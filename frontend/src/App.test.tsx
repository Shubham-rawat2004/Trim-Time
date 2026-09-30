import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('shows verified only after the server confirms the database', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }))
  render(<App />)
  expect(await screen.findByText('Connection verified')).toBeInTheDocument()
})
it('reports failure and allows a successful retry', async () => {
  const request = vi.fn().mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'UP', database: 'CONNECTED' }) })
  vi.stubGlobal('fetch', request)
  render(<App />)
  expect(await screen.findByText('Connection unavailable')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Check connection' }))
  expect(await screen.findByText('Connection verified')).toBeInTheDocument()
})
it('does not claim readiness for an unhealthy response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
  render(<App />)
  expect(await screen.findByText('Connection unavailable')).toBeInTheDocument()
})
it('registers a customer through the auth form', async () => {
  const request = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'UP', database: 'CONNECTED' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 9, email: 'test@example.com', displayName: 'Test User', roles: ['CUSTOMER'] }) })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Test User' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  expect(await screen.findByText('Signed in')).toBeInTheDocument()
  expect(screen.getByText('CUSTOMER')).toBeInTheDocument()
})

it('keeps saved hours and displays booking references when a schedule edit conflicts', async () => {
  const savedHour = { id: 1, weekStartDate: '2026-09-21', dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }
  const request = vi.fn(async (url: string, options?: RequestInit) => {
    let body: unknown = []
    let status = 200
    if (url === '/api/system/status') body = { status: 'UP', database: 'CONNECTED' }
    else if (url === '/api/auth/csrf') body = { token: 'csrf', headerName: 'X-XSRF-TOKEN' }
    else if (url === '/api/auth/login') body = { id: 9, email: 'barber@example.com', displayName: 'Barber', roles: ['CUSTOMER', 'BARBER'] }
    else if (url === '/api/barber/availability/hours/bulk' && options?.method === 'PUT') {
      status = 409
      body = { detail: 'This change would invalidate existing appointments.', bookingReferences: ['booking-123'] }
    } else if (url.startsWith('/api/barber/availability/hours?')) body = [savedHour]
    else if (url.startsWith('/api/salons/mine')) { status = 403; body = {} }
    return { ok: status === 200, status, json: async () => body }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'barber@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
  expect(await screen.findByText('Monday - 09:00-17:00')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '12:00' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save weekly schedule' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('This change would invalidate existing appointments.')
  expect(screen.getByRole('alert')).toHaveTextContent('booking-123')
  expect(screen.getByText('Monday - 09:00-17:00')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save weekly schedule' })).toBeEnabled())
})

it('submits the checked days as the complete weekly schedule', async () => {
  const monday = { id: 1, weekStartDate: '2026-09-21', dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }
  const tuesday = { id: 2, weekStartDate: '2026-09-21', dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }
  let submitted: { daysOfWeek: number[] } | null = null
  let submittedBreak: { dayOfWeek: number; startTime: string; endTime: string } | null = null
  const request = vi.fn(async (url: string, options?: RequestInit) => {
    let body: unknown = []
    let status = 200
    if (url === '/api/system/status') body = { status: 'UP', database: 'CONNECTED' }
    else if (url === '/api/auth/csrf') body = { token: 'csrf', headerName: 'X-XSRF-TOKEN' }
    else if (url === '/api/auth/login') body = { id: 9, email: 'barber@example.com', displayName: 'Barber', roles: ['CUSTOMER', 'BARBER'] }
    else if (url === '/api/barber/availability/hours/bulk' && options?.method === 'PUT') {
      submitted = JSON.parse(String(options.body)) as { daysOfWeek: number[] }
      body = [monday]
    } else if (url === '/api/barber/availability/breaks' && options?.method === 'POST') {
      submittedBreak = JSON.parse(String(options.body)) as { dayOfWeek: number; startTime: string; endTime: string }
      body = { id: 11, weekStartDate: '2026-09-21', dayOfWeek: 1, startTime: '12:00', endTime: '13:00' }
    } else if (url.startsWith('/api/barber/availability/hours?')) body = [monday, tuesday]
    else if (url.startsWith('/api/salons/mine')) { status = 403; body = {} }
    return { ok: status === 200, status, json: async () => body }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'barber@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
  expect(await screen.findByText('Tuesday - 09:00-17:00')).toBeInTheDocument()
  expect(screen.getByLabelText('Tuesday')).toBeChecked()
  fireEvent.click(screen.getByLabelText('Tuesday'))
  fireEvent.click(screen.getByRole('button', { name: 'Save weekly schedule' }))
  await waitFor(() => expect(submitted).toMatchObject({ daysOfWeek: [1] }))
  expect(screen.queryByText('Tuesday - 09:00-17:00')).not.toBeInTheDocument()
  expect(screen.getByText('Monday - 09:00-17:00')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Break weekday'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('Break start'), { target: { value: '12:00' } })
  fireEvent.change(screen.getByLabelText('Break end'), { target: { value: '13:00' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save break' }))
  await waitFor(() => expect(submittedBreak).toMatchObject({ dayOfWeek: 1, startTime: '12:00', endTime: '13:00' }))
  expect(screen.getByText('Monday · 12:00-13:00')).toBeInTheDocument()
})

it('reuses the booking request key after a lost response', async () => {
  const bookingHeaders: Record<string, string>[] = []
  let bookingAttempt = 0
  vi.stubGlobal('crypto', { randomUUID: () => 'booking-request-123' })
  const appointment = { bookingReference: 'confirmed-123', date: '2026-09-24', startTime: '10:00', endTime: '10:30', salonName: 'Trim Salon', barberName: 'Alex', serviceName: 'Cut', addonSummary: null, durationMinutes: 30, totalPrice: 100, status: 'CONFIRMED', items: [{ kind: 'SERVICE', catalogueItemId: 7, name: 'Cut', durationMinutes: 30, price: 100 }] }
  const request = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/system/status') return { ok: true, status: 200, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }
    if (url === '/api/auth/csrf') return { ok: true, status: 200, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) }
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => ({ id: 9, email: 'customer@example.com', displayName: 'Customer', roles: ['CUSTOMER'] }) }
    if (url === '/api/salons') return { ok: true, status: 200, json: async () => [{ id: 1, name: 'Trim Salon', address: 'Main Street' }] }
    if (url === '/api/salons/1/services') return { ok: true, status: 200, json: async () => [{ id: 7, salonId: 1, name: 'Cut', description: '', price: 100, durationMinutes: 30, active: true }] }
    if (url === '/api/salons/1/services/7/addons') return { ok: true, status: 200, json: async () => [] }
    if (url.startsWith('/api/slots?')) return { ok: true, status: 200, json: async () => [{ date: '2026-09-24', startTime: '10:00', endTime: '10:30', durationMinutes: 30, totalPrice: 100 }] }
    if (url === '/api/appointments' && options?.method === 'POST') {
      bookingHeaders.push(options.headers as Record<string, string>)
      bookingAttempt += 1
      if (bookingAttempt === 1) throw new Error('Response was lost')
      return { ok: true, status: 201, json: async () => appointment }
    }
    return { ok: false, status: 403, json: async () => [] }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'customer@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  const salonSelect = await screen.findByLabelText('Salon')
  fireEvent.change(salonSelect, { target: { value: '1' } })
  fireEvent.click(await screen.findByLabelText(/Cut - ₹100 - 30 minutes/))
  fireEvent.click(screen.getByRole('button', { name: 'Find available slots' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Select slot' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm your booking' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Response was lost')
  fireEvent.click(screen.getByRole('button', { name: 'Confirm your booking' }))

  expect(await screen.findByText('Alex')).toBeInTheDocument()
  expect(screen.getByText(/Items: Cut \(30 min, ₹100\)/)).toBeInTheDocument()
  expect(bookingHeaders).toHaveLength(2)
  expect(bookingHeaders[0]['Idempotency-Key']).toBe('booking-request-123')
  expect(bookingHeaders[1]['Idempotency-Key']).toBe(bookingHeaders[0]['Idempotency-Key'])
})

it('cancels a confirmed appointment and updates its status', async () => {
  const confirmed = { bookingReference: 'ref-cancel-1', date: '2026-09-24', startTime: '10:00', endTime: '10:30', salonName: 'Trim Salon', barberName: 'Alex', serviceName: 'Cut', addonSummary: null, durationMinutes: 30, totalPrice: 100, status: 'CONFIRMED', items: [] }
  const cancelled = { ...confirmed, status: 'CANCELLED' }
  const request = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/system/status') return { ok: true, status: 200, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }
    if (url === '/api/auth/csrf') return { ok: true, status: 200, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) }
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => ({ id: 9, email: 'customer@example.com', displayName: 'Customer', roles: ['CUSTOMER'] }) }
    if (url === '/api/appointments/mine') return { ok: true, status: 200, json: async () => [confirmed] }
    if (url === '/api/appointments/ref-cancel-1/cancel' && options?.method === 'POST') {
      return { ok: true, status: 200, json: async () => cancelled }
    }
    return { ok: false, status: 403, json: async () => [] }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'customer@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  expect(await screen.findByText(/CONFIRMED/)).toBeInTheDocument()
  const cancelBtn = screen.getByRole('button', { name: 'Cancel appointment' })
  expect(cancelBtn).toBeInTheDocument()
  fireEvent.click(cancelBtn)

  expect(await screen.findByText(/CANCELLED/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cancel appointment' })).not.toBeInTheDocument()
})

it('displays barber appointment schedule and supports date filtering', async () => {
  const appt1 = { bookingReference: 'barber-appt-1', date: '2026-09-24', startTime: '11:00', endTime: '11:30', salonName: 'Trim Salon', barberName: 'Alex', customerName: 'John Doe', serviceName: 'Fade Cut', addonSummary: null, durationMinutes: 30, totalPrice: 150, status: 'CONFIRMED', items: [] }
  const appt2 = { bookingReference: 'barber-appt-2', date: '2026-09-25', startTime: '14:00', endTime: '14:30', salonName: 'Trim Salon', barberName: 'Alex', customerName: 'Sam Wilson', serviceName: 'Beard Trim', addonSummary: null, durationMinutes: 30, totalPrice: 80, status: 'CONFIRMED', items: [] }
  const request = vi.fn(async (url: string) => {
    if (url === '/api/system/status') return { ok: true, status: 200, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }
    if (url === '/api/auth/csrf') return { ok: true, status: 200, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) }
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => ({ id: 5, email: 'barber@example.com', displayName: 'Alex', roles: ['CUSTOMER', 'BARBER'] }) }
    if (url === '/api/barber/appointments') return { ok: true, status: 200, json: async () => [appt1] }
    if (url === '/api/barber/appointments?date=2026-09-25') return { ok: true, status: 200, json: async () => [appt2] }
    return { ok: false, status: 403, json: async () => [] }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'barber@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  expect(await screen.findByText('Barber appointment schedule')).toBeInTheDocument()
  expect(await screen.findByText('John Doe')).toBeInTheDocument()
  expect(screen.getByText(/Fade Cut/)).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('Filter by date'), { target: { value: '2026-09-25' } })
  fireEvent.click(screen.getByRole('button', { name: 'Filter schedule' }))

  expect(await screen.findByText('Sam Wilson')).toBeInTheDocument()
  expect(screen.getByText(/Beard Trim/)).toBeInTheDocument()
  expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
})

it('displays salon owner appointment dashboard and allows owner cancellation', async () => {
  const salonData = { id: 1, ownerId: 2, name: 'Trim Salon', description: 'Best cuts', address: '123 High St', contact: '1234567890', latitude: null, longitude: null, timezone: 'Asia/Kolkata' }
  const appt = { bookingReference: 'owner-appt-1', date: '2026-09-26', startTime: '15:00', endTime: '15:45', salonName: 'Trim Salon', barberName: 'Alex', customerName: 'Jane Smith', serviceName: 'Styling', addonSummary: null, durationMinutes: 45, totalPrice: 200, status: 'CONFIRMED', items: [] }
  const cancelledAppt = { ...appt, status: 'CANCELLED' }

  const request = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/system/status') return { ok: true, status: 200, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }
    if (url === '/api/auth/csrf') return { ok: true, status: 200, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) }
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => ({ id: 2, email: 'owner@example.com', displayName: 'Owner', roles: ['CUSTOMER', 'SALON_OWNER'] }) }
    if (url === '/api/salons/mine') return { ok: true, status: 200, json: async () => salonData }
    if (url === '/api/salons/mine/appointments') return { ok: true, status: 200, json: async () => [appt] }
    if (url === '/api/salons/mine/appointments/owner-appt-1/cancel' && options?.method === 'POST') {
      return { ok: true, status: 200, json: async () => cancelledAppt }
    }
    return { ok: false, status: 403, json: async () => [] }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  expect(await screen.findByText('Salon appointment dashboard')).toBeInTheDocument()
  expect(await screen.findByText('Jane Smith')).toBeInTheDocument()
  expect(screen.getAllByText(/Alex/).length).toBeGreaterThan(0)
  expect(screen.getByText(/Styling/)).toBeInTheDocument()

  const cancelBtn = screen.getByRole('button', { name: 'Cancel appointment' })
  expect(cancelBtn).toBeInTheDocument()
  fireEvent.click(cancelBtn)

  fireEvent.click(await screen.findByRole('button', { name: /Completed & History/ }))
  expect(await screen.findByText(/CANCELLED/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cancel appointment' })).not.toBeInTheDocument()
})

it('allows barber to start service and complete appointment', async () => {
  const confirmed = { bookingReference: 'barber-status-1', date: '2026-09-24', startTime: '11:00', endTime: '11:30', salonName: 'Trim Salon', barberName: 'Alex', customerName: 'John Doe', serviceName: 'Fade Cut', addonSummary: null, durationMinutes: 30, totalPrice: 150, status: 'CONFIRMED', items: [] }
  const inProgress = { ...confirmed, status: 'IN_PROGRESS' }
  const completed = { ...confirmed, status: 'COMPLETED' }

  const request = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/system/status') return { ok: true, status: 200, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }
    if (url === '/api/auth/csrf') return { ok: true, status: 200, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) }
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => ({ id: 5, email: 'barber@example.com', displayName: 'Alex', roles: ['CUSTOMER', 'BARBER'] }) }
    if (url === '/api/barber/appointments') return { ok: true, status: 200, json: async () => [confirmed] }
    if (url === '/api/barber/appointments/barber-status-1/status' && options?.method === 'POST') {
      const parsed = JSON.parse(String(options.body)) as { status: string }
      return { ok: true, status: 200, json: async () => parsed.status === 'IN_PROGRESS' ? inProgress : completed }
    }
    return { ok: false, status: 403, json: async () => [] }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'barber@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  expect(await screen.findByText('Barber appointment schedule')).toBeInTheDocument()
  expect(await screen.findByText(/CONFIRMED/)).toBeInTheDocument()

  const startBtn = screen.getByRole('button', { name: 'Start service' })
  expect(startBtn).toBeInTheDocument()
  fireEvent.click(startBtn)

  expect(await screen.findByText(/IN_PROGRESS/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Start service' })).not.toBeInTheDocument()

  const completeBtn = screen.getByRole('button', { name: 'Complete' })
  expect(completeBtn).toBeInTheDocument()
  fireEvent.click(completeBtn)

  fireEvent.click(await screen.findByRole('button', { name: /Completed & History/ }))
  expect(await screen.findByText(/COMPLETED/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument()
})

it('allows salon owner to mark appointment as no-show', async () => {
  const salonData = { id: 1, ownerId: 2, name: 'Trim Salon', description: 'Best cuts', address: '123 High St', contact: '1234567890', latitude: null, longitude: null, timezone: 'Asia/Kolkata' }
  const confirmed = { bookingReference: 'owner-status-1', date: '2026-09-26', startTime: '15:00', endTime: '15:45', salonName: 'Trim Salon', barberName: 'Alex', customerName: 'Jane Smith', serviceName: 'Styling', addonSummary: null, durationMinutes: 45, totalPrice: 200, status: 'CONFIRMED', items: [] }
  const noShow = { ...confirmed, status: 'NO_SHOW' }

  const request = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/system/status') return { ok: true, status: 200, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }
    if (url === '/api/auth/csrf') return { ok: true, status: 200, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) }
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => ({ id: 2, email: 'owner@example.com', displayName: 'Owner', roles: ['CUSTOMER', 'SALON_OWNER'] }) }
    if (url === '/api/salons/mine') return { ok: true, status: 200, json: async () => salonData }
    if (url === '/api/salons/mine/appointments') return { ok: true, status: 200, json: async () => [confirmed] }
    if (url === '/api/salons/mine/appointments/owner-status-1/status' && options?.method === 'POST') {
      return { ok: true, status: 200, json: async () => noShow }
    }
    return { ok: false, status: 403, json: async () => [] }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  expect(await screen.findByText('Salon appointment dashboard')).toBeInTheDocument()
  const noShowBtn = await screen.findByRole('button', { name: 'Mark no-show' })
  expect(noShowBtn).toBeInTheDocument()
  fireEvent.click(noShowBtn)

  fireEvent.click(await screen.findByRole('button', { name: /Completed & History/ }))
  expect(await screen.findByText(/NO_SHOW/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Mark no-show' })).not.toBeInTheDocument()
})

it('allows applicant to withdraw pending application', async () => {
  const pendingApp = { id: 10, salonId: 1, salonName: 'Trim Salon', barberId: 5, barberName: 'Bob', message: 'Hello', bio: 'Cutter', experienceYears: 2, status: 'PENDING' }
  const withdrawnApp = { ...pendingApp, status: 'WITHDRAWN' }

  const request = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/system/status') return { ok: true, status: 200, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }
    if (url === '/api/auth/csrf') return { ok: true, status: 200, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) }
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => ({ id: 5, email: 'bob@example.com', displayName: 'Bob', roles: ['CUSTOMER'] }) }
    if (url === '/api/barber/applications/mine') return { ok: true, status: 200, json: async () => [pendingApp] }
    if (url === '/api/barber/applications/10/withdraw' && options?.method === 'POST') {
      return { ok: true, status: 200, json: async () => withdrawnApp }
    }
    return { ok: false, status: 403, json: async () => [] }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bob@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  expect(await screen.findByText('Your applications')).toBeInTheDocument()
  expect(screen.getByText('PENDING')).toBeInTheDocument()
  const withdrawBtn = screen.getByRole('button', { name: 'Withdraw' })
  expect(withdrawBtn).toBeInTheDocument()
  fireEvent.click(withdrawBtn)

  expect(await screen.findByText('WITHDRAWN')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument()
})

it('allows salon owner to self-enroll as barber without join request', async () => {
  const salonData = { id: 1, ownerId: 2, name: 'Trim Salon', description: 'Best cuts', address: '123 High St', contact: '1234567890', latitude: null, longitude: null, timezone: 'Asia/Kolkata' }
  const ownerAccountBefore = { id: 2, email: 'owner@example.com', displayName: 'Owner Sam', roles: ['CUSTOMER', 'SALON_OWNER'] }
  const ownerAccountAfter = { id: 2, email: 'owner@example.com', displayName: 'Owner Sam', roles: ['CUSTOMER', 'SALON_OWNER', 'BARBER'] }
  const ownerBarberQualification = { barberId: 2, barberName: 'Owner Sam', serviceIds: [] }

  const request = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/system/status') return { ok: true, status: 200, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }
    if (url === '/api/auth/csrf') return { ok: true, status: 200, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) }
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => ownerAccountBefore }
    if (url === '/api/auth/me') return { ok: true, status: 200, json: async () => ownerAccountAfter }
    if (url === '/api/salons/mine') return { ok: true, status: 200, json: async () => salonData }
    if (url === '/api/salons/mine/barbers') {
      if (options?.method === undefined) {
        return { ok: true, status: 200, json: async () => [ownerBarberQualification] }
      }
    }
    if (url === '/api/salons/mine/barbers/enroll-self' && options?.method === 'POST') {
      return { ok: true, status: 201, json: async () => ({ id: 1, barberUserId: 2, salonId: 1, salonName: 'Trim Salon' }) }
    }
    return { ok: false, status: 403, json: async () => [] }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  expect(await screen.findByText('Owner self-enrollment')).toBeInTheDocument()
  const enrollBtn = screen.getByRole('button', { name: 'Enroll myself as barber' })
  expect(enrollBtn).toBeInTheDocument()
  fireEvent.click(enrollBtn)

  expect(await screen.findByText('Your availability')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Enroll myself as barber' })).not.toBeInTheDocument()
})

it('allows salon owner to remove a barber from salon', async () => {
  const salonData = { id: 1, ownerId: 2, name: 'Trim Salon', description: 'Best cuts', address: '123 High St', contact: '1234567890', latitude: null, longitude: null, timezone: 'Asia/Kolkata' }
  const ownerAccount = { id: 2, email: 'owner@example.com', displayName: 'Owner Sam', roles: ['CUSTOMER', 'SALON_OWNER'] }
  const barberQual = { barberId: 7, barberName: 'Barber Jack', serviceIds: [] }

  const request = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/system/status') return { ok: true, status: 200, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }
    if (url === '/api/auth/csrf') return { ok: true, status: 200, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) }
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => ownerAccount }
    if (url === '/api/salons/mine') return { ok: true, status: 200, json: async () => salonData }
    if (url === '/api/salons/mine/barbers') return { ok: true, status: 200, json: async () => [barberQual] }
    if (url === '/api/salons/mine/barbers/7' && options?.method === 'DELETE') {
      return { ok: true, status: 204, json: async () => null }
    }
    return { ok: false, status: 403, json: async () => [] }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  expect(await screen.findByText('Barber Jack')).toBeInTheDocument()
  const removeBtn = screen.getByRole('button', { name: 'Remove barber' })
  expect(removeBtn).toBeInTheDocument()
  fireEvent.click(removeBtn)

  await waitFor(() => expect(screen.queryByText('Barber Jack')).not.toBeInTheDocument())
})

it('allows barber to leave salon voluntarily', async () => {
  const barberAccountBefore = { id: 7, email: 'jack@example.com', displayName: 'Jack Barber', roles: ['CUSTOMER', 'BARBER'] }
  const barberAccountAfter = { id: 7, email: 'jack@example.com', displayName: 'Jack Barber', roles: ['CUSTOMER'] }

  const request = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/system/status') return { ok: true, status: 200, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }
    if (url === '/api/auth/csrf') return { ok: true, status: 200, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) }
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => barberAccountBefore }
    if (url === '/api/auth/me') return { ok: true, status: 200, json: async () => barberAccountAfter }
    if (url === '/api/barber/membership' && options?.method === 'DELETE') {
      return { ok: true, status: 204, json: async () => null }
    }
    return { ok: false, status: 403, json: async () => [] }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jack@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  expect(await screen.findByText('Your availability')).toBeInTheDocument()
  const leaveBtn = screen.getByRole('button', { name: 'Leave salon' })
  expect(leaveBtn).toBeInTheDocument()
  fireEvent.click(leaveBtn)

  await waitFor(() => expect(screen.queryByText('Your availability')).not.toBeInTheDocument())
})

it('allows salon owner to upload and delete salon photo', async () => {
  const salonData = { id: 1, ownerId: 2, name: 'Trim Salon', description: 'Best cuts', address: '123 High St', contact: '1234567890', latitude: null, longitude: null, timezone: 'Asia/Kolkata' }
  const ownerAccount = { id: 2, email: 'owner@example.com', displayName: 'Owner Sam', roles: ['CUSTOMER', 'SALON_OWNER'] }
  const uploadedPhoto = { id: 101, salonId: 1, url: '/api/salons/1/photos/101', contentType: 'image/jpeg', sizeBytes: 1024, displayOrder: 0, createdAt: '2026-09-26T00:00:00Z' }

  const request = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/system/status') return { ok: true, status: 200, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }
    if (url === '/api/auth/csrf') return { ok: true, status: 200, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) }
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => ownerAccount }
    if (url === '/api/salons/mine') return { ok: true, status: 200, json: async () => salonData }
    if (url === '/api/salons/mine/photos' && options?.method === undefined) return { ok: true, status: 200, json: async () => [] }
    if (url === '/api/salons/mine/photos' && options?.method === 'POST') {
      return { ok: true, status: 201, json: async () => uploadedPhoto }
    }
    if (url === '/api/salons/mine/photos/101' && options?.method === 'DELETE') {
      return { ok: true, status: 204, json: async () => null }
    }
    return { ok: false, status: 403, json: async () => [] }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  expect(await screen.findByText('Salon photo gallery')).toBeInTheDocument()
  const fileInput = screen.getByLabelText('Select image')
  const file = new File(['fake-jpg'], 'interior.jpg', { type: 'image/jpeg' })
  fireEvent.change(fileInput, { target: { files: [file] } })
  fireEvent.submit(fileInput.closest('form')!)

  expect(await screen.findByAltText('Salon photo 101')).toBeInTheDocument()
  const deleteBtn = screen.getByRole('button', { name: 'Delete' })
  expect(deleteBtn).toBeInTheDocument()
  fireEvent.click(deleteBtn)

  await waitFor(() => expect(screen.queryByAltText('Salon photo 101')).not.toBeInTheDocument())
})

it('allows salon owner to configure slot grid increment and advance booking horizon', async () => {
  let updatedPayload: Record<string, unknown> | null = null
  const salonData = { id: 1, ownerId: 2, name: 'Trim Salon', description: 'Best cuts', address: '123 High St', contact: '1234567890', latitude: null, longitude: null, timezone: 'Asia/Kolkata', slotIncrementMinutes: 15, bookingHorizonDays: 14 }
  const ownerAccount = { id: 2, email: 'owner@example.com', displayName: 'Owner Sam', roles: ['CUSTOMER', 'SALON_OWNER'] }

  const request = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/system/status') return { ok: true, status: 200, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }
    if (url === '/api/auth/csrf') return { ok: true, status: 200, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) }
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => ownerAccount }
    if (url === '/api/salons/mine' && options?.method === undefined) return { ok: true, status: 200, json: async () => salonData }
    if (url === '/api/salons/mine' && options?.method === 'PUT') {
      updatedPayload = JSON.parse(String(options.body))
      return { ok: true, status: 200, json: async () => ({ ...salonData, ...updatedPayload }) }
    }
    return { ok: false, status: 403, json: async () => [] }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  expect(await screen.findByText(/Grid: 15 min · Horizon: 14 days/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Edit salon' }))

  fireEvent.change(screen.getByLabelText('Slot start grid'), { target: { value: '30' } })
  fireEvent.change(screen.getByLabelText('Advance booking horizon (days)'), { target: { value: '21' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.getByText(/Grid: 30 min · Horizon: 21 days/)).toBeInTheDocument())
  expect(updatedPayload).toMatchObject({
    slotIncrementMinutes: 30,
    bookingHorizonDays: 21
  })
})

it('supports customer appointment pagination and status filtering', async () => {
  const apptPage0 = {
    bookingReference: 'cust-page0-ref',
    date: '2026-09-24',
    startTime: '10:00',
    endTime: '10:30',
    salonName: 'Trim Salon',
    barberName: 'Alex',
    serviceName: 'Haircut',
    addonSummary: null,
    durationMinutes: 30,
    totalPrice: 120,
    status: 'CONFIRMED',
    items: []
  }
  const apptPage1 = {
    bookingReference: 'cust-page1-ref',
    date: '2026-09-20',
    startTime: '14:00',
    endTime: '14:45',
    salonName: 'Trim Salon',
    barberName: 'Alex',
    serviceName: 'Styling',
    addonSummary: null,
    durationMinutes: 45,
    totalPrice: 200,
    status: 'COMPLETED',
    items: []
  }
  const apptCompleted = {
    bookingReference: 'cust-completed-ref',
    date: '2026-09-18',
    startTime: '16:00',
    endTime: '16:30',
    salonName: 'Trim Salon',
    barberName: 'Alex',
    serviceName: 'Shave',
    addonSummary: null,
    durationMinutes: 30,
    totalPrice: 80,
    status: 'COMPLETED',
    items: []
  }

  const requestedUrls: string[] = []
  const request = vi.fn(async (url: string, _options?: RequestInit) => {
    requestedUrls.push(url)
    if (url === '/api/system/status') return { ok: true, status: 200, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }
    if (url === '/api/auth/csrf') return { ok: true, status: 200, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) }
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => ({ id: 9, email: 'customer@example.com', displayName: 'Customer', roles: ['CUSTOMER'] }) }
    if (url === '/api/appointments/mine') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          content: [apptPage0],
          page: 0,
          size: 10,
          totalElements: 2,
          totalPages: 2,
          first: true,
          last: false
        })
      }
    }
    if (url === '/api/appointments/mine?page=1&size=10') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          content: [apptPage1],
          page: 1,
          size: 10,
          totalElements: 2,
          totalPages: 2,
          first: false,
          last: true
        })
      }
    }
    if (url === '/api/appointments/mine?status=COMPLETED&page=0&size=10') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          content: [apptCompleted],
          page: 0,
          size: 10,
          totalElements: 1,
          totalPages: 1,
          first: true,
          last: true
        })
      }
    }
    if (url === '/api/appointments/mine?page=0&size=10') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          content: [apptPage0],
          page: 0,
          size: 10,
          totalElements: 2,
          totalPages: 2,
          first: true,
          last: false
        })
      }
    }
    return { ok: false, status: 403, json: async () => [] }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'customer@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  expect(await screen.findByText(/Haircut/)).toBeInTheDocument()
  expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
  const nextBtn = screen.getByRole('button', { name: 'Next page' })
  expect(nextBtn).toBeInTheDocument()

  fireEvent.click(nextBtn)
  expect(await screen.findByText(/Styling/)).toBeInTheDocument()
  expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeInTheDocument()

  const filterSelect = screen.getByLabelText('Filter appointments by status')
  fireEvent.change(filterSelect, { target: { value: 'COMPLETED' } })
  expect(await screen.findByText(/Shave/)).toBeInTheDocument()
  expect(screen.queryByText('Page 1 of 2')).not.toBeInTheDocument()

  const clearBtn = screen.getByRole('button', { name: 'Clear filter' })
  fireEvent.click(clearBtn)
  expect(await screen.findByText(/Haircut/)).toBeInTheDocument()
  expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
})

