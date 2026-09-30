package com.trimtime.availability;

import com.trimtime.appointment.AppointmentProtection;
import com.trimtime.appointment.BookingWriteLock;
import com.trimtime.barber.BarberMembershipRepository;
import com.trimtime.identity.UserAccount;
import com.trimtime.identity.UserAccountRepository;
import com.trimtime.salon.SalonTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

@Service
public class AvailabilityService {
    private final UserAccountRepository users;
    private final BarberMembershipRepository memberships;
    private final WorkingHourRepository hours;
    private final DayOffRepository days;
    private final BarberBreakRepository breaks;
    private final BookingWriteLock locks;
    private final AppointmentProtection protection;
    private final SalonTime salonTime;

    public AvailabilityService(UserAccountRepository users, BarberMembershipRepository memberships,
                               WorkingHourRepository hours, DayOffRepository days, BarberBreakRepository breaks,
                               BookingWriteLock locks, AppointmentProtection protection, SalonTime salonTime) {
        this.users = users;
        this.memberships = memberships;
        this.hours = hours;
        this.days = days;
        this.breaks = breaks;
        this.locks = locks;
        this.protection = protection;
        this.salonTime = salonTime;
    }

    private UserAccount barber(Long id) {
        if (!memberships.existsByBarberId(id)) throw new MembershipRequiredException();
        return users.findById(id).orElseThrow();
    }
    private LocalDate monday(LocalDate date) { return date.with(DayOfWeek.MONDAY); }
    private LocalDate today(Long barberId) {
        var membership = memberships.findByBarberId(barberId).orElseThrow(MembershipRequiredException::new);
        return salonTime.today(membership.getSalon());
    }

    @Transactional(readOnly = true)
    public List<WorkingHour> getHours(Long id, LocalDate weekStart) {
        barber(id);
        return hours.findByBarberIdAndWeekStartDateOrderByDayOfWeekAsc(id,
                monday(weekStart == null ? today(id) : weekStart));
    }
    @Transactional(readOnly = true)
    public List<DayOff> getDays(Long id) {
        barber(id);
        return days.findByBarberIdAndDateGreaterThanEqualOrderByDateAsc(id, today(id));
    }

