package com.trimtime.barber;

import com.trimtime.appointment.BookingWriteLock;
import com.trimtime.identity.*;
import com.trimtime.salon.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class BarberService {
    private final BookingWriteLock locks;
    private final UserAccountRepository users;
    private final SalonRepository salons;
    private final BarberJoinRequestRepository requests;
    private final BarberMembershipRepository memberships;
    private final BarberServiceQualificationRepository qualifications;
    private final com.trimtime.appointment.AppointmentProtection protection;
    private final JdbcTemplate jdbc;

    public BarberService(UserAccountRepository users, SalonRepository salons, BarberJoinRequestRepository requests,
                         BarberMembershipRepository memberships, BarberServiceQualificationRepository qualifications,
                         com.trimtime.appointment.AppointmentProtection protection, JdbcTemplate jdbc, BookingWriteLock locks) {
        this.locks = locks;
        this.users = users;
        this.salons = salons;
        this.requests = requests;
        this.memberships = memberships;
        this.qualifications = qualifications;
        this.protection = protection;
        this.jdbc = jdbc;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public BarberJoinRequest apply(Long barberId, Long salonId, BarberDtos.ApplyRequest input) {
        locks.salon(salonId);
        // The applicant lock serializes requests to different salons. Keep salon -> user lock order.
        users.lockId(barberId).orElseThrow(UnknownUserException::new);
        var barber = users.findById(barberId).orElseThrow(UnknownUserException::new);
        var salon = salons.findById(salonId).orElseThrow(SalonMissingException::new);
        if (salon.getOwner().getId().equals(barberId)) {
            throw new InvalidOnboardingException("A salon owner cannot request to join their own salon");
        }
        if (memberships.existsByBarberId(barberId)) throw new AlreadyMemberException();
        if (requests.existsByBarberIdAndStatus(barberId, BarberStatus.PENDING)) throw new PendingRequestException();
        jdbc.update("INSERT INTO barber_profiles (user_id, bio, experience_years) VALUES (?, ?, ?) "
                        + "ON DUPLICATE KEY UPDATE bio = VALUES(bio), experience_years = VALUES(experience_years)",
                barberId, input.bio() == null ? "" : input.bio(), input.experienceYears() == null ? 0 : input.experienceYears());
        return requests.save(new BarberJoinRequest(barber, salon, input.message() == null ? "" : input.message()));
    }

    @Transactional(readOnly = true)
    public List<BarberJoinRequest> mine(Long barberId) {
        return requests.findByBarberIdOrderByCreatedAtDesc(barberId);
    }

    @Transactional(readOnly = true)
    public List<BarberJoinRequest> forOwner(Long ownerId) {
        var salon = salons.findByOwnerId(ownerId).orElseThrow(SalonMissingException::new);
        return requests.findBySalonIdAndStatusOrderByCreatedAtAsc(salon.getId(), BarberStatus.PENDING);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public BarberMembership decide(Long ownerId, Long requestId, boolean approve) {
        Long salonId = locks.owner(ownerId);
        Long requestSalonId = requests.findSalonIdById(requestId).orElseThrow(RequestMissingException::new);
        if (!salonId.equals(requestSalonId)) throw new ForbiddenDecisionException();
        Long barberId = requests.findBarberIdById(requestId).orElseThrow(RequestMissingException::new);
        users.lockId(barberId).orElseThrow(UnknownUserException::new);
        // Read the request and account only after both locks, so waiting writers see current state/roles.
        var request = requests.findById(requestId).orElseThrow(RequestMissingException::new);
        if (request.getStatus() != BarberStatus.PENDING) throw new RequestAlreadyDecidedException();
        if (!approve) {
            request.decide(BarberStatus.REJECTED);
            return null;
        }
        if (memberships.existsByBarberId(barberId)) throw new AlreadyMemberException();
        request.decide(BarberStatus.APPROVED);
        request.getBarber().addRole(Role.BARBER);
        var owner = users.findById(ownerId).orElseThrow(UnknownUserException::new);
        return memberships.save(new BarberMembership(request.getBarber(), request.getSalon(), owner));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public BarberJoinRequest withdraw(Long barberUserId, Long requestId) {
        Long barberId = requests.findBarberIdById(requestId).orElseThrow(RequestMissingException::new);
        if (!barberId.equals(barberUserId)) {
            throw new ForbiddenWithdrawalException("You can only withdraw your own applications.");
        }
        Long salonId = requests.findSalonIdById(requestId).orElseThrow(RequestMissingException::new);
        locks.salon(salonId);
        users.lockId(barberUserId).orElseThrow(UnknownUserException::new);
        var request = requests.findById(requestId).orElseThrow(RequestMissingException::new);
        if (request.getStatus() != BarberStatus.PENDING) {
            throw new InvalidWithdrawalStatusException("Only pending applications can be withdrawn.");
        }
        request.decide(BarberStatus.WITHDRAWN);
        return requests.save(request);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public BarberMembership enrollOwner(Long ownerId, BarberDtos.SelfEnrollRequest input) {
        Long salonId = locks.owner(ownerId);
        users.lockId(ownerId).orElseThrow(UnknownUserException::new);
        var owner = users.findById(ownerId).orElseThrow(UnknownUserException::new);
        var salon = salons.findById(salonId).orElseThrow(SalonMissingException::new);

        if (memberships.existsByBarberId(ownerId)) {
            throw new AlreadyMemberException();
        }

        requests.findByBarberIdOrderByCreatedAtDesc(ownerId).stream()
                .filter(r -> r.getStatus() == BarberStatus.PENDING)
                .forEach(r -> {
                    r.decide(BarberStatus.WITHDRAWN);
                    requests.save(r);
                });

        String bio = (input != null && input.bio() != null) ? input.bio() : "";
        int experienceYears = (input != null && input.experienceYears() != null) ? input.experienceYears() : 0;
        jdbc.update("INSERT INTO barber_profiles (user_id, bio, experience_years) VALUES (?, ?, ?) "
                        + "ON DUPLICATE KEY UPDATE bio = VALUES(bio), experience_years = VALUES(experience_years)",
                ownerId, bio, experienceYears);

        owner.addRole(Role.BARBER);
        users.save(owner);

        return memberships.save(new BarberMembership(owner, salon, owner));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void deactivateBarber(Long ownerId, Long barberId) {
        Long salonId = locks.owner(ownerId);
        users.lockId(barberId).orElseThrow(UnknownUserException::new);
        var salon = salons.findById(salonId).orElseThrow(SalonMissingException::new);
        var membership = memberships.findByBarberId(barberId)
                .filter(m -> m.getSalon().getId().equals(salon.getId()))
                .orElseThrow(BarberMissingException::new);

        protection.membershipDeactivation(barberId);

        qualifications.deleteByBarberId(barberId);
        memberships.delete(membership);

        var barber = users.findById(barberId).orElseThrow(UnknownUserException::new);
        barber.removeRole(Role.BARBER);
        users.save(barber);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void leaveSalon(Long barberId) {
        var membership = memberships.findByBarberId(barberId).orElseThrow(MembershipMissingException::new);
        Long salonId = membership.getSalon().getId();
        locks.salon(salonId);
        users.lockId(barberId).orElseThrow(UnknownUserException::new);

        protection.membershipDeactivation(barberId);

        qualifications.deleteByBarberId(barberId);
        memberships.delete(membership);

        var barber = users.findById(barberId).orElseThrow(UnknownUserException::new);
        barber.removeRole(Role.BARBER);
        users.save(barber);
    }

    public static class BarberMissingException extends RuntimeException {}
    public static class MembershipMissingException extends RuntimeException {}
    public static class UnknownUserException extends RuntimeException {}
    public static class SalonMissingException extends RuntimeException {}
    public static class RequestMissingException extends RuntimeException {}
    public static class PendingRequestException extends RuntimeException {}
    public static class AlreadyMemberException extends RuntimeException {}
    public static class InvalidOnboardingException extends RuntimeException {
        public InvalidOnboardingException(String message) { super(message); }
    }
    public static class ForbiddenDecisionException extends RuntimeException {}
    public static class RequestAlreadyDecidedException extends RuntimeException {}
    public static class ForbiddenWithdrawalException extends RuntimeException {
        public ForbiddenWithdrawalException(String message) { super(message); }
    }
    public static class InvalidWithdrawalStatusException extends RuntimeException {
        public InvalidWithdrawalStatusException(String message) { super(message); }
    }
}
