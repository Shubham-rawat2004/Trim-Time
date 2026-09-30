package com.trimtime.photo;

import com.trimtime.salon.Salon;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "salon_photos")
public class SalonPhoto {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "salon_id", nullable = false)
    private Salon salon;

    @Column(name = "storage_key", nullable = false, unique = true, length = 120)
    private String storageKey;

    @Column(name = "content_type", nullable = false, length = 64)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected SalonPhoto() {}

    public SalonPhoto(Salon salon, String storageKey, String contentType, long sizeBytes, int displayOrder) {
        this.salon = salon;
        this.storageKey = storageKey;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.displayOrder = displayOrder;
    }

    public Long getId() { return id; }
    public Salon getSalon() { return salon; }
    public String getStorageKey() { return storageKey; }
    public String getContentType() { return contentType; }
    public long getSizeBytes() { return sizeBytes; }
    public int getDisplayOrder() { return displayOrder; }
    public Instant getCreatedAt() { return createdAt; }
    public void setDisplayOrder(int displayOrder) { this.displayOrder = displayOrder; }
}
