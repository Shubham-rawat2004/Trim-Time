package com.trimtime.photo;

import java.time.Instant;

public final class PhotoDtos {
    private PhotoDtos() {}

    public record PhotoResponse(
            Long id,
            Long salonId,
            String url,
            String contentType,
            long sizeBytes,
            int displayOrder,
            Instant createdAt
    ) {
        public static PhotoResponse from(SalonPhoto photo) {
            String url = "/api/salons/" + photo.getSalon().getId() + "/photos/" + photo.getId();
            return new PhotoResponse(
                    photo.getId(),
                    photo.getSalon().getId(),
                    url,
                    photo.getContentType(),
                    photo.getSizeBytes(),
                    photo.getDisplayOrder(),
                    photo.getCreatedAt()
            );
        }
    }
}
