package com.trimtime.availability;

import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface BarberBreakRepository extends JpaRepository<BarberBreak, Long> {
    List<BarberBreak> findByBarberIdAndWeekStartDateOrderByDayOfWeekAscStartTimeAsc(Long barberId, LocalDate weekStartDate);
    List<BarberBreak> findByBarberIdAndWeekStartDateAndDayOfWeekOrderByStartTimeAsc(Long barberId, LocalDate weekStartDate, int dayOfWeek);
    Optional<BarberBreak> findByIdAndBarberId(Long id, Long barberId);
}
