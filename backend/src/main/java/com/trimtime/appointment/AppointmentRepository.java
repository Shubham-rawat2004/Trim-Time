package com.trimtime.appointment;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.time.*;
import java.util.*;

public interface AppointmentRepository extends JpaRepository<Appointment, Long> {
    @Query("select a from Appointment a where a.barber.id=:barberId and a.status in :statuses and a.startAt < :endAt and a.endAt > :startAt")
    List<Appointment> findOverlapping(@Param("barberId") Long barberId, @Param("startAt") LocalDateTime startAt, @Param("endAt") LocalDateTime endAt, @Param("statuses") Collection<AppointmentStatus> statuses);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Appointment a where a.barber.id=:barberId and a.status in :statuses and a.startAt < :endAt and a.endAt > :startAt")
    List<Appointment> findOverlappingForUpdate(@Param("barberId") Long barberId, @Param("startAt") LocalDateTime startAt, @Param("endAt") LocalDateTime endAt, @Param("statuses") Collection<AppointmentStatus> statuses);

    @Query("select a from Appointment a where a.barber.id=:barberId and a.status in :statuses and a.endAt > :now")
    List<Appointment> findUnfinished(@Param("barberId") Long barberId, @Param("now") LocalDateTime now, @Param("statuses") Collection<AppointmentStatus> statuses);

    List<Appointment> findByCustomerIdOrderByStartAtDesc(Long customerId);

    Page<Appointment> findByCustomerIdOrderByStartAtDesc(Long customerId, Pageable pageable);

    Page<Appointment> findByCustomerIdAndStatusOrderByStartAtDesc(Long customerId, AppointmentStatus status, Pageable pageable);

    Optional<Appointment> findByCustomerIdAndRequestKey(Long customerId, String requestKey);

    Optional<Appointment> findByBookingReference(String bookingReference);

    List<Appointment> findBySalonIdAndStatusIn(Long salonId, Collection<AppointmentStatus> statuses);

    List<Appointment> findByBarberIdOrderByStartAtAsc(Long barberId);

    List<Appointment> findByBarberIdAndStartAtBetweenOrderByStartAtAsc(Long barberId, LocalDateTime start, LocalDateTime end);

    List<Appointment> findBySalonIdOrderByStartAtAsc(Long salonId);

    List<Appointment> findBySalonIdAndStartAtBetweenOrderByStartAtAsc(Long salonId, LocalDateTime start, LocalDateTime end);
}
