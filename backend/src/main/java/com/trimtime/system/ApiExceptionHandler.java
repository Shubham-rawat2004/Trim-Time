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
    @ExceptionHandler(HttpMessageNotReadableException.class)
    ProblemDetail malformedRequest() { return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Request body is invalid."); }
    @ExceptionHandler(DataAccessException.class)
    ProblemDetail databaseUnavailable(DataAccessException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
                "The database is temporarily unavailable. Please try again shortly.");
    }
}
