CREATE TABLE barber_services (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    barber_user_id BIGINT NOT NULL,
    service_id BIGINT NOT NULL,
    CONSTRAINT fk_barber_services_barber FOREIGN KEY (barber_user_id) REFERENCES users(id),
    CONSTRAINT fk_barber_services_service FOREIGN KEY (service_id) REFERENCES salon_services(id),
    CONSTRAINT uq_barber_service UNIQUE (barber_user_id, service_id)
) ENGINE=InnoDB;

INSERT INTO barber_services (barber_user_id, service_id)
SELECT m.barber_user_id, s.id
FROM barber_memberships m
JOIN salon_services s ON s.salon_id = m.salon_id AND s.active = TRUE;
