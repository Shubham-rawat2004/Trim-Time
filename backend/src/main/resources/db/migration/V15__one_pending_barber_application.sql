-- NULL values allow historical terminal requests; only PENDING applicants must be unique.
-- If legacy duplicates exist, this atomic ALTER fails rather than silently deciding/withdrawing requests.
ALTER TABLE barber_join_requests
    ADD COLUMN pending_barber_user_id BIGINT
        GENERATED ALWAYS AS (CASE WHEN status = 'PENDING' THEN barber_user_id ELSE NULL END) STORED,
    ADD CONSTRAINT uq_join_requests_pending_barber UNIQUE (pending_barber_user_id);
