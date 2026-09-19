package com.trimtime.catalogue;
import com.trimtime.salon.*; import org.springframework.stereotype.Service; import org.springframework.transaction.annotation.Transactional; import java.util.*;
@Service public class CatalogueService {
 private final SalonRepository salons; private final ServiceOfferingRepository services;
 public CatalogueService(SalonRepository salons,ServiceOfferingRepository services){this.salons=salons;this.services=services;}
 @Transactional(readOnly=true) public List<ServiceOffering> mine(Long ownerId){return services.findBySalonIdOrderByNameAsc(ownerSalon(ownerId).getId());}
 @Transactional(readOnly=true) public List<ServiceOffering> active(Long salonId){return services.findBySalonIdAndActiveTrueOrderByNameAsc(salonId);}
 @Transactional public ServiceOffering create(Long ownerId,CatalogueDtos.ServiceRequest input){var salon=ownerSalon(ownerId);return services.save(new ServiceOffering(salon,input.name().trim(),input.description(),input.price(),input.durationMinutes()));}
 @Transactional public ServiceOffering update(Long ownerId,Long id,CatalogueDtos.ServiceRequest input){var service=owned(ownerId,id);service.update(input.name().trim(),input.description(),input.price(),input.durationMinutes());return service;}
 @Transactional public void deactivate(Long ownerId,Long id){owned(ownerId,id).deactivate();}
 private Salon ownerSalon(Long ownerId){return salons.findByOwnerId(ownerId).orElseThrow(SalonMissingException::new);} private ServiceOffering owned(Long ownerId,Long id){var salon=ownerSalon(ownerId);return services.findByIdAndSalonId(id,salon.getId()).orElseThrow(ServiceMissingException::new);}
 public static class SalonMissingException extends RuntimeException{} public static class ServiceMissingException extends RuntimeException{}
}
