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
    private final AppointmentRepository appointments;

    public SlotService(SalonRepository salons, ServiceOfferingRepository services, AddOnRepository addons,
                       BarberMembershipRepository memberships, BarberServiceQualificationRepository qualifications,
                       WorkingHourRepository hours, DayOffRepository days, AppointmentRepository appointments) {
        this.salons = salons; this.services = services; this.addons = addons; this.memberships = memberships;
        this.qualifications = qualifications; this.hours = hours; this.days = days; this.appointments = appointments;
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
        if (date == null || date.isBefore(LocalDate.now())) throw new InvalidSlotRequestException();
        var selection = resolve(salonId, serviceIds, addonIds);
        var result = new ArrayList<SlotDtos.SlotResponse>();
        for (var membership : memberships.findBySalonId(salonId)) {
            if (!qualifiedForAll(membership.getBarber().getId(), selection.services())) continue;
            var interval = interval(membership.getBarber().getId(), date);
            if (interval == null) continue;
            for (var cursor = interval.start; !cursor.plusMinutes(selection.duration).isAfter(interval.end); cursor = cursor.plusMinutes(selection.duration)) {
                var start = LocalDateTime.of(date, cursor); var end = start.plusMinutes(selection.duration);
                if (appointments.findOverlapping(membership.getBarber().getId(), start, end, BLOCKING).isEmpty()) result.add(new SlotDtos.SlotResponse(date, cursor, cursor.plusMinutes(selection.duration), selection.duration, selection.price));
            }
        }
        return result.stream().distinct().sorted(Comparator.comparing(SlotDtos.SlotResponse::startTime)).toList();
    }

    public List<BarberMembership> eligible(Long salonId, List<Long> serviceIds, LocalDate date, LocalTime start, LocalTime end) {
        var result = new ArrayList<BarberMembership>();
        for (var membership : memberships.findBySalonId(salonId)) {
            if (!qualifiedForAllIds(membership.getBarber().getId(), serviceIds)) continue;
            var interval = interval(membership.getBarber().getId(), date);
            if (interval != null && !start.isBefore(interval.start) && !end.isAfter(interval.end)) result.add(membership);
        }
        return result;
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
    public record Selection(Salon salon, List<ServiceOffering> services, List<AddOn> addons, int duration, BigDecimal price, String serviceSummary, String addonSummary) {}
    private record Interval(LocalTime start, LocalTime end) {}
    public static class InvalidSlotRequestException extends RuntimeException {}
    public static class InvalidSelectionException extends RuntimeException {}
    public static class SalonMissingException extends RuntimeException {}
    public static class ServiceMissingException extends RuntimeException {}
    public static class AddOnMissingException extends RuntimeException {}
    public static class IncompatibleAddOnException extends RuntimeException {}
}