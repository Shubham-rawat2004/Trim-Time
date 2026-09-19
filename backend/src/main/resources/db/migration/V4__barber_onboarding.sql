CREATE TABLE barber_profiles (
    user_id BIGINT NOT NULL PRIMARY KEY,
    bio VARCHAR(1000),
    experience_years INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_barber_profiles_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE barber_join_requests (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    barber_user_id BIGINT NOT NULL,
    salon_id BIGINT NOT NULL,
    message VARCHAR(1000),
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    decided_at TIMESTAMP(6) NULL,
    CONSTRAINT fk_join_requests_barber FOREIGN KEY (barber_user_id) REFERENCES users(id),
    CONSTRAINT fk_join_requests_salon FOREIGN KEY (salon_id) REFERENCES salons(id),
    CONSTRAINT chk_join_requests_status CHECK (status IN ('PENDING','APPROVED','REJECTED','WITHDRAWN')),
    INDEX ix_join_requests_salon_status (salon_id, status),
    INDEX ix_join_requests_barber_status (barber_user_id, status)
) ENGINE=InnoDB;

CREATE TABLE barber_memberships (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    barber_user_id BIGINT NOT NULL UNIQUE,
    salon_id BIGINT NOT NULL,
    approved_by_user_id BIGINT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_memberships_barber FOREIGN KEY (barber_user_id) REFERENCES users(id),
    CONSTRAINT fk_memberships_salon FOREIGN KEY (salon_id) REFERENCES salons(id),
    CONSTRAINT fk_memberships_approver FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB;
