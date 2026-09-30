# Step 3: Appointment Status Lifecycle (F10) Walkthrough

## 1. Overview
Step 3 implements the complete **Appointment Status Lifecycle** for **Feature 10 (Appointment Dashboard)**.
Previously, appointments could only be booked (`CONFIRMED`) and cancelled (`CANCELLED`). With Step 3, Barbers and Salon Owners can manage the full lifecycle of each customer visit as it occurs:
- Starting a service when the customer sits in the chair (`CONFIRMED` -> `IN_PROGRESS`).
- Completing a service when the haircut/styling is done (`CONFIRMED` or `IN_PROGRESS` -> `COMPLETED`).
- Marking a no-show if the customer does not arrive (`CONFIRMED` -> `NO_SHOW`).
- Releasing appointment slots automatically when an appointment transitions to a non-blocking terminal state (`NO_SHOW` or `CANCELLED`).

---

## 2. State Machine & Business Rules

```
                      ┌────────────────┐
                      │   CONFIRMED    │
                      └───────┬────────┘
                              │
             ┌────────────────┼────────────────┬────────────────┐
             │                │                │                │
             ▼                ▼                ▼                ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │ IN_PROGRESS  │ │  COMPLETED   │ │   NO_SHOW    │ │  CANCELLED   │
     └───────┬──────┘ └──────────────┘ └──────────────┘ └──────────────┘
             │           (Terminal)       (Terminal)       (Terminal)
             │                ▲
             └────────────────┘
```

1. **Terminal State Immutability**:
   Once an appointment reaches `COMPLETED`, `NO_SHOW`, or `CANCELLED`, it cannot transition to any other status. Attempting to modify a terminal appointment returns `409 Conflict`.
2. **Actor Roles & Permissions**:
   - **Barbers**: Can transition assigned appointments to `IN_PROGRESS`, `COMPLETED`, or `NO_SHOW`. Barbers cannot cancel appointments directly (cancellation remains with customers and owners).
   - **Salon Owners**: Can transition any appointment in their salon to `IN_PROGRESS`, `COMPLETED`, `NO_SHOW`, or `CANCELLED`.
   - **Customers**: Can cancel their own `CONFIRMED` appointments before they begin.
3. **Availability & Slot Release**:
   `SlotService` considers only `CONFIRMED` and `IN_PROGRESS` as `BLOCKING` statuses. Once an appointment is marked `NO_SHOW`, `COMPLETED`, or `CANCELLED`, the slot is immediately released and available for future bookings.

---

## 3. Implementation Details

### 3.1 Backend Changes
- **Entity ([`Appointment.java`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/backend/src/main/java/com/trimtime/appointment/Appointment.java))**:
  - Added `startProgress()`, `complete()`, and `markNoShow()`.
- **DTOs ([`AppointmentDtos.java`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/backend/src/main/java/com/trimtime/appointment/AppointmentDtos.java))**:
  - Added `StatusUpdateRequest(@NotNull AppointmentStatus status)`.
- **Service Layer ([`AppointmentService.java`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/backend/src/main/java/com/trimtime/appointment/AppointmentService.java))**:
  - `updateStatusByBarber(barberUserId, bookingReference, newStatus)`: Enforces barber assignment, disallows cancellation, acquires salon write lock, and validates transition rules.
  - `updateStatusByOwner(ownerId, bookingReference, newStatus)`: Enforces salon ownership, acquires owner lock, and applies status transition (delegating to cancellation logic if `CANCELLED`).
  - Added `ForbiddenStatusUpdateException` (403) and `InvalidStatusTransitionException` (409).
- **REST Endpoints ([`AppointmentController.java`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/backend/src/main/java/com/trimtime/appointment/AppointmentController.java))**:
  - `POST /api/barber/appointments/{bookingReference}/status` (`@PreAuthorize("hasRole('BARBER')")`)
  - `POST /api/salons/mine/appointments/{bookingReference}/status` (`@PreAuthorize("hasRole('SALON_OWNER')")`)
- **Exception Handling ([`ApiExceptionHandler.java`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/backend/src/main/java/com/trimtime/system/ApiExceptionHandler.java))**:
  - Mapped `ForbiddenStatusUpdateException` to HTTP 403 Forbidden.
  - Mapped `InvalidStatusTransitionException` to HTTP 409 Conflict.

### 3.2 Frontend UI Changes ([`frontend/src/App.tsx`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/frontend/src/App.tsx))
- Added `updateBarberAppointmentStatus` and `updateOwnerAppointmentStatus` helper functions with CSRF token inclusion.
- **Barber Schedule UI**:
  - For `CONFIRMED`: Displays **Start service**, **Complete**, and **Mark no-show** buttons.
  - For `IN_PROGRESS`: Displays **Complete** button.
  - For terminal states: Displays the status text (`COMPLETED`, `NO_SHOW`, `CANCELLED`).
- **Salon Owner Dashboard UI**:
  - For `CONFIRMED`: Displays **Start service**, **Complete**, **Mark no-show**, and **Cancel appointment** buttons.
  - For `IN_PROGRESS`: Displays **Complete** and **Cancel appointment** buttons.
  - For terminal states: Displays the final status without action buttons.

---

## 4. Verification Results

### 4.1 Unit Tests ([`frontend/src/App.test.tsx`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/frontend/src/App.test.tsx))
- `allows barber to start service and complete appointment` (PASSED).
- `allows salon owner to mark appointment as no-show` (PASSED).
- **Frontend test summary**: `12/12 passed (100%)`, 0 lint errors, TypeScript build clean.

### 4.2 Integration Tests ([`backend/src/test/java/com/trimtime/appointment/BookingConsistencyIT.java`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/backend/src/test/java/com/trimtime/appointment/BookingConsistencyIT.java))
- `barberCanStartAndCompleteAssignedAppointment` (PASSED).
- `barberCannotCancelDirectlyOrUpdateOthersAppointments` (PASSED).
- `markingNoShowReleasesSlotAndTerminalStatusBlocksFurtherTransitions` (PASSED).
- **Backend test summary**: `37/37 integration tests passed (100%)`, `BUILD SUCCESS`.

### 4.3 Container Deployment
- Successfully built and recreated Docker containers:
  - `trimtime-backend-1` (port 8081->8080)
  - `trimtime-frontend-1` (port 8088->80)
  - `trimtime-mysql-1` (port 3307->3306)
- Verified health endpoint via `http://localhost:8088/api/system/status`:
  `status: UP, database: CONNECTED`.

---

## 5. Manual Testing Guide

1. Open `http://localhost:8088`.
2. **As Customer**: Book an appointment at an active salon. Confirm it appears under **Your appointments** as `CONFIRMED`.
3. **As Assigned Barber**:
   - Log in and scroll to **Barber appointment schedule**.
   - Click **Start service**: the status immediately updates to `IN_PROGRESS`.
   - Click **Complete**: the status updates to `COMPLETED`. Action buttons are removed.
4. **As Salon Owner**:
   - For another appointment, test the **Mark no-show** button from the **Salon appointment dashboard**.
   - Confirm status updates to `NO_SHOW`.
   - Re-check available slots for that time and verify the slot has been freed up!
