package com.trimtime.slots;

import com.trimtime.appointment.*;
import com.trimtime.availability.*;
import com.trimtime.barber.*;
import com.trimtime.catalogue.*;
import com.trimtime.salon.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;

@Service
public class SlotService {
    private static final List<AppointmentStatus> BLOCKING = List.of(AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS);
    private final SalonRepository salons;
    private final ServiceOfferingRepository services;
    private final AddOnRepository addons;
    private final BarberMembershipRepository memberships;
    private final BarberServiceQualificationRepository qualifications;
    private final WorkingHourRepository hours;
    private final DayOffRepository days;
    private final BarberBreakRepository breaks;
    private final AppointmentRepository appointments;
    private final SalonTime salonTime;

    public SlotService(SalonRepository salons, ServiceOfferingRepository services, AddOnRepository addons,
                       BarberMembershipRepository memberships, BarberServiceQualificationRepository qualifications,
                       WorkingHourRepository hours, DayOffRepository days, BarberBreakRepository breaks,
                       AppointmentRepository appointments,
                       SalonTime salonTime) {
        this.salons = salons; this.services = services; this.addons = addons; this.memberships = memberships;
        this.qualifications = qualifications; this.hours = hours; this.days = days; this.breaks = breaks; this.appointments = appointments;
        this.salonTime = salonTime;
    }

    public Selection resolve(Long salonId, List<Long> requestedServiceIds, List<Long> addonIds) {
        var salon = salons.findById(salonId).filter(Salon::isActive).orElseThrow(SalonMissingException::new);
        var serviceIds = requestedServiceIds == null ? List.<Long>of() : requestedServiceIds.stream().filter(Objects::nonNull).distinct().toList();
        if (serviceIds.isEmpty()) throw new InvalidSelectionException();
        var selectedServices = serviceIds.stream().map(id -> services.findByIdAndSalonId(id, salonId).filter(ServiceOffering::isActive).orElseThrow(ServiceMissingException::new)).toList();
        var ids = addonIds == null ? List.<Long>of() : addonIds.stream().filter(Objects::nonNull).distinct().toList();
        var selectedAddons = ids.stream().map(id -> addons.findByIdAndSalonId(id, salonId).filter(AddOn::isActive).orElseThrow(AddOnMissingException::new)).toList();
        if (selectedAddons.size() != ids.size()) throw new AddOnMissingException();
        if (selectedAddons.stream().anyMatch(addon -> addon.getCompatibleServices().stream().noneMatch(service -> serviceIds.contains(service.getId())))) throw new IncompatibleAddOnException();
        int duration = selectedServices.stream().mapToInt(ServiceOffering::getDurationMinutes).sum() + selectedAddons.stream().mapToInt(AddOn::getDurationMinutes).sum();
        BigDecimal price = selectedServices.stream().map(ServiceOffering::getPrice).reduce(BigDecimal.ZERO, BigDecimal::add).add(selectedAddons.stream().map(AddOn::getPrice).reduce(BigDecimal.ZERO, BigDecimal::add));
        String serviceSummary = selectedServices.stream().map(ServiceOffering::getName).reduce((a, b) -> a + ", " + b).orElse(null);
        String addonSummary = selectedAddons.stream().map(AddOn::getName).reduce((a, b) -> a + ", " + b).orElse(null);
        return new Selection(salon, selectedServices, selectedAddons, duration, price, serviceSummary, addonSummary);
    }

    @Transactional(readOnly = true)
    public List<SlotDtos.SlotResponse> find(Long salonId, List<Long> serviceIds, List<Long> addonIds, LocalDate date) {
        if (date == null) throw new InvalidSlotRequestException();
        var selection = resolve(salonId, serviceIds, addonIds);
        var now = nowFor(selection.salon());
        if (date.isBefore(now.toLocalDate())) throw new InvalidSlotRequestException();
        if (date.isAfter(now.toLocalDate().plusDays(selection.salon().getBookingHorizonDays()))) throw new BookingHorizonExceededException("Selected date exceeds the advance booking horizon of " + selection.salon().getBookingHorizonDays() + " days.");
        var result = new ArrayList<SlotDtos.SlotResponse>();
        for (var membership : memberships.findBySalonId(salonId)) {
            if (!qualifiedForAll(membership.getBarber().getId(), selection.services())) continue;
            for (var interval : availableIntervals(membership.getBarber().getId(), date)) {
                var intervalStart = LocalDateTime.of(date, interval.start);
                var intervalEnd = LocalDateTime.of(date, interval.end);
                if (!intervalEnd.isAfter(intervalStart)) continue;
                int increment = selection.salon().getSlotIncrementMinutes() != null
                        ? selection.salon().getSlotIncrementMinutes()
                        : selection.duration;
                for (var cursor = intervalStart; !cursor.plusMinutes(selection.duration).isAfter(intervalEnd); cursor = cursor.plusMinutes(increment)) {
                    if (cursor.isBefore(now)) continue;
                    var end = cursor.plusMinutes(selection.duration);
                    if (!salonTime.isUnambiguous(selection.salon(), cursor)
                            || !salonTime.isUnambiguous(selection.salon(), end)) continue;
                    if (appointments.findOverlapping(membership.getBarber().getId(), cursor, end, BLOCKING).isEmpty()) result.add(new SlotDtos.SlotResponse(date, cursor.toLocalTime(), end.toLocalTime(), salonTime.instant(selection.salon(), cursor), salonTime.instant(selection.salon(), end), selection.salon().getTimezone(), selection.duration, selection.price));
                }
            }
        }
        return result.stream().distinct().sorted(Comparator.comparing(SlotDtos.SlotResponse::startTime)).toList();
    }

