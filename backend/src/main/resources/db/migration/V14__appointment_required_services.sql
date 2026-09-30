-- Older appointments have name summaries only. Do not guess IDs from mutable names.
CREATE TABLE appointment_required_services (
    appointment_id BIGINT NOT NULL,
    service_id BIGINT NOT NULL,
    PRIMARY KEY (appointment_id, service_id),
    CONSTRAINT fk_required_service_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id),
    CONSTRAINT fk_required_service_catalogue FOREIGN KEY (service_id) REFERENCES salon_services(id)
) ENGINE=InnoDB;
