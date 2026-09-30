package com.trimtime.appointment;

import com.trimtime.availability.WorkingHour;
import com.trimtime.availability.WorkingHourRepository;
import com.trimtime.barber.BarberMembership;
import com.trimtime.barber.BarberMembershipRepository;
import com.trimtime.barber.BarberServiceQualification;
import com.trimtime.barber.BarberServiceQualificationRepository;
import com.trimtime.catalogue.ServiceOffering;
import com.trimtime.catalogue.ServiceOfferingRepository;
import com.trimtime.identity.UserAccount;
import com.trimtime.identity.UserAccountRepository;
import com.trimtime.salon.Salon;
import com.trimtime.salon.SalonRepository;
import com.trimtime.salon.SalonDtos;
import com.trimtime.salon.SalonService;
import com.trimtime.slots.SlotService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;

import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
@SpringBootTest
class SlotTimeHandlingIT {
    @Container static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4.8");

    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
    }

    @TestConfiguration
    static class FixedClockConfig {
        @Bean
        @Primary
        Clock fixedClock() {
            return Clock.fixed(Instant.parse("2026-09-22T06:00:00Z"), ZoneOffset.UTC);
        }
    }

    @Autowired UserAccountRepository users;
    @Autowired SalonRepository salons;
    @Autowired ServiceOfferingRepository services;
    @Autowired BarberMembershipRepository memberships;
    @Autowired BarberServiceQualificationRepository qualifications;
    @Autowired WorkingHourRepository hours;
    @Autowired com.trimtime.availability.AvailabilityService availability;
    @Autowired AppointmentService bookings;
    @Autowired SlotService slots;
    @Autowired SalonService salonService;
    @Autowired PlatformTransactionManager transactions;

    Long ownerId, customerId, salonId, serviceId, longServiceId, barberId;
    LocalDate today;
    LocalDate weekStart;

    @BeforeEach
    void fixture() {
        today = LocalDate.of(2026, 9, 22);
        weekStart = today.with(DayOfWeek.MONDAY);
        transaction().executeWithoutResult(status -> {
            var owner = users.save(new UserAccount(UUID.randomUUID() + "@example.test", "unused", "Owner"));
            var barber = users.save(new UserAccount(UUID.randomUUID() + "@example.test", "unused", "Barber"));
            var customer = users.save(new UserAccount(UUID.randomUUID() + "@example.test", "unused", "Customer"));
            var salon = salons.save(new Salon(owner, "Salon", "", "Address", "Contact", null, null, "Asia/Kolkata"));
            var service = services.save(new ServiceOffering(salon, "Cut", "", new BigDecimal("100.00"), 60));
            var longService = services.save(new ServiceOffering(salon, "Long service", "", new BigDecimal("500.00"), 480));
            memberships.save(new BarberMembership(barber, salon, owner));
            qualifications.save(new BarberServiceQualification(barber, service));
            qualifications.save(new BarberServiceQualification(barber, longService));
            hours.save(new WorkingHour(barber, weekStart, 2, LocalTime.of(9, 0), LocalTime.of(17, 0)));
            customerId = customer.getId();
            salonId = salon.getId();
            serviceId = service.getId();
            longServiceId = longService.getId();
            barberId = barber.getId();
            ownerId = owner.getId();
        });
    }

    @Test
    void todaySlotsStartAfterSalonLocalNow() {
        var available = slots.find(salonId, List.of(serviceId), List.of(), today);
        assertFalse(available.isEmpty());
        assertTrue(available.stream().allMatch(slot -> !slot.startTime().isBefore(LocalTime.of(11, 30))));
        assertTrue(available.stream().noneMatch(slot -> slot.startTime().equals(LocalTime.of(11, 0))));
        assertEquals(LocalTime.NOON, available.getFirst().startTime());
    }

    @Test
    void bookingUsesSalonLocalNowInsteadOfServerLocalNow() {
        assertThrows(AppointmentService.InvalidBookingTimeException.class, () ->
                bookings.book(customerId, request(today, LocalTime.of(11, 0), serviceId)));

        var booked = bookings.book(customerId, request(today, LocalTime.NOON, serviceId));
        assertEquals(LocalTime.NOON, booked.getStartAt().toLocalTime());
        assertEquals(Instant.parse("2026-09-22T06:30:00Z"), booked.getStartInstant());
        assertEquals(Instant.parse("2026-09-22T07:30:00Z"), booked.getEndInstant());
        assertEquals("Asia/Kolkata", booked.getSalonTimezone());
    }

    @Test
    void pastSalonLocalDatesAreRejected() {
        assertThrows(SlotService.InvalidSlotRequestException.class, () ->
                slots.find(salonId, List.of(serviceId), List.of(), today.minusDays(1)));
    }

    @Test
    void servicesMustFitBeforeWorkingDayEndsWithoutWrappingPastMidnight() {
        transaction().executeWithoutResult(status -> {
            var hour = hours.findByBarberIdAndWeekStartDateAndDayOfWeek(barberId, weekStart, 2).orElseThrow();
            hour.setTimes(LocalTime.of(18, 0), LocalTime.of(23, 0));
        });

        assertTimeoutPreemptively(java.time.Duration.ofSeconds(3), () ->
                assertTrue(slots.find(salonId, List.of(longServiceId), List.of(), today).isEmpty()));
        assertThrows(AppointmentService.NoBarberAvailableException.class, () ->
                bookings.book(customerId, request(today, LocalTime.of(18, 0), longServiceId)));
    }

    @Test
    void scheduleProtectionUsesTheInjectedSalonClock() {
        bookings.book(customerId, request(today, LocalTime.NOON, serviceId));
        assertThrows(AppointmentProtection.AppointmentConflictException.class, () ->
                availability.addBreak(barberId, new com.trimtime.availability.AvailabilityDtos.BreakRequest(
                        weekStart, 2, LocalTime.NOON, LocalTime.of(13, 0))));
        assertTrue(availability.getBreaks(barberId, weekStart).isEmpty());
    }

    @Test
    void timezoneChangesCannotReinterpretFutureAppointments() {
        bookings.book(customerId, request(today, LocalTime.NOON, serviceId));
        assertThrows(AppointmentProtection.AppointmentConflictException.class, () ->
                salonService.update(ownerId, new SalonDtos.SalonRequest(
                        "Salon", "", "Address", "Contact", null, null, "America/New_York")));
        assertEquals("Asia/Kolkata", salons.findById(salonId).orElseThrow().getTimezone());
    }

    @Test
    void specialDatesUseSalonTodayRatherThanJvmToday() {
        var values = transaction().execute(status -> {
            var owner = users.save(new UserAccount(UUID.randomUUID() + "@example.test", "unused", "Adak owner"));
            var barber = users.save(new UserAccount(UUID.randomUUID() + "@example.test", "unused", "Adak barber"));
            var salon = salons.save(new Salon(owner, "Adak salon", "", "Address", "Contact", null, null, "America/Adak"));
            memberships.save(new BarberMembership(barber, salon, owner));
            var salonToday = LocalDate.of(2026, 9, 21);
            hours.save(new WorkingHour(barber, salonToday, 1, LocalTime.of(9, 0), LocalTime.of(17, 0)));
            return List.of(barber.getId(), salon.getId());
        });
        var adakBarberId = values.getFirst();
        var salonToday = LocalDate.of(2026, 9, 21);

        var saved = availability.addDay(adakBarberId,
                new com.trimtime.availability.AvailabilityDtos.DayOffRequest(salonToday, null, null, "Closed"));
        assertEquals(salonToday, saved.getDate());
        assertEquals(List.of(salonToday), availability.getDays(adakBarberId).stream()
                .map(com.trimtime.availability.DayOff::getDate).toList());
        assertThrows(com.trimtime.availability.AvailabilityService.PastAvailabilityDateException.class, () ->
                availability.addDay(adakBarberId,
                        new com.trimtime.availability.AvailabilityDtos.DayOffRequest(
                                salonToday.minusDays(1), null, null, "Past")));
    }

    @Test
    void daylightSavingGapsAndOverlapsAreNeverBookedArbitrarily() {
        var ids = transaction().execute(status -> {
            var owner = users.save(new UserAccount(UUID.randomUUID() + "@example.test", "unused", "NY owner"));
            var barber = users.save(new UserAccount(UUID.randomUUID() + "@example.test", "unused", "NY barber"));
            var customer = users.save(new UserAccount(UUID.randomUUID() + "@example.test", "unused", "NY customer"));
            var salon = salons.save(new Salon(owner, "NY salon", "", "Address", "Contact", null, null, "America/New_York", null, 365));
            var service = services.save(new ServiceOffering(salon, "Short cut", "", new BigDecimal("50.00"), 30));
            memberships.save(new BarberMembership(barber, salon, owner));
            qualifications.save(new BarberServiceQualification(barber, service));
            var spring = LocalDate.of(2027, 3, 14);
            var autumn = LocalDate.of(2026, 11, 1);
            hours.save(new WorkingHour(barber, spring.with(DayOfWeek.MONDAY), 7, LocalTime.of(1, 0), LocalTime.of(4, 0)));
            hours.save(new WorkingHour(barber, autumn.with(DayOfWeek.MONDAY), 7, LocalTime.MIDNIGHT, LocalTime.of(3, 0)));
            return List.of(customer.getId(), salon.getId(), service.getId());
        });
        var nyCustomer = ids.get(0);
        var nySalon = ids.get(1);
        var nyService = ids.get(2);
        var spring = LocalDate.of(2027, 3, 14);
        var autumn = LocalDate.of(2026, 11, 1);

        assertTrue(slots.find(nySalon, List.of(nyService), List.of(), spring).stream()
                .noneMatch(slot -> slot.startTime().getHour() == 2 || slot.endTime().getHour() == 2));
        assertThrows(com.trimtime.salon.SalonTime.InvalidSalonLocalTimeException.class, () ->
                bookings.book(nyCustomer, request(nySalon, spring, LocalTime.of(2, 0), nyService)));
        assertThrows(com.trimtime.salon.SalonTime.InvalidSalonLocalTimeException.class, () ->
                bookings.book(nyCustomer, request(nySalon, autumn, LocalTime.of(1, 0), nyService)));
    }

    private AppointmentDtos.CreateRequest request(LocalDate date, LocalTime start, Long serviceId) {
        return new AppointmentDtos.CreateRequest(salonId, List.of(serviceId), null, List.of(), date, start);
    }

    private AppointmentDtos.CreateRequest request(Long salonId, LocalDate date, LocalTime start, Long serviceId) {
        return new AppointmentDtos.CreateRequest(salonId, List.of(serviceId), null, List.of(), date, start);
    }

    private TransactionTemplate transaction() {
        var tx = new TransactionTemplate(transactions);
        tx.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
        tx.setTimeout(15);
        return tx;
    }
}
