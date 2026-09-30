package com.trimtime.barber;

import com.trimtime.appointment.AppointmentProtection;
import com.trimtime.appointment.BookingWriteLock;
import com.trimtime.catalogue.ServiceOffering;
import com.trimtime.catalogue.ServiceOfferingRepository;
import com.trimtime.salon.SalonRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import java.util.HashSet;
import java.util.List;

@Service
public class BarberQualificationService {
    private final SalonRepository salons;
    private final BarberMembershipRepository memberships;
    private final BarberServiceQualificationRepository qualifications;
    private final ServiceOfferingRepository services;
    private final BookingWriteLock locks;
    private final AppointmentProtection protection;

    public BarberQualificationService(SalonRepository salons, BarberMembershipRepository memberships,
                                      BarberServiceQualificationRepository qualifications, ServiceOfferingRepository services,
                                      BookingWriteLock locks, AppointmentProtection protection) {
        this.salons = salons;
        this.memberships = memberships;
        this.qualifications = qualifications;
        this.services = services;
        this.locks = locks;
        this.protection = protection;
    }

    @Transactional(readOnly = true)
    public List<BarberQualificationDtos.BarberResponse> list(Long ownerId) {
        var salon = salons.findByOwnerId(ownerId).orElseThrow(SalonMissingException::new);
        return memberships.findBySalonId(salon.getId()).stream()
                .map(m -> response(m.getBarber().getId(), m.getBarber().getDisplayName())).toList();
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public BarberQualificationDtos.BarberResponse update(Long ownerId, Long barberId, BarberQualificationDtos.UpdateRequest input) {
        locks.owner(ownerId);
        var salon = salons.findByOwnerId(ownerId).orElseThrow(SalonMissingException::new);
        var membership = memberships.findByBarberId(barberId)
                .filter(m -> m.getSalon().getId().equals(salon.getId())).orElseThrow(BarberMissingException::new);
        var selected = input.serviceIds().stream().distinct().map(id -> services.findByIdAndSalonId(id, salon.getId())
                .filter(ServiceOffering::isActive).orElseThrow(ServiceMissingException::new)).toList();
        protection.qualifications(barberId, new HashSet<>(input.serviceIds()),
                qualifications.findByBarberId(barberId).stream().map(q -> q.getService().getId()).toList());
        qualifications.deleteByBarberId(barberId);
        qualifications.flush();
        qualifications.saveAll(selected.stream().map(s -> new BarberServiceQualification(membership.getBarber(), s)).toList());
        return response(barberId, membership.getBarber().getDisplayName());
    }

    private BarberQualificationDtos.BarberResponse response(Long id, String name) {
        return new BarberQualificationDtos.BarberResponse(id, name,
                qualifications.findByBarberId(id).stream().map(q -> q.getService().getId()).toList());
    }
    public static class SalonMissingException extends RuntimeException {}
    public static class BarberMissingException extends RuntimeException {}
    public static class ServiceMissingException extends RuntimeException {}
}
