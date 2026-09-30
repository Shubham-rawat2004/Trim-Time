package com.trimtime.photo;

import com.trimtime.appointment.BookingWriteLock;
import com.trimtime.salon.Salon;
import com.trimtime.salon.SalonRepository;
import com.trimtime.salon.SalonService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Service
public class PhotoService {
    public static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    public static final int MAX_PHOTOS_PER_SALON = 10;

    private final SalonRepository salons;
    private final SalonPhotoRepository photos;
    private final PhotoStorageService storage;
    private final BookingWriteLock locks;

    public PhotoService(SalonRepository salons, SalonPhotoRepository photos,
                        PhotoStorageService storage, BookingWriteLock locks) {
        this.salons = salons;
        this.photos = photos;
        this.storage = storage;
        this.locks = locks;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public SalonPhoto uploadPhoto(Long ownerId, MultipartFile file) {
        Long salonId = locks.owner(ownerId);
        Salon salon = salons.findById(salonId).orElseThrow(SalonService.SalonNotFoundException::new);

        if (file == null || file.isEmpty()) {
            throw new InvalidPhotoException("Photo file cannot be empty.");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new InvalidPhotoException("Photo file size cannot exceed 5 MB.");
        }
        if (photos.countBySalonId(salonId) >= MAX_PHOTOS_PER_SALON) {
            throw new MaxPhotosExceededException("A salon cannot have more than " + MAX_PHOTOS_PER_SALON + " photos.");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new InvalidPhotoException("Failed to read photo content.");
        }

        var validated = storage.detectAndValidateFormat(bytes);
        String storageKey = salonId + "_" + UUID.randomUUID() + validated.extension();

        storage.save(storageKey, bytes);

        int nextOrder = (int) photos.countBySalonId(salonId);
        SalonPhoto salonPhoto = new SalonPhoto(salon, storageKey, validated.contentType(), bytes.length, nextOrder);
        return photos.save(salonPhoto);
    }

    @Transactional(readOnly = true)
    public List<SalonPhoto> listPhotos(Long salonId) {
        if (!salons.existsById(salonId)) {
            throw new SalonService.SalonNotFoundException();
        }
        return photos.findBySalonIdOrderByDisplayOrderAscCreatedAtAsc(salonId);
    }

    @Transactional(readOnly = true)
    public List<SalonPhoto> listPhotosForOwner(Long ownerId) {
        Long salonId = salons.findIdByOwnerId(ownerId).orElseThrow(SalonService.SalonNotFoundException::new);
        return photos.findBySalonIdOrderByDisplayOrderAscCreatedAtAsc(salonId);
    }

    @Transactional(readOnly = true)
    public PhotoData getPhotoData(Long salonId, Long photoId) {
        SalonPhoto photo = photos.findByIdAndSalonId(photoId, salonId)
                .orElseThrow(PhotoNotFoundException::new);
        byte[] bytes = storage.read(photo.getStorageKey());
        return new PhotoData(photo.getContentType(), bytes);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void deletePhoto(Long ownerId, Long photoId) {
        Long salonId = locks.owner(ownerId);
        SalonPhoto photo = photos.findByIdAndSalonId(photoId, salonId)
                .orElseThrow(PhotoNotFoundException::new);

        photos.delete(photo);
        storage.delete(photo.getStorageKey());
    }

    public record PhotoData(String contentType, byte[] bytes) {}

    public static class InvalidPhotoException extends RuntimeException {
        public InvalidPhotoException(String message) { super(message); }
    }
    public static class UnsupportedMediaTypeException extends RuntimeException {
        public UnsupportedMediaTypeException(String message) { super(message); }
    }
    public static class MaxPhotosExceededException extends RuntimeException {
        public MaxPhotosExceededException(String message) { super(message); }
    }
    public static class PhotoNotFoundException extends RuntimeException {}
}