it('separates active and completed/history appointments with earnings and revenue summaries', async () => {
  const activeAppt = { bookingReference: 'barber-act-1', date: '2026-09-27', startTime: '10:00', endTime: '10:30', salonName: 'Trim Salon', barberName: 'Alex', customerName: 'Alice', serviceName: 'Fade Cut', addonSummary: null, durationMinutes: 30, totalPrice: 150, status: 'CONFIRMED', items: [] }
  const completedAppt = { bookingReference: 'barber-comp-1', date: '2026-09-27', startTime: '11:00', endTime: '11:45', salonName: 'Trim Salon', barberName: 'Alex', customerName: 'Bob', serviceName: 'Hair Styling', addonSummary: null, durationMinutes: 45, totalPrice: 350, status: 'COMPLETED', items: [] }
  const noShowAppt = { bookingReference: 'barber-ns-1', date: '2026-09-27', startTime: '12:00', endTime: '12:30', salonName: 'Trim Salon', barberName: 'Alex', customerName: 'Charlie', serviceName: 'Beard Trim', addonSummary: null, durationMinutes: 30, totalPrice: 100, status: 'NO_SHOW', items: [] }

  const request = vi.fn(async (url: string) => {
    if (url === '/api/system/status') return { ok: true, status: 200, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }
    if (url === '/api/auth/csrf') return { ok: true, status: 200, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) }
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => ({ id: 5, email: 'barber@example.com', displayName: 'Alex', roles: ['CUSTOMER', 'BARBER'] }) }
    if (url === '/api/barber/appointments') return { ok: true, status: 200, json: async () => [activeAppt, completedAppt, noShowAppt] }
    return { ok: false, status: 403, json: async () => [] }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'barber@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  expect(await screen.findByText('Barber appointment schedule')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Active Schedule \(1\)/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Completed & History \(2\)/ })).toBeInTheDocument()
  expect(screen.getByText('Alice')).toBeInTheDocument()
  expect(screen.queryByText('Bob')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /Completed & History \(2\)/ }))
  expect(await screen.findByText('Bob')).toBeInTheDocument()
  expect(screen.getByText('Charlie')).toBeInTheDocument()
  expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  expect(screen.getByText('Completed Services')).toBeInTheDocument()
  expect(screen.getByText('Total Earnings Handled')).toBeInTheDocument()
  expect(screen.getByText('₹350')).toBeInTheDocument()
})

