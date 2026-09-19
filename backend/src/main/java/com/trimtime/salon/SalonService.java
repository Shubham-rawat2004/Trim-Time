package com.trimtime.salon;
import com.trimtime.identity.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;
import java.util.List;
@Service public class SalonService {
 private final SalonRepository salons; private final UserAccountRepository users;
 public SalonService(SalonRepository salons,UserAccountRepository users){this.salons=salons;this.users=users;}
 @Transactional public Salon create(Long ownerId,SalonDtos.SalonRequest request){var owner=users.findById(ownerId).orElseThrow();if(salons.existsByOwnerId(ownerId))throw new SalonAlreadyExistsException();owner.addRole(Role.SALON_OWNER);return salons.save(new Salon(owner,request.name().trim(),request.description(),request.address().trim(),request.contact().trim(),request.latitude(),request.longitude(),request.timezone().trim()));}
 @Transactional(readOnly=true) public Salon getOwned(Long ownerId){return salons.findByOwnerId(ownerId).orElseThrow(SalonNotFoundException::new);}
 @Transactional public Salon update(Long ownerId,SalonDtos.SalonRequest request){var salon=getOwned(ownerId);salon.update(request.name().trim(),request.description(),request.address().trim(),request.contact().trim(),request.latitude(),request.longitude(),request.timezone().trim());return salon;}
 @Transactional(readOnly=true) public List<Salon> directory(){return salons.findByActiveTrueOrderByNameAsc();}
 public static class SalonAlreadyExistsException extends RuntimeException{} public static class SalonNotFoundException extends RuntimeException{}
}
