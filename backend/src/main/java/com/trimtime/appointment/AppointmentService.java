package com.trimtime.appointment;

import com.trimtime.availability.AvailabilityService;
import com.trimtime.barber.BarberMembership;
import com.trimtime.barber.BarberMembershipRepository;
import com.trimtime.identity.UserAccountRepository;
import com.trimtime.salon.SalonRepository;
import com.trimtime.salon.SalonService;
import com.trimtime.salon.SalonTime;
import com.trimtime.slots.SlotService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class AppointmentService {
    private final UserAccountRepository users;
    private final BarberMembershipRepository memberships;
    private final SalonRepository salons;
    private final AppointmentRepository appointments;
    private final SlotService slots;
    private final BookingWriteLock locks;
    private final SalonTime salonTime;

    public AppointmentService(UserAccountRepository users, BarberMembershipRepository memberships,
                              SalonRepository salons, AppointmentRepository appointments,
                              SlotService slots, BookingWriteLock locks,
                              SalonTime salonTime) {
        this.users = users;
        this.memberships = memberships;
        this.salons = salons;
        this.appointments = appointments;
        this.slots = slots;
        this.locks = locks;
        this.salonTime = salonTime;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Appointment book(Long customerId, AppointmentDtos.CreateRequest input) {
        return book(customerId, UUID.randomUUID().toString(), input);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Appointment book(Long customerId, String suppliedRequestKey, AppointmentDtos.CreateRequest input) {
        var requestKey = validateRequestKey(suppliedRequestKey);
        var fingerprint = fingerprint(input);
        locks.salon(input.salonId());
        users.lockId(customerId).orElseThrow();
        var existing = appointments.findByCustomerIdAndRequestKey(customerId, requestKey);
        if (existing.isPresent()) {
            if (!fingerprint.equals(existing.get().getRequestFingerprint())) throw new RequestKeyReusedException();
            return existing.get();
        }
        var customer = users.findById(customerId).orElseThrow();
        var serviceIds = input.selectedServiceIds();
        var selection = slots.resolve(input.salonId(), serviceIds, input.addonIds());
        var start = LocalDateTime.of(input.date(), input.startTime());
        if (start.isBefore(slots.nowFor(selection.salon()))) throw new InvalidBookingTimeException();
        if (input.date().isAfter(slots.nowFor(selection.salon()).toLocalDate().plusDays(selection.salon().getBookingHorizonDays()))) {
            throw new com.trimtime.slots.SlotService.BookingHorizonExceededException("Selected booking date exceeds the advance booking horizon of " + selection.salon().getBookingHorizonDays() + " days.");
        }
        if (selection.salon().getSlotIncrementMinutes() != null && input.startTime().getMinute() % selection.salon().getSlotIncrementMinutes() != 0) {
            throw new InvalidBookingTimeException();
        }
        var end = start.plusMinutes(selection.duration());
        if (!end.toLocalDate().equals(input.date())) throw new NoBarberAvailableException();
        var startInstant = salonTime.instant(selection.salon(), start);
        var endInstant = salonTime.instant(selection.salon(), end);
        var eligible = slots.eligible(input.salonId(), serviceIds, start, end);
        // Read eligibility after the salon lock. Lock memberships in ID order before assignment.
        eligible.stream().sorted(Comparator.comparing(BarberMembership::getId))
                .forEach(candidate -> memberships.findByIdForUpdate(candidate.getId())
                        .orElseThrow(NoBarberAvailableException::new));
        eligible.sort(Comparator.comparing((BarberMembership m) -> m.getBarber().getDisplayName())
                .thenComparing(BarberMembership::getId));
        for (var candidate : eligible) {
            if (slots.free(candidate.getBarber().getId(), start, end)) {
                var appointment = new Appointment(customer, selection.salon(), candidate.getBarber(), start, end,
                        startInstant, endInstant,
                        selection.serviceSummary(), selection.addonSummary(), selection.duration(), selection.price(),
                        requestKey, fingerprint);
                appointment.recordRequiredServices(serviceIds);
                selection.services().forEach(item -> appointment.addItem(AppointmentItemKind.SERVICE,
                        item.getId(), item.getName(), item.getPrice(), item.getDurationMinutes()));
                selection.addons().forEach(item -> appointment.addItem(AppointmentItemKind.ADD_ON,
                        item.getId(), item.getName(), item.getPrice(), item.getDurationMinutes()));
                return appointments.save(appointment);
            }
        }
        throw new NoBarberAvailableException();
    }

    @Transactional(readOnly = true)
    public List<Appointment> mine(Long customerId) {
        return appointments.findByCustomerIdOrderByStartAtDesc(customerId);
    }

    @Transactional(readOnly = true)
    public Page<Appointment> mine(Long customerId, AppointmentStatus status, int page, int size) {
        int validPage = Math.max(0, page);
        int validSize = Math.max(1, Math.min(100, size));
        Pageable pageable = PageRequest.of(validPage, validSize);
        return status != null
                ? appointments.findByCustomerIdAndStatusOrderByStartAtDesc(customerId, status, pageable)
                : appointments.findByCustomerIdOrderByStartAtDesc(customerId, pageable);
    }

    @Transactional(readOnly = true)
    public List<Appointment> forBarber(Long barberId, LocalDate date) {
        if (!memberships.existsByBarberId(barberId)) {
            throw new AvailabilityService.MembershipRequiredException();
        }
        if (date != null) {
            return appointments.findByBarberIdAndStartAtBetweenOrderByStartAtAsc(
                    barberId, date.atStartOfDay(), date.atTime(LocalTime.MAX));
        }
        return appointments.findByBarberIdOrderByStartAtAsc(barberId);
    }

    @Transactional(readOnly = true)
    public List<Appointment> forOwner(Long ownerId, LocalDate date) {
        var salon = salons.findByOwnerId(ownerId)
                .orElseThrow(SalonService.SalonNotFoundException::new);
        if (date != null) {
            return appointments.findBySalonIdAndStartAtBetweenOrderByStartAtAsc(
                    salon.getId(), date.atStartOfDay(), date.atTime(LocalTime.MAX));
        }
        return appointments.findBySalonIdOrderByStartAtAsc(salon.getId());
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Appointment cancelByCustomer(Long customerId, String bookingReference) {
        var initial = appointments.findByBookingReference(bookingReference)
                .orElseThrow(AppointmentNotFoundException::new);
        if (!initial.getCustomer().getId().equals(customerId)) {
            throw new ForbiddenCancellationException();
        }
        locks.salon(initial.getSalon().getId());
        var appointment = appointments.findByBookingReference(bookingReference)
                .orElseThrow(AppointmentNotFoundException::new);
        return cancelInternal(appointment);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Appointment cancelByOwner(Long ownerId, String bookingReference) {
        Long salonId = locks.owner(ownerId);
        var appointment = appointments.findByBookingReference(bookingReference)
                .orElseThrow(AppointmentNotFoundException::new);
        if (!appointment.getSalon().getId().equals(salonId)) {
            throw new ForbiddenCancellationException();
        }
        return cancelInternal(appointment);
    }

    private Appointment cancelInternal(Appointment appointment) {
        if (appointment.getStatus() == AppointmentStatus.CANCELLED) {
            throw new AppointmentAlreadyCancelledException();
        }
        if (appointment.getStatus() != AppointmentStatus.CONFIRMED) {
            throw new InvalidCancellationStatusException("Only confirmed appointments can be cancelled.");
        }
        var now = slots.nowFor(appointment.getSalon());
        if (!appointment.getStartAt().isAfter(now)) {
            throw new PastAppointmentCancellationException();
        }
        appointment.cancel();
        return appointments.save(appointment);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Appointment updateStatusByBarber(Long barberUserId, String bookingReference, AppointmentStatus newStatus) {
        if (newStatus == null) {
            throw new InvalidStatusTransitionException("Target status is required.");
        }
        if (newStatus == AppointmentStatus.CANCELLED) {
            throw new ForbiddenStatusUpdateException("Barbers cannot cancel appointments.");
        }
        var initial = appointments.findByBookingReference(bookingReference)
                .orElseThrow(AppointmentNotFoundException::new);
        if (!initial.getBarber().getId().equals(barberUserId)) {
            throw new ForbiddenStatusUpdateException("Barbers can only update appointments assigned to them.");
        }
        locks.salon(initial.getSalon().getId());
        var appointment = appointments.findByBookingReference(bookingReference)
                .orElseThrow(AppointmentNotFoundException::new);
        return applyStatusTransition(appointment, newStatus);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Appointment updateStatusByOwner(Long ownerId, String bookingReference, AppointmentStatus newStatus) {
        if (newStatus == null) {
            throw new InvalidStatusTransitionException("Target status is required.");
        }
        Long salonId = locks.owner(ownerId);
        var appointment = appointments.findByBookingReference(bookingReference)
                .orElseThrow(AppointmentNotFoundException::new);
        if (!appointment.getSalon().getId().equals(salonId)) {
            throw new ForbiddenStatusUpdateException("Owners can only update appointments at their salon.");
        }
        if (newStatus == AppointmentStatus.CANCELLED) {
            return cancelInternal(appointment);
        }
        return applyStatusTransition(appointment, newStatus);
    }

    private Appointment applyStatusTransition(Appointment appointment, AppointmentStatus newStatus) {
        var current = appointment.getStatus();
        if (current == AppointmentStatus.COMPLETED || current == AppointmentStatus.CANCELLED || current == AppointmentStatus.NO_SHOW) {
            throw new InvalidStatusTransitionException("Terminal appointments cannot be modified.");
        }
        if (current == newStatus) {
            return appointment;
        }
        switch (newStatus) {
            case IN_PROGRESS -> {
                if (current != AppointmentStatus.CONFIRMED) {
                    throw new InvalidStatusTransitionException("Only confirmed appointments can be started.");
                }
                appointment.startProgress();
            }
            case COMPLETED -> {
                if (current != AppointmentStatus.CONFIRMED && current != AppointmentStatus.IN_PROGRESS) {
                    throw new InvalidStatusTransitionException("Only confirmed or in-progress appointments can be completed.");
                }
                appointment.complete();
            }
            case NO_SHOW -> {
                if (current != AppointmentStatus.CONFIRMED) {
                    throw new InvalidStatusTransitionException("Only confirmed appointments can be marked as no-show.");
                }
                appointment.markNoShow();
            }
            default -> throw new InvalidStatusTransitionException("Invalid target status: " + newStatus);
        }
        return appointments.save(appointment);
    }

    public static class InvalidBookingTimeException extends RuntimeException {}
    public static class NoBarberAvailableException extends RuntimeException {}
    public static class InvalidRequestKeyException extends RuntimeException {}
    public static class RequestKeyReusedException extends RuntimeException {}
    public static class AppointmentNotFoundException extends RuntimeException {}
    public static class ForbiddenCancellationException extends RuntimeException {}
    public static class AppointmentAlreadyCancelledException extends RuntimeException {}
    public static class InvalidCancellationStatusException extends RuntimeException {
        public InvalidCancellationStatusException(String message) { super(message); }
    }
    public static class PastAppointmentCancellationException extends RuntimeException {}
    public static class ForbiddenStatusUpdateException extends RuntimeException {
        public ForbiddenStatusUpdateException(String message) { super(message); }
    }
    public static class InvalidStatusTransitionException extends RuntimeException {
        public InvalidStatusTransitionException(String message) { super(message); }
    }
    public static class InvalidBarberReassignmentException extends RuntimeException {
        public InvalidBarberReassignmentException(String message) { super(message); }
    }

    @Transactional(readOnly = true)
    public List<BarberMembership> availableBarbersForReassignment(Long ownerId, String bookingReference) {
        Long salonId = locks.owner(ownerId);
        var appointment = appointments.findByBookingReference(bookingReference)
                .orElseThrow(AppointmentNotFoundException::new);
        if (!appointment.getSalon().getId().equals(salonId)) {
            throw new ForbiddenStatusUpdateException("Owners can only inspect appointments at their salon.");
        }
        var requiredServiceIds = appointment.getRequiredServiceIds().stream().toList();
        var eligible = slots.eligible(salonId, requiredServiceIds, appointment.getStartAt(), appointment.getEndAt());
        return eligible.stream()
                .filter(m -> !m.getBarber().getId().equals(appointment.getBarber().getId()))
                .filter(m -> slots.free(m.getBarber().getId(), appointment.getStartAt(), appointment.getEndAt()))
                .toList();
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Appointment reassign(Long ownerId, String bookingReference, Long targetBarberId) {
        if (targetBarberId == null) {
            throw new InvalidBarberReassignmentException("Target barber ID is required.");
        }
        Long salonId = locks.owner(ownerId);
        var appointment = appointments.findByBookingReference(bookingReference)
                .orElseThrow(AppointmentNotFoundException::new);
        if (!appointment.getSalon().getId().equals(salonId)) {
            throw new ForbiddenStatusUpdateException("Owners can only reassign appointments at their salon.");
        }
        if (appointment.getStatus() != AppointmentStatus.CONFIRMED) {
            throw new InvalidStatusTransitionException("Only confirmed appointments can be reassigned.");
        }
        if (appointment.getBarber().getId().equals(targetBarberId)) {
            throw new InvalidBarberReassignmentException("Cannot reassign appointment to the current barber.");
        }

        var targetMembership = memberships.findByBarberId(targetBarberId)
                .filter(m -> m.getSalon().getId().equals(salonId))
                .orElseThrow(() -> new InvalidBarberReassignmentException("Target barber does not belong to this salon."));

        var requiredServiceIds = appointment.getRequiredServiceIds().stream().toList();
        var eligible = slots.eligible(salonId, requiredServiceIds, appointment.getStartAt(), appointment.getEndAt());
        boolean isEligible = eligible.stream().anyMatch(m -> m.getBarber().getId().equals(targetBarberId));
        if (!isEligible) {
            throw new InvalidBarberReassignmentException("Target barber is either not qualified for the required service(s) or not scheduled to work during this slot.");
        }
        if (!slots.free(targetBarberId, appointment.getStartAt(), appointment.getEndAt())) {
            throw new InvalidBarberReassignmentException("Target barber already has an overlapping appointment during this slot.");
        }

        var targetBarberUser = targetMembership.getBarber();
        appointment.reassignBarber(targetBarberUser);
        return appointments.save(appointment);
    }

    private String validateRequestKey(String supplied) {
        if (supplied == null) throw new InvalidRequestKeyException();
        var key = supplied.trim();
        if (!key.matches("[A-Za-z0-9._:-]{1,100}")) throw new InvalidRequestKeyException();
        return key;
    }

    private String fingerprint(AppointmentDtos.CreateRequest input) {
        var services = input.selectedServiceIds().stream().filter(Objects::nonNull).distinct().sorted().toList();
        var addons = input.addonIds() == null ? List.<Long>of()
                : input.addonIds().stream().filter(Objects::nonNull).distinct().sorted().toList();
        var canonical = input.salonId() + "|" + services + "|" + addons + "|" + input.date() + "|" + input.startTime();
        try {
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }
}
