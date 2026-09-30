# Step 2: Barber & Salon Owner Appointment Dashboards (F10) Walkthrough

## 1. Overview
Step 2 implements **Feature 10 (Barber & Salon Owner Appointment Dashboards)**.
Previously, customers could see their own appointments via `GET /api/appointments/mine`, but barbers had no dedicated view of their daily schedule, and salon owners had no salon-wide visibility into bookings across their barbers.

With this implementation:
- **Barbers** can view all customer appointments assigned to them, complete with customer names, booked services, add-ons, exact times, prices, and statuses. Barbers can filter their schedule by a specific date.
- **Salon Owners** can monitor all appointments across their salon in real time, see which customer booked with which barber, filter by date, and execute cancellations directly from the dashboard if needed.

---

## 2. Changes Made

### 2.1 Backend Implementation
1. **DTO Enhancement ([`AppointmentDtos.java`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/backend/src/main/java/com/trimtime/appointment/AppointmentDtos.java))**:
   - Added `String customerName` to `AppointmentDtos.Response`.
   - Updated `Response.from(Appointment a)` to populate `customerName` from `a.getCustomer().getDisplayName()`.
2. **Repository Enhancements ([`AppointmentRepository.java`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/backend/src/main/java/com/trimtime/appointment/AppointmentRepository.java))**:
   - `findByBarberIdOrderByStartAtAsc(Long barberId)`
   - `findByBarberIdAndStartAtBetweenOrderByStartAtAsc(Long barberId, LocalDateTime start, LocalDateTime end)`
   - `findBySalonIdOrderByStartAtAsc(Long salonId)`
   - `findBySalonIdAndStartAtBetweenOrderByStartAtAsc(Long salonId, LocalDateTime start, LocalDateTime end)`
3. **Service Layer ([`AppointmentService.java`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/backend/src/main/java/com/trimtime/appointment/AppointmentService.java))**:
   - Injected `SalonRepository salons`.
   - `forBarber(Long barberUserId, LocalDate date)`: Validates that the user has an approved barber membership, determines their active salon timezone, converts the date filter into start/end day bounds in that timezone, and fetches appointments ordered chronologically.
   - `forOwner(Long ownerId, LocalDate date)`: Validates that the owner manages an active salon, determines the salon's timezone, converts the date filter, and queries all appointments for that salon.
4. **REST Endpoints ([`AppointmentController.java`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/backend/src/main/java/com/trimtime/appointment/AppointmentController.java))**:
   - `GET /api/barber/appointments` with optional `?date=YYYY-MM-DD` (Secured: `@PreAuthorize("hasRole('BARBER')")`).
   - `GET /api/salons/mine/appointments` with optional `?date=YYYY-MM-DD` (Secured: `@PreAuthorize("hasRole('SALON_OWNER')")`).

### 2.2 Frontend Implementation
1. **Model & State ([`frontend/src/App.tsx`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/frontend/src/App.tsx))**:
   - Added `customerName?: string` to `Appointment` type.
   - Added state: `barberAppointments`, `barberAppointmentDate`, `ownerAppointments`, `ownerAppointmentDate`.
   - Added `loadBarberAppointments(filterDate)` and `loadOwnerAppointments(filterDate)`.
   - Updated `authenticate()` to automatically fetch barber schedule and owner appointments on login when the corresponding role is present.
   - Updated `logout()` to reset these states.
2. **Barber Schedule Component**:
   - Rendered when `account.roles.includes('BARBER')`.
   - Shows a date filter input with "Filter schedule" and "Clear date filter" actions.
   - Lists assigned appointments detailing date, start/end time, customer name, service name, add-ons, price, and status.
3. **Salon Owner Dashboard Component**:
   - Rendered when `account.roles.includes('SALON_OWNER') && salon`.
   - Shows a date filter input with "Filter appointments" and "Clear date filter" actions.
   - Lists all salon appointments detailing customer name, assigned barber name, service name, add-ons, price, and status.
   - Provides an in-place **Cancel appointment** button for confirmed bookings calling `POST /api/salons/mine/appointments/{bookingReference}/cancel`.

---

## 3. Verification & Testing

### 3.1 Unit & Integration Tests
- **Frontend ([`frontend/src/App.test.tsx`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/frontend/src/App.test.tsx))**:
  - `displays barber appointment schedule and supports date filtering` (PASSED).
  - `displays salon owner appointment dashboard and allows owner cancellation` (PASSED).
  - **Results**: 10 tests passed (100%), 0 lint warnings, clean build.
- **Backend ([`backend/src/test/java/com/trimtime/appointment/BookingConsistencyIT.java`](file:///C:/Users/shub1/OneDrive/Desktop/Trim-Time/backend/src/test/java/com/trimtime/appointment/BookingConsistencyIT.java))**:
  - `barberCanViewAssignedAppointmentsAndFilterByDate` (PASSED).
  - `ownerCanViewSalonAppointmentsAndFilterByDate` (PASSED).
  - **Results**: 54 integration tests passed (100%), `BUILD SUCCESS`.

### 3.2 Manual Testing Guide
1. Open the UI at `http://localhost:8088`.
2. **Log in as Salon Owner**:
   - View the **Salon appointment dashboard** section.
   - Verify that all appointments across all barbers in the salon are listed.
   - Test date filtering by entering a date and clicking **Filter appointments**.
   - Notice the **Cancel appointment** button next to any confirmed appointment.
3. **Log in as Barber**:
   - View the **Barber appointment schedule** section.
   - Verify that only bookings assigned to this barber are shown, including the customer's name.
   - Filter by date to review upcoming daily schedule.
4. **Log in as Customer**:
   - Verify customer sees only their personal bookings under **Your appointments** with self-service cancellation.
