package com.trimtime.appointment;

import com.trimtime.slots.SlotService;
import com.trimtime.barber.BarberMembershipRepository;
import com.trimtime.availability.AvailabilityService;
import com.trimtime.salon.SalonTime;
import com.trimtime.salon.Salon;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.util.Collection;
import java.util.List;
import java.util.Set;

/** Call after the salon lock; exceptions roll the entire edit back. */
@Component
@Transactional(propagation = Propagation.MANDATORY)
public class AppointmentProtection {
    private static final List<AppointmentStatus> BLOCKING =
            List.of(AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS);
    private final AppointmentRepository appointments;
    private final SlotService slots;
    private final BarberMembershipRepository memberships;
    private final SalonTime salonTime;

    public AppointmentProtection(AppointmentRepository appointments, SlotService slots,
                                 BarberMembershipRepository memberships, SalonTime salonTime) {
        this.appointments = appointments;
        this.slots = slots;
        this.memberships = memberships;
        this.salonTime = salonTime;
    }

    public void schedule(Long barberId, java.time.LocalDate date) {
        reject(unfinished(barberId).stream()
                .filter(a -> a.getStartAt().toLocalDate().equals(date))
                .filter(a -> !slots.scheduleCovers(barberId, a.getStartAt(), a.getEndAt())).toList());
    }

    public void qualifications(Long barberId, Set<Long> selected, Collection<Long> previous) {
        boolean removing = !selected.containsAll(previous);
        reject(unfinished(barberId).stream().filter(a -> {
            var required = a.getRequiredServiceIds();
            // Legacy summaries cannot safely identify services after renames or comma-containing names.
            return required.isEmpty() ? removing : !selected.containsAll(required);
        }).toList());
    }

    public void timezoneChange(Salon salon, String requestedTimezone) {
        if (salon.getTimezone().equals(requestedTimezone)) return;
        var nowInstant = salonTime.currentInstant();
        var nowLocal = salonTime.now(salon);
        reject(appointments.findBySalonIdAndStatusIn(salon.getId(), BLOCKING).stream()
                .filter(a -> a.getEndInstant() == null
                        ? a.getEndAt().isAfter(nowLocal)
                        : a.getEndInstant().isAfter(nowInstant))
                .toList());
    }

    public void membershipDeactivation(Long barberId) { reject(unfinished(barberId)); }
    private List<Appointment> unfinished(Long barberId) {
        var salon = memberships.findByBarberId(barberId).orElseThrow(AvailabilityService.MembershipRequiredException::new).getSalon();
        return appointments.findUnfinished(barberId, salonTime.now(salon), BLOCKING);
    }

    private void reject(List<Appointment> conflicts) {
        if (!conflicts.isEmpty()) {
            throw new AppointmentConflictException(conflicts.stream().map(Appointment::getBookingReference).toList());
        }
    }

    public static class AppointmentConflictException extends RuntimeException {
        private final List<String> references;
        public AppointmentConflictException(List<String> references) {
            super("This change would invalidate existing appointments. Keep their required availability and services.");
            this.references = List.copyOf(references);
        }
        public List<String> getReferences() { return references; }
    }
}
