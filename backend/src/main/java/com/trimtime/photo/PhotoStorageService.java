package com.trimtime.photo;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.*;

@Service
public class PhotoStorageService {
    private static final Logger log = LoggerFactory.getLogger(PhotoStorageService.class);

    private final String configuredDir;
    private Path baseDirectory;

    public PhotoStorageService(@Value("${trimtime.storage.photos-dir:/app/storage/photos}") String configuredDir) {
        this.configuredDir = configuredDir;
    }

    @PostConstruct
    public void init() {
        Path preferred = Path.of(configuredDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(preferred);
            baseDirectory = preferred;
            log.info("Initialized photo storage at {}", baseDirectory);
        } catch (Exception ex) {
            Path fallback = Path.of(System.getProperty("java.io.tmpdir"), "trimtime-photos").toAbsolutePath().normalize();
            try {
                Files.createDirectories(fallback);
                baseDirectory = fallback;
                log.warn("Failed to initialize storage at {}. Using fallback at {}", preferred, fallback);
            } catch (IOException e) {
                throw new UncheckedIOException("Unable to initialize photo storage directory", e);
            }
        }
    }

    public record ValidatedFormat(String contentType, String extension) {}

    public ValidatedFormat detectAndValidateFormat(byte[] bytes) {
        if (bytes == null || bytes.length < 12) {
            throw new PhotoService.UnsupportedMediaTypeException("File is empty or unrecognized format.");
        }
        if (bytes[0] == (byte) 0xFF && bytes[1] == (byte) 0xD8 && bytes[2] == (byte) 0xFF) {
            return new ValidatedFormat("image/jpeg", ".jpg");
        }
        if (bytes[0] == (byte) 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47
                && bytes[4] == 0x0D && bytes[5] == 0x0A && bytes[6] == 0x1A && bytes[7] == 0x0A) {
            return new ValidatedFormat("image/png", ".png");
        }
        if (bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') {
            return new ValidatedFormat("image/webp", ".webp");
        }
        throw new PhotoService.UnsupportedMediaTypeException("Only JPEG, PNG, and WebP images are allowed.");
    }

    public void save(String storageKey, byte[] data) {
        Path target = resolveSafe(storageKey);
        try {
            Files.write(target, data, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to write photo bytes to storage", e);
        }
    }

    public byte[] read(String storageKey) {
        Path target = resolveSafe(storageKey);
        if (!Files.exists(target)) {
            throw new PhotoService.PhotoNotFoundException();
        }
        try {
            return Files.readAllBytes(target);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read photo bytes from storage", e);
        }
    }

    public void delete(String storageKey) {
        try {
            Path target = resolveSafe(storageKey);
            Files.deleteIfExists(target);
        } catch (Exception ex) {
            log.warn("Failed to delete photo file {}: {}", storageKey, ex.getMessage());
        }
    }

    private Path resolveSafe(String storageKey) {
        if (storageKey == null || storageKey.isBlank() || storageKey.contains("..") || storageKey.contains("/") || storageKey.contains("\\")) {
            throw new SecurityException("Invalid storage key");
        }
        Path target = baseDirectory.resolve(storageKey).normalize();
        if (!target.startsWith(baseDirectory)) {
            throw new SecurityException("Path traversal attempt detected");
        }
        return target;
    }
}
