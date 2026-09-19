package com.trimtime.barber;
import org.springframework.data.jpa.repository.JpaRepository; import java.util.*;
public interface BarberMembershipRepository extends JpaRepository<BarberMembership,Long> { boolean existsByBarberId(Long barberId); Optional<BarberMembership> findByBarberId(Long barberId); }