it('displays salon owner transaction ledger with KPI cards, filters, and digital receipt modal', async () => {
  const salonData = { id: 1, ownerId: 2, name: 'Trim Salon', description: 'Best cuts', address: '123 High St', contact: '1234567890', latitude: null, longitude: null, timezone: 'Asia/Kolkata' }
  const completedAppt = { bookingReference: 'txn-comp-1', date: '2026-09-28', startTime: '10:00', endTime: '10:45', salonName: 'Trim Salon', barberName: 'Alex', customerName: 'David Miller', serviceName: 'Fade Cut', addonSummary: 'Beard Trim', durationMinutes: 45, totalPrice: 300, status: 'COMPLETED', items: [{ name: 'Fade Cut', durationMinutes: 30, price: 200 }, { name: 'Beard Trim', durationMinutes: 15, price: 100 }] }
  const inProgressAppt = { bookingReference: 'txn-prog-1', date: '2026-09-28', startTime: '11:00', endTime: '11:30', salonName: 'Trim Salon', barberName: 'Sam', customerName: 'Emma Watson', serviceName: 'Hair Styling', addonSummary: null, durationMinutes: 30, totalPrice: 250, status: 'IN_PROGRESS', items: [] }
  const confirmedAppt = { bookingReference: 'txn-conf-1', date: '2026-09-28', startTime: '14:00', endTime: '14:30', salonName: 'Trim Salon', barberName: 'Alex', customerName: 'Frank Castle', serviceName: 'Quick Trim', addonSummary: null, durationMinutes: 30, totalPrice: 150, status: 'CONFIRMED', items: [] }

  const request = vi.fn(async (url: string) => {
    if (url === '/api/system/status') return { ok: true, status: 200, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }
    if (url === '/api/auth/csrf') return { ok: true, status: 200, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) }
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => ({ id: 2, email: 'owner@example.com', displayName: 'Owner', roles: ['CUSTOMER', 'SALON_OWNER'] }) }
    if (url === '/api/salons/mine') return { ok: true, status: 200, json: async () => salonData }
    if (url === '/api/salons/mine/appointments') return { ok: true, status: 200, json: async () => [completedAppt, inProgressAppt, confirmedAppt] }
    return { ok: false, status: 403, json: async () => [] }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  expect(await screen.findByText('Salon appointment dashboard')).toBeInTheDocument()

  const ledgerBtn = screen.getByRole('button', { name: /Transaction & Sales Ledger/ })
  expect(ledgerBtn).toBeInTheDocument()
  fireEvent.click(ledgerBtn)

  expect(await screen.findByText('Financial Transaction & Sales Ledger')).toBeInTheDocument()
  expect(screen.getByText('Settled Revenue')).toBeInTheDocument()
  expect(screen.getAllByText('₹300')[0]).toBeInTheDocument()
  expect(screen.getByText('In-Service (Active)')).toBeInTheDocument()
  expect(screen.getAllByText('₹250')[0]).toBeInTheDocument()
  expect(screen.getByText('Projected')).toBeInTheDocument()
  expect(screen.getAllByText('₹150')[0]).toBeInTheDocument()

  expect(screen.getByText('David Miller')).toBeInTheDocument()
  expect(screen.getByText('Emma Watson')).toBeInTheDocument()
  expect(screen.getByText('Frank Castle')).toBeInTheDocument()

  const statusFilter = screen.getByLabelText('Filter ledger by status')
  fireEvent.change(statusFilter, { target: { value: 'IN_PROGRESS' } })
  expect(screen.getByText('Emma Watson')).toBeInTheDocument()
  expect(screen.queryByText('David Miller')).not.toBeInTheDocument()
  expect(screen.queryByText('Frank Castle')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Reset Filters' }))
  expect(screen.getByText('David Miller')).toBeInTheDocument()

  const receiptButtons = screen.getAllByRole('button', { name: 'Receipt' })
  fireEvent.click(receiptButtons[0])

  expect(await screen.findByText('Digital Sales Receipt')).toBeInTheDocument()
  expect(screen.getByText('Fade Cut (30m)')).toBeInTheDocument()
  expect(screen.getByText('Beard Trim (15m)')).toBeInTheDocument()
  expect(screen.getAllByText('David Miller').length).toBe(2)

  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
  expect(screen.queryByText('Digital Sales Receipt')).not.toBeInTheDocument()
})

it('allows salon owner to select multiple photos and batch upload them', async () => {
  const salonData = { id: 1, ownerId: 2, name: 'Trim Salon', description: 'Best cuts', address: '123 High St', contact: '1234567890', latitude: null, longitude: null, timezone: 'Asia/Kolkata' }
  const ownerAccount = { id: 2, email: 'owner@example.com', displayName: 'Owner Sam', roles: ['CUSTOMER', 'SALON_OWNER'] }
  let uploadCount = 0

  const request = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/system/status') return { ok: true, status: 200, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }
    if (url === '/api/auth/csrf') return { ok: true, status: 200, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) }
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => ownerAccount }
    if (url === '/api/salons/mine') return { ok: true, status: 200, json: async () => salonData }
    if (url === '/api/salons/mine/photos' && options?.method === undefined) return { ok: true, status: 200, json: async () => [] }
    if (url === '/api/salons/mine/photos' && options?.method === 'POST') {
      uploadCount++
      return {
        ok: true,
        status: 201,
        json: async () => ({
          id: 100 + uploadCount,
          salonId: 1,
          url: `/api/salons/1/photos/${100 + uploadCount}`,
          contentType: 'image/jpeg',
          sizeBytes: 1024,
          displayOrder: uploadCount - 1,
          createdAt: '2026-09-28T00:00:00Z'
        })
      }
    }
    return { ok: false, status: 403, json: async () => [] }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  expect(await screen.findByText('Salon photo gallery')).toBeInTheDocument()
  const fileInput = screen.getByLabelText('Select image')
  expect(fileInput).toHaveAttribute('multiple')

  const file1 = new File(['fake-jpg-1'], 'photo1.jpg', { type: 'image/jpeg' })
  const file2 = new File(['fake-png-2'], 'photo2.png', { type: 'image/png' })
  fireEvent.change(fileInput, { target: { files: [file1, file2] } })

  expect(screen.getByText(/2 images selected/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Upload 2 photos' })).toBeInTheDocument()

  fireEvent.submit(fileInput.closest('form')!)

  expect(await screen.findByAltText('Salon photo 101')).toBeInTheDocument()
  expect(await screen.findByAltText('Salon photo 102')).toBeInTheDocument()
  expect(screen.getByText('Current photos (2/10)')).toBeInTheDocument()
})

it('allows salon owner to view barber workload, inspect assigned customer book, and filter chair schedule by barber', async () => {
  const salonData = { id: 1, ownerId: 2, name: 'Trim Salon', description: 'Best cuts', address: '123 High St', contact: '1234567890', latitude: null, longitude: null, timezone: 'Asia/Kolkata' }
  const ownerAccount = { id: 2, email: 'owner@example.com', displayName: 'Owner Sam', roles: ['CUSTOMER', 'SALON_OWNER'] }
  const servicesList = [{ id: 10, salonId: 1, name: 'Fade Cut', description: 'Fresh fade', price: 200, durationMinutes: 30, active: true }]
  const barbersList = [
    { barberId: 5, barberName: 'Alex', serviceIds: [10], approved: true },
    { barberId: 6, barberName: 'Jordan', serviceIds: [10], approved: true }
  ]
  const appts = [
    { bookingReference: 'appt-alex-1', date: '2026-09-28', startTime: '10:00', endTime: '10:30', salonName: 'Trim Salon', barberId: 5, barberName: 'Alex', customerName: 'John Doe', serviceName: 'Fade Cut', addonSummary: null, durationMinutes: 30, totalPrice: 200, status: 'CONFIRMED', items: [] },
    { bookingReference: 'appt-alex-2', date: '2026-09-27', startTime: '11:00', endTime: '11:30', salonName: 'Trim Salon', barberId: 5, barberName: 'Alex', customerName: 'John Doe', serviceName: 'Fade Cut', addonSummary: null, durationMinutes: 30, totalPrice: 200, status: 'COMPLETED', items: [] },
    { bookingReference: 'appt-jordan-1', date: '2026-09-28', startTime: '14:00', endTime: '14:30', salonName: 'Trim Salon', barberId: 6, barberName: 'Jordan', customerName: 'Sam Wilson', serviceName: 'Fade Cut', addonSummary: null, durationMinutes: 30, totalPrice: 200, status: 'CONFIRMED', items: [] }
  ]

  const request = vi.fn(async (url: string) => {
    if (url === '/api/system/status') return { ok: true, status: 200, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }
    if (url === '/api/auth/csrf') return { ok: true, status: 200, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) }
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => ownerAccount }
    if (url === '/api/salons/mine') return { ok: true, status: 200, json: async () => salonData }
    if (url === '/api/salons/mine/services') return { ok: true, status: 200, json: async () => servicesList }
    if (url === '/api/salons/mine/barbers') return { ok: true, status: 200, json: async () => barbersList }
    if (url === '/api/salons/mine/appointments') return { ok: true, status: 200, json: async () => appts }
    return { ok: false, status: 403, json: async () => [] }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  expect(await screen.findByText('Assign services to your barbers')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '👥 View Assigned Customers (2)' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '👥 View Assigned Customers (1)' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '👥 View Assigned Customers (2)' }))
  expect(await screen.findByText('Assigned Customers: Alex')).toBeInTheDocument()
  expect(screen.getByText('🕒 Active & Upcoming Customers (1)')).toBeInTheDocument()
  expect(screen.getByText(/👥 Client History & Clientele/)).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 3, name: 'Assigned Customers: Alex' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.queryByText('Assigned Customers: Alex')).not.toBeInTheDocument()

  expect(screen.getByText('Salon appointment dashboard')).toBeInTheDocument()
  expect(screen.getByText('John Doe')).toBeInTheDocument()
  expect(screen.getByText('Sam Wilson')).toBeInTheDocument()

  const barberSelect = screen.getByLabelText('Filter appointments by barber')
  fireEvent.change(barberSelect, { target: { value: 'Jordan' } })

  expect(screen.getByText('Sam Wilson')).toBeInTheDocument()
  expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
  expect(screen.getByText(/Filtering chair schedule for:/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Clear barber filter' }))
  expect(screen.getByText('John Doe')).toBeInTheDocument()
  expect(screen.getByText('Sam Wilson')).toBeInTheDocument()
})

