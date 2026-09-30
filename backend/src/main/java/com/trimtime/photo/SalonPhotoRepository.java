package com.trimtime.photo;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface SalonPhotoRepository extends JpaRepository<SalonPhoto, Long> {
    List<SalonPhoto> findBySalonIdOrderByDisplayOrderAscCreatedAtAsc(Long salonId);
    Optional<SalonPhoto> findByIdAndSalonId(Long id, Long salonId);
    long countBySalonId(Long salonId);
}
