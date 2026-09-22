package com.trimtime.catalogue;
import org.springframework.data.jpa.repository.JpaRepository; import java.util.*;
public interface AddOnRepository extends JpaRepository<AddOn,Long> { List<AddOn> findBySalonIdOrderByNameAsc(Long salonId); Optional<AddOn> findByIdAndSalonId(Long id,Long salonId); }