it('alerts salon owner when a new booking arrives, provides quick chair focus, and manages activity feed', async () => {
  const salonData = { id: 1, ownerId: 2, name: 'Trim Salon', description: 'Best cuts', address: '123 High St', contact: '1234567890', latitude: null, longitude: null, timezone: 'Asia/Kolkata' }
  const ownerAccount = { id: 2, email: 'owner@example.com', displayName: 'Owner Sam', roles: ['CUSTOMER', 'SALON_OWNER'] }
  const servicesList = [{ id: 10, salonId: 1, name: 'Fade Cut', description: 'Fresh fade', price: 200, durationMinutes: 30, active: true }]
  const barbersList = [{ barberId: 5, barberName: 'Alex', serviceIds: [10], approved: true }]
  const initialAppts = [
    { bookingReference: 'appt-initial-1', date: '2026-09-28', startTime: '09:00', endTime: '09:30', salonName: 'Trim Salon', barberId: 5, barberName: 'Alex', customerName: 'Initial Client', serviceName: 'Fade Cut', addonSummary: null, durationMinutes: 30, totalPrice: 200, status: 'CONFIRMED', items: [] }
  ]
  const newAppt = {
    bookingReference: 'appt-new-1', date: '2026-09-28', startTime: '15:00', endTime: '15:30', salonName: 'Trim Salon', barberId: 5, barberName: 'Alex', customerName: 'Jane Smith', serviceName: 'Fade Cut', addonSummary: null, durationMinutes: 30, totalPrice: 200, status: 'CONFIRMED', items: []
  }

  let refreshed = false
  const request = vi.fn(async (url: string) => {
    if (url === '/api/system/status') return { ok: true, status: 200, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }
    if (url === '/api/auth/csrf') return { ok: true, status: 200, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) }
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => ownerAccount }
    if (url === '/api/salons/mine') return { ok: true, status: 200, json: async () => salonData }
    if (url === '/api/salons/mine/services') return { ok: true, status: 200, json: async () => servicesList }
    if (url === '/api/salons/mine/barbers') return { ok: true, status: 200, json: async () => barbersList }
    if (url === '/api/salons/mine/appointments') {
      return { ok: true, status: 200, json: async () => refreshed ? [...initialAppts, newAppt] : initialAppts }
    }
    return { ok: false, status: 403, json: async () => [] }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  expect(await screen.findByText('Salon appointment dashboard')).toBeInTheDocument()
  expect(screen.queryByTestId('new-booking-alert-banner')).not.toBeInTheDocument()
  expect(screen.getByText('✓ All salon bookings acknowledged (1 total)')).toBeInTheDocument()

  refreshed = true
  fireEvent.click(screen.getByRole('button', { name: '🔄 Refresh schedule' }))

  expect(await screen.findByTestId('new-booking-alert-banner')).toBeInTheDocument()
  expect(screen.getByText(/New Booking Alert \(1 new reservation\)/)).toBeInTheDocument()
  expect(screen.getByText(/Reserved by:/)).toBeInTheDocument()
  expect(screen.getByText(/Client Jane Smith/)).toBeInTheDocument()
  expect(screen.getByText(/Staff: Alex/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: "🎯 Focus Alex's Chair" }))
  expect(screen.getByText(/Filtering chair schedule for:/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '📋 Recent Activity Feed ▾' }))
  expect(await screen.findByText(/📋 Recent Salon Booking Activity \(2 total\)/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '✓ Mark all as read' }))
  expect(screen.queryByTestId('new-booking-alert-banner')).not.toBeInTheDocument()
})

