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
import com.trimtime.appointment.AppointmentService;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(com.trimtime.appointment.AppointmentProtection.AppointmentConflictException.class)
    ProblemDetail appointmentEditConflict(com.trimtime.appointment.AppointmentProtection.AppointmentConflictException exception) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
        problem.setProperty("bookingReferences", exception.getReferences());
        return problem;
    }
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
    @ExceptionHandler(SalonService.InvalidTimezoneException.class)
    ProblemDetail invalidTimezone() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Timezone must be a valid IANA timezone such as Asia/Kolkata."); }
    @ExceptionHandler(SalonService.InvalidDiscoveryRequestException.class)
    ProblemDetail invalidDiscovery(SalonService.InvalidDiscoveryRequestException exception) { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage()); }
    @ExceptionHandler(SalonService.InvalidSlotIncrementException.class)
    ProblemDetail invalidSlotIncrement(SalonService.InvalidSlotIncrementException exception) { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage()); }
    @ExceptionHandler(SalonService.InvalidBookingHorizonException.class)
    ProblemDetail invalidBookingHorizon(SalonService.InvalidBookingHorizonException exception) { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage()); }
    @ExceptionHandler(BarberService.SalonMissingException.class)
    ProblemDetail onboardingSalonNotFound() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Salon not found."); }
    @ExceptionHandler(BarberService.RequestMissingException.class)
    ProblemDetail requestNotFound() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Barber application not found."); }
    @ExceptionHandler(BarberService.PendingRequestException.class)
    ProblemDetail pendingRequest() { return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "You already have a pending application. Wait for its decision before applying to another salon."); }
    @ExceptionHandler(BarberService.AlreadyMemberException.class)
    ProblemDetail alreadyMember() { return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "This barber already belongs to a salon."); }
    @ExceptionHandler(BarberService.RequestAlreadyDecidedException.class)
    ProblemDetail requestAlreadyDecided() { return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "This application has already been decided."); }
    @ExceptionHandler(BarberService.ForbiddenDecisionException.class)
    ProblemDetail forbiddenDecision() { return ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, "You can only decide applications for your own salon."); }
    @ExceptionHandler(BarberService.ForbiddenWithdrawalException.class)
    ProblemDetail forbiddenWithdrawal(BarberService.ForbiddenWithdrawalException exception) { return ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, exception.getMessage()); }
    @ExceptionHandler(BarberService.InvalidWithdrawalStatusException.class)
    ProblemDetail invalidWithdrawalStatus(BarberService.InvalidWithdrawalStatusException exception) { return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage()); }
    @ExceptionHandler(BarberService.BarberMissingException.class)
    ProblemDetail barberNotFound() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Barber not found in this salon."); }
    @ExceptionHandler(BarberService.MembershipMissingException.class)
    ProblemDetail membershipNotFound() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "You do not belong to any salon."); }
    @ExceptionHandler(com.trimtime.photo.PhotoService.InvalidPhotoException.class)
    ProblemDetail invalidPhoto(com.trimtime.photo.PhotoService.InvalidPhotoException exception) { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage()); }
    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    ProblemDetail maxUploadSize() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Photo file size cannot exceed 5 MB."); }
    @ExceptionHandler(com.trimtime.photo.PhotoService.UnsupportedMediaTypeException.class)
    ProblemDetail unsupportedMediaType(com.trimtime.photo.PhotoService.UnsupportedMediaTypeException exception) { return ProblemDetail.forStatusAndDetail(HttpStatus.UNSUPPORTED_MEDIA_TYPE, exception.getMessage()); }
    @ExceptionHandler(com.trimtime.photo.PhotoService.MaxPhotosExceededException.class)
    ProblemDetail maxPhotosExceeded(com.trimtime.photo.PhotoService.MaxPhotosExceededException exception) { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage()); }
    @ExceptionHandler(com.trimtime.photo.PhotoService.PhotoNotFoundException.class)
    ProblemDetail photoNotFound() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Photo not found."); }
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
    @ExceptionHandler(com.trimtime.availability.AvailabilityService.InvalidBreakException.class)
    ProblemDetail invalidBreak() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "A break must be inside that weekday's saved working hours."); }
    @ExceptionHandler(com.trimtime.availability.AvailabilityService.BreakOverlapException.class)
    ProblemDetail breakOverlap() { return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "Breaks cannot overlap another saved break."); }
    @ExceptionHandler(com.trimtime.availability.AvailabilityService.BreakMissingException.class)
    ProblemDetail breakMissing() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Break not found."); }
    @ExceptionHandler(com.trimtime.availability.AvailabilityService.SpecialDateNotWorkingException.class)
    ProblemDetail specialDateNotWorking() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Custom hours can only be set for a weekday marked as working in that week."); }
    @ExceptionHandler(com.trimtime.availability.AvailabilityService.DayOffMissingException.class)
    ProblemDetail dayOffMissing() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Day off not found."); }
    @ExceptionHandler(com.trimtime.availability.AvailabilityService.PastAvailabilityDateException.class)
    ProblemDetail pastAvailabilityDate() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Choose today or a future date in the salon timezone."); }
    @ExceptionHandler(com.trimtime.slots.SlotService.InvalidSlotRequestException.class)
    ProblemDetail invalidSlotRequest() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Choose today or a future booking date."); }
    @ExceptionHandler(com.trimtime.slots.SlotService.BookingHorizonExceededException.class)
    ProblemDetail bookingHorizonExceeded(com.trimtime.slots.SlotService.BookingHorizonExceededException exception) { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage()); }
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
    @ExceptionHandler(com.trimtime.appointment.AppointmentService.InvalidRequestKeyException.class)
    ProblemDetail invalidRequestKey() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Idempotency-Key must contain 1 to 100 letters, digits, dots, underscores, colons, or hyphens."); }
    @ExceptionHandler(com.trimtime.appointment.AppointmentService.RequestKeyReusedException.class)
    ProblemDetail requestKeyReused() { return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "This Idempotency-Key was already used for a different booking request."); }
    @ExceptionHandler(com.trimtime.salon.SalonTime.InvalidSalonLocalTimeException.class)
    ProblemDetail invalidSalonLocalTime() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Choose an unambiguous local time outside the daylight-saving clock change."); }
    @ExceptionHandler(com.trimtime.barber.BarberQualificationService.ServiceMissingException.class)
    ProblemDetail qualificationServiceMissing() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "One or more selected services do not belong to this salon or are inactive."); }
    @ExceptionHandler(com.trimtime.barber.BarberQualificationService.BarberMissingException.class)
    ProblemDetail qualificationBarberMissing() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Approved barber not found for this salon."); }
    @ExceptionHandler(com.trimtime.barber.BarberQualificationService.SalonMissingException.class)
    ProblemDetail qualificationSalonMissing() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Salon not found."); }
    @ExceptionHandler(AppointmentService.AppointmentNotFoundException.class)
    ProblemDetail appointmentNotFound() { return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Appointment not found."); }
    @ExceptionHandler(AppointmentService.ForbiddenCancellationException.class)
    ProblemDetail forbiddenCancellation() { return ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, "You are not authorized to cancel this appointment."); }
    @ExceptionHandler(AppointmentService.AppointmentAlreadyCancelledException.class)
    ProblemDetail appointmentAlreadyCancelled() { return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "This appointment has already been cancelled."); }
    @ExceptionHandler(AppointmentService.InvalidCancellationStatusException.class)
    ProblemDetail invalidCancellationStatus(AppointmentService.InvalidCancellationStatusException exception) { return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage()); }
    @ExceptionHandler(AppointmentService.PastAppointmentCancellationException.class)
    ProblemDetail pastAppointmentCancellation() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Cannot cancel an appointment that has already started or ended."); }
    @ExceptionHandler(AppointmentService.ForbiddenStatusUpdateException.class)
    ProblemDetail forbiddenStatusUpdate(AppointmentService.ForbiddenStatusUpdateException exception) { return ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, exception.getMessage()); }
    @ExceptionHandler(AppointmentService.InvalidStatusTransitionException.class)
    ProblemDetail invalidStatusTransition(AppointmentService.InvalidStatusTransitionException exception) { return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage()); }
    @ExceptionHandler(AppointmentService.InvalidBarberReassignmentException.class)
    ProblemDetail invalidBarberReassignment(AppointmentService.InvalidBarberReassignmentException exception) { return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage()); }
    @ExceptionHandler(HttpMessageNotReadableException.class)
    ProblemDetail malformedRequest() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Request body is invalid."); }
    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    ProblemDetail argumentMismatch() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Invalid parameter value."); }
    @ExceptionHandler(DataAccessException.class)
    ProblemDetail databaseUnavailable(DataAccessException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
                "The database is temporarily unavailable. Please try again shortly.");
    }
}
