package com.trimtime.catalogue;
import jakarta.validation.constraints.*; import java.math.BigDecimal;
public final class CatalogueDtos { private CatalogueDtos(){}
 public record ServiceRequest(@NotBlank @Size(max=160) String name,@Size(max=1000) String description,@NotNull @DecimalMin("0.00") @Digits(integer=8,fraction=2) BigDecimal price,@Min(5) @Max(480) int durationMinutes){}
 public record ServiceResponse(Long id,Long salonId,String name,String description,BigDecimal price,int durationMinutes,boolean active){static ServiceResponse from(ServiceOffering s){return new ServiceResponse(s.getId(),s.getSalon().getId(),s.getName(),s.getDescription(),s.getPrice(),s.getDurationMinutes(),s.isActive());}}
}
