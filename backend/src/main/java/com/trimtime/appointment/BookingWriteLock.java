package com.trimtime.appointment;

import com.trimtime.availability.AvailabilityService;
import com.trimtime.barber.BarberMembershipRepository;
import com.trimtime.salon.SalonRepository;
import com.trimtime.salon.SalonService;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** All availability-affecting writes lock the salon before reading booking inputs. */
@Component
@Transactional(propagation = Propagation.MANDATORY)
public class BookingWriteLock {
    private final SalonRepository salons;
    private final BarberMembershipRepository memberships;

    public BookingWriteLock(SalonRepository salons, BarberMembershipRepository memberships) {
        this.salons = salons;
        this.memberships = memberships;
    }

    public void salon(Long salonId) {
        salons.lockId(salonId).orElseThrow(SalonService.SalonNotFoundException::new);
    }

    public Long owner(Long ownerId) {
        Long salonId = salons.findIdByOwnerId(ownerId).orElseThrow(SalonService.SalonNotFoundException::new);
        salon(salonId);
        return salonId;
    }

    public void barber(Long barberId) {
        // Scalar lookup only: do not cache membership or eligibility before waiting for the lock.
        Long salonId = memberships.findSalonIdByBarberId(barberId)
                .orElseThrow(AvailabilityService.MembershipRequiredException::new);
        salon(salonId);
        if (!memberships.findSalonIdByBarberId(barberId).filter(salonId::equals).isPresent()) {
            throw new AvailabilityService.MembershipRequiredException();
        }
    }
}