it('opens staff departure wizard when removing barber with active appointments and reassigns them to colleague before removal', async () => {
  const salonData = { id: 1, ownerId: 2, name: 'Trim Salon', description: 'Best cuts', address: '123 High St', contact: '1234567890', latitude: null, longitude: null, timezone: 'Asia/Kolkata' }
  const ownerAccount = { id: 2, email: 'owner@example.com', displayName: 'Owner Sam', roles: ['CUSTOMER', 'SALON_OWNER'] }
  const servicesList = [{ id: 10, salonId: 1, name: 'Fade Cut', description: 'Fresh fade', price: 200, durationMinutes: 30, active: true }]
  let barbersList = [
    { barberId: 7, barberName: 'Mukesh Rawat', serviceIds: [10], approved: true },
    { barberId: 8, barberName: 'Alex Rivera', serviceIds: [10], approved: true }
  ]
  let currentAppts = [
    {
      bookingReference: 'appt-mukesh-1',
      date: '2026-09-28',
      startTime: '10:00',
      endTime: '10:30',
      salonName: 'Trim Salon',
      barberId: 7,
      barberName: 'Mukesh Rawat',
      customerName: 'Kunal Verma',
      serviceName: 'Fade Cut',
      addonSummary: null,
      durationMinutes: 30,
      totalPrice: 200,
      status: 'CONFIRMED',
      items: []
    }
  ]
  const availableCandidates = [{ barberId: 8, barberName: 'Alex Rivera' }]

  let reassigned = false
  let deletedBarberId: number | null = null

  const request = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/system/status') return { ok: true, status: 200, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }
    if (url === '/api/auth/csrf') return { ok: true, status: 200, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) }
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => ownerAccount }
    if (url === '/api/salons/mine') return { ok: true, status: 200, json: async () => salonData }
    if (url === '/api/salons/mine/services') return { ok: true, status: 200, json: async () => servicesList }
    if (url === '/api/salons/mine/barbers') return { ok: true, status: 200, json: async () => barbersList }
    if (url === '/api/salons/mine/appointments') return { ok: true, status: 200, json: async () => currentAppts }
    if (url === '/api/salons/mine/appointments/appt-mukesh-1/available-barbers') {
      return { ok: true, status: 200, json: async () => availableCandidates }
    }
    if (url === '/api/salons/mine/appointments/appt-mukesh-1/reassign' && options?.method === 'POST') {
      reassigned = true
      const body = JSON.parse(String(options.body)) as { targetBarberId: number }
      currentAppts = currentAppts.map(a => a.bookingReference === 'appt-mukesh-1' ? {
        ...a,
        barberId: body.targetBarberId,
        barberName: 'Alex Rivera'
      } : a)
      return { ok: true, status: 200, json: async () => currentAppts[0] }
    }
    if (url.startsWith('/api/salons/mine/barbers/') && options?.method === 'DELETE') {
      const id = Number(url.split('/').pop())
      deletedBarberId = id
      barbersList = barbersList.filter(b => b.barberId !== id)
      return { ok: true, status: 204, json: async () => ({}) }
    }
    return { ok: false, status: 403, json: async () => [] }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  expect(await screen.findByText('Assign services to your barbers')).toBeInTheDocument()
  expect(screen.getAllByText('Mukesh Rawat').length).toBeGreaterThanOrEqual(1)
  expect(screen.getAllByText('Alex Rivera').length).toBeGreaterThanOrEqual(1)

  const removeButtons = screen.getAllByRole('button', { name: 'Remove barber' })
  fireEvent.click(removeButtons[0])

  expect(await screen.findByText('Staff Departure: Mukesh Rawat')).toBeInTheDocument()
  expect(screen.getByText(/Active Appointments Detected/)).toBeInTheDocument()
  expect(screen.getByText(/Client: Kunal Verma/)).toBeInTheDocument()

  expect(await screen.findByRole('button', { name: '🔄 Transfer Booking' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '🔄 Transfer Booking' }))

  expect(await screen.findByText('All Active Bookings Cleared')).toBeInTheDocument()
  expect(reassigned).toBe(true)

  const confirmBtn = screen.getByRole('button', { name: 'Confirm & Remove Mukesh Rawat' })
  fireEvent.click(confirmBtn)

  await waitFor(() => expect(deletedBarberId).toBe(7))
  await waitFor(() => expect(screen.queryByText('Staff Departure: Mukesh Rawat')).not.toBeInTheDocument())
  expect(screen.queryByText('Mukesh Rawat')).not.toBeInTheDocument()
})

