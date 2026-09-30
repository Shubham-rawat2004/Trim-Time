package com.trimtime.salon;
import com.trimtime.appointment.AppointmentProtection; import com.trimtime.appointment.BookingWriteLock; import org.springframework.transaction.annotation.Isolation; import com.trimtime.identity.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.List;
import java.util.Comparator;
@Service public class SalonService {
 private final BookingWriteLock locks; private final AppointmentProtection protection; private final SalonRepository salons; private final UserAccountRepository users;
 public SalonService(SalonRepository salons,UserAccountRepository users,BookingWriteLock locks,AppointmentProtection protection){this.locks=locks;this.protection=protection;this.salons=salons;this.users=users;}
 @Transactional public Salon create(Long ownerId,SalonDtos.SalonRequest request){validateCoordinates(request);validateSettings(request.slotIncrementMinutes(),request.bookingHorizonDays());var owner=users.findById(ownerId).orElseThrow();if(salons.existsByOwnerId(ownerId))throw new SalonAlreadyExistsException();owner.addRole(Role.SALON_OWNER);return salons.save(new Salon(owner,request.name().trim(),request.description(),request.address().trim(),request.contact().trim(),request.latitude(),request.longitude(),request.timezone().trim(),request.slotIncrementMinutes(),request.bookingHorizonDays()));}
 @Transactional(readOnly=true) public Salon getOwned(Long ownerId){return salons.findByOwnerId(ownerId).orElseThrow(SalonNotFoundException::new);}
 @Transactional(isolation=Isolation.READ_COMMITTED) public Salon update(Long ownerId,SalonDtos.SalonRequest request){locks.owner(ownerId);validateCoordinates(request);validateSettings(request.slotIncrementMinutes(),request.bookingHorizonDays());var salon=getOwned(ownerId);var timezone=request.timezone().trim();protection.timezoneChange(salon,timezone);salon.update(request.name().trim(),request.description(),request.address().trim(),request.contact().trim(),request.latitude(),request.longitude(),timezone,request.slotIncrementMinutes(),request.bookingHorizonDays());return salon;}
 private static void validateSettings(Integer slotIncrementMinutes, Integer bookingHorizonDays){
  if(slotIncrementMinutes != null && slotIncrementMinutes != 15 && slotIncrementMinutes != 30) throw new InvalidSlotIncrementException("Slot increment must be 15 or 30 minutes.");
  if(bookingHorizonDays != null && (bookingHorizonDays < 1 || bookingHorizonDays > 365)) throw new InvalidBookingHorizonException("Booking horizon must be between 1 and 365 days.");
 }
 private static void validateCoordinates(SalonDtos.SalonRequest request){if((request.latitude()==null)!=(request.longitude()==null))throw new InvalidCoordinatesException();validateTimezone(request.timezone());}
 private static void validateTimezone(String timezone){try{if(timezone==null||timezone.isBlank())throw new DateTimeException("blank timezone");ZoneId.of(timezone.trim());}catch(DateTimeException exception){throw new InvalidTimezoneException();}}
 @Transactional(readOnly=true) public List<SalonDtos.DirectoryResponse> directory(Double latitude,Double longitude,Double radiusKm){
  if ((latitude == null) != (longitude == null)) throw new InvalidDiscoveryRequestException("Latitude and longitude must be provided together.");
  if (latitude != null && (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)) throw new InvalidDiscoveryRequestException("Latitude or longitude is outside its valid range.");
  if (radiusKm != null && (radiusKm <= 0 || radiusKm > 100)) throw new InvalidDiscoveryRequestException("Radius must be greater than 0 and no more than 100 km.");
  if (latitude == null) return salons.findByActiveTrueOrderByNameAsc().stream().map(salon -> SalonDtos.DirectoryResponse.from(salon,null)).toList();
  var radius = radiusKm == null ? 5.0 : radiusKm;
  return salons.findByActiveTrueOrderByNameAsc().stream()
      .map(salon -> new SalonDistance(salon, distanceKm(latitude,longitude,salon.getLatitude(),salon.getLongitude())))
      .filter(item -> item.distanceKm != null && item.distanceKm <= radius)
      .sorted(Comparator.comparing(item -> item.distanceKm))
      .map(item -> SalonDtos.DirectoryResponse.from(item.salon, roundDistance(item.distanceKm)))
      .toList();
 }
 private static Double distanceKm(double latitude,double longitude,Double targetLatitude,Double targetLongitude){
  if (targetLatitude == null || targetLongitude == null) return null;
  var earthRadiusKm=6371.0088;
  var lat1=Math.toRadians(latitude); var lat2=Math.toRadians(targetLatitude);
  var dLat=Math.toRadians(targetLatitude-latitude); var dLon=Math.toRadians(targetLongitude-longitude);
  var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return earthRadiusKm*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
 }
 private static Double roundDistance(Double value){return value == null ? null : Math.round(value*100.0)/100.0;}
 private record SalonDistance(Salon salon,Double distanceKm){}
 public static class SalonAlreadyExistsException extends RuntimeException{} public static class SalonNotFoundException extends RuntimeException{}
 public static class InvalidCoordinatesException extends RuntimeException{}
 public static class InvalidTimezoneException extends RuntimeException{}
 public static class InvalidSlotIncrementException extends RuntimeException{public InvalidSlotIncrementException(String message){super(message);}}
 public static class InvalidBookingHorizonException extends RuntimeException{public InvalidBookingHorizonException(String message){super(message);}}
 public static class InvalidDiscoveryRequestException extends RuntimeException{public InvalidDiscoveryRequestException(String message){super(message);}}
}
