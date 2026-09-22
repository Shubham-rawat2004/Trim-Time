package com.trimtime.salon;
import com.trimtime.identity.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Comparator;
@Service public class SalonService {
 private final SalonRepository salons; private final UserAccountRepository users;
 public SalonService(SalonRepository salons,UserAccountRepository users){this.salons=salons;this.users=users;}
 @Transactional public Salon create(Long ownerId,SalonDtos.SalonRequest request){validateCoordinates(request);var owner=users.findById(ownerId).orElseThrow();if(salons.existsByOwnerId(ownerId))throw new SalonAlreadyExistsException();owner.addRole(Role.SALON_OWNER);return salons.save(new Salon(owner,request.name().trim(),request.description(),request.address().trim(),request.contact().trim(),request.latitude(),request.longitude(),request.timezone().trim()));}
 @Transactional(readOnly=true) public Salon getOwned(Long ownerId){return salons.findByOwnerId(ownerId).orElseThrow(SalonNotFoundException::new);}
 @Transactional public Salon update(Long ownerId,SalonDtos.SalonRequest request){validateCoordinates(request);var salon=getOwned(ownerId);salon.update(request.name().trim(),request.description(),request.address().trim(),request.contact().trim(),request.latitude(),request.longitude(),request.timezone().trim());return salon;}
 private static void validateCoordinates(SalonDtos.SalonRequest request){if((request.latitude()==null)!=(request.longitude()==null))throw new InvalidCoordinatesException();}
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
 public static class InvalidDiscoveryRequestException extends RuntimeException{public InvalidDiscoveryRequestException(String message){super(message);}}
}
