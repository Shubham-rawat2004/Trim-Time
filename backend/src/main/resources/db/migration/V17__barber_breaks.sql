CREATE TABLE barber_breaks (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    barber_user_id BIGINT NOT NULL,
    week_start_date DATE NOT NULL,
    day_of_week INT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    CONSTRAINT fk_breaks_barber FOREIGN KEY (barber_user_id) REFERENCES users(id),
    CONSTRAINT uq_breaks_exact UNIQUE (barber_user_id, week_start_date, day_of_week, start_time, end_time),
    CONSTRAINT chk_breaks_day CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT chk_breaks_order CHECK (start_time < end_time),
    INDEX ix_breaks_barber_week_day (barber_user_id, week_start_date, day_of_week, start_time)
) ENGINE=InnoDB;
