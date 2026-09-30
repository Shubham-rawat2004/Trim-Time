package com.trimtime.barber;

import com.trimtime.identity.*;
import com.trimtime.salon.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;
import java.util.*;
import java.util.concurrent.*;
import java.time.*;
import java.math.BigDecimal;
import com.trimtime.appointment.*;
import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
@SpringBootTest
class BarberOnboardingIT {
    @Container static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4.8");
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url",MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username",MYSQL::getUsername);
        registry.add("spring.datasource.password",MYSQL::getPassword);
    }
    @Autowired BarberService onboarding;
    @Autowired UserAccountRepository users;
    @Autowired SalonRepository salons;
    @Autowired BarberJoinRequestRepository requests;
    @Autowired BarberMembershipRepository memberships;
    @Autowired com.trimtime.appointment.AppointmentRepository appointments;
    @Autowired PlatformTransactionManager transactions;
    Long applicant, firstOwner, secondOwner, firstSalon, secondSalon;
    static final BarberDtos.ApplyRequest INPUT = new BarberDtos.ApplyRequest("Please consider me","Bio",2);

    @BeforeEach void fixture() {
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            var person = user("Applicant");
            var owner1 = user("Owner 1");
            var owner2 = user("Owner 2");
            owner1.addRole(Role.SALON_OWNER);
            owner2.addRole(Role.SALON_OWNER);
            users.save(owner1);
            users.save(owner2);
            applicant=person.getId(); firstOwner=owner1.getId(); secondOwner=owner2.getId();
            firstSalon=salons.save(new Salon(owner1,"First","","Address","Contact",null,null,"Asia/Kolkata")).getId();
            secondSalon=salons.save(new Salon(owner2,"Second","","Address","Contact",null,null,"Asia/Kolkata")).getId();
        });
    }
    private UserAccount user(String name) { return users.save(new UserAccount(UUID.randomUUID()+"@example.test","unused",name)); }

    @Test void rejectsPendingApplicationToEitherSameOrDifferentSalon() {
        onboarding.apply(applicant,firstSalon,INPUT);
        assertThrows(BarberService.PendingRequestException.class, () -> onboarding.apply(applicant,firstSalon,INPUT));
        assertThrows(BarberService.PendingRequestException.class, () -> onboarding.apply(applicant,secondSalon,INPUT));
        assertEquals(1,onboarding.mine(applicant).size());
    }

    @Test void rejectionReleasesPendingSlotAndKeepsHistory() {
        var first = onboarding.apply(applicant,firstSalon,INPUT);
        onboarding.decide(firstOwner,first.getId(),false);
        var second = onboarding.apply(applicant,secondSalon,INPUT);
        assertEquals(BarberStatus.PENDING,second.getStatus());
        assertEquals(BarberStatus.REJECTED,requests.findById(first.getId()).orElseThrow().getStatus());
        assertEquals(2,onboarding.mine(applicant).size());
        assertFalse(users.findById(applicant).orElseThrow().getRoles().contains(Role.BARBER));
    }

    @Test void databaseRejectsBypassWhileAllowingTerminalHistory() {
        onboarding.apply(applicant,firstSalon,INPUT);
        assertThrows(DataIntegrityViolationException.class, () -> new TransactionTemplate(transactions).executeWithoutResult(status ->
                requests.saveAndFlush(new BarberJoinRequest(users.findById(applicant).orElseThrow(),
                        salons.findById(secondSalon).orElseThrow(),"Bypass"))));
        assertEquals(1,onboarding.mine(applicant).size());
    }

    @Test void concurrentApplicationsToDifferentSalonsCreateOnlyOnePendingRequest() throws Exception {
        var results = race(() -> onboarding.apply(applicant,firstSalon,INPUT),
                () -> onboarding.apply(applicant,secondSalon,INPUT));
        assertEquals(1,results.stream().filter(BarberJoinRequest.class::isInstance).count());
        assertEquals(1,results.stream().filter(BarberService.PendingRequestException.class::isInstance).count());
        assertEquals(1,onboarding.mine(applicant).stream().filter(r -> r.getStatus()==BarberStatus.PENDING).count());
    }

    @Test void concurrentApprovalCreatesOneMembershipAndKeepsCustomerRole() throws Exception {
        var request=onboarding.apply(applicant,firstSalon,INPUT);
        var results=race(() -> onboarding.decide(firstOwner,request.getId(),true),
                () -> onboarding.decide(firstOwner,request.getId(),true));
        assertEquals(1,results.stream().filter(BarberMembership.class::isInstance).count());
        assertEquals(1,results.stream().filter(BarberService.RequestAlreadyDecidedException.class::isInstance).count());
        assertEquals(Set.of(Role.CUSTOMER,Role.BARBER),users.findById(applicant).orElseThrow().getRoles());
        assertTrue(memberships.existsByBarberId(applicant));
        assertFalse(requests.existsByBarberIdAndStatus(applicant,BarberStatus.PENDING));
    }

    @Test void approvalVersusRejectionCannotLeaveRoleAndMembershipInconsistent() throws Exception {
        var request=onboarding.apply(applicant,firstSalon,INPUT);
        var results=race(() -> onboarding.decide(firstOwner,request.getId(),true),
                () -> onboarding.decide(firstOwner,request.getId(),false));
        assertEquals(1,results.stream().filter(BarberService.RequestAlreadyDecidedException.class::isInstance).count());
        boolean approved=requests.findById(request.getId()).orElseThrow().getStatus()==BarberStatus.APPROVED;
        assertEquals(approved,memberships.existsByBarberId(applicant));
        assertEquals(approved,users.findById(applicant).orElseThrow().getRoles().contains(Role.BARBER));
    }

    @Test void approvalVersusNewApplicationNeverCreatesPendingRequestForAnActiveMember() throws Exception {
        var request=onboarding.apply(applicant,firstSalon,INPUT);
        var results=race(() -> onboarding.decide(firstOwner,request.getId(),true),
                () -> onboarding.apply(applicant,secondSalon,INPUT));
        assertEquals(1,results.stream().filter(BarberMembership.class::isInstance).count());
        assertTrue(results.stream().anyMatch(r -> r instanceof BarberService.AlreadyMemberException || r instanceof BarberService.PendingRequestException));
        assertFalse(requests.existsByBarberIdAndStatus(applicant,BarberStatus.PENDING));
        assertEquals(1,onboarding.mine(applicant).size());
    }

    @Test void wrongOwnerCannotDecideAndCannotReleasePendingSlot() {
        var request=onboarding.apply(applicant,firstSalon,INPUT);
        assertThrows(BarberService.ForbiddenDecisionException.class, () -> onboarding.decide(secondOwner,request.getId(),false));
        assertThrows(BarberService.PendingRequestException.class, () -> onboarding.apply(applicant,secondSalon,INPUT));
        assertEquals(BarberStatus.PENDING,requests.findById(request.getId()).orElseThrow().getStatus());
    }

    @Test void applicantCanWithdrawPendingApplicationAndApplyElsewhere() {
        var request = onboarding.apply(applicant, firstSalon, INPUT);
        assertEquals(BarberStatus.PENDING, request.getStatus());

        var withdrawn = onboarding.withdraw(applicant, request.getId());
        assertEquals(BarberStatus.WITHDRAWN, withdrawn.getStatus());
        assertEquals(BarberStatus.WITHDRAWN, requests.findById(request.getId()).orElseThrow().getStatus());

        var newRequest = onboarding.apply(applicant, secondSalon, INPUT);
        assertEquals(BarberStatus.PENDING, newRequest.getStatus());
        assertEquals(2, onboarding.mine(applicant).size());
    }

    @Test void cannotWithdrawOthersOrDecidedApplication() {
        var request = onboarding.apply(applicant, firstSalon, INPUT);

        assertThrows(BarberService.ForbiddenWithdrawalException.class,
                () -> onboarding.withdraw(secondOwner, request.getId()));

        onboarding.decide(firstOwner, request.getId(), true);

        assertThrows(BarberService.InvalidWithdrawalStatusException.class,
                () -> onboarding.withdraw(applicant, request.getId()));
    }

    @Test void ownerCanSelfEnrollAsBarberWithoutJoinRequest() {
        var membership = onboarding.enrollOwner(firstOwner, new BarberDtos.SelfEnrollRequest("Master owner barber", 10));
        assertNotNull(membership);
        assertEquals(firstOwner, membership.getBarber().getId());
        assertEquals(firstSalon, membership.getSalon().getId());

        var owner = users.findById(firstOwner).orElseThrow();
        assertTrue(owner.getRoles().contains(Role.BARBER));
        assertTrue(owner.getRoles().contains(Role.SALON_OWNER));

        assertTrue(memberships.existsByBarberId(firstOwner));

        assertThrows(BarberService.AlreadyMemberException.class,
                () -> onboarding.enrollOwner(firstOwner, new BarberDtos.SelfEnrollRequest("Again", 10)));
    }

    @Test void concurrentSelfEnrollmentCreatesOneMembership() throws Exception {
        var results = race(
                () -> onboarding.enrollOwner(secondOwner, new BarberDtos.SelfEnrollRequest("First", 5)),
                () -> onboarding.enrollOwner(secondOwner, new BarberDtos.SelfEnrollRequest("Second", 6)));
        assertEquals(1, results.stream().filter(BarberMembership.class::isInstance).count());
        assertEquals(1, results.stream().filter(BarberService.AlreadyMemberException.class::isInstance).count());
        assertTrue(memberships.existsByBarberId(secondOwner));
        assertTrue(users.findById(secondOwner).orElseThrow().getRoles().contains(Role.BARBER));
    }

    @Test void ownerCanDeactivateBarberWithoutUpcomingAppointments() {
        var request = onboarding.apply(applicant, firstSalon, INPUT);
        onboarding.decide(firstOwner, request.getId(), true);
        assertTrue(memberships.existsByBarberId(applicant));
        assertTrue(users.findById(applicant).orElseThrow().getRoles().contains(Role.BARBER));

        onboarding.deactivateBarber(firstOwner, applicant);

        assertFalse(memberships.existsByBarberId(applicant));
        assertFalse(users.findById(applicant).orElseThrow().getRoles().contains(Role.BARBER));

        var newRequest = onboarding.apply(applicant, secondSalon, INPUT);
        assertEquals(BarberStatus.PENDING, newRequest.getStatus());
    }

    @Test void barberCanLeaveSalonVoluntarily() {
        var request = onboarding.apply(applicant, firstSalon, INPUT);
        onboarding.decide(firstOwner, request.getId(), true);
        assertTrue(memberships.existsByBarberId(applicant));

        onboarding.leaveSalon(applicant);

        assertFalse(memberships.existsByBarberId(applicant));
        assertFalse(users.findById(applicant).orElseThrow().getRoles().contains(Role.BARBER));
    }

    @Test void cannotDeactivateBarberWithUnfinishedAppointments() {
        var request = onboarding.apply(applicant, firstSalon, INPUT);
        onboarding.decide(firstOwner, request.getId(), true);

        var salon = salons.findById(firstSalon).orElseThrow();
        var customer = users.findById(secondOwner).orElseThrow();
        var barber = users.findById(applicant).orElseThrow();
        var start = LocalDateTime.now().plusDays(1);
        var end = start.plusMinutes(30);
        appointments.saveAndFlush(new Appointment(customer, salon, barber, start, end,
                start.atZone(ZoneId.of("Asia/Kolkata")).toInstant(),
                end.atZone(ZoneId.of("Asia/Kolkata")).toInstant(),
                "Haircut", null, 30, BigDecimal.valueOf(100), "key-1", "fp-1"));

        assertThrows(com.trimtime.appointment.AppointmentProtection.AppointmentConflictException.class,
                () -> onboarding.deactivateBarber(firstOwner, applicant));

        assertThrows(com.trimtime.appointment.AppointmentProtection.AppointmentConflictException.class,
                () -> onboarding.leaveSalon(applicant));

        assertTrue(memberships.existsByBarberId(applicant));
        assertTrue(users.findById(applicant).orElseThrow().getRoles().contains(Role.BARBER));
    }




    private List<Object> race(Callable<?> first,Callable<?> second) throws Exception {
        var ready=new CountDownLatch(2);
        var start=new CountDownLatch(1);
        try (var pool=Executors.newFixedThreadPool(2)) {
            var a=pool.submit(() -> attempt(first,ready,start));
            var b=pool.submit(() -> attempt(second,ready,start));
            try {
                assertTrue(ready.await(5,TimeUnit.SECONDS));
                start.countDown();
                return Arrays.asList(a.get(15,TimeUnit.SECONDS),b.get(15,TimeUnit.SECONDS));
            } finally { start.countDown(); }
        }
    }
    private Object attempt(Callable<?> call,CountDownLatch ready,CountDownLatch start) throws Exception {
        ready.countDown();
        if (!start.await(5,TimeUnit.SECONDS)) throw new IllegalStateException("Start timeout");
        try { return call.call(); } catch (RuntimeException ex) { return ex; }
    }
}
