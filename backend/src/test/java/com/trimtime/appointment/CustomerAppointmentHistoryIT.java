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
class CustomerAppointmentHistoryIT {
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
    @Autowired ServiceOfferingRepository services;
    @Autowired BarberMembershipRepository memberships;
    @Autowired BarberServiceQualificationRepository qualifications;
    @Autowired WorkingHourRepository hours;
    @Autowired AppointmentService appointmentService;
    @Autowired AppointmentRepository appointmentRepository;
    @Autowired PlatformTransactionManager transactions;

    Long customer1Id, customer2Id, salonId, serviceId, barberId;
    LocalDate testDate;

    @BeforeEach
    void setup() {
        testDate = LocalDate.of(2026, 9, 22);
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            var owner = users.save(new UserAccount(UUID.randomUUID() + "@example.test", "pass", "Owner"));
            var barber = users.save(new UserAccount(UUID.randomUUID() + "@example.test", "pass", "Barber"));
            var customer1 = users.save(new UserAccount(UUID.randomUUID() + "@example.test", "pass", "Alice"));
            var customer2 = users.save(new UserAccount(UUID.randomUUID() + "@example.test", "pass", "Bob"));
            var salon = salons.save(new Salon(owner, "History Salon", "Desc", "123 Main St", "1234567890",
                    null, null, "Asia/Kolkata", 15, 30));
            var service = services.save(new ServiceOffering(salon, "Trim", "Desc", new BigDecimal("50.00"), 30));
            memberships.save(new BarberMembership(barber, salon, owner));
            qualifications.save(new BarberServiceQualification(barber, service));
            hours.save(new WorkingHour(barber, testDate.with(DayOfWeek.MONDAY), 2, LocalTime.of(9, 0), LocalTime.of(17, 0)));

            customer1Id = customer1.getId();
            customer2Id = customer2.getId();
            salonId = salon.getId();
            serviceId = service.getId();
            barberId = barber.getId();
        });
    }

    @Test
    void paginatesCustomerAppointmentHistory() {
        // Book 5 appointments for Customer 1 on different times/dates
        var appt1 = appointmentService.book(customer1Id, new AppointmentDtos.CreateRequest(salonId, List.of(serviceId), null, List.of(), testDate, LocalTime.of(9, 0)));
        var appt2 = appointmentService.book(customer1Id, new AppointmentDtos.CreateRequest(salonId, List.of(serviceId), null, List.of(), testDate, LocalTime.of(10, 0)));
        var appt3 = appointmentService.book(customer1Id, new AppointmentDtos.CreateRequest(salonId, List.of(serviceId), null, List.of(), testDate, LocalTime.of(11, 0)));
        var appt4 = appointmentService.book(customer1Id, new AppointmentDtos.CreateRequest(salonId, List.of(serviceId), null, List.of(), testDate, LocalTime.of(14, 0)));
        var appt5 = appointmentService.book(customer1Id, new AppointmentDtos.CreateRequest(salonId, List.of(serviceId), null, List.of(), testDate, LocalTime.of(15, 0)));

        // Page 0 with size 2 (expect 2 newest: 15:00 and 14:00)
        var page0 = appointmentService.mine(customer1Id, null, 0, 2);
        assertEquals(2, page0.getContent().size());
        assertEquals(5, page0.getTotalElements());
        assertEquals(3, page0.getTotalPages());
        assertEquals(LocalTime.of(15, 0), page0.getContent().get(0).getStartAt().toLocalTime());
        assertEquals(LocalTime.of(14, 0), page0.getContent().get(1).getStartAt().toLocalTime());
        assertTrue(page0.isFirst());
        assertFalse(page0.isLast());

        // Page 1 with size 2 (expect next 2: 11:00 and 10:00)
        var page1 = appointmentService.mine(customer1Id, null, 1, 2);
        assertEquals(2, page1.getContent().size());
        assertEquals(LocalTime.of(11, 0), page1.getContent().get(0).getStartAt().toLocalTime());
        assertEquals(LocalTime.of(10, 0), page1.getContent().get(1).getStartAt().toLocalTime());
        assertFalse(page1.isFirst());
        assertFalse(page1.isLast());

        // Page 2 with size 2 (expect last 1: 09:00)
        var page2 = appointmentService.mine(customer1Id, null, 2, 2);
        assertEquals(1, page2.getContent().size());
        assertEquals(LocalTime.of(9, 0), page2.getContent().get(0).getStartAt().toLocalTime());
        assertFalse(page2.isFirst());
        assertTrue(page2.isLast());
    }

    @Test
    void filtersCustomerAppointmentsByStatus() {
        var appt1 = appointmentService.book(customer1Id, new AppointmentDtos.CreateRequest(salonId, List.of(serviceId), null, List.of(), testDate, LocalTime.of(9, 0)));
        var appt2 = appointmentService.book(customer1Id, new AppointmentDtos.CreateRequest(salonId, List.of(serviceId), null, List.of(), testDate, LocalTime.of(10, 0)));
        var appt3 = appointmentService.book(customer1Id, new AppointmentDtos.CreateRequest(salonId, List.of(serviceId), null, List.of(), testDate, LocalTime.of(11, 0)));

        // Cancel appt2
        appointmentService.cancelByCustomer(customer1Id, appt2.getBookingReference());

        // Complete appt1 (simulated by updating status directly or via barber)
        appointmentService.updateStatusByBarber(barberId, appt1.getBookingReference(), AppointmentStatus.IN_PROGRESS);
        appointmentService.updateStatusByBarber(barberId, appt1.getBookingReference(), AppointmentStatus.COMPLETED);

        // Filter: CONFIRMED (only appt3 remains)
        var confirmedPage = appointmentService.mine(customer1Id, AppointmentStatus.CONFIRMED, 0, 10);
        assertEquals(1, confirmedPage.getTotalElements());
        assertEquals(appt3.getBookingReference(), confirmedPage.getContent().get(0).getBookingReference());

        // Filter: CANCELLED (only appt2)
        var cancelledPage = appointmentService.mine(customer1Id, AppointmentStatus.CANCELLED, 0, 10);
        assertEquals(1, cancelledPage.getTotalElements());
        assertEquals(appt2.getBookingReference(), cancelledPage.getContent().get(0).getBookingReference());

        // Filter: COMPLETED (only appt1)
        var completedPage = appointmentService.mine(customer1Id, AppointmentStatus.COMPLETED, 0, 10);
        assertEquals(1, completedPage.getTotalElements());
        assertEquals(appt1.getBookingReference(), completedPage.getContent().get(0).getBookingReference());

        // Filter: NO_SHOW (none)
        var noShowPage = appointmentService.mine(customer1Id, AppointmentStatus.NO_SHOW, 0, 10);
        assertEquals(0, noShowPage.getTotalElements());
    }

    @Test
    void customerHistoryIsStrictlyIsolated() {
        var cust1Appt = appointmentService.book(customer1Id, new AppointmentDtos.CreateRequest(salonId, List.of(serviceId), null, List.of(), testDate, LocalTime.of(9, 0)));
        var cust2Appt = appointmentService.book(customer2Id, new AppointmentDtos.CreateRequest(salonId, List.of(serviceId), null, List.of(), testDate, LocalTime.of(10, 0)));

        var cust1History = appointmentService.mine(customer1Id, null, 0, 10);
        assertEquals(1, cust1History.getTotalElements());
        assertEquals(cust1Appt.getBookingReference(), cust1History.getContent().get(0).getBookingReference());

        var cust2History = appointmentService.mine(customer2Id, null, 0, 10);
        assertEquals(1, cust2History.getTotalElements());
        assertEquals(cust2Appt.getBookingReference(), cust2History.getContent().get(0).getBookingReference());
    }
}
