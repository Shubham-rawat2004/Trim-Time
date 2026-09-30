ALTER TABLE salons
    ADD COLUMN slot_increment_minutes INT NULL,
    ADD COLUMN booking_horizon_days INT NOT NULL DEFAULT 30;
