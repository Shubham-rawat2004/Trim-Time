package com.trimtime.photo;

import com.trimtime.identity.Role;
import com.trimtime.identity.UserAccount;
import com.trimtime.identity.UserAccountRepository;
import com.trimtime.salon.Salon;
import com.trimtime.salon.SalonRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
@SpringBootTest
class SalonPhotoIT {
    @Container
    static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4.8");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
    }

    @Autowired PhotoService photoService;
    @Autowired SalonPhotoRepository photos;
    @Autowired SalonRepository salons;
    @Autowired UserAccountRepository users;
    @Autowired PlatformTransactionManager transactions;

    Long firstOwner, secondOwner, firstSalon, secondSalon;

    // Standard valid JPEG header bytes: FF D8 FF E0 00 10 4A 46 49 46 00 01
    static final byte[] JPEG_BYTES = new byte[] {
            (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0,
            0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01
    };

    // Standard valid PNG header bytes: 89 50 4E 47 0D 0A 1A 0A 00 00 00 0D
    static final byte[] PNG_BYTES = new byte[] {
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D
    };

    @BeforeEach
    void setup() {
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            var owner1 = users.save(new UserAccount(UUID.randomUUID() + "@example.test", "hash", "Owner 1"));
            var owner2 = users.save(new UserAccount(UUID.randomUUID() + "@example.test", "hash", "Owner 2"));
            owner1.addRole(Role.SALON_OWNER);
            owner2.addRole(Role.SALON_OWNER);
            users.save(owner1);
            users.save(owner2);
            firstOwner = owner1.getId();
            secondOwner = owner2.getId();
            firstSalon = salons.save(new Salon(owner1, "First Salon", "", "Address 1", "Contact 1", null, null, "Asia/Kolkata")).getId();
            secondSalon = salons.save(new Salon(owner2, "Second Salon", "", "Address 2", "Contact 2", null, null, "Asia/Kolkata")).getId();
        });
    }

    @Test
    void ownerCanUploadValidPhotoAndRetrieveIt() {
        var file = new MockMultipartFile("file", "test.jpg", "image/jpeg", JPEG_BYTES);
        var uploaded = photoService.uploadPhoto(firstOwner, file);

        assertNotNull(uploaded);
        assertEquals("image/jpeg", uploaded.getContentType());
        assertEquals(JPEG_BYTES.length, uploaded.getSizeBytes());

        var list = photoService.listPhotos(firstSalon);
        assertEquals(1, list.size());
        assertEquals(uploaded.getId(), list.get(0).getId());

        var data = photoService.getPhotoData(firstSalon, uploaded.getId());
        assertEquals("image/jpeg", data.contentType());
        assertArrayEquals(JPEG_BYTES, data.bytes());
    }

    @Test
    void rejectsUploadWithInvalidMagicBytes() {
        // Pretends to be jpeg by filename and content type, but content is malicious/text
        var fakeFile = new MockMultipartFile("file", "malicious.jpg", "image/jpeg", "NOT_AN_IMAGE_FILE".getBytes());
        assertThrows(PhotoService.UnsupportedMediaTypeException.class,
                () -> photoService.uploadPhoto(firstOwner, fakeFile));
    }

    @Test
    void rejectsUploadExceedingMaxPhotos() {
        for (int i = 0; i < 10; i++) {
            var file = new MockMultipartFile("file", "photo" + i + ".png", "image/png", PNG_BYTES);
            photoService.uploadPhoto(firstOwner, file);
        }

        assertEquals(10, photoService.listPhotos(firstSalon).size());

        var extraFile = new MockMultipartFile("file", "extra.jpg", "image/jpeg", JPEG_BYTES);
        assertThrows(PhotoService.MaxPhotosExceededException.class,
                () -> photoService.uploadPhoto(firstOwner, extraFile));
    }

    @Test
    void ownerCanDeletePhotoAndWrongOwnerCannotDeleteIt() {
        var file = new MockMultipartFile("file", "photo.png", "image/png", PNG_BYTES);
        var uploaded = photoService.uploadPhoto(firstOwner, file);

        // Owner 2 cannot delete Owner 1's photo
        assertThrows(PhotoService.PhotoNotFoundException.class,
                () -> photoService.deletePhoto(secondOwner, uploaded.getId()));

        // Owner 1 deletes photo
        photoService.deletePhoto(firstOwner, uploaded.getId());

        assertEquals(0, photoService.listPhotos(firstSalon).size());
        assertThrows(PhotoService.PhotoNotFoundException.class,
                () -> photoService.getPhotoData(firstSalon, uploaded.getId()));
    }
}
