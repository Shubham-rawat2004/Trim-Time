package com.trimtime.salon;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface SalonRepository extends JpaRepository<Salon,Long> { Optional<Salon> findByOwnerId(Long ownerId); boolean existsByOwnerId(Long ownerId); List<Salon> findByActiveTrueOrderByNameAsc(); }
