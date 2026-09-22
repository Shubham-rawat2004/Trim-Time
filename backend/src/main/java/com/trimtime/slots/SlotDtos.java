package com.trimtime.slots;
import java.math.BigDecimal; import java.time.*;
public final class SlotDtos { private SlotDtos(){} public record SlotResponse(LocalDate date,LocalTime startTime,LocalTime endTime,int durationMinutes,BigDecimal totalPrice){} }
