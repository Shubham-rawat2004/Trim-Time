package com.trimtime.availability;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.*;

public interface WorkingHourRepository extends JpaRepository<WorkingHour,Long> {
    List<WorkingHour> findByBarberIdAndWeekStartDateOrderByDayOfWeekAsc(Long barberId, LocalDate weekStartDate);
    Optional<WorkingHour> findByBarberIdAndWeekStartDateAndDayOfWeek(Long barberId, LocalDate weekStartDate, int day);
    boolean existsByBarberIdAndWeekStartDateAndDayOfWeek(Long barberId, LocalDate weekStartDate, int day);
}
