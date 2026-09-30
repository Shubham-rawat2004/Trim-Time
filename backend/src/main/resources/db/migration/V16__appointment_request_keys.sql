ALTER TABLE appointments
    ADD COLUMN request_key VARCHAR(100) NULL AFTER booking_reference,
    ADD COLUMN request_fingerprint CHAR(64) NULL AFTER request_key,
    ADD CONSTRAINT uq_appointments_customer_request UNIQUE (customer_user_id, request_key);
