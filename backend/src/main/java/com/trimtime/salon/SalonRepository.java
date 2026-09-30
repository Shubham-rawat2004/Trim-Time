package com.trimtime.salon;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface SalonRepository extends JpaRepository<Salon,Long> {
 Optional<Salon> findByOwnerId(Long ownerId);
 boolean existsByOwnerId(Long ownerId);
 List<Salon> findByActiveTrueOrderByNameAsc();
 @Query("select s.id from Salon s where s.owner.id = :ownerId")
 Optional<Long> findIdByOwnerId(@Param("ownerId") Long ownerId);
 // Lock only the salon row, without loading eager owner relationships before the lock.
 @Query(value = "SELECT id FROM salons WHERE id = :id FOR UPDATE", nativeQuery = true)
 Optional<Long> lockId(@Param("id") Long id);
}
