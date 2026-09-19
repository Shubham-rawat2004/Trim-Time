CREATE TABLE salon_services (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    salon_id BIGINT NOT NULL,
    name VARCHAR(160) NOT NULL,
    description VARCHAR(1000),
    price DECIMAL(10,2) NOT NULL,
    duration_minutes INT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_services_salon FOREIGN KEY (salon_id) REFERENCES salons(id),
    CONSTRAINT uq_services_salon_name UNIQUE (salon_id, name),
    CONSTRAINT chk_services_price CHECK (price >= 0),
    CONSTRAINT chk_services_duration CHECK (duration_minutes BETWEEN 5 AND 480)
) ENGINE=InnoDB;
