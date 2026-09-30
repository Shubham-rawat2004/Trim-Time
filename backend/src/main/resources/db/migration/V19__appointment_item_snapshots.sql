CREATE TABLE appointment_items (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    appointment_id BIGINT NOT NULL,
    item_kind VARCHAR(16) NOT NULL,
    catalogue_item_id BIGINT NOT NULL,
    name_snapshot VARCHAR(160) NOT NULL,
    price_snapshot DECIMAL(10,2) NOT NULL,
    duration_minutes_snapshot INT NOT NULL,
    display_order INT NOT NULL,
    CONSTRAINT fk_appointment_items_appointment
        FOREIGN KEY (appointment_id) REFERENCES appointments(id),
    CONSTRAINT uq_appointment_items_order UNIQUE (appointment_id, display_order),
    CONSTRAINT chk_appointment_items_kind CHECK (item_kind IN ('SERVICE', 'ADD_ON')),
    CONSTRAINT chk_appointment_items_price CHECK (price_snapshot >= 0),
    CONSTRAINT chk_appointment_items_duration CHECK (duration_minutes_snapshot > 0),
    CONSTRAINT chk_appointment_items_order CHECK (display_order >= 0),
    INDEX ix_appointment_items_appointment (appointment_id)
) ENGINE=InnoDB;

-- Historical comma-separated summaries cannot be split safely because catalogue names may
-- contain commas and may have changed. V19 deliberately snapshots only new appointments.
