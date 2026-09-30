package com.trimtime.appointment;

import com.trimtime.identity.SessionAuthenticationFilter;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api")
public class AppointmentController {
    private final AppointmentService service;

    public AppointmentController(AppointmentService service) {
        this.service = service;
    }

    private Long current() {
        return ((SessionAuthenticationFilter.UserPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal()).id();
    }

    @PreAuthorize("hasRole('CUSTOMER')")
    @PostMapping("/appointments")
    public ResponseEntity<AppointmentDtos.Response> book(
            @RequestHeader(name = "Idempotency-Key", required = false) String requestKey,
            @Valid @RequestBody AppointmentDtos.CreateRequest input) {
        return ResponseEntity.status(HttpStatus.CREATED).body(AppointmentDtos.Response.from(service.book(current(), requestKey, input)));
    }

    @PreAuthorize("hasRole('CUSTOMER')")
    @GetMapping("/appointments/mine")
    public AppointmentDtos.PageResponse<AppointmentDtos.Response> mine(
            @RequestParam(required = false) AppointmentStatus status,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size) {
        var pageResult = service.mine(current(), status, page, size);
        return new AppointmentDtos.PageResponse<>(
                pageResult.getContent().stream().map(AppointmentDtos.Response::from).toList(),
                pageResult.getNumber(),
                pageResult.getSize(),
                pageResult.getTotalElements(),
                pageResult.getTotalPages(),
                pageResult.isFirst(),
                pageResult.isLast()
        );
    }

    @PreAuthorize("hasRole('CUSTOMER')")
    @PostMapping("/appointments/{bookingReference}/cancel")
    public AppointmentDtos.Response cancelByCustomer(@PathVariable String bookingReference) {
        return AppointmentDtos.Response.from(service.cancelByCustomer(current(), bookingReference));
    }

    @PreAuthorize("hasRole('SALON_OWNER')")
    @PostMapping("/salons/mine/appointments/{bookingReference}/cancel")
    public AppointmentDtos.Response cancelByOwner(@PathVariable String bookingReference) {
        return AppointmentDtos.Response.from(service.cancelByOwner(current(), bookingReference));
    }

    @PreAuthorize("hasRole('BARBER')")
    @GetMapping("/barber/appointments")
    public List<AppointmentDtos.Response> barberAppointments(@RequestParam(required = false) LocalDate date) {
        return service.forBarber(current(), date).stream().map(AppointmentDtos.Response::from).toList();
    }

    @PreAuthorize("hasRole('BARBER')")
    @PostMapping("/barber/appointments/{bookingReference}/status")
    public AppointmentDtos.Response updateStatusByBarber(
            @PathVariable String bookingReference,
            @Valid @RequestBody AppointmentDtos.StatusUpdateRequest request) {
        return AppointmentDtos.Response.from(service.updateStatusByBarber(current(), bookingReference, request.status()));
    }

    @PreAuthorize("hasRole('SALON_OWNER')")
    @GetMapping("/salons/mine/appointments")
    public List<AppointmentDtos.Response> ownerAppointments(@RequestParam(required = false) LocalDate date) {
        return service.forOwner(current(), date).stream().map(AppointmentDtos.Response::from).toList();
    }

    @PreAuthorize("hasRole('SALON_OWNER')")
    @PostMapping("/salons/mine/appointments/{bookingReference}/status")
    public AppointmentDtos.Response updateStatusByOwner(
            @PathVariable String bookingReference,
            @Valid @RequestBody AppointmentDtos.StatusUpdateRequest request) {
        return AppointmentDtos.Response.from(service.updateStatusByOwner(current(), bookingReference, request.status()));
    }

    @PreAuthorize("hasRole('SALON_OWNER')")
    @GetMapping("/salons/mine/appointments/{bookingReference}/available-barbers")
    public List<AppointmentDtos.CandidateBarberResponse> availableBarbersForReassignment(
            @PathVariable String bookingReference) {
        return service.availableBarbersForReassignment(current(), bookingReference).stream()
                .map(m -> new AppointmentDtos.CandidateBarberResponse(m.getBarber().getId(), m.getBarber().getDisplayName()))
                .toList();
    }

    @PreAuthorize("hasRole('SALON_OWNER')")
    @PostMapping("/salons/mine/appointments/{bookingReference}/reassign")
    public AppointmentDtos.Response reassignByOwner(
            @PathVariable String bookingReference,
            @Valid @RequestBody AppointmentDtos.ReassignRequest request) {
        return AppointmentDtos.Response.from(service.reassign(current(), bookingReference, request.targetBarberId()));
    }
}
