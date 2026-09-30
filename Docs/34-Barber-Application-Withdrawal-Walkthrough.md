# Barber Application Withdrawal Walkthrough

## Summary
Implements self-service withdrawal for applicants who submitted a join request to a salon and wish to cancel it (e.g. if the salon owner has not responded or the applicant wants to apply elsewhere).

In Trim-Time, applicants are constrained by `uq_join_requests_pending_barber` on `pending_barber_user_id` (`V15__one_pending_barber_application.sql`), which only allows at most one `PENDING` request per user. Withdrawing a request transitions its status to `WITHDRAWN`, setting `pending_barber_user_id = NULL` and freeing the applicant to apply to another salon immediately without waiting for rejection or administrative intervention.

---

## Changes Implemented

### 1. Backend Service (`BarberService.java`)
- Added `withdraw(Long barberUserId, Long requestId)`:
  - Validates request existence.
  - Verifies that the caller owns the application (`ForbiddenWithdrawalException` -> HTTP 403).
  - Serializes on salon and user locks (`locks.salon(salonId)` -> `users.lockId(barberUserId)`).
  - Validates that the request is currently in `PENDING` state (`InvalidWithdrawalStatusException` -> HTTP 409).
  - Updates request status to `WITHDRAWN` and persists.

### 2. Backend Controller & Exception Handler
- Added `POST /api/barber/applications/{requestId}/withdraw` in [`BarberController.java`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/backend/src/main/java/com/trimtime/barber/BarberController.java).
- Mapped `ForbiddenWithdrawalException` (403) and `InvalidWithdrawalStatusException` (409) in [`ApiExceptionHandler.java`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/backend/src/main/java/com/trimtime/system/ApiExceptionHandler.java).

### 3. Integration Tests (`BarberOnboardingIT.java`)
- `applicantCanWithdrawPendingApplicationAndApplyElsewhere`: Verifies status transitions to `WITHDRAWN`, releasing the unique constraint and allowing the applicant to submit a new application to another salon.
- `cannotWithdrawOthersOrDecidedApplication`: Verifies HTTP 403 when another user attempts withdrawal and HTTP 409 when attempting to withdraw an already approved/rejected request.

### 4. Frontend UI (`App.tsx` & `App.test.tsx`)
- In "Your applications", added a **Withdraw** button for any application in `PENDING` status.
- Clicking Withdraw invokes `POST /api/barber/applications/{id}/withdraw` with CSRF protection, updating the application status in-place to `WITHDRAWN` and hiding the action button.
- Added comprehensive unit test in `App.test.tsx`.

---

## Verification
- `BarberOnboardingIT`: 10/10 tests passed (0 failures, 0 errors).
- Frontend Vitest: 13/13 tests passed (0 failures).
- Oxlint: 0 errors, 0 warnings.
- Frontend build: succeeded cleanly.
