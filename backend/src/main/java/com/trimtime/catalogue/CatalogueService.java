package com.trimtime.catalogue;
import com.trimtime.salon.*; import org.springframework.stereotype.Service; import org.springframework.transaction.annotation.Transactional; import java.util.*;
@Service public class CatalogueService {
 private final SalonRepository salons; private final ServiceOfferingRepository services;
 private final AddOnRepository addons;
 public CatalogueService(SalonRepository salons,ServiceOfferingRepository services,AddOnRepository addons){this.salons=salons;this.services=services;this.addons=addons;}
 @Transactional(readOnly=true) public List<ServiceOffering> mine(Long ownerId){return services.findBySalonIdOrderByNameAsc(ownerSalon(ownerId).getId());}
 @Transactional(readOnly=true) public List<ServiceOffering> active(Long salonId){return services.findBySalonIdAndActiveTrueOrderByNameAsc(salonId);}
 @Transactional public ServiceOffering create(Long ownerId,CatalogueDtos.ServiceRequest input){var salon=ownerSalon(ownerId);return services.save(new ServiceOffering(salon,input.name().trim(),input.description(),input.price(),input.durationMinutes()));}
 @Transactional public ServiceOffering update(Long ownerId,Long id,CatalogueDtos.ServiceRequest input){var service=owned(ownerId,id);service.update(input.name().trim(),input.description(),input.price(),input.durationMinutes());return service;}
 @Transactional public void deactivate(Long ownerId,Long id){owned(ownerId,id).deactivate();}
 @Transactional(readOnly=true) public List<AddOn> mineAddons(Long ownerId){return addons.findBySalonIdOrderByNameAsc(ownerSalon(ownerId).getId());}
 @Transactional(readOnly=true) public List<AddOn> activeAddons(Long salonId,Long serviceId){return addons.findBySalonIdOrderByNameAsc(salonId).stream().filter(AddOn::isActive).filter(a->a.getCompatibleServices().stream().anyMatch(s->s.getId().equals(serviceId))).toList();}
 @Transactional public AddOn createAddon(Long ownerId,CatalogueDtos.AddOnRequest input){var salon=ownerSalon(ownerId);var service=services.findByIdAndSalonId(input.serviceId(),salon.getId()).orElseThrow(ServiceMissingException::new);var addon=addons.save(new AddOn(salon,input.name().trim(),input.description(),input.price(),input.durationMinutes()));addon.addCompatibility(service);return addon;}
 @Transactional public void deactivateAddon(Long ownerId,Long id){var addon=addons.findByIdAndSalonId(id,ownerSalon(ownerId).getId()).orElseThrow(AddOnMissingException::new);addon.deactivate();}
 private Salon ownerSalon(Long ownerId){return salons.findByOwnerId(ownerId).orElseThrow(SalonMissingException::new);} private ServiceOffering owned(Long ownerId,Long id){var salon=ownerSalon(ownerId);return services.findByIdAndSalonId(id,salon.getId()).orElseThrow(ServiceMissingException::new);}
 public static class SalonMissingException extends RuntimeException{} public static class ServiceMissingException extends RuntimeException{} public static class AddOnMissingException extends RuntimeException{}
}