it('displays no vacant barber warning and allows cancellation when no colleague has vacant time in that slot', async () => {
  const salonData = { id: 1, ownerId: 2, name: 'Trim Salon', description: 'Best cuts', address: '123 High St', contact: '1234567890', latitude: null, longitude: null, timezone: 'Asia/Kolkata' }
  const ownerAccount = { id: 2, email: 'owner@example.com', displayName: 'Owner Sam', roles: ['CUSTOMER', 'SALON_OWNER'] }
  const servicesList = [{ id: 10, salonId: 1, name: 'Fade Cut', description: 'Fresh fade', price: 200, durationMinutes: 30, active: true }]
  let barbersList = [
    { barberId: 7, barberName: 'Mukesh Rawat', serviceIds: [10], approved: true },
    { barberId: 8, barberName: 'Alex Rivera', serviceIds: [10], approved: true }
  ]
  let currentAppts = [
    {
      bookingReference: 'appt-mukesh-2',
      date: '2026-09-28',
      startTime: '14:00',
      endTime: '14:30',
      salonName: 'Trim Salon',
      barberId: 7,
      barberName: 'Mukesh Rawat',
      customerName: 'Rohit Sharma',
      serviceName: 'Fade Cut',
      addonSummary: null,
      durationMinutes: 30,
      totalPrice: 200,
      status: 'CONFIRMED',
      items: []
    }
  ]
  let cancelled = false

  const request = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/system/status') return { ok: true, status: 200, json: async () => ({ status: 'UP', database: 'CONNECTED' }) }
    if (url === '/api/auth/csrf') return { ok: true, status: 200, json: async () => ({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }) }
    if (url === '/api/auth/login') return { ok: true, status: 200, json: async () => ownerAccount }
    if (url === '/api/salons/mine') return { ok: true, status: 200, json: async () => salonData }
    if (url === '/api/salons/mine/services') return { ok: true, status: 200, json: async () => servicesList }
    if (url === '/api/salons/mine/barbers') return { ok: true, status: 200, json: async () => barbersList }
    if (url === '/api/salons/mine/appointments') return { ok: true, status: 200, json: async () => currentAppts }
    if (url === '/api/salons/mine/appointments/appt-mukesh-2/available-barbers') {
      return { ok: true, status: 200, json: async () => [] }
    }
    if (url === '/api/salons/mine/appointments/appt-mukesh-2/cancel' && options?.method === 'POST') {
      cancelled = true
      currentAppts = currentAppts.map(a => a.bookingReference === 'appt-mukesh-2' ? { ...a, status: 'CANCELLED' } : a)
      return { ok: true, status: 200, json: async () => currentAppts[0] }
    }
    if (url.startsWith('/api/salons/mine/barbers/') && options?.method === 'DELETE') {
      barbersList = barbersList.filter(b => b.barberId !== 7)
      return { ok: true, status: 204, json: async () => ({}) }
    }
    return { ok: false, status: 403, json: async () => [] }
  })
  vi.stubGlobal('fetch', request)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

  expect(await screen.findByText('Assign services to your barbers')).toBeInTheDocument()

  const removeButtons = screen.getAllByRole('button', { name: 'Remove barber' })
  fireEvent.click(removeButtons[0])

  expect(await screen.findByText('Staff Departure: Mukesh Rawat')).toBeInTheDocument()
  expect(await screen.findByText(/No Vacant Barber During This Slot/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '🔄 Transfer Booking' })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Cancel Booking' }))

  expect(await screen.findByText('All Active Bookings Cleared')).toBeInTheDocument()
  expect(cancelled).toBe(true)

  fireEvent.click(screen.getByRole('button', { name: 'Confirm & Remove Mukesh Rawat' }))
  await waitFor(() => expect(screen.queryByText('Staff Departure: Mukesh Rawat')).not.toBeInTheDocument())
})






