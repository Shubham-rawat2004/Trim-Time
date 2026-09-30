CREATE TABLE salon_photos (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    salon_id BIGINT NOT NULL,
    storage_key VARCHAR(120) NOT NULL,
    content_type VARCHAR(64) NOT NULL,
    size_bytes BIGINT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_salon_photos_salon FOREIGN KEY (salon_id) REFERENCES salons(id),
    CONSTRAINT uq_salon_photos_storage UNIQUE (storage_key),
    INDEX ix_salon_photos_salon_order (salon_id, display_order)
) ENGINE=InnoDB;