    @Transactional(readOnly = true)
    public List<BarberBreak> getBreaks(Long id, LocalDate weekStart) {
        barber(id);
        return breaks.findByBarberIdAndWeekStartDateOrderByDayOfWeekAscStartTimeAsc(id, monday(weekStart));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public WorkingHour saveHour(Long id, AvailabilityDtos.HourRequest input) {
        locks.barber(id);
        return saveHourLocked(barber(id), input);
    }

    private WorkingHour saveHourLocked(UserAccount user, AvailabilityDtos.HourRequest input) {
        if (input.weekStartDate().getDayOfWeek() != DayOfWeek.MONDAY
                || !input.startTime().isBefore(input.endTime())) throw new InvalidHoursException();
        var week = monday(input.weekStartDate());
        if (breaks.findByBarberIdAndWeekStartDateAndDayOfWeekOrderByStartTimeAsc(
                user.getId(), week, input.dayOfWeek()).stream().anyMatch(item ->
                item.getStartTime().isBefore(input.startTime()) || item.getEndTime().isAfter(input.endTime()))) {
            throw new InvalidBreakException();
        }
        var hour = hours.findByBarberIdAndWeekStartDateAndDayOfWeek(user.getId(), week, input.dayOfWeek())
                .orElseGet(() -> new WorkingHour(user, week, input.dayOfWeek(), input.startTime(), input.endTime()));
        hour.setTimes(input.startTime(), input.endTime());
        hours.saveAndFlush(hour);
        protection.schedule(user.getId(), week.plusDays(input.dayOfWeek() - 1));
        return hour;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public List<WorkingHour> saveHours(Long id, AvailabilityDtos.BulkHourRequest input) {
        locks.barber(id);
        var user = barber(id);
        if (input.weekStartDate().getDayOfWeek() != DayOfWeek.MONDAY
                || !input.startTime().isBefore(input.endTime())
                || input.daysOfWeek().stream().distinct().count() != input.daysOfWeek().size()) {
            throw new InvalidHoursException();
        }
        var week = monday(input.weekStartDate());
        var selectedDays = new HashSet<>(input.daysOfWeek());
        var existing = hours.findByBarberIdAndWeekStartDateOrderByDayOfWeekAsc(id, week);

        // The submitted days are the complete schedule for this week. Remove omitted days and
        // their now-inapplicable special-date overrides before validating affected bookings.
        var omitted = existing.stream().filter(hour -> !selectedDays.contains(hour.getDayOfWeek())).toList();
        for (var hour : omitted) {
            var date = week.plusDays(hour.getDayOfWeek() - 1L);
            days.findByBarberIdAndDate(id, date).ifPresent(days::delete);
            breaks.deleteAll(breaks.findByBarberIdAndWeekStartDateAndDayOfWeekOrderByStartTimeAsc(
                    id, week, hour.getDayOfWeek()));
            hours.delete(hour);
        }
        hours.flush();
        days.flush();
        breaks.flush();

        for (var day : input.daysOfWeek()) {
            saveHourLocked(user, new AvailabilityDtos.HourRequest(
                    day, week, input.startTime(), input.endTime()));
        }
        // Check closed dates after every write. A conflict rolls back additions, edits, removals,
        // and special-date cleanup as one transaction.
        omitted.forEach(hour -> protection.schedule(id, week.plusDays(hour.getDayOfWeek() - 1L)));
        return hours.findByBarberIdAndWeekStartDateOrderByDayOfWeekAsc(id, week);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public BarberBreak addBreak(Long id, AvailabilityDtos.BreakRequest input) {
        locks.barber(id);
        var user = barber(id);
        if (input.weekStartDate().getDayOfWeek() != DayOfWeek.MONDAY
                || !input.startTime().isBefore(input.endTime())) throw new InvalidBreakException();
        var week = monday(input.weekStartDate());
        var working = hours.findByBarberIdAndWeekStartDateAndDayOfWeek(id, week, input.dayOfWeek())
                .orElseThrow(InvalidBreakException::new);
        if (input.startTime().isBefore(working.getStartTime())
                || input.endTime().isAfter(working.getEndTime())) throw new InvalidBreakException();
        var existing = breaks.findByBarberIdAndWeekStartDateAndDayOfWeekOrderByStartTimeAsc(
                id, week, input.dayOfWeek());
        if (existing.stream().anyMatch(item -> item.getStartTime().isBefore(input.endTime())
                && item.getEndTime().isAfter(input.startTime()))) throw new BreakOverlapException();
        var saved = breaks.saveAndFlush(new BarberBreak(user, week, input.dayOfWeek(),
                input.startTime(), input.endTime()));
        protection.schedule(id, week.plusDays(input.dayOfWeek() - 1L));
        return saved;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void removeBreak(Long id, Long breakId) {
        locks.barber(id);
        barber(id);
        var item = breaks.findByIdAndBarberId(breakId, id).orElseThrow(BreakMissingException::new);
        breaks.delete(item);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public DayOff addDay(Long id, AvailabilityDtos.DayOffRequest input) {
        locks.barber(id);
        var user = barber(id);
        if (input.date().isBefore(today(id))) throw new PastAvailabilityDateException();
        if ((input.startTime() == null) != (input.endTime() == null)
                || input.startTime() != null && !input.startTime().isBefore(input.endTime())) {
            throw new InvalidHoursException();
        }
        if (!hours.existsByBarberIdAndWeekStartDateAndDayOfWeek(id, monday(input.date()), input.date().getDayOfWeek().getValue())) {
            throw new SpecialDateNotWorkingException();
        }
        var day = days.saveAndFlush(new DayOff(user, input.date(), input.startTime(), input.endTime(), input.reason()));
        protection.schedule(id, input.date());
        return day;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void removeDay(Long id, Long dayId) {
        locks.barber(id);
        barber(id);
        var day = days.findByIdAndBarberId(dayId, id).orElseThrow(DayOffMissingException::new);
        var date = day.getDate();
        days.delete(day);
        days.flush();
        // Removing extended special hours can invalidate a booking too.
        protection.schedule(id, date);
    }

    public static class MembershipRequiredException extends RuntimeException {}
    public static class InvalidHoursException extends RuntimeException {}
    public static class InvalidBreakException extends RuntimeException {}
    public static class BreakOverlapException extends RuntimeException {}
    public static class BreakMissingException extends RuntimeException {}
    public static class SpecialDateNotWorkingException extends RuntimeException {}
    public static class DayOffMissingException extends RuntimeException {}
    public static class PastAvailabilityDateException extends RuntimeException {}
}
