package com.trimtime.barber;
import org.springframework.data.jpa.repository.*; import org.springframework.data.repository.query.Param; import java.util.*;
public interface BarberJoinRequestRepository extends JpaRepository<BarberJoinRequest,Long> {
 boolean existsByBarberIdAndStatus(Long barberId,BarberStatus status);
 @Query("select r.salon.id from BarberJoinRequest r where r.id=:id")
 Optional<Long> findSalonIdById(@Param("id") Long id);
 @Query("select r.barber.id from BarberJoinRequest r where r.id=:id")
 Optional<Long> findBarberIdById(@Param("id") Long id);
 List<BarberJoinRequest> findByBarberIdOrderByCreatedAtDesc(Long barberId);
 List<BarberJoinRequest> findBySalonIdAndStatusOrderByCreatedAtAsc(Long salonId,BarberStatus status);
}
