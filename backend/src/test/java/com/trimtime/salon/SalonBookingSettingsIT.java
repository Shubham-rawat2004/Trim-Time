package com.trimtime.salon;

import com.trimtime.appointment.AppointmentDtos;
import com.trimtime.appointment.AppointmentService;
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
class SalonBookingSettingsIT {
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
            return Clock.fixed(Instant.parse("2026-09-22T03:00:00Z"), ZoneOffset.UTC); // 08:30 in Asia/Kolkata
        }
    }

    @Autowired UserAccountRepository users;
    @Autowired SalonRepository salons;
    @Autowired SalonService salonService;
    @Autowired ServiceOfferingRepository services;
    @Autowired BarberMembershipRepository memberships;
    @Autowired BarberServiceQualificationRepository qualifications;
    @Autowired WorkingHourRepository hours;
    @Autowired AppointmentService appointmentService;
    @Autowired SlotService slotService;
    @Autowired PlatformTransactionManager transactions;

    Long ownerId, customerId, salonId, serviceId, barberId;
    LocalDate testDate;

    @BeforeEach
    void setup() {
        testDate = LocalDate.of(2026, 9, 22);
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            var owner = users.save(new UserAccount(UUID.randomUUID() + "@example.test", "pass", "Owner"));
            var barber = users.save(new UserAccount(UUID.randomUUID() + "@example.test", "pass", "Barber"));
            var customer = users.save(new UserAccount(UUID.randomUUID() + "@example.test", "pass", "Customer"));
            var salon = salons.save(new Salon(owner, "Grid Salon", "Desc", "123 Main St", "1234567890",
                    null, null, "Asia/Kolkata", 15, 14));
            var service = services.save(new ServiceOffering(salon, "Style Cut", "Desc", new BigDecimal("100.00"), 45));
            memberships.save(new BarberMembership(barber, salon, owner));
            qualifications.save(new BarberServiceQualification(barber, service));
            hours.save(new WorkingHour(barber, testDate.with(DayOfWeek.MONDAY), 2, LocalTime.of(9, 0), LocalTime.of(12, 0)));

            ownerId = owner.getId();
            barberId = barber.getId();
            customerId = customer.getId();
            salonId = salon.getId();
            serviceId = service.getId();
        });
    }

    @Test
    void generatesSlotsOn15MinuteGrid() {
        var slots = slotService.find(salonId, List.of(serviceId), List.of(), testDate);
        assertFalse(slots.isEmpty());
        // Service duration = 45 min, working hours = 09:00 - 12:00, increment = 15 min.
        // Expected starts: 09:00, 09:15, 09:30, 09:45, 10:00, 10:15, 10:30, 10:45, 11:00, 11:15
        // (11:15 + 45 min = 12:00, exactly fits). 11:30 would end at 12:15, exceeding 12:00.
        var startTimes = slots.stream().map(s -> s.startTime()).toList();
        assertEquals(List.of(
                LocalTime.of(9, 0), LocalTime.of(9, 15), LocalTime.of(9, 30), LocalTime.of(9, 45),
                LocalTime.of(10, 0), LocalTime.of(10, 15), LocalTime.of(10, 30), LocalTime.of(10, 45),
                LocalTime.of(11, 0), LocalTime.of(11, 15)
        ), startTimes);
    }

    @Test
    void generatesSlotsOn30MinuteGridWhenConfigured() {
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            salonService.update(ownerId, new SalonDtos.SalonRequest("Grid Salon", "Desc", "123 Main St", "1234567890",
                    null, null, "Asia/Kolkata", 30, 14));
        });

        var slots = slotService.find(salonId, List.of(serviceId), List.of(), testDate);
        var startTimes = slots.stream().map(s -> s.startTime()).toList();
        // 09:00, 09:30, 10:00, 10:30, 11:00 (11:00 ends at 11:45; next is 11:30 which ends at 12:15 > 12:00)
        assertEquals(List.of(
                LocalTime.of(9, 0), LocalTime.of(9, 30), LocalTime.of(10, 0),
                LocalTime.of(10, 30), LocalTime.of(11, 0)
        ), startTimes);
    }

    @Test
    void fallsBackToServiceDurationWhenSlotIncrementIsNull() {
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            salonService.update(ownerId, new SalonDtos.SalonRequest("Grid Salon", "Desc", "123 Main St", "1234567890",
                    null, null, "Asia/Kolkata", null, 14));
        });

        var slots = slotService.find(salonId, List.of(serviceId), List.of(), testDate);
        var startTimes = slots.stream().map(s -> s.startTime()).toList();
        // Service duration = 45 min. Starts: 09:00, 09:45, 10:30, 11:15
        assertEquals(List.of(
                LocalTime.of(9, 0), LocalTime.of(9, 45), LocalTime.of(10, 30), LocalTime.of(11, 15)
        ), startTimes);
    }

    @Test
    void rejectsSlotQueryBeyondBookingHorizon() {
        // Horizon is 14 days from testDate (2026-09-22)
        var allowedDate = testDate.plusDays(14);
        // Valid query within horizon (even if no working hours on that day, it won't throw horizon exception)
        assertDoesNotThrow(() -> slotService.find(salonId, List.of(serviceId), List.of(), allowedDate));

        var exceededDate = testDate.plusDays(15);
        var exception = assertThrows(SlotService.BookingHorizonExceededException.class, () ->
                slotService.find(salonId, List.of(serviceId), List.of(), exceededDate));
        assertTrue(exception.getMessage().contains("14 days"));
    }

    @Test
    void rejectsBookingBeyondBookingHorizon() {
        var exceededDate = testDate.plusDays(15);
        var request = new AppointmentDtos.CreateRequest(salonId, List.of(serviceId), null, List.of(), exceededDate, LocalTime.of(9, 0));
        assertThrows(SlotService.BookingHorizonExceededException.class, () ->
                appointmentService.book(customerId, request));
    }

    @Test
    void rejectsBookingNotAlignedWithSlotIncrement() {
        // Salon has 15-minute grid. Attempting booking at 09:10
        var unalignedRequest = new AppointmentDtos.CreateRequest(salonId, List.of(serviceId), null, List.of(), testDate, LocalTime.of(9, 10));
        assertThrows(AppointmentService.InvalidBookingTimeException.class, () ->
                appointmentService.book(customerId, unalignedRequest));

        // Aligned booking at 09:15 succeeds
        var alignedRequest = new AppointmentDtos.CreateRequest(salonId, List.of(serviceId), null, List.of(), testDate, LocalTime.of(9, 15));
        var booked = appointmentService.book(customerId, alignedRequest);
        assertNotNull(booked);
        assertEquals(LocalTime.of(9, 15), booked.getStartAt().toLocalTime());
    }

    @Test
    void rejectsInvalidSettingsOnCreationAndUpdate() {
        // Invalid increment (e.g. 20 min)
        assertThrows(SalonService.InvalidSlotIncrementException.class, () ->
                salonService.create(customerId, new SalonDtos.SalonRequest("Another", "", "Addr", "123", null, null, "Asia/Kolkata", 20, 30)));

        // Invalid horizon (e.g. 0 days or 500 days)
        assertThrows(SalonService.InvalidBookingHorizonException.class, () ->
                salonService.create(customerId, new SalonDtos.SalonRequest("Another", "", "Addr", "123", null, null, "Asia/Kolkata", 15, 0)));
        assertThrows(SalonService.InvalidBookingHorizonException.class, () ->
                salonService.create(customerId, new SalonDtos.SalonRequest("Another", "", "Addr", "123", null, null, "Asia/Kolkata", 15, 500)));
    }
}
