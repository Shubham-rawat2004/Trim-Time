package com.trimtime.barber;
import jakarta.validation.constraints.*; import java.util.*;
public final class BarberQualificationDtos { private BarberQualificationDtos(){} public record UpdateRequest(@NotNull List<Long> serviceIds){} public record BarberResponse(Long barberId,String barberName,List<Long> serviceIds){} }
