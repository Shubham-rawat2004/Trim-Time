package com.trimtime.barber;
import org.springframework.data.jpa.repository.JpaRepository; import java.util.*;
public interface BarberServiceQualificationRepository extends JpaRepository<BarberServiceQualification,Long>{List<BarberServiceQualification> findByBarberId(Long barberId); boolean existsByBarberIdAndServiceId(Long barberId,Long serviceId); void deleteByBarberId(Long barberId);}
