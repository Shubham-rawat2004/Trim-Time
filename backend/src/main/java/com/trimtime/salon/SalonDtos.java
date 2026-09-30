package com.trimtime.salon;
import jakarta.validation.constraints.*;
public final class SalonDtos {
 private SalonDtos(){}
 public record SalonRequest(@NotBlank @Size(max=160) String name,@Size(max=2000) String description,@NotBlank @Size(max=500) String address,@NotBlank @Size(max=120) String contact,@DecimalMin("-90") @DecimalMax("90") Double latitude,@DecimalMin("-180") @DecimalMax("180") Double longitude,@NotBlank @Size(max=64) String timezone,Integer slotIncrementMinutes,Integer bookingHorizonDays){
     public SalonRequest(String name, String description, String address, String contact, Double latitude, Double longitude, String timezone) {
         this(name, description, address, contact, latitude, longitude, timezone, null, 7);
     }
 }
 public record SalonResponse(Long id,Long ownerId,String name,String description,String address,String contact,Double latitude,Double longitude,String timezone,Integer slotIncrementMinutes,int bookingHorizonDays){ static SalonResponse from(Salon salon){return new SalonResponse(salon.getId(),salon.getOwner().getId(),salon.getName(),salon.getDescription(),salon.getAddress(),salon.getContact(),salon.getLatitude(),salon.getLongitude(),salon.getTimezone(),salon.getSlotIncrementMinutes(),salon.getBookingHorizonDays());} }
 public record DirectoryResponse(Long id,String name,String description,String address,String contact,String ownerName,Double latitude,Double longitude,Double distanceKm,Integer slotIncrementMinutes,int bookingHorizonDays){ static DirectoryResponse from(Salon salon,Double distanceKm){return new DirectoryResponse(salon.getId(),salon.getName(),salon.getDescription(),salon.getAddress(),salon.getContact(),salon.getOwner().getDisplayName(),salon.getLatitude(),salon.getLongitude(),distanceKm,salon.getSlotIncrementMinutes(),salon.getBookingHorizonDays());} }
}
