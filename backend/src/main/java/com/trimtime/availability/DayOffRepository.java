package com.trimtime.availability;
import org.springframework.data.jpa.repository.JpaRepository; import java.util.*;
public interface DayOffRepository extends JpaRepository<DayOff,Long>{List<DayOff> findByBarberIdAndDateGreaterThanEqualOrderByDateAsc(Long barberId,java.time.LocalDate date); Optional<DayOff> findByBarberIdAndDate(Long barberId,java.time.LocalDate date); Optional<DayOff> findByIdAndBarberId(Long id,Long barberId);}
