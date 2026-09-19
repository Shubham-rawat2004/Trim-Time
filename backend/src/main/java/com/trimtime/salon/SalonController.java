package com.trimtime.salon;
import com.trimtime.identity.SessionAuthenticationFilter;
import jakarta.validation.Valid;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import java.util.List;
@RestController @RequestMapping("/api/salons") public class SalonController {
 private final SalonService service; public SalonController(SalonService service){this.service=service;}
 @PostMapping public SalonDtos.SalonResponse create(@Valid @RequestBody SalonDtos.SalonRequest request){return SalonDtos.SalonResponse.from(service.create(currentUserId(),request));}
 @GetMapping public List<SalonDtos.DirectoryResponse> directory(){return service.directory().stream().map(SalonDtos.DirectoryResponse::from).toList();}
 @PreAuthorize("hasRole('SALON_OWNER')") @GetMapping("/mine") public SalonDtos.SalonResponse mine(){return SalonDtos.SalonResponse.from(service.getOwned(currentUserId()));}
 @PreAuthorize("hasRole('SALON_OWNER')") @PutMapping("/mine") public SalonDtos.SalonResponse update(@Valid @RequestBody SalonDtos.SalonRequest request){return SalonDtos.SalonResponse.from(service.update(currentUserId(),request));}
 private Long currentUserId(){return ((SessionAuthenticationFilter.UserPrincipal)SecurityContextHolder.getContext().getAuthentication().getPrincipal()).id();}
}
