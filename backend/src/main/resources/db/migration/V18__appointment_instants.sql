ALTER TABLE appointments
    ADD COLUMN start_instant TIMESTAMP(6) NULL AFTER end_at,
    ADD COLUMN end_instant TIMESTAMP(6) NULL AFTER start_instant,
    ADD COLUMN salon_timezone VARCHAR(64) NULL AFTER end_instant;

-- Existing rows retain their original local wall times. Their historical timezone cannot be
-- reconstructed safely if a salon timezone changed, so V18 deliberately does not guess it.
