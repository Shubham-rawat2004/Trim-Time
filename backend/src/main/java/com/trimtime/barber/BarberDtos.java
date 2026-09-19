package com.trimtime.barber;
import jakarta.validation.constraints.*; import java.time.Instant;
public final class BarberDtos { private BarberDtos(){}
 public record ApplyRequest(@Size(max=1000) String message,@Size(max=1000) String bio,@Min(0) @Max(80) Integer experienceYears){}
 public record RequestResponse(Long id,Long barberUserId,String barberName,Long salonId,String salonName,String message,BarberStatus status,Instant createdAt){ static RequestResponse from(BarberJoinRequest r){return new RequestResponse(r.getId(),r.getBarber().getId(),r.getBarber().getDisplayName(),r.getSalon().getId(),r.getSalon().getName(),r.getMessage(),r.getStatus(),r.getCreatedAt());} }
 public record MembershipResponse(Long id,Long barberUserId,Long salonId,String salonName){ static MembershipResponse from(BarberMembership m){return new MembershipResponse(m.getId(),m.getBarber().getId(),m.getSalon().getId(),m.getSalon().getName());} }
}
