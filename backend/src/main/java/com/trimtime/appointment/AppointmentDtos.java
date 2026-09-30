package com.trimtime.appointment;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

public final class AppointmentDtos {
    private AppointmentDtos() {}

    public record CreateRequest(
            @NotNull Long salonId,
            List<Long> serviceIds,
            Long serviceId,
            List<Long> addonIds,
            @NotNull LocalDate date,
            @NotNull LocalTime startTime) {
        public List<Long> selectedServiceIds() {
            var selected = serviceIds == null ? List.<Long>of()
                    : serviceIds.stream().filter(Objects::nonNull).distinct().toList();
            return selected.isEmpty() && serviceId != null ? List.of(serviceId) : selected;
        }
    }

    public record StatusUpdateRequest(@NotNull AppointmentStatus status) {}

    public record ReassignRequest(@NotNull Long targetBarberId) {}

    public record CandidateBarberResponse(Long barberId, String barberName) {}

    public record ItemResponse(
            AppointmentItemKind kind,
            Long catalogueItemId,
            String name,
            int durationMinutes,
            BigDecimal price) {
        static ItemResponse from(AppointmentItem item) {
            return new ItemResponse(item.getKind(), item.getCatalogueItemId(), item.getName(), item.getDurationMinutes(), item.getPrice());
        }
    }

    public record Response(
            String bookingReference,
            LocalDate date,
            LocalTime startTime,
            LocalTime endTime,
            Instant startInstant,
            Instant endInstant,
            String timezone,
            String salonName,
            String customerName,
            String barberName,
            Long barberId,
            String serviceName,
            String addonSummary,
            int durationMinutes,
            BigDecimal totalPrice,
            AppointmentStatus status,
            List<ItemResponse> items) {
        public static Response from(Appointment a) {
            return new Response(
                    a.getBookingReference(),
                    a.getStartAt().toLocalDate(),
                    a.getStartAt().toLocalTime(),
                    a.getEndAt().toLocalTime(),
                    a.getStartInstant(),
                    a.getEndInstant(),
                    a.getSalonTimezone(),
                    a.getSalon().getName(),
                    a.getCustomer() != null ? a.getCustomer().getDisplayName() : null,
                    a.getBarber() != null ? a.getBarber().getDisplayName() : null,
                    a.getBarber() != null ? a.getBarber().getId() : null,
                    a.getServiceName(),
                    a.getAddonSummary(),
                    a.getDurationMinutes(),
                    a.getTotalPrice(),
                    a.getStatus(),
                    a.getItems().stream().map(ItemResponse::from).toList());
        }
    }

    public record PageResponse<T>(
            List<T> content,
            int page,
            int size,
            long totalElements,
            int totalPages,
            boolean first,
            boolean last) {}
}
