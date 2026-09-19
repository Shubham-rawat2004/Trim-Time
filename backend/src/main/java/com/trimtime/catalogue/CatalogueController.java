package com.trimtime.catalogue;
import jakarta.validation.Valid; import org.springframework.http.*; import org.springframework.security.access.prepost.PreAuthorize; import org.springframework.security.core.context.SecurityContextHolder; import org.springframework.web.bind.annotation.*; import java.util.*;
@RestController @RequestMapping("/api") public class CatalogueController {
 private final CatalogueService catalogue; public CatalogueController(CatalogueService catalogue){this.catalogue=catalogue;}
 private Long current(){return ((com.trimtime.identity.SessionAuthenticationFilter.UserPrincipal)SecurityContextHolder.getContext().getAuthentication().getPrincipal()).id();}
 @PreAuthorize("hasRole('SALON_OWNER')") @GetMapping("/salons/mine/services") public List<CatalogueDtos.ServiceResponse> mine(){return catalogue.mine(current()).stream().map(CatalogueDtos.ServiceResponse::from).toList();}
 @GetMapping("/salons/{salonId}/services") public List<CatalogueDtos.ServiceResponse> active(@PathVariable Long salonId){return catalogue.active(salonId).stream().map(CatalogueDtos.ServiceResponse::from).toList();}
 @PreAuthorize("hasRole('SALON_OWNER')") @PostMapping("/salons/mine/services") public ResponseEntity<CatalogueDtos.ServiceResponse> create(@Valid @RequestBody CatalogueDtos.ServiceRequest input){return ResponseEntity.status(HttpStatus.CREATED).body(CatalogueDtos.ServiceResponse.from(catalogue.create(current(),input)));}
 @PreAuthorize("hasRole('SALON_OWNER')") @PutMapping("/salons/mine/services/{id}") public CatalogueDtos.ServiceResponse update(@PathVariable Long id,@Valid @RequestBody CatalogueDtos.ServiceRequest input){return CatalogueDtos.ServiceResponse.from(catalogue.update(current(),id,input));}
 @PreAuthorize("hasRole('SALON_OWNER')") @DeleteMapping("/salons/mine/services/{id}") public ResponseEntity<Void> deactivate(@PathVariable Long id){catalogue.deactivate(current(),id);return ResponseEntity.noContent().build();}
}
