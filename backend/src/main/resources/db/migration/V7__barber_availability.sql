CREATE TABLE barber_working_hours (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    barber_user_id BIGINT NOT NULL,
    day_of_week TINYINT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    CONSTRAINT fk_hours_barber FOREIGN KEY (barber_user_id) REFERENCES users(id),
    CONSTRAINT uq_hours_barber_day UNIQUE (barber_user_id, day_of_week),
    CONSTRAINT chk_hours_day CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT chk_hours_order CHECK (start_time < end_time)
) ENGINE=InnoDB;
CREATE TABLE barber_days_off (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    barber_user_id BIGINT NOT NULL,
    off_date DATE NOT NULL,
    reason VARCHAR(255),
    CONSTRAINT fk_days_off_barber FOREIGN KEY (barber_user_id) REFERENCES users(id),
    CONSTRAINT uq_days_off_barber_date UNIQUE (barber_user_id, off_date)
) ENGINE=InnoDB;
