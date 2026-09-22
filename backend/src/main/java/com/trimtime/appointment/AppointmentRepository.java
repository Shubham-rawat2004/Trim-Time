package com.trimtime.appointment;
import org.springframework.data.jpa.repository.*; import org.springframework.data.repository.query.Param; import jakarta.persistence.LockModeType; import java.time.*; import java.util.*;
public interface AppointmentRepository extends JpaRepository<Appointment,Long>{
 @Query("select a from Appointment a where a.barber.id=:barberId and a.status in :statuses and a.startAt < :endAt and a.endAt > :startAt") List<Appointment> findOverlapping(@Param("barberId") Long barberId,@Param("startAt") LocalDateTime startAt,@Param("endAt") LocalDateTime endAt,@Param("statuses") Collection<AppointmentStatus> statuses);
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select a from Appointment a where a.barber.id=:barberId and a.status in :statuses and a.startAt < :endAt and a.endAt > :startAt") List<Appointment> findOverlappingForUpdate(@Param("barberId") Long barberId,@Param("startAt") LocalDateTime startAt,@Param("endAt") LocalDateTime endAt,@Param("statuses") Collection<AppointmentStatus> statuses);
 List<Appointment> findByCustomerIdOrderByStartAtDesc(Long customerId);
}
