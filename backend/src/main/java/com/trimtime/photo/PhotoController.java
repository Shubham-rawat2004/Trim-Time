package com.trimtime.photo;

import com.trimtime.identity.SessionAuthenticationFilter;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api")
public class PhotoController {
    private final PhotoService photoService;

    public PhotoController(PhotoService photoService) {
        this.photoService = photoService;
    }

    private Long current() {
        return ((SessionAuthenticationFilter.UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal()).id();
    }

    @PreAuthorize("hasRole('SALON_OWNER')")
    @PostMapping(value = "/salons/mine/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PhotoDtos.PhotoResponse> uploadPhoto(@RequestParam("file") MultipartFile file) {
        SalonPhoto photo = photoService.uploadPhoto(current(), file);
        return ResponseEntity.status(HttpStatus.CREATED).body(PhotoDtos.PhotoResponse.from(photo));
    }

    @PreAuthorize("hasRole('SALON_OWNER')")
    @GetMapping("/salons/mine/photos")
    public List<PhotoDtos.PhotoResponse> listMyPhotos() {
        return photoService.listPhotosForOwner(current()).stream()
                .map(PhotoDtos.PhotoResponse::from)
                .toList();
    }

    @GetMapping("/salons/{salonId}/photos")
    public List<PhotoDtos.PhotoResponse> listPhotos(@PathVariable Long salonId) {
        return photoService.listPhotos(salonId).stream()
                .map(PhotoDtos.PhotoResponse::from)
                .toList();
    }

    @GetMapping("/salons/{salonId}/photos/{photoId}")
    public ResponseEntity<byte[]> getPhoto(@PathVariable Long salonId, @PathVariable Long photoId) {
        PhotoService.PhotoData data = photoService.getPhotoData(salonId, photoId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(data.contentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .body(data.bytes());
    }

    @PreAuthorize("hasRole('SALON_OWNER')")
    @DeleteMapping("/salons/mine/photos/{photoId}")
    public ResponseEntity<Void> deletePhoto(@PathVariable Long photoId) {
        photoService.deletePhoto(current(), photoId);
        return ResponseEntity.noContent().build();
    }
}
