package com.trimtime.catalogue;
import org.springframework.data.jpa.repository.JpaRepository; import java.util.*;
public interface ServiceOfferingRepository extends JpaRepository<ServiceOffering,Long> { List<ServiceOffering> findBySalonIdAndActiveTrueOrderByNameAsc(Long salonId); List<ServiceOffering> findBySalonIdOrderByNameAsc(Long salonId); Optional<ServiceOffering> findByIdAndSalonId(Long id,Long salonId); }
