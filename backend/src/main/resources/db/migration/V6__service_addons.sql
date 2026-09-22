CREATE TABLE salon_addons (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    salon_id BIGINT NOT NULL,
    name VARCHAR(160) NOT NULL,
    description VARCHAR(1000),
    price DECIMAL(10,2) NOT NULL,
    duration_minutes INT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_addons_salon FOREIGN KEY (salon_id) REFERENCES salons(id),
    CONSTRAINT uq_addons_salon_name UNIQUE (salon_id, name),
    CONSTRAINT chk_addons_price CHECK (price >= 0),
    CONSTRAINT chk_addons_duration CHECK (duration_minutes BETWEEN 1 AND 240)
) ENGINE=InnoDB;
CREATE TABLE service_addons (
    service_id BIGINT NOT NULL,
    addon_id BIGINT NOT NULL,
    PRIMARY KEY (service_id, addon_id),
    CONSTRAINT fk_service_addons_service FOREIGN KEY (service_id) REFERENCES salon_services(id),
    CONSTRAINT fk_service_addons_addon FOREIGN KEY (addon_id) REFERENCES salon_addons(id)
) ENGINE=InnoDB;
