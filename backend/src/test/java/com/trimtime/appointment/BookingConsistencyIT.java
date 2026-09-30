package com.trimtime.appointment;

import com.trimtime.availability.*;
import com.trimtime.barber.*;
import com.trimtime.catalogue.*;
import com.trimtime.identity.*;
import com.trimtime.salon.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
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
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
@SpringBootTest
class BookingConsistencyIT {
    @Container static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4.8");
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
    }
    @Autowired UserAccountRepository users;
    @Autowired SalonRepository salons;
    @Autowired ServiceOfferingRepository services;
    @Autowired AddOnRepository addons;
    @Autowired BarberMembershipRepository memberships;
    @Autowired BarberServiceQualificationRepository qualifications;
    @Autowired WorkingHourRepository hours;
    @Autowired DayOffRepository days;
    @Autowired BarberBreakRepository breaks;
    @Autowired AppointmentRepository appointments;
    @Autowired AppointmentService bookings;
    @Autowired com.trimtime.slots.SlotService slots;
    @Autowired AvailabilityService availability;
    @Autowired BarberQualificationService qualificationService;
    @Autowired CatalogueService catalogue;
    @Autowired PlatformTransactionManager transactions;
    @Autowired BookingWriteLock locks;
    @Autowired JdbcTemplate jdbc;
    Long ownerId, barberId, customerId, salonId, serviceId, extraServiceId, addonId;
    LocalDate date;

    @BeforeEach void fixture() {
        date = LocalDate.now().plusWeeks(2).with(DayOfWeek.MONDAY);
        transaction().executeWithoutResult(status -> {
            var owner = users.save(new UserAccount(UUID.randomUUID()+"@example.test", "unused", "Owner"));
            var barber = users.save(new UserAccount(UUID.randomUUID()+"@example.test", "unused", "Barber"));
            var customer = users.save(new UserAccount(UUID.randomUUID()+"@example.test", "unused", "Customer"));
            var salon = salons.save(new Salon(owner,"Salon","","Address","Contact",null,null,"Asia/Kolkata"));
            var service = services.save(new ServiceOffering(salon,"Cut","",new BigDecimal("100.00"),30));
            var extra = services.save(new ServiceOffering(salon,"Other","",new BigDecimal("50.00"),30));
            var addon = new AddOn(salon,"Conditioner","",new BigDecimal("25.00"),15);
            addon.addCompatibility(service);
            addons.save(addon);
            memberships.save(new BarberMembership(barber,salon,owner));
            qualifications.save(new BarberServiceQualification(barber,service));
            qualifications.save(new BarberServiceQualification(barber,extra));
            hours.save(new WorkingHour(barber,date,1,LocalTime.of(9,0),LocalTime.of(17,0)));
            hours.save(new WorkingHour(barber,date,2,LocalTime.of(9,0),LocalTime.of(17,0)));
            ownerId=owner.getId(); barberId=barber.getId(); customerId=customer.getId();
            salonId=salon.getId(); serviceId=service.getId(); extraServiceId=extra.getId(); addonId=addon.getId();
        });
    }

    @Test void rejectsHoursAndSpecialDatesThatInvalidateABooking() {
        var booked = book(10);
        var conflict = assertThrows(AppointmentProtection.AppointmentConflictException.class, () -> shrinkHours());
        assertEquals(List.of(booked.getBookingReference()), conflict.getReferences());
        assertEquals(LocalTime.of(9,0), availability.getHours(barberId,date).getFirst().getStartTime());
        assertThrows(AppointmentProtection.AppointmentConflictException.class, () ->
                availability.addDay(barberId,new AvailabilityDtos.DayOffRequest(date,null,null,"Closed")));
        assertThrows(AppointmentProtection.AppointmentConflictException.class, () ->
                availability.addDay(barberId,new AvailabilityDtos.DayOffRequest(date,LocalTime.NOON,LocalTime.of(17,0),"Late")));
        assertTrue(days.findByBarberIdAndDate(barberId,date).isEmpty());
        availability.saveHour(barberId,new AvailabilityDtos.HourRequest(1,date,LocalTime.of(8,0),LocalTime.of(18,0)));
    }

    @Test void bulkEditRollsBackEarlierDaysWhenAnotherDayConflicts() {
        bookings.book(customerId, request(date.plusDays(1),10));
        assertThrows(AppointmentProtection.AppointmentConflictException.class, () -> availability.saveHours(barberId,
                new AvailabilityDtos.BulkHourRequest(List.of(1,2),date,LocalTime.NOON,LocalTime.of(17,0))));
        assertTrue(availability.getHours(barberId,date).stream().allMatch(h -> h.getStartTime().equals(LocalTime.of(9,0))));
    }

    @Test void bulkScheduleRemovesPreviouslySavedUncheckedDays() {
        var saved = availability.saveHours(barberId, new AvailabilityDtos.BulkHourRequest(
                List.of(1), date, LocalTime.of(8, 0), LocalTime.of(16, 0)));
        assertEquals(List.of(1), saved.stream().map(WorkingHour::getDayOfWeek).toList());
        assertEquals(List.of(1), availability.getHours(barberId, date).stream()
                .map(WorkingHour::getDayOfWeek).toList());
        assertEquals(LocalTime.of(8, 0), saved.getFirst().getStartTime());
    }

    @Test void emptyBulkScheduleClosesTheWholeWeek() {
        var saved = availability.saveHours(barberId, new AvailabilityDtos.BulkHourRequest(
                List.of(), date, LocalTime.of(9, 0), LocalTime.of(17, 0)));
        assertTrue(saved.isEmpty());
        assertTrue(availability.getHours(barberId, date).isEmpty());
    }

    @Test void closingDayRemovesItsSpecialOverride() {
        availability.addDay(barberId, new AvailabilityDtos.DayOffRequest(
                date.plusDays(1), LocalTime.of(10, 0), LocalTime.of(15, 0), "Short day"));
        availability.saveHours(barberId, new AvailabilityDtos.BulkHourRequest(
                List.of(1), date, LocalTime.of(9, 0), LocalTime.of(17, 0)));
        assertTrue(days.findByBarberIdAndDate(barberId, date.plusDays(1)).isEmpty());
    }

    @Test void closingBookedDayRollsBackEveryScheduleAndSpecialDateChange() {
        var special = availability.addDay(barberId, new AvailabilityDtos.DayOffRequest(
                date.plusDays(1), LocalTime.of(9, 0), LocalTime.of(16, 0), "Short day"));
        bookings.book(customerId, request(date.plusDays(1), 10));
        assertThrows(AppointmentProtection.AppointmentConflictException.class, () -> availability.saveHours(barberId,
                new AvailabilityDtos.BulkHourRequest(List.of(1), date, LocalTime.of(8, 0), LocalTime.of(18, 0))));
        var unchanged = availability.getHours(barberId, date);
        assertEquals(List.of(1, 2), unchanged.stream().map(WorkingHour::getDayOfWeek).toList());
        assertEquals(LocalTime.of(9, 0), unchanged.getFirst().getStartTime());
        assertEquals(special.getId(), days.findByBarberIdAndDate(barberId, date.plusDays(1)).orElseThrow().getId());
    }

    @Test void breaksSplitSlotsAndBlockDirectBooking() {
        availability.addBreak(barberId, new AvailabilityDtos.BreakRequest(
                date, 1, LocalTime.of(12, 15), LocalTime.of(13, 15)));

        var available = slots.find(salonId, List.of(serviceId), List.of(), date);
        assertTrue(available.stream().noneMatch(slot -> slot.startTime().isBefore(LocalTime.of(13, 15))
                && slot.endTime().isAfter(LocalTime.of(12, 15))));
        assertTrue(available.stream().anyMatch(slot -> slot.startTime().equals(LocalTime.of(13, 15))));
        assertThrows(AppointmentService.NoBarberAvailableException.class, () -> book(12));
        assertEquals(LocalTime.of(13, 15), bookings.book(customerId,
                new AppointmentDtos.CreateRequest(salonId, List.of(serviceId), null, List.of(),
                        date, LocalTime.of(13, 15))).getStartAt().toLocalTime());
    }

    @Test void breaksMustFitWorkingHoursAndCannotOverlap() {
        availability.addBreak(barberId, new AvailabilityDtos.BreakRequest(
                date, 1, LocalTime.NOON, LocalTime.of(13, 0)));
        assertThrows(AvailabilityService.BreakOverlapException.class, () -> availability.addBreak(
                barberId, new AvailabilityDtos.BreakRequest(date, 1,
                        LocalTime.of(12, 30), LocalTime.of(13, 30))));
        assertThrows(AvailabilityService.InvalidBreakException.class, () -> availability.addBreak(
                barberId, new AvailabilityDtos.BreakRequest(date, 1,
                        LocalTime.of(8, 30), LocalTime.of(9, 30))));
        assertThrows(AvailabilityService.InvalidBreakException.class, () -> availability.saveHour(
                barberId, new AvailabilityDtos.HourRequest(1, date,
                        LocalTime.of(13, 0), LocalTime.of(17, 0))));
        assertEquals(1, availability.getBreaks(barberId, date).size());
    }

    @Test void addingBreakOverAppointmentRollsBack() {
        var booked = book(10);
        var conflict = assertThrows(AppointmentProtection.AppointmentConflictException.class, () ->
                availability.addBreak(barberId, new AvailabilityDtos.BreakRequest(
                        date, 1, LocalTime.of(10, 15), LocalTime.of(10, 45))));
        assertEquals(List.of(booked.getBookingReference()), conflict.getReferences());
        assertTrue(availability.getBreaks(barberId, date).isEmpty());
    }

    @Test void closingDayRemovesItsBreaks() {
        availability.addBreak(barberId, new AvailabilityDtos.BreakRequest(
                date.plusDays(1).with(DayOfWeek.MONDAY), 2,
                LocalTime.NOON, LocalTime.of(13, 0)));
        availability.saveHours(barberId, new AvailabilityDtos.BulkHourRequest(
                List.of(1), date, LocalTime.of(9, 0), LocalTime.of(17, 0)));
        assertTrue(availability.getBreaks(barberId, date).isEmpty());
    }

    @Test void breakWaitingForBookingRejectsAndRollsBack() throws Exception {
        assertInstanceOf(AppointmentProtection.AppointmentConflictException.class,
                competing(() -> book(10), () -> availability.addBreak(barberId,
                        new AvailabilityDtos.BreakRequest(date, 1,
                                LocalTime.of(10, 0), LocalTime.of(11, 0)))));
        assertTrue(availability.getBreaks(barberId, date).isEmpty());
    }

    @Test void bookingWaitingForBreakReadsCommittedBreak() throws Exception {
        assertInstanceOf(AppointmentService.NoBarberAvailableException.class,
                competing(() -> availability.addBreak(barberId,
                                new AvailabilityDtos.BreakRequest(date, 1,
                                        LocalTime.of(10, 0), LocalTime.of(11, 0))),
                        () -> book(10)));
        assertEquals(1, availability.getBreaks(barberId, date).size());
    }

    @Test void removingSpecialHoursCannotInvalidateAppointmentOutsideRegularHours() {
        var special = availability.addDay(barberId,new AvailabilityDtos.DayOffRequest(date,LocalTime.of(8,0),LocalTime.of(18,0),"Extended"));
        book(8);
        assertThrows(AppointmentProtection.AppointmentConflictException.class, () -> availability.removeDay(barberId,special.getId()));
        assertTrue(days.findByBarberIdAndDate(barberId,date).isPresent());
        // Editing regular hours must respect the special-date override.
        shrinkHours();
    }

    @Test void requiredServiceIdsSurviveRenameAndOnlyRelevantRemovalIsBlocked() {
        var booked = book(10);
        catalogue.update(ownerId,serviceId,new CatalogueDtos.ServiceRequest("Renamed","",new BigDecimal("200.00"),60));
        qualificationService.update(ownerId,barberId,new BarberQualificationDtos.UpdateRequest(List.of(serviceId)));
        assertThrows(AppointmentProtection.AppointmentConflictException.class, () ->
                qualificationService.update(ownerId,barberId,new BarberQualificationDtos.UpdateRequest(List.of())));
        assertTrue(qualifications.existsByBarberIdAndServiceId(barberId,serviceId));
        var original = bookings.mine(customerId).getFirst();
        assertEquals(booked.getBookingReference(),original.getBookingReference());
        assertEquals("Cut",original.getServiceName());
        assertEquals(new BigDecimal("100.00"),original.getTotalPrice());
        assertEquals(30,original.getDurationMinutes());
    }

    @Test void structuredItemSnapshotsRemainImmutableAfterCatalogueChanges() {
        var booked = bookings.book(customerId, new AppointmentDtos.CreateRequest(
                salonId, List.of(serviceId, extraServiceId), null, List.of(addonId), date, LocalTime.of(10, 0)));

        catalogue.update(ownerId, serviceId,
                new CatalogueDtos.ServiceRequest("Renamed", "", new BigDecimal("200.00"), 60));
        catalogue.deactivateAddon(ownerId, addonId);

        var historical = bookings.mine(customerId).stream()
                .filter(item -> item.getId().equals(booked.getId())).findFirst().orElseThrow();
        assertEquals(List.of(AppointmentItemKind.SERVICE, AppointmentItemKind.SERVICE, AppointmentItemKind.ADD_ON),
                historical.getItems().stream().map(AppointmentItem::getKind).toList());
        assertEquals(List.of("Cut", "Other", "Conditioner"),
                historical.getItems().stream().map(AppointmentItem::getName).toList());
        assertEquals(List.of(new BigDecimal("100.00"), new BigDecimal("50.00"), new BigDecimal("25.00")),
                historical.getItems().stream().map(AppointmentItem::getPrice).toList());
        assertEquals(List.of(30, 30, 15),
                historical.getItems().stream().map(AppointmentItem::getDurationMinutes).toList());
        assertEquals(new BigDecimal("175.00"), historical.getTotalPrice());
        assertEquals(75, historical.getDurationMinutes());
    }

    @Test void legacyBookingsBlockQualificationRemovalWithoutGuessingNames() {
        var booked = book(10);
        jdbc.update("DELETE FROM appointment_required_services WHERE appointment_id=?",booked.getId());
        jdbc.update("DELETE FROM appointment_items WHERE appointment_id=?",booked.getId());
        var legacy = bookings.mine(customerId).getFirst();
        assertTrue(legacy.getItems().isEmpty());
        assertEquals("Cut", legacy.getServiceName());
        assertThrows(AppointmentProtection.AppointmentConflictException.class, () ->
                qualificationService.update(ownerId,barberId,new BarberQualificationDtos.UpdateRequest(List.of(serviceId))));
        qualificationService.update(ownerId,barberId,new BarberQualificationDtos.UpdateRequest(List.of(serviceId,extraServiceId)));
    }

    @Test void protectsInProgressButIgnoresCancelledAndFinishedAppointments() {
        var booked = book(10);
        jdbc.update("UPDATE appointments SET status='IN_PROGRESS' WHERE id=?",booked.getId());
        assertThrows(AppointmentProtection.AppointmentConflictException.class, () -> shrinkHours());
        jdbc.update("UPDATE appointments SET status='CANCELLED' WHERE id=?",booked.getId());
        shrinkHours();
        qualificationService.update(ownerId,barberId,new BarberQualificationDtos.UpdateRequest(List.of()));
    }

    @Test void overlappingBookingsSerializeAndAdjacentBookingStillWorks() throws Exception {
        var result = competing(() -> book(10), () -> book(10));
        assertInstanceOf(AppointmentService.NoBarberAvailableException.class,result);
        assertEquals(1,bookings.mine(customerId).size());
        bookings.book(customerId,new AppointmentDtos.CreateRequest(salonId,List.of(serviceId),null,List.of(),date,LocalTime.of(10,30)));
        assertEquals(2,bookings.mine(customerId).size());
    }

    @Test void retryWithSameRequestKeyReturnsOriginalBooking() {
        var key = UUID.randomUUID().toString();
        var input = request(date, 10);

        var original = bookings.book(customerId, key, input);
        var replay = bookings.book(customerId, key, input);

        assertEquals(original.getId(), replay.getId());
        assertEquals(original.getBookingReference(), replay.getBookingReference());
        assertEquals(1, bookings.mine(customerId).size());
    }

    @Test void requestKeyCannotBeReusedForDifferentBookingContent() {
        var key = UUID.randomUUID().toString();
        bookings.book(customerId, key, request(date, 10));

        assertThrows(AppointmentService.RequestKeyReusedException.class, () ->
                bookings.book(customerId, key, request(date, 11)));
        assertEquals(1, bookings.mine(customerId).size());
    }

    @Test void concurrentRetriesWithSameRequestKeyCreateOneBooking() throws Exception {
        var key = UUID.randomUUID().toString();
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Callable<Appointment> retry = () -> {
                ready.countDown();
                await(start);
                return bookings.book(customerId, key, request(date, 10));
            };
            var first = pool.submit(retry);
            var second = pool.submit(retry);
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            assertEquals(first.get(15, TimeUnit.SECONDS).getBookingReference(),
                    second.get(15, TimeUnit.SECONDS).getBookingReference());
        }
        assertEquals(1, bookings.mine(customerId).size());
    }

    @Test void malformedRequestKeysAreRejectedBeforeBooking() {
        assertThrows(AppointmentService.InvalidRequestKeyException.class, () ->
                bookings.book(customerId, " ", request(date, 10)));
        assertThrows(AppointmentService.InvalidRequestKeyException.class, () ->
                bookings.book(customerId, "contains spaces", request(date, 10)));
        assertTrue(bookings.mine(customerId).isEmpty());
    }

    @Test void scheduleEditWaitingForBookingRejectsAndRollsBack() throws Exception {
        assertInstanceOf(AppointmentProtection.AppointmentConflictException.class,
                competing(() -> book(10), () -> shrinkHours()));
        assertEquals(LocalTime.of(9,0),availability.getHours(barberId,date).getFirst().getStartTime());
    }

    @Test void bookingWaitingForScheduleEditReadsCommittedHours() throws Exception {
        assertInstanceOf(AppointmentService.NoBarberAvailableException.class,
                competing(() -> shrinkHours(), () -> book(10)));
        assertTrue(bookings.mine(customerId).isEmpty());
    }

    @Test void qualificationEditWaitingForBookingRejectsAndRollsBack() throws Exception {
        assertInstanceOf(AppointmentProtection.AppointmentConflictException.class, competing(() -> book(10), () ->
                qualificationService.update(ownerId,barberId,new BarberQualificationDtos.UpdateRequest(List.of()))));
        assertTrue(qualifications.existsByBarberIdAndServiceId(barberId,serviceId));
    }

    @Test void bookingWaitingForQualificationEditReadsCommittedServices() throws Exception {
        assertInstanceOf(AppointmentService.NoBarberAvailableException.class, competing(() ->
                qualificationService.update(ownerId,barberId,new BarberQualificationDtos.UpdateRequest(List.of())), () -> book(10)));
        assertTrue(bookings.mine(customerId).isEmpty());
    }

    @Test void bookingWaitingForCatalogueEditUsesNewPriceAndDuration() throws Exception {
        var result = competing(() -> catalogue.update(ownerId,serviceId,
                new CatalogueDtos.ServiceRequest("Updated","",new BigDecimal("250.00"),60)), () -> book(10));
        var booked = assertInstanceOf(Appointment.class,result);
        assertEquals(new BigDecimal("250.00"),booked.getTotalPrice());
        assertEquals(60,booked.getDurationMinutes());
    }

    @Test void everyPrimaryServiceInAMultiServiceBookingRemainsQualified() {
        bookings.book(customerId,new AppointmentDtos.CreateRequest(salonId,List.of(serviceId,extraServiceId),null,List.of(),date,LocalTime.of(10,0)));
        assertThrows(AppointmentProtection.AppointmentConflictException.class, () -> qualificationService.update(
                ownerId,barberId,new BarberQualificationDtos.UpdateRequest(List.of(serviceId))));
        assertThrows(AppointmentProtection.AppointmentConflictException.class, () -> qualificationService.update(
                ownerId,barberId,new BarberQualificationDtos.UpdateRequest(List.of(extraServiceId))));
    }

    @Test void anotherOwnerCannotReadConflictsOrChangeQualifications() {
        book(10);
        Long otherOwner = transaction().execute(status -> {
            var owner = users.save(new UserAccount(UUID.randomUUID()+"@example.test","unused","Other Owner"));
            salons.save(new Salon(owner,"Other Salon","","Address","Contact",null,null,"Asia/Kolkata"));
            return owner.getId();
        });
        assertThrows(BarberQualificationService.BarberMissingException.class, () -> qualificationService.update(
                otherOwner,barberId,new BarberQualificationDtos.UpdateRequest(List.of())));
        assertTrue(qualifications.existsByBarberIdAndServiceId(barberId,serviceId));
    }

    @Test void customerCanCancelConfirmedAppointmentAndReleasesSlot() {
        var booked = book(10);
        assertEquals(AppointmentStatus.CONFIRMED, booked.getStatus());
        assertTrue(slots.find(salonId, List.of(serviceId), List.of(), date).stream()
                .noneMatch(s -> s.startTime().equals(LocalTime.of(10, 0))));

        var cancelled = bookings.cancelByCustomer(customerId, booked.getBookingReference());
        assertEquals(AppointmentStatus.CANCELLED, cancelled.getStatus());

        assertTrue(slots.find(salonId, List.of(serviceId), List.of(), date).stream()
                .anyMatch(s -> s.startTime().equals(LocalTime.of(10, 0))));

        assertThrows(AppointmentService.AppointmentAlreadyCancelledException.class,
                () -> bookings.cancelByCustomer(customerId, booked.getBookingReference()));
    }

    @Test void otherCustomerCannotCancelAppointment() {
        var booked = book(10);
        assertThrows(AppointmentService.ForbiddenCancellationException.class,
                () -> bookings.cancelByCustomer(barberId, booked.getBookingReference()));
    }

    @Test void ownerCanCancelAppointmentAtOwnedSalon() {
        var booked = book(10);
        var cancelled = bookings.cancelByOwner(ownerId, booked.getBookingReference());
        assertEquals(AppointmentStatus.CANCELLED, cancelled.getStatus());
    }

    @Test void barberCanViewAssignedAppointmentsAndFilterByDate() {
        var booked = book(10);
        var allForBarber = bookings.forBarber(barberId, null);
        assertFalse(allForBarber.isEmpty());
        assertTrue(allForBarber.stream().anyMatch(a -> a.getBookingReference().equals(booked.getBookingReference())));

        var dateMatch = bookings.forBarber(barberId, date);
        assertEquals(1, dateMatch.size());
        assertEquals(booked.getBookingReference(), dateMatch.getFirst().getBookingReference());
        assertEquals(customerId, dateMatch.getFirst().getCustomer().getId());

        var noMatch = bookings.forBarber(barberId, date.plusDays(1));
        assertTrue(noMatch.isEmpty());
    }

    @Test void ownerCanViewSalonAppointmentsAndFilterByDate() {
        var booked = book(10);
        var allForOwner = bookings.forOwner(ownerId, null);
        assertFalse(allForOwner.isEmpty());
        assertTrue(allForOwner.stream().anyMatch(a -> a.getBookingReference().equals(booked.getBookingReference())));

        var dateMatch = bookings.forOwner(ownerId, date);
        assertEquals(1, dateMatch.size());
        assertEquals(booked.getBookingReference(), dateMatch.getFirst().getBookingReference());

        var noMatch = bookings.forOwner(ownerId, date.plusDays(1));
        assertTrue(noMatch.isEmpty());
    }

    @Test void barberCanStartAndCompleteAssignedAppointment() {
        var booked = book(10);
        assertEquals(AppointmentStatus.CONFIRMED, booked.getStatus());

        var inProgress = bookings.updateStatusByBarber(barberId, booked.getBookingReference(), AppointmentStatus.IN_PROGRESS);
        assertEquals(AppointmentStatus.IN_PROGRESS, inProgress.getStatus());

        var completed = bookings.updateStatusByBarber(barberId, booked.getBookingReference(), AppointmentStatus.COMPLETED);
        assertEquals(AppointmentStatus.COMPLETED, completed.getStatus());

        assertThrows(AppointmentService.InvalidStatusTransitionException.class, () ->
                bookings.updateStatusByBarber(barberId, booked.getBookingReference(), AppointmentStatus.CONFIRMED));
    }

    @Test void barberCannotCancelDirectlyOrUpdateOthersAppointments() {
        var booked = book(10);
        assertThrows(AppointmentService.ForbiddenStatusUpdateException.class, () ->
                bookings.updateStatusByBarber(barberId, booked.getBookingReference(), AppointmentStatus.CANCELLED));

        assertThrows(AppointmentService.ForbiddenStatusUpdateException.class, () ->
                bookings.updateStatusByBarber(customerId, booked.getBookingReference(), AppointmentStatus.IN_PROGRESS));
    }

    @Test void markingNoShowReleasesSlotAndTerminalStatusBlocksFurtherTransitions() {
        var booked = book(10);
        var noShow = bookings.updateStatusByOwner(ownerId, booked.getBookingReference(), AppointmentStatus.NO_SHOW);
        assertEquals(AppointmentStatus.NO_SHOW, noShow.getStatus());

        assertTrue(slots.find(salonId, List.of(serviceId), List.of(), date).stream()
                .anyMatch(s -> s.startTime().equals(LocalTime.of(10, 0))));

        assertThrows(AppointmentService.InvalidStatusTransitionException.class, () ->
                bookings.updateStatusByOwner(ownerId, booked.getBookingReference(), AppointmentStatus.COMPLETED));
    }

    private Appointment book(int hour) { return bookings.book(customerId,request(date,hour)); }
    private AppointmentDtos.CreateRequest request(LocalDate day,int hour) {
        return new AppointmentDtos.CreateRequest(salonId,List.of(serviceId),null,List.of(),day,LocalTime.of(hour,0));
    }
    private WorkingHour shrinkHours() {
        return availability.saveHour(barberId,new AvailabilityDtos.HourRequest(1,date,LocalTime.NOON,LocalTime.of(17,0)));
    }
    private TransactionTemplate transaction() {
        var tx = new TransactionTemplate(transactions);
        tx.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
        tx.setTimeout(15);
        return tx;
    }

    /** Hold the first uncommitted write while a second service call attempts the same salon. */
    private Object competing(Runnable first, Callable<?> second) throws Exception {
        var written = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var attempted = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var writer = pool.submit(() -> transaction().executeWithoutResult(status -> {
                locks.salon(salonId);
                first.run();
                written.countDown();
                await(release);
            }));
            try {
                assertTrue(written.await(10,TimeUnit.SECONDS),"First writer did not finish its mutation");
                var waiter = pool.submit(() -> {
                    attempted.countDown();
                    try { return second.call(); } catch (RuntimeException failure) { return failure; }
                });
                assertTrue(attempted.await(5,TimeUnit.SECONDS));
                assertThrows(TimeoutException.class, () -> waiter.get(300,TimeUnit.MILLISECONDS),
                        "Competing write must wait for the salon lock");
                release.countDown();
                writer.get(10,TimeUnit.SECONDS);
                return waiter.get(10,TimeUnit.SECONDS);
            } finally { release.countDown(); }
        }
    }
    private static void await(CountDownLatch latch) {
        try { if (!latch.await(10,TimeUnit.SECONDS)) throw new IllegalStateException("Timed out waiting for release"); }
        catch (InterruptedException ex) { Thread.currentThread().interrupt(); throw new IllegalStateException(ex); }
    }
}
