package com.trimtime.barber;
import org.springframework.data.jpa.repository.*; import java.util.*;
public interface BarberJoinRequestRepository extends JpaRepository<BarberJoinRequest,Long> {
 Optional<BarberJoinRequest> findByBarberIdAndSalonIdAndStatus(Long barberId,Long salonId,BarberStatus status);
 List<BarberJoinRequest> findByBarberIdOrderByCreatedAtDesc(Long barberId);
 List<BarberJoinRequest> findBySalonIdAndStatusOrderByCreatedAtAsc(Long salonId,BarberStatus status);
}