    public List<BarberMembership> eligible(Long salonId, List<Long> serviceIds, LocalDateTime start, LocalDateTime end) {
        var result = new ArrayList<BarberMembership>();
        for (var membership : memberships.findBySalonId(salonId)) {
            if (!qualifiedForAllIds(membership.getBarber().getId(), serviceIds)) continue;
            if (scheduleCovers(membership.getBarber().getId(), start, end)) result.add(membership);
        }
        return result;
    }

    public LocalDateTime nowFor(Salon salon) {
        return salonTime.now(salon);
    }

    public boolean scheduleCovers(Long barberId, LocalDateTime start, LocalDateTime end) {
        var working = interval(barberId, start.toLocalDate());
        return working != null && start.toLocalDate().equals(end.toLocalDate())
                && !start.toLocalTime().isBefore(working.start)
                && !end.toLocalTime().isAfter(working.end)
                && breaks.findByBarberIdAndWeekStartDateAndDayOfWeekOrderByStartTimeAsc(
                        barberId, start.toLocalDate().with(DayOfWeek.MONDAY),
                        start.toLocalDate().getDayOfWeek().getValue()).stream().noneMatch(item ->
                        item.getStartTime().isBefore(end.toLocalTime())
                                && item.getEndTime().isAfter(start.toLocalTime()));
    }

    public boolean free(Long barberId, LocalDateTime start, LocalDateTime end) { return appointments.findOverlappingForUpdate(barberId, start, end, BLOCKING).isEmpty(); }
    private boolean qualifiedForAll(Long barberId, List<ServiceOffering> selectedServices) { return selectedServices.stream().allMatch(service -> qualifications.existsByBarberIdAndServiceId(barberId, service.getId())); }
    private boolean qualifiedForAllIds(Long barberId, List<Long> serviceIds) { return serviceIds != null && !serviceIds.isEmpty() && serviceIds.stream().distinct().allMatch(serviceId -> qualifications.existsByBarberIdAndServiceId(barberId, serviceId)); }
    private Interval interval(Long barberId, LocalDate date) {
        var special = days.findByBarberIdAndDate(barberId, date);
        if (special.isPresent()) { var day = special.get(); return day.getStartTime() == null ? null : new Interval(day.getStartTime(), day.getEndTime()); }
        var regular = hours.findByBarberIdAndWeekStartDateAndDayOfWeek(barberId, date.with(DayOfWeek.MONDAY), date.getDayOfWeek().getValue());
        return regular.map(hour -> new Interval(hour.getStartTime(), hour.getEndTime())).orElse(null);
    }
    private List<Interval> availableIntervals(Long barberId, LocalDate date) {
        var working = interval(barberId, date);
        if (working == null) return List.of();
        var result = new ArrayList<Interval>();
        var cursor = working.start;
        for (var item : breaks.findByBarberIdAndWeekStartDateAndDayOfWeekOrderByStartTimeAsc(
                barberId, date.with(DayOfWeek.MONDAY), date.getDayOfWeek().getValue())) {
            if (!item.getEndTime().isAfter(working.start) || !item.getStartTime().isBefore(working.end)) continue;
            var breakStart = item.getStartTime().isBefore(working.start) ? working.start : item.getStartTime();
            var breakEnd = item.getEndTime().isAfter(working.end) ? working.end : item.getEndTime();
            if (cursor.isBefore(breakStart)) result.add(new Interval(cursor, breakStart));
            if (cursor.isBefore(breakEnd)) cursor = breakEnd;
        }
        if (cursor.isBefore(working.end)) result.add(new Interval(cursor, working.end));
        return result;
    }
    public record Selection(Salon salon, List<ServiceOffering> services, List<AddOn> addons, int duration, BigDecimal price, String serviceSummary, String addonSummary) {}
    private record Interval(LocalTime start, LocalTime end) {}
    public static class InvalidSlotRequestException extends RuntimeException {}
    public static class BookingHorizonExceededException extends RuntimeException { public BookingHorizonExceededException(String message) { super(message); } }
    public static class InvalidSelectionException extends RuntimeException {}
    public static class SalonMissingException extends RuntimeException {}
    public static class ServiceMissingException extends RuntimeException {}
    public static class AddOnMissingException extends RuntimeException {}
    public static class IncompatibleAddOnException extends RuntimeException {}
}
