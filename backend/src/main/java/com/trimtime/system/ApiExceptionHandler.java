package com.trimtime.system;

import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.http.converter.HttpMessageNotReadableException;
import com.trimtime.identity.AuthService;
import com.trimtime.salon.SalonService;
import com.trimtime.barber.BarberService;
import com.trimtime.catalogue.CatalogueService;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(AuthService.DuplicateEmailException.class)
    ProblemDetail duplicateEmail() { return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "An account with that email already exists."); }
    @ExceptionHandler(AuthService.InvalidCredentialsException.class)
    ProblemDetail invalidCredentials() { return ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, "Email or password is incorrect."); }
    @ExceptionHandler(SalonService.SalonAlreadyExistsException.class)
    ProblemDetail salonAlreadyExists() { return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "This account already owns a salon."); }
    @ExceptionHandler(SalonService.SalonNotFoundException.class)
    ProblemDetail salonNotFound() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Salon not found."); }
    @ExceptionHandler(SalonService.InvalidCoordinatesException.class)
    ProblemDetail invalidCoordinates() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Latitude and longitude must be provided together."); }
    @ExceptionHandler(SalonService.InvalidDiscoveryRequestException.class)
    ProblemDetail invalidDiscovery(SalonService.InvalidDiscoveryRequestException exception) { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage()); }
    @ExceptionHandler(BarberService.SalonMissingException.class)
    ProblemDetail onboardingSalonNotFound() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Salon not found."); }
    @ExceptionHandler(BarberService.RequestMissingException.class)
    ProblemDetail requestNotFound() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Barber application not found."); }
    @ExceptionHandler(BarberService.PendingRequestException.class)
    ProblemDetail pendingRequest() { return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "You already have a pending application for this salon."); }
    @ExceptionHandler(BarberService.AlreadyMemberException.class)
    ProblemDetail alreadyMember() { return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "This barber already belongs to a salon."); }
    @ExceptionHandler(BarberService.RequestAlreadyDecidedException.class)
    ProblemDetail requestAlreadyDecided() { return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "This application has already been decided."); }
    @ExceptionHandler(BarberService.ForbiddenDecisionException.class)
    ProblemDetail forbiddenDecision() { return ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, "You can only decide applications for your own salon."); }
    @ExceptionHandler(BarberService.InvalidOnboardingException.class)
    ProblemDetail invalidOnboarding(BarberService.InvalidOnboardingException exception) { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage()); }
    @ExceptionHandler(CatalogueService.SalonMissingException.class)
    ProblemDetail catalogueSalonNotFound() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Salon not found."); }
    @ExceptionHandler(CatalogueService.ServiceMissingException.class)
    ProblemDetail serviceNotFound() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Service not found for this salon."); }
    @ExceptionHandler(com.trimtime.catalogue.CatalogueService.AddOnMissingException.class)
    ProblemDetail addonNotFound() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Add-on not found for this salon."); }
    @ExceptionHandler(com.trimtime.availability.AvailabilityService.MembershipRequiredException.class)
    ProblemDetail membershipRequired() { return ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, "An approved barber membership is required to manage availability."); }
    @ExceptionHandler(com.trimtime.availability.AvailabilityService.InvalidHoursException.class)
    ProblemDetail invalidHours() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Start time must be before end time."); }
    @ExceptionHandler(com.trimtime.availability.AvailabilityService.SpecialDateNotWorkingException.class)
    ProblemDetail specialDateNotWorking() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Custom hours can only be set for a weekday marked as working in that week."); }
    @ExceptionHandler(com.trimtime.availability.AvailabilityService.DayOffMissingException.class)
    ProblemDetail dayOffMissing() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Day off not found."); }
    @ExceptionHandler(com.trimtime.slots.SlotService.InvalidSlotRequestException.class)
    ProblemDetail invalidSlotRequest() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Choose today or a future booking date."); }
    @ExceptionHandler(com.trimtime.slots.SlotService.InvalidSelectionException.class)
    ProblemDetail invalidSelection() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Select at least one primary service."); }
    @ExceptionHandler(com.trimtime.slots.SlotService.SalonMissingException.class)
    ProblemDetail slotSalonMissing() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Salon not found."); }
    @ExceptionHandler(com.trimtime.slots.SlotService.ServiceMissingException.class)
    ProblemDetail slotServiceMissing() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Active service not found for this salon."); }
    @ExceptionHandler(com.trimtime.slots.SlotService.AddOnMissingException.class)
    ProblemDetail slotAddonMissing() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Active add-on not found for this salon."); }
    @ExceptionHandler(com.trimtime.slots.SlotService.IncompatibleAddOnException.class)
    ProblemDetail incompatibleAddon() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "One or more add-ons are not compatible with the selected services."); }
    @ExceptionHandler(com.trimtime.appointment.AppointmentService.InvalidBookingTimeException.class)
    ProblemDetail invalidBookingTime() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Choose a current or future available slot."); }
    @ExceptionHandler(com.trimtime.appointment.AppointmentService.NoBarberAvailableException.class)
    ProblemDetail noBarberAvailable() { return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "That slot is no longer available. Please search again."); }
    @ExceptionHandler(com.trimtime.barber.BarberQualificationService.ServiceMissingException.class)
    ProblemDetail qualificationServiceMissing() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "One or more selected services do not belong to this salon or are inactive."); }
    @ExceptionHandler(com.trimtime.barber.BarberQualificationService.BarberMissingException.class)
    ProblemDetail qualificationBarberMissing() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Approved barber not found for this salon."); }
    @ExceptionHandler(com.trimtime.barber.BarberQualificationService.SalonMissingException.class)
    ProblemDetail qualificationSalonMissing() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Salon not found."); }
    @ExceptionHandler(HttpMessageNotReadableException.class)
    ProblemDetail malformedRequest() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Request body is invalid."); }
    @ExceptionHandler(DataAccessException.class)
    ProblemDetail databaseUnavailable(DataAccessException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
                "The database is temporarily unavailable. Please try again shortly.");
    }
}
