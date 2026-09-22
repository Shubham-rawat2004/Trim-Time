package com.trimtime.availability;
import org.springframework.data.jpa.repository.JpaRepository; import java.util.*;
public interface WorkingHourRepository extends JpaRepository<WorkingHour,Long>{List<WorkingHour> findByBarberIdAndWeekStartDateOrderByDayOfWeekAsc(Long barberId,java.time.LocalDate weekStartDate); Optional<WorkingHour> findByBarberIdAndWeekStartDateAndDayOfWeek(Long barberId,java.time.LocalDate weekStartDate,int day); boolean existsByBarberIdAndWeekStartDateAndDayOfWeek(Long barberId,java.time.LocalDate weekStartDate,int day);}
