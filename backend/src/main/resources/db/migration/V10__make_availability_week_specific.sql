ALTER TABLE barber_working_hours
    ADD COLUMN week_start_date DATE NULL;

UPDATE barber_working_hours
SET week_start_date = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
WHERE week_start_date IS NULL;

ALTER TABLE barber_working_hours
    MODIFY week_start_date DATE NOT NULL,
    DROP INDEX uq_hours_barber_day,
    ADD CONSTRAINT uk_barber_week_day UNIQUE (barber_user_id, week_start_date, day_of_week);
