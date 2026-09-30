package com.trimtime.salon;

import org.springframework.stereotype.Component;
import java.time.*;

@Component
public class SalonTime {
    private final Clock clock;

    public SalonTime(Clock clock) { this.clock = clock; }

    public LocalDateTime now(Salon salon) {
        return LocalDateTime.now(clock.withZone(zone(salon)));
    }

    public LocalDate today(Salon salon) {
        return LocalDate.now(clock.withZone(zone(salon)));
    }

    public Instant currentInstant() { return clock.instant(); }

    public Instant instant(Salon salon, LocalDateTime local) {
        var offsets = zone(salon).getRules().getValidOffsets(local);
        if (offsets.size() != 1) throw new InvalidSalonLocalTimeException();
        return local.toInstant(offsets.getFirst());
    }

    public boolean isUnambiguous(Salon salon, LocalDateTime local) {
        return zone(salon).getRules().getValidOffsets(local).size() == 1;
    }

    private ZoneId zone(Salon salon) { return ZoneId.of(salon.getTimezone()); }

    public static class InvalidSalonLocalTimeException extends RuntimeException {}
}
