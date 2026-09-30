import { useEffect, useRef, useState } from 'react'
import styles from './App.module.css'

type Connection = 'checking' | 'connected' | 'unavailable'
type Account = { id: number; email: string; displayName: string; roles: string[] }
type Salon = { id: number; ownerId: number; name: string; description: string; address: string; contact: string; latitude: number | null; longitude: number | null; timezone: string; slotIncrementMinutes?: number | null; bookingHorizonDays?: number }
type BarberApplication = { id: number; barberUserId: number; barberName: string; salonId: number; salonName: string; message: string; status: string; createdAt: string }
type BarberQualification = { barberId: number; barberName: string; serviceIds: number[] }
type DirectorySalon = { id: number; name: string; description: string; address: string; contact: string; ownerName: string; latitude: number | null; longitude: number | null; distanceKm: number | null; slotIncrementMinutes?: number | null; bookingHorizonDays?: number }
type SalonService = { id: number; salonId: number; name: string; description: string; price: number; durationMinutes: number; active: boolean }
type AddOn = { id: number; salonId: number; name: string; description: string; price: number; durationMinutes: number; active: boolean; compatibleServiceIds: number[] }
type WorkingHour = { id: number; weekStartDate: string; dayOfWeek: number; startTime: string; endTime: string }
type BarberBreak = { id: number; weekStartDate: string; dayOfWeek: number; startTime: string; endTime: string }
type DayOff = { id: number; date: string; startTime: string | null; endTime: string | null; reason: string }
type Slot = { date: string; startTime: string; endTime: string; startInstant?: string; endInstant?: string; timezone?: string; durationMinutes: number; totalPrice: number }
type AppointmentItem = { kind: 'SERVICE' | 'ADD_ON'; catalogueItemId: number; name: string; durationMinutes: number; price: number }
type Appointment = { bookingReference: string; date: string; startTime: string; endTime: string; startInstant?: string; endInstant?: string; timezone?: string; salonId?: number; salonName: string; barberId?: number; barberName: string; customerId?: number; customerName?: string; serviceName: string; addonSummary: string | null; durationMinutes: number; totalPrice: number; status: string; items?: AppointmentItem[] }
type SalonPhoto = { id: number; salonId: number; url: string; contentType: string; sizeBytes: number; displayOrder: number; createdAt: string }
type PageResponse<T> = { content: T[]; page: number; size: number; totalElements: number; totalPages: number; first: boolean; last: boolean }
function mondayFor(value: string) { const date = new Date(`${value}T00:00:00Z`); const offset = (date.getUTCDay() + 6) % 7; date.setUTCDate(date.getUTCDate() - offset); return date.toISOString().slice(0, 10) }
function nextMondayFor(mondayStr: string) { const d = new Date(`${mondayStr}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 7); return d.toISOString().slice(0, 10) }
function formatDisplayDate(dateStr: string) { const parts = dateStr.split('-'); return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr }
function weekDateRange(mondayStr: string) { const mon = new Date(`${mondayStr}T00:00:00Z`); const sun = new Date(`${mondayStr}T00:00:00Z`); sun.setUTCDate(sun.getUTCDate() + 6); return `${formatDisplayDate(mon.toISOString().slice(0, 10))} to ${formatDisplayDate(sun.toISOString().slice(0, 10))}` }
function dayDate(mondayStr: string, dayOfWeek: number) { const d = new Date(`${mondayStr}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + (dayOfWeek - 1)); return formatDisplayDate(d.toISOString().slice(0, 10)) }
function formatBookingDateTime(dateStr: string, startTime: string, endTime: string) { const d = new Date(`${dateStr}T00:00:00Z`); const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']; const dayName = days[d.getUTCDay()]; return `${dayName}, ${formatDisplayDate(dateStr)} at ${startTime.slice(0, 5)} - ${endTime.slice(0, 5)}` }
async function editError(response: Response, fallback: string): Promise<Error> {
  const problem = await response.json().catch(() => null) as { detail?: string; bookingReferences?: string[] } | null
  const references = problem?.bookingReferences?.length ? ` Booking references: ${problem.bookingReferences.join(', ')}` : ''
  return new Error(`${problem?.detail || fallback}${references}`)
}

export default function App() {
  const [connection, setConnection] = useState<Connection>('checking')
  const [attempt, setAttempt] = useState(0)
  const [account, setAccount] = useState<Account | null>(null)
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register')
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [salon, setSalon] = useState<Salon | null>(null)
  const [salonError, setSalonError] = useState('')
  const [salonBusy, setSalonBusy] = useState(false)
  const [editingSalon, setEditingSalon] = useState(false)
  const [applications, setApplications] = useState<BarberApplication[]>([])
  const [ownerApplications, setOwnerApplications] = useState<BarberApplication[]>([])
  const [ownerBarbers, setOwnerBarbers] = useState<BarberQualification[]>([])
  const [editingQualificationBarberId, setEditingQualificationBarberId] = useState<number | null>(null)
  const [qualificationError, setQualificationError] = useState('')
  const [qualificationBusy, setQualificationBusy] = useState<number | null>(null)
  const [directorySalons, setDirectorySalons] = useState<DirectorySalon[]>([])
  const [nearbySalons, setNearbySalons] = useState<DirectorySalon[]>([])
  const [discoveryLatitude, setDiscoveryLatitude] = useState('')
  const [discoveryLongitude, setDiscoveryLongitude] = useState('')
  const [showManualLocation, setShowManualLocation] = useState(false)
  const [discoveryError, setDiscoveryError] = useState('')
  const [discoveryBusy, setDiscoveryBusy] = useState(false)
  const [services, setServices] = useState<SalonService[]>([])
  const [selectedSalonServices, setSelectedSalonServices] = useState<SalonService[]>([])
  const [serviceError, setServiceError] = useState('')
  const [serviceBusy, setServiceBusy] = useState(false)
  const [addons, setAddons] = useState<AddOn[]>([])
  const [addonError, setAddonError] = useState('')
  const [addonBusy, setAddonBusy] = useState(false)
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([])
  const [selectedWorkingDays, setSelectedWorkingDays] = useState<number[]>([])
  const [barberBreaks, setBarberBreaks] = useState<BarberBreak[]>([])
  const [daysOff, setDaysOff] = useState<DayOff[]>([])
  const [availabilityError, setAvailabilityError] = useState('')
  const [availabilityBusy, setAvailabilityBusy] = useState(false)
  const [editingDayHourId, setEditingDayHourId] = useState<number | null>(null)
  const [editingDayStart, setEditingDayStart] = useState('')
  const [editingDayEnd, setEditingDayEnd] = useState('')
  const [scheduleWeek, setScheduleWeek] = useState(() => mondayFor(new Date().toISOString().slice(0, 10)))
  const [slotSalonId, setSlotSalonId] = useState('')
  const [slotServices, setSlotServices] = useState<SalonService[]>([])
  const [slotAddons, setSlotAddons] = useState<AddOn[]>([])
  const [slotServiceIds, setSlotServiceIds] = useState<number[]>([])
  const [slotAddonIds, setSlotAddonIds] = useState<number[]>([])
  const [slotDate, setSlotDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotError, setSlotError] = useState('')
  const [slotBusy, setSlotBusy] = useState(false)
  const [bookingBusy, setBookingBusy] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE_TEST' | 'PAY_AT_SALON'>('ONLINE_TEST')
  const [paymentNotes, setPaymentNotes] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem('trimtime_payment_notes')
      return stored ? JSON.parse(stored) as Record<string, string> : {}
    } catch {
      return {}
    }
  })
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [customerAppointmentStatus, setCustomerAppointmentStatus] = useState<string>('')
  const [customerAppointmentPage, setCustomerAppointmentPage] = useState<number>(0)
  const [customerAppointmentTotalPages, setCustomerAppointmentTotalPages] = useState<number>(0)
  const [customerAppointmentTotalElements, setCustomerAppointmentTotalElements] = useState<number>(0)
  const [customerAppointmentsBusy, setCustomerAppointmentsBusy] = useState<boolean>(false)
  const [customerAppointmentsError, setCustomerAppointmentsError] = useState<string>('')
  const bookingRequestKeys = useRef(new Map<string, string>())
  const [barberError, setBarberError] = useState('')
  const [barberBusy, setBarberBusy] = useState(false)
  const [barberAppointments, setBarberAppointments] = useState<Appointment[]>([])
  const [barberAppointmentDate, setBarberAppointmentDate] = useState('')
  const [barberAppointmentsBusy, setBarberAppointmentsBusy] = useState(false)
  const [barberAppointmentsError, setBarberAppointmentsError] = useState('')
  const [barberTab, setBarberTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE')
  const [ownerAppointments, setOwnerAppointments] = useState<Appointment[]>([])
  const [ownerAppointmentDate, setOwnerAppointmentDate] = useState('')
  const [ownerAppointmentsBusy, setOwnerAppointmentsBusy] = useState(false)
  const [ownerAppointmentsError, setOwnerAppointmentsError] = useState('')
  const [ownerTab, setOwnerTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE')
  const [ownerViewMode, setOwnerViewMode] = useState<'APPOINTMENTS' | 'TRANSACTIONS'>('APPOINTMENTS')
  const [txnStatusFilter, setTxnStatusFilter] = useState<string>('ALL')
  const [txnBarberFilter, setTxnBarberFilter] = useState<string>('ALL')
  const [txnPaymentFilter, setTxnPaymentFilter] = useState<string>('ALL')
  const [inspectedReceipt, setInspectedReceipt] = useState<Appointment | null>(null)
  const [ownerBarberFilter, setOwnerBarberFilter] = useState<string>('ALL')
  const [inspectedBarberClients, setInspectedBarberClients] = useState<BarberQualification | null>(null)
  const [acknowledgedBookingIds, setAcknowledgedBookingIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('trimtime_ack_bookings')
      return stored ? new Set(JSON.parse(stored)) : new Set<string>()
    } catch {
      return new Set<string>()
    }
  })
  const [showRecentBookingsFeed, setShowRecentBookingsFeed] = useState(false)
  const initialOwnerAppointmentsLoaded = useRef(false)
  const [offboardingBarber, setOffboardingBarber] = useState<BarberQualification | null>(null)
  const [reassignTargetBarbers, setReassignTargetBarbers] = useState<Record<string, string>>({})
  const [candidateBarbersMap, setCandidateBarbersMap] = useState<Record<string, { barberId: number; barberName: string }[]>>({})
  const [candidateLoadingMap, setCandidateLoadingMap] = useState<Record<string, boolean>>({})
  const [reassignBusy, setReassignBusy] = useState<string | null>(null)
  const [reassignError, setReassignError] = useState('')
  const [photos, setPhotos] = useState<SalonPhoto[]>([])
  const [selectedPhotoFiles, setSelectedPhotoFiles] = useState<File[]>([])
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [photoUploadProgress, setPhotoUploadProgress] = useState('')
  const [selectedSalonPhotos, setSelectedSalonPhotos] = useState<SalonPhoto[]>([])

  async function loadCustomerAppointments(statusFilter = customerAppointmentStatus, pageNumber = customerAppointmentPage) {
    setCustomerAppointmentsBusy(true)
    setCustomerAppointmentsError('')
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', String(pageNumber))
      params.set('size', '10')
      const response = await fetch(`/api/appointments/mine?${params.toString()}`)
      if (!response.ok) throw await editError(response, 'Unable to load appointments.')
      const data = await response.json()
      if (Array.isArray(data)) {
        setAppointments(data as Appointment[])
        setCustomerAppointmentPage(0)
        setCustomerAppointmentTotalPages(data.length > 0 ? 1 : 0)
        setCustomerAppointmentTotalElements(data.length)
      } else {
        const pageData = data as PageResponse<Appointment>
        setAppointments(pageData.content)
        setCustomerAppointmentPage(pageData.page)
        setCustomerAppointmentTotalPages(pageData.totalPages)
        setCustomerAppointmentTotalElements(pageData.totalElements)
      }
    } catch (error) {
      setCustomerAppointmentsError(error instanceof Error ? error.message : 'Unable to load appointments.')
    } finally {
      setCustomerAppointmentsBusy(false)
    }
  }

  async function loadBarberAppointments(filterDate = barberAppointmentDate) {
    setBarberAppointmentsBusy(true)
    setBarberAppointmentsError('')
    try {
      const url = filterDate ? `/api/barber/appointments?date=${filterDate}` : '/api/barber/appointments'
      const response = await fetch(url)
      if (!response.ok) throw await editError(response, 'Unable to load barber schedule.')
      setBarberAppointments(await response.json() as Appointment[])
    } catch (error) {
      setBarberAppointmentsError(error instanceof Error ? error.message : 'Unable to load barber schedule.')
    } finally {
      setBarberAppointmentsBusy(false)
    }
  }

  async function loadOwnerAppointments(filterDate = ownerAppointmentDate) {
    setOwnerAppointmentsBusy(true)
    setOwnerAppointmentsError('')
    try {
      const url = filterDate ? `/api/salons/mine/appointments?date=${filterDate}` : '/api/salons/mine/appointments'
      const response = await fetch(url)
      if (!response.ok) throw await editError(response, 'Unable to load salon appointments.')
      const data = await response.json() as Appointment[]
      if (!initialOwnerAppointmentsLoaded.current) {
        initialOwnerAppointmentsLoaded.current = true
        setAcknowledgedBookingIds(prev => new Set([...prev, ...data.map(a => a.bookingReference)]))
      }
      setOwnerAppointments(data)
    } catch (error) {
      setOwnerAppointmentsError(error instanceof Error ? error.message : 'Unable to load salon appointments.')
    } finally {
      setOwnerAppointmentsBusy(false)
    }
  }

  async function loadAvailableBarbersFor(bookingReference: string) {
    setCandidateLoadingMap(prev => ({ ...prev, [bookingReference]: true }))
    try {
      const res = await fetch(`/api/salons/mine/appointments/${bookingReference}/available-barbers`)
      if (res.ok) {
        const candidates = await res.json() as { barberId: number; barberName: string }[]
        setCandidateBarbersMap(prev => ({ ...prev, [bookingReference]: candidates }))
        if (candidates.length > 0) {
          setReassignTargetBarbers(prev => ({
            ...prev,
            [bookingReference]: prev[bookingReference] || String(candidates[0].barberId)
          }))
        }
      }
    } catch {
      // ignore
    } finally {
      setCandidateLoadingMap(prev => ({ ...prev, [bookingReference]: false }))
    }
  }

  useEffect(() => {
    if (!offboardingBarber) return
    const activeAppts = ownerAppointments.filter(
      a => (a.barberId === offboardingBarber.barberId || a.barberName === offboardingBarber.barberName) &&
           (a.status === 'CONFIRMED' || a.status === 'IN_PROGRESS')
    )
    activeAppts.forEach(appt => {
      if (!candidateBarbersMap[appt.bookingReference]) {
        void loadAvailableBarbersFor(appt.bookingReference)
      }
    })
  }, [offboardingBarber, ownerAppointments])

  async function handleReassignAppointment(bookingReference: string, targetBarberId: number) {
    setReassignBusy(bookingReference)
    setReassignError('')
    try {
      const csrfResponse = await fetch('/api/auth/csrf')
      const csrf = await csrfResponse.json() as { token: string; headerName: string }
      const response = await fetch(`/api/salons/mine/appointments/${bookingReference}/reassign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [csrf.headerName]: csrf.token
        },
        body: JSON.stringify({ targetBarberId })
      })
      if (!response.ok) {
        throw await editError(response, 'Unable to reassign appointment.')
      }
      const updated = await response.json() as Appointment
      setOwnerAppointments(prev => prev.map(a => a.bookingReference === updated.bookingReference ? updated : a))
    } catch (err) {
      setReassignError(err instanceof Error ? err.message : 'Unable to reassign appointment.')
    } finally {
      setReassignBusy(null)
    }
  }

  async function handleCancelAppointmentInWizard(bookingReference: string) {
    setReassignBusy(bookingReference)
    setReassignError('')
    try {
      const csrfResponse = await fetch('/api/auth/csrf')
      const csrf = await csrfResponse.json() as { token: string; headerName: string }
      const response = await fetch(`/api/salons/mine/appointments/${bookingReference}/cancel`, {
        method: 'POST',
        headers: { [csrf.headerName]: csrf.token }
      })
      if (!response.ok) {
        throw await editError(response, 'Unable to cancel appointment.')
      }
      const updated = await response.json() as Appointment
      setOwnerAppointments(prev => prev.map(a => a.bookingReference === updated.bookingReference ? updated : a))
    } catch (err) {
      setReassignError(err instanceof Error ? err.message : 'Unable to cancel appointment.')
    } finally {
      setReassignBusy(null)
    }
  }

  async function handleRemoveBarber(barberId: number) {
    setQualificationBusy(barberId)
    setQualificationError('')
    setReassignError('')
    try {
      const csrfResponse = await fetch('/api/auth/csrf')
      const csrf = await csrfResponse.json() as { token: string; headerName: string }
      const response = await fetch(`/api/salons/mine/barbers/${barberId}`, {
        method: 'DELETE',
        headers: { [csrf.headerName]: csrf.token }
      })
      if (!response.ok) throw await editError(response, 'Unable to remove barber from salon.')
      setOwnerBarbers(ownerBarbers.filter(item => item.barberId !== barberId))
      setOffboardingBarber(null)
      if (barberId === account?.id) {
        const meResponse = await fetch('/api/auth/me')
        if (meResponse.ok) setAccount(await meResponse.json() as Account)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to remove barber from salon.'
      setQualificationError(msg)
      setReassignError(msg)
      if (msg.includes('invalidate existing appointments') || msg.includes('Booking references:')) {
        const found = ownerBarbers.find(b => b.barberId === barberId)
        if (found) setOffboardingBarber(found)
        void loadOwnerAppointments()
      }
    } finally {
      setQualificationBusy(null)
    }
  }

  const thisWeekMonday = mondayFor(new Date().toISOString().slice(0, 10))
  const nextWeekMonday = nextMondayFor(thisWeekMonday)

  async function selectWeek(week: string) {
    if (week === scheduleWeek) return
    setScheduleWeek(week)
    setAvailabilityError('')
    setEditingDayHourId(null)
    setAvailabilityBusy(true)
    try {
      const [hoursResponse, breaksResponse] = await Promise.all([
        fetch(`/api/barber/availability/hours?weekStartDate=${week}`),
        fetch(`/api/barber/availability/breaks?weekStartDate=${week}`)
      ])
      if (hoursResponse.ok) {
        const loadedHours = await hoursResponse.json() as WorkingHour[]
        setWorkingHours(loadedHours)
        setSelectedWorkingDays(loadedHours.map(item => item.dayOfWeek))
      } else {
        setWorkingHours([])
        setSelectedWorkingDays([])
      }
      if (breaksResponse.ok) {
        setBarberBreaks(await breaksResponse.json() as BarberBreak[])
      } else {
        setBarberBreaks([])
      }
    } catch (err) {
      setAvailabilityError(err instanceof Error ? err.message : 'Unable to load schedule.')
    } finally {
      setAvailabilityBusy(false)
    }
  }

  async function updateBarberAppointmentStatus(bookingReference: string, targetStatus: string) {
    setBarberAppointmentsBusy(true)
    setBarberAppointmentsError('')
    try {
      const csrfResponse = await fetch('/api/auth/csrf')
      const csrf = await csrfResponse.json() as { token: string; headerName: string }
      const response = await fetch(`/api/barber/appointments/${bookingReference}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
        body: JSON.stringify({ status: targetStatus })
      })
      if (!response.ok) throw await editError(response, 'Unable to update appointment status.')
      const updated = await response.json() as Appointment
      setBarberAppointments(current => current.map(appt => appt.bookingReference === updated.bookingReference ? updated : appt))
    } catch (error) {
      setBarberAppointmentsError(error instanceof Error ? error.message : 'Unable to update appointment status.')
    } finally {
      setBarberAppointmentsBusy(false)
    }
  }

  async function updateOwnerAppointmentStatus(bookingReference: string, targetStatus: string) {
    setOwnerAppointmentsBusy(true)
    setOwnerAppointmentsError('')
    try {
      const csrfResponse = await fetch('/api/auth/csrf')
      const csrf = await csrfResponse.json() as { token: string; headerName: string }
      const response = await fetch(`/api/salons/mine/appointments/${bookingReference}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
        body: JSON.stringify({ status: targetStatus })
      })
      if (!response.ok) throw await editError(response, 'Unable to update appointment status.')
      const updated = await response.json() as Appointment
      setOwnerAppointments(current => current.map(appt => appt.bookingReference === updated.bookingReference ? updated : appt))
    } catch (error) {
      setOwnerAppointmentsError(error instanceof Error ? error.message : 'Unable to update appointment status.')
    } finally {
      setOwnerAppointmentsBusy(false)
    }
  }

  async function searchDirectory(latitude = discoveryLatitude, longitude = discoveryLongitude) {
    setDiscoveryBusy(true); setDiscoveryError('')
    try {
      const params = new URLSearchParams()
      if (!latitude.trim() || !longitude.trim()) throw new Error('Allow location access or enter both manual coordinates.')
      params.set('latitude', latitude); params.set('longitude', longitude); params.set('radiusKm', '5')
      const response = await fetch(`/api/salons${params.toString() ? `?${params.toString()}` : ''}`)
      if (!response.ok) { const detail = await response.json().catch(() => null) as { detail?: string } | null; throw new Error(detail?.detail || 'Unable to search salons.') }
      setNearbySalons(await response.json() as DirectorySalon[])
    } catch (error) { setDiscoveryError(error instanceof Error ? error.message : 'Unable to search salons.') }
    finally { setDiscoveryBusy(false) }
  }
  function useMyLocation() {
    if (!navigator.geolocation) { setShowManualLocation(true); setDiscoveryError('Location is not supported by this browser. Use the manual location fallback.'); return }
    setDiscoveryBusy(true); setDiscoveryError('')
    navigator.geolocation.getCurrentPosition(position => { const latitude = position.coords.latitude.toFixed(6); const longitude = position.coords.longitude.toFixed(6); setDiscoveryLatitude(latitude); setDiscoveryLongitude(longitude); setShowManualLocation(false); void searchDirectory(latitude, longitude) }, () => { setShowManualLocation(true); setDiscoveryBusy(false); setDiscoveryError('Location permission was unavailable. Use the manual location fallback.') })
  }
  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    let active = true
    fetch('/api/system/status', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Service unavailable')
        const body = await response.json()
        if (body.status !== 'UP' || body.database !== 'CONNECTED') throw new Error('Not ready')
        if (active) setConnection('connected')
      })
      .catch(() => { if (active) setConnection('unavailable') })
      .finally(() => window.clearTimeout(timeout))
    return () => { active = false; window.clearTimeout(timeout); controller.abort() }
  }, [attempt])

  async function authenticate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthBusy(true); setAuthError('')
    const form = new FormData(event.currentTarget)
    try {
      const csrfResponse = await fetch('/api/auth/csrf')
      const csrf = await csrfResponse.json() as { token: string; headerName: string }
      const payload = { email: String(form.get('email')), password: String(form.get('password')), displayName: String(form.get('displayName') ?? '') }
      const response = await fetch(`/api/auth/${authMode}`, { method: 'POST', headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify(payload) })
      if (!response.ok) throw new Error(response.status === 409 ? 'An account with that email already exists.' : 'Please check your details and try again.')
      const signedIn = await response.json() as Account
      setAccount(signedIn)
      const mine = await fetch('/api/salons/mine')
      if (mine?.ok) {
        setSalon(await mine.json() as Salon)
        const photoResponse = await fetch('/api/salons/mine/photos')
        if (photoResponse?.ok) setPhotos(await photoResponse.json() as SalonPhoto[])
      }
      const ownApps = await fetch('/api/barber/applications/mine')
      if (ownApps?.ok) setApplications(await ownApps.json() as BarberApplication[])
      const directory = await fetch('/api/salons')
      if (directory?.ok) setDirectorySalons(await directory.json() as DirectorySalon[])
      const pending = await fetch('/api/salons/mine/barber-applications')
      if (pending?.ok) setOwnerApplications(await pending.json() as BarberApplication[])
      const barberResponse = await fetch('/api/salons/mine/barbers')
      if (barberResponse?.ok) setOwnerBarbers(await barberResponse.json() as BarberQualification[])
      const catalogue = await fetch('/api/salons/mine/services')
      if (catalogue?.ok) setServices(await catalogue.json() as SalonService[])
      const addonResponse = await fetch('/api/salons/mine/addons')
      if (addonResponse?.ok) setAddons(await addonResponse.json() as AddOn[])
      const appointmentsResponse = await fetch('/api/appointments/mine')
      if (appointmentsResponse?.ok) {
        const data = await appointmentsResponse.json()
        if (Array.isArray(data)) {
          setAppointments(data as Appointment[])
          setCustomerAppointmentPage(0)
          setCustomerAppointmentTotalPages(data.length > 0 ? 1 : 0)
          setCustomerAppointmentTotalElements(data.length)
        } else {
          const pageData = data as PageResponse<Appointment>
          setAppointments(pageData.content)
          setCustomerAppointmentPage(pageData.page)
          setCustomerAppointmentTotalPages(pageData.totalPages)
          setCustomerAppointmentTotalElements(pageData.totalElements)
        }
      }
      if (signedIn.roles.includes('BARBER')) {
        const barberApptsResponse = await fetch('/api/barber/appointments')
        if (barberApptsResponse?.ok) setBarberAppointments(await barberApptsResponse.json() as Appointment[])
      }
      if (signedIn.roles.includes('SALON_OWNER')) {
        const ownerApptsResponse = await fetch('/api/salons/mine/appointments')
        if (ownerApptsResponse?.ok) {
          const ownerAppts = await ownerApptsResponse.json() as Appointment[]
          setOwnerAppointments(ownerAppts)
          setAcknowledgedBookingIds(prev => new Set([...prev, ...ownerAppts.map(a => a.bookingReference)]))
          initialOwnerAppointmentsLoaded.current = true
        }
      }
      const hoursResponse = await fetch(`/api/barber/availability/hours?weekStartDate=${scheduleWeek}`)
      if (hoursResponse?.ok) {
        const loadedHours = await hoursResponse.json() as WorkingHour[]
        setWorkingHours(loadedHours)
        setSelectedWorkingDays(loadedHours.map(item => item.dayOfWeek))
      }
      const breaksResponse = await fetch(`/api/barber/availability/breaks?weekStartDate=${scheduleWeek}`)
      if (breaksResponse?.ok) setBarberBreaks(await breaksResponse.json() as BarberBreak[])
      const daysOffResponse = await fetch('/api/barber/availability/days-off')
      if (daysOffResponse?.ok) setDaysOff(await daysOffResponse.json() as DayOff[])
    } catch (error) { setAuthError(error instanceof Error ? error.message : 'Unable to complete the request.') }
    finally { setAuthBusy(false) }
  }

  async function logout() {
    try {
      const csrfResponse = await fetch('/api/auth/csrf')
      const csrf = await csrfResponse.json() as { token: string; headerName: string }
      await fetch('/api/auth/logout', { method: 'POST', headers: { [csrf.headerName]: csrf.token } })
    } finally {
      setAccount(null); setSalon(null); setApplications([]); setOwnerApplications([]); setOwnerBarbers([]); setEditingQualificationBarberId(null); setDirectorySalons([]); setNearbySalons([]); setServices([]); setSelectedSalonServices([]); setAddons([]); setWorkingHours([]); setSelectedWorkingDays([]); setBarberBreaks([]); setDaysOff([]); setSlots([]); setAppointments([]); setCustomerAppointmentStatus(''); setCustomerAppointmentPage(0); setCustomerAppointmentTotalPages(0); setCustomerAppointmentTotalElements(0); setCustomerAppointmentsError(''); setSlotSalonId(''); setSlotServices([]); setSlotAddons([]); setSlotServiceIds([]); setSlotAddonIds([]); setDiscoveryLatitude(''); setDiscoveryLongitude(''); setShowManualLocation(false); setDiscoveryError(''); setAuthError(''); setBarberError(''); setQualificationError(''); setAvailabilityError(''); setSlotError(''); setBookingError('')
      setBarberAppointments([]); setBarberAppointmentDate(''); setBarberAppointmentsError('')
      setOwnerAppointments([]); setOwnerAppointmentDate(''); setOwnerAppointmentsError(''); setOwnerBarberFilter('ALL'); setInspectedBarberClients(null); setShowRecentBookingsFeed(false); initialOwnerAppointmentsLoaded.current = false;
      setOffboardingBarber(null); setReassignTargetBarbers({}); setCandidateBarbersMap({}); setCandidateLoadingMap({}); setReassignBusy(null); setReassignError('');
      setPhotos([]); setSelectedSalonPhotos([]); setSelectedPhotoFiles([]); setPhotoUploadProgress(''); setPhotoError('')
    }
  }

  const status = connection === 'connected' ? 'Connection verified'
    : connection === 'checking' ? 'Checking connection...' : 'Connection unavailable'
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a href="/" className={styles.brand}>Trim<span>Time</span><span className={styles.dot}>.</span></a>
        <span className={styles.badge}>PROJECT PREVIEW</span>
      </header>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>YOUR NEXT GOOD HAIR DAY</p>
        <h1>A little less waiting.<br /><span>A little more you.</span></h1>
        <p className={styles.intro}>Find a salon nearby, choose your service, and make time for yourself. We’re building your appointment experience, one step at a time.</p>
        <div className={styles.previewNote}>Booking and account features are coming next.</div>
      </section>
      <section className={styles.foundation} aria-labelledby="foundation-heading">
        <div>
          <p className={styles.eyebrow}>MILESTONE 01</p>
          <h2 id="foundation-heading">The foundation</h2>
          <p>Our first check connects this page to the application and its database.</p>
        </div>
        <div className={styles.statusCard}>
          <p role="status" className={styles.status}>{status}</p>
          <p>{connection === 'connected' ? 'React → Spring Boot → MySQL is working.' : connection === 'checking' ? 'Waiting for the application to respond.' : 'The application or database may be starting. Try again shortly.'}</p>
          <button disabled={connection === 'checking'} onClick={() => { setConnection('checking'); setAttempt((value) => value + 1) }}>Check connection</button>
        </div>
      </section>
      <section className={styles.authSection} aria-labelledby="auth-heading">
        <div><p className={styles.eyebrow}>FEATURE 01 / 12</p><h2 id="auth-heading">Create your account</h2><p>Every new account starts as a customer. Barber and salon-owner access will be added through controlled onboarding.</p></div>
        {account ? <div className={styles.accountCard}><p className={styles.status}>Signed in</p><h3>{account.displayName}</h3><p>{account.email}</p><span>{account.roles.join(' - ')}</span><button type="button" className={styles.secondaryButton} onClick={logout}>Log out</button></div> : <form className={styles.authForm} onSubmit={authenticate}>
          <div className={styles.mode}><button type="button" className={authMode === 'register' ? styles.activeMode : ''} onClick={() => setAuthMode('register')}>Register</button><button type="button" className={authMode === 'login' ? styles.activeMode : ''} onClick={() => setAuthMode('login')}>Log in</button></div>
          {authMode === 'register' && <label>Display name<input name="displayName" required maxLength={120} /></label>}
          <label>Email<input name="email" type="email" required /></label>
          <label>Password<input name="password" type="password" minLength={8} required /></label>
          {authError && <p className={styles.error} role="alert">{authError}</p>}
          <button className={styles.submit} disabled={authBusy}>{authBusy ? 'Working...' : authMode === 'register' ? 'Create account' : 'Log in'}</button>
        </form>}
      </section>
      {account && <section className={styles.authSection} aria-labelledby="salon-heading">
        <div><p className={styles.eyebrow}>FEATURE 02 / 12</p><h2 id="salon-heading">Set up your salon</h2><p>One salon owner account manages one salon. This profile becomes the workspace where barbers can request to join.</p></div>
        {salon ? (editingSalon ? <form className={styles.authForm} onSubmit={async (event) => { event.preventDefault(); setSalonBusy(true); setSalonError(''); const formElement = event.currentTarget; const form = new FormData(formElement); try { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const latitude = String(form.get('latitude') ?? '').trim(); const longitude = String(form.get('longitude') ?? '').trim(); const slotInc = form.get('slotIncrementMinutes'); const horizon = form.get('bookingHorizonDays'); const response = await fetch('/api/salons/mine', { method: 'PUT', headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify({ name: String(form.get('name')), description: String(form.get('description') ?? ''), address: String(form.get('address')), contact: String(form.get('contact')), latitude: latitude ? Number(latitude) : null, longitude: longitude ? Number(longitude) : null, timezone: String(form.get('timezone') || 'Asia/Kolkata'), slotIncrementMinutes: slotInc ? Number(slotInc) : null, bookingHorizonDays: horizon ? Number(horizon) : 7 }) }); if (!response.ok) throw new Error('Unable to update the salon.'); setSalon(await response.json() as Salon); setEditingSalon(false) } catch (error) { setSalonError(error instanceof Error ? error.message : 'Unable to update the salon.') } finally { setSalonBusy(false) } }}><label>Salon name<input name="name" defaultValue={salon.name} required maxLength={160} /></label><label>Address<input name="address" defaultValue={salon.address} required maxLength={255} /></label><label>Contact<input name="contact" defaultValue={salon.contact} required maxLength={40} /></label><label>Latitude<input name="latitude" type="number" step="any" min="-90" max="90" defaultValue={salon.latitude ?? ''} /></label><label>Longitude<input name="longitude" type="number" step="any" min="-180" max="180" defaultValue={salon.longitude ?? ''} /></label><label>Description<input name="description" defaultValue={salon.description} maxLength={500} /></label><label>Timezone<input name="timezone" defaultValue={salon.timezone} required /></label><label>Slot start grid<select name="slotIncrementMinutes" defaultValue={salon.slotIncrementMinutes ? String(salon.slotIncrementMinutes) : ''}><option value="15">15-minute grid</option><option value="30">30-minute grid</option><option value="">By service duration</option></select></label><label>Advance booking horizon (days)<input name="bookingHorizonDays" type="number" min="1" max="365" defaultValue={salon.bookingHorizonDays ?? 7} required /></label>{salonError && <p className={styles.error} role="alert">{salonError}</p>}<button className={styles.submit} disabled={salonBusy}>{salonBusy ? 'Saving...' : 'Save changes'}</button><button type="button" className={styles.secondaryButton} onClick={() => setEditingSalon(false)}>Cancel</button></form> : <div className={styles.accountCard}><p className={styles.status}>Salon created</p><h3>{salon.name}</h3><p>{salon.address} - {salon.contact}</p><span>{salon.timezone} · Grid: {salon.slotIncrementMinutes ? `${salon.slotIncrementMinutes} min` : 'Service duration'} · Horizon: {salon.bookingHorizonDays ?? 7} days</span><button type="button" className={styles.secondaryButton} onClick={() => setEditingSalon(true)}>Edit salon</button></div>) : <form className={styles.authForm} onSubmit={async (event) => { event.preventDefault(); setSalonBusy(true); setSalonError(''); const formElement = event.currentTarget; const form = new FormData(formElement); try { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const latitude = String(form.get('latitude') ?? '').trim(); const longitude = String(form.get('longitude') ?? '').trim(); const slotInc = form.get('slotIncrementMinutes'); const horizon = form.get('bookingHorizonDays'); const response = await fetch('/api/salons', { method: 'POST', headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify({ name: String(form.get('name')), description: String(form.get('description') ?? ''), address: String(form.get('address')), contact: String(form.get('contact')), latitude: latitude ? Number(latitude) : null, longitude: longitude ? Number(longitude) : null, timezone: String(form.get('timezone') || 'Asia/Kolkata'), slotIncrementMinutes: slotInc ? Number(slotInc) : null, bookingHorizonDays: horizon ? Number(horizon) : 7 }) }); if (!response.ok) throw new Error(response.status === 409 ? 'This account already owns a salon.' : 'Unable to create the salon.'); setSalon(await response.json() as Salon); const refreshed = await fetch('/api/auth/me'); if (refreshed.ok) setAccount(await refreshed.json() as Account) } catch (error) { setSalonError(error instanceof Error ? error.message : 'Unable to create the salon.') } finally { setSalonBusy(false) } }}>
          <label>Salon name<input name="name" required maxLength={160} /></label><label>Address<input name="address" required maxLength={255} /></label><label>Contact<input name="contact" required maxLength={40} /></label><label>Latitude<input name="latitude" type="number" step="any" min="-90" max="90" /></label><label>Longitude<input name="longitude" type="number" step="any" min="-180" max="180" /></label><label>Description<input name="description" maxLength={500} /></label><label>Timezone<input name="timezone" defaultValue="Asia/Kolkata" required /></label><label>Slot start grid<select name="slotIncrementMinutes" defaultValue="15"><option value="15">15-minute grid</option><option value="30">30-minute grid</option><option value="">By service duration</option></select></label><label>Advance booking horizon (days)<input name="bookingHorizonDays" type="number" min="1" max="365" defaultValue="7" required /></label>{salonError && <p className={styles.error} role="alert">{salonError}</p>}<button className={styles.submit} disabled={salonBusy}>{salonBusy ? 'Creating...' : 'Create salon'}</button>
        </form>}
      </section>}
      {account?.roles.includes('SALON_OWNER') && salon && <section className={styles.authSection} aria-labelledby="photos-heading">
        <div><p className={styles.eyebrow}>SALON GALLERY</p><h2 id="photos-heading">Salon photo gallery</h2><p>Upload photos showcasing your salon interior, styling stations, and storefront (JPEG, PNG, WebP up to 5 MB, max 10 photos).</p></div>
        <div className={styles.authForm}>
          <form onSubmit={async (event) => {
            event.preventDefault();
            setPhotoBusy(true);
            setPhotoError('');
            setPhotoUploadProgress('');
            const formElement = event.currentTarget;
            if (selectedPhotoFiles.length === 0) {
              setPhotoError('Please select at least one photo file.');
              setPhotoBusy(false);
              return;
            }
            if (photos.length + selectedPhotoFiles.length > 10) {
              setPhotoError(`Cannot upload ${selectedPhotoFiles.length} photos. You can only add up to ${10 - photos.length} more photo(s) (maximum 10 allowed).`);
              setPhotoBusy(false);
              return;
            }
            try {
              const csrfResponse = await fetch('/api/auth/csrf');
              const csrf = await csrfResponse.json() as { token: string; headerName: string };
              const uploaded: SalonPhoto[] = [];
              for (let i = 0; i < selectedPhotoFiles.length; i++) {
                const file = selectedPhotoFiles[i];
                if (selectedPhotoFiles.length > 1) {
                  setPhotoUploadProgress(`Uploading photo ${i + 1} of ${selectedPhotoFiles.length}...`);
                }
                const form = new FormData();
                form.append('file', file);
                const response = await fetch('/api/salons/mine/photos', {
                  method: 'POST',
                  headers: { [csrf.headerName]: csrf.token },
                  body: form
                });
                if (!response.ok) throw await editError(response, `Unable to upload ${file.name}.`);
                const saved = await response.json() as SalonPhoto;
                uploaded.push(saved);
              }
              setPhotos(current => [...current, ...uploaded]);
              setSelectedPhotoFiles([]);
              setPhotoUploadProgress('');
              formElement.reset();
            } catch (error) {
              setPhotoError(error instanceof Error ? error.message : 'Unable to upload photo.');
            } finally {
              setPhotoBusy(false);
              setPhotoUploadProgress('');
            }
          }}>
            <label>
              Select image(s)
              <input
                aria-label="Select image"
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                required
                onChange={(e) => {
                  const files = Array.from(e.currentTarget.files ?? []);
                  setSelectedPhotoFiles(files);
                  setPhotoError('');
                }}
              />
            </label>
            {selectedPhotoFiles.length > 0 && (
              <p style={{ fontSize: '0.85rem', color: '#1b4332', fontWeight: 600, marginTop: '-0.3rem', marginBottom: '0.6rem' }}>
                📷 {selectedPhotoFiles.length} {selectedPhotoFiles.length === 1 ? 'image' : 'images'} selected ({selectedPhotoFiles.map(f => f.name).join(', ')})
              </p>
            )}
            {photoUploadProgress && <p style={{ fontSize: '0.85rem', color: '#224c3e', fontWeight: 600 }}>{photoUploadProgress}</p>}
            {photoError && <p className={styles.error} role="alert">{photoError}</p>}
            <button className={styles.submit} disabled={photoBusy || photos.length >= 10}>
              {photoBusy
                ? (photoUploadProgress || 'Uploading...')
                : photos.length >= 10
                  ? 'Photo limit reached (10/10)'
                  : selectedPhotoFiles.length > 1
                    ? `Upload ${selectedPhotoFiles.length} photos`
                    : 'Upload photo'}
            </button>
          </form>
          {photos.length > 0 && <div className={styles.accountCard}>
            <p className={styles.status}>Current photos ({photos.length}/10)</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
              {photos.map(p => (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <img src={p.url} alt={`Salon photo ${p.id}`} style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '4px' }} />
                  <button type="button" className={styles.secondaryButton} disabled={photoBusy} onClick={async () => {
                    setPhotoBusy(true);
                    setPhotoError('');
                    try {
                      const csrfResponse = await fetch('/api/auth/csrf');
                      const csrf = await csrfResponse.json() as { token: string; headerName: string };
                      const response = await fetch(`/api/salons/mine/photos/${p.id}`, {
                        method: 'DELETE',
                        headers: { [csrf.headerName]: csrf.token }
                      });
                      if (!response.ok) throw await editError(response, 'Unable to delete photo.');
                      setPhotos(current => current.filter(item => item.id !== p.id));
                    } catch (error) {
                      setPhotoError(error instanceof Error ? error.message : 'Unable to delete photo.');
                    } finally {
                      setPhotoBusy(false);
                    }
                  }}>Delete</button>
                </div>
              ))}
            </div>
          </div>}
        </div>
      </section>}
      {account && <section className={styles.authSection} aria-labelledby="discovery-heading">
        <div><p className={styles.eyebrow}>FEATURE 03 / 12</p><h2 id="discovery-heading">Find nearby salons</h2><p>Share your location and we will show active salons within 5 km. Your exact location is used only for this search.</p></div>
        <div className={styles.authForm}>
          <button type="button" className={styles.submit} onClick={useMyLocation} disabled={discoveryBusy}>{discoveryBusy ? 'Finding nearby salons...' : 'Use my location'}</button>
          <details open={showManualLocation} onToggle={(event) => setShowManualLocation(event.currentTarget.open)}>
            <summary>Enter location manually</summary>
            <form onSubmit={(event) => { event.preventDefault(); void searchDirectory() }}>
              <label>Latitude<input type="number" step="any" min="-90" max="90" value={discoveryLatitude} onChange={(event) => setDiscoveryLatitude(event.currentTarget.value)} placeholder="e.g. 29.1492" required /></label>
              <label>Longitude<input type="number" step="any" min="-180" max="180" value={discoveryLongitude} onChange={(event) => setDiscoveryLongitude(event.currentTarget.value)} placeholder="e.g. 75.7217" required /></label>
              <button className={styles.secondaryButton} disabled={discoveryBusy}>{discoveryBusy ? 'Searching...' : 'Search within 5 km'}</button>
            </form>
          </details>
          {discoveryError && <p className={styles.error} role="alert">{discoveryError}</p>}
          <div className={styles.accountCard}><p className={styles.status}>Nearby salons</p>{nearbySalons.length === 0 ? <p>Use your location to search for salons within 5 km.</p> : nearbySalons.map(item => <p key={item.id}><strong>{item.name}</strong> · {item.address} · Owner: {item.ownerName}{item.distanceKm !== null && ` · ${item.distanceKm} km away`}</p>)}</div>
        </div>
      </section>}
      {account && <section className={styles.authSection} aria-labelledby="barber-heading">
        <div><p className={styles.eyebrow}>BARBER ONBOARDING</p><h2 id="barber-heading">Barber onboarding</h2><p>Barbers apply to join a salon. Owners review pending applications and approve or reject them.</p></div>
        <div className={styles.authForm}>
          <form onSubmit={async (event) => { event.preventDefault(); setBarberBusy(true); setBarberError(''); const formElement = event.currentTarget; const form = new FormData(formElement); try { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch(`/api/barber/applications/${String(form.get('salonId'))}`, { method: 'POST', headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify({ message: String(form.get('message') ?? ''), bio: String(form.get('bio') ?? ''), experienceYears: Number(form.get('experienceYears') || 0) }) }); if (!response.ok) throw await editError(response, 'Unable to submit the application.'); setApplications([await response.json() as BarberApplication, ...applications]) } catch (error) { setBarberError(error instanceof Error ? error.message : 'Unable to submit the application.') } finally { setBarberBusy(false) } }}>
            <label>Choose a salon<select name="salonId" required defaultValue="" onChange={async (event) => { const salonId = event.currentTarget.value; setSelectedSalonServices([]); if (!salonId) return; const response = await fetch(`/api/salons/${salonId}/services`); if (response.ok) setSelectedSalonServices(await response.json() as SalonService[]) }}><option value="" disabled>Select a salon</option>{directorySalons.map(item => <option key={item.id} value={item.id}>{item.name} — {item.address} - Owner: {item.ownerName}</option>)}</select></label>{selectedSalonServices.length > 0 && <div className={styles.accountCard}><p className={styles.status}>Active services at this salon</p>{selectedSalonServices.map(item => <p key={item.id}><strong>{item.name}</strong> - ₹{item.price} - {item.durationMinutes} minutes</p>)}</div>}{selectedSalonServices.length === 0 && directorySalons.length > 0 && <p>Select a salon to view its active services.</p>}<label>Experience (years)<input name="experienceYears" type="number" min="0" max="80" defaultValue="0" /></label><label>Short bio<input name="bio" maxLength={1000} /></label><label>Message to owner<input name="message" maxLength={1000} /></label>{directorySalons.length === 0 && <p>No active salons are available yet.</p>}{barberError && <p className={styles.error} role="alert">{barberError}</p>}<button className={styles.submit} disabled={barberBusy || directorySalons.length === 0}>{barberBusy ? 'Submitting...' : 'Apply to join salon'}</button>
          </form>
          {applications.length > 0 && <div className={styles.accountCard}><p className={styles.status}>Your applications</p>{applications.map(application => <p key={application.id}>{application.salonName} - <strong>{application.status}</strong>{application.status === 'PENDING' && <> <button type="button" disabled={barberBusy} onClick={async () => { setBarberBusy(true); setBarberError(''); try { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch(`/api/barber/applications/${application.id}/withdraw`, { method: 'POST', headers: { [csrf.headerName]: csrf.token } }); if (!response.ok) throw await editError(response, 'Unable to withdraw application.'); const updated = await response.json() as BarberApplication; setApplications(applications.map(item => item.id === updated.id ? updated : item)) } catch (error) { setBarberError(error instanceof Error ? error.message : 'Unable to withdraw application.') } finally { setBarberBusy(false) } }}>Withdraw</button></>}</p>)}</div>}
          {ownerApplications.length > 0 && <div className={styles.accountCard}><p className={styles.status}>Pending owner approvals</p>{ownerApplications.map(application => <p key={application.id}>{application.barberName} - {application.message || 'No message'} <button type="button" onClick={async () => { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch(`/api/salons/mine/barber-applications/${application.id}/approve`, { method: 'POST', headers: { [csrf.headerName]: csrf.token } }); if (response.ok) { setOwnerApplications(ownerApplications.filter(item => item.id !== application.id)); const barberResponse = await fetch('/api/salons/mine/barbers'); if (barberResponse.ok) setOwnerBarbers(await barberResponse.json() as BarberQualification[]) } }}>Approve</button> <button type="button" onClick={async () => { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch(`/api/salons/mine/barber-applications/${application.id}/reject`, { method: 'POST', headers: { [csrf.headerName]: csrf.token } }); if (response.ok) setOwnerApplications(ownerApplications.filter(item => item.id !== application.id)) }}>Reject</button></p>)}</div>}
        </div>
      </section>}
      {account?.roles.includes('SALON_OWNER') && salon && <section className={styles.authSection} aria-labelledby="qualifications-heading">
        <div><p className={styles.eyebrow}>BARBER QUALIFICATIONS</p><h2 id="qualifications-heading">Assign services to your barbers</h2><p>Choose the services each approved barber can perform. Customers see slots only when a qualified barber is available.</p></div>
        <div className={styles.authForm}>
          {!account.roles.includes('BARBER') && <div className={styles.accountCard}>
            <p className={styles.status}>Owner self-enrollment</p>
            <p>Work as a barber in your salon without submitting a join request.</p>
            <button type="button" className={styles.submit} disabled={barberBusy} onClick={async () => {
              setBarberBusy(true); setBarberError('');
              try {
                const csrfResponse = await fetch('/api/auth/csrf');
                const csrf = await csrfResponse.json() as { token: string; headerName: string };
                const response = await fetch('/api/salons/mine/barbers/enroll-self', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
                  body: JSON.stringify({})
                });
                if (!response.ok) throw await editError(response, 'Unable to enroll as barber.');
                const meResponse = await fetch('/api/auth/me');
                if (meResponse.ok) setAccount(await meResponse.json() as Account);
                const barberResponse = await fetch('/api/salons/mine/barbers');
                if (barberResponse.ok) setOwnerBarbers(await barberResponse.json() as BarberQualification[]);
              } catch (error) {
                setBarberError(error instanceof Error ? error.message : 'Unable to enroll as barber.');
              } finally {
                setBarberBusy(false);
              }
            }}>{barberBusy ? 'Enrolling...' : 'Enroll myself as barber'}</button>
          </div>}
          {ownerBarbers.length === 0 && <p>No approved barbers yet. Approve a barber application first or enroll yourself.</p>}
          {ownerBarbers.map(barber => {
            const isEditing = editingQualificationBarberId === barber.barberId || barber.serviceIds.length === 0;
            if (isEditing) {
              return (
                <form key={barber.barberId} onSubmit={async (event) => {
                  event.preventDefault();
                  setQualificationBusy(barber.barberId);
                  setQualificationError('');
                  const formElement = event.currentTarget;
                  const form = new FormData(formElement);
                  const serviceIds = form.getAll('serviceIds').map(value => Number(value));
                  try {
                    const csrfResponse = await fetch('/api/auth/csrf');
                    const csrf = await csrfResponse.json() as { token: string; headerName: string };
                    const response = await fetch(`/api/salons/mine/barbers/${barber.barberId}/services`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
                      body: JSON.stringify({ serviceIds })
                    });
                    if (!response.ok) throw await editError(response, 'Unable to save barber qualifications.');
                    const saved = await response.json() as BarberQualification;
                    setOwnerBarbers(ownerBarbers.map(item => item.barberId === saved.barberId ? saved : item));
                    setEditingQualificationBarberId(null);
                  } catch (error) {
                    setQualificationError(error instanceof Error ? error.message : 'Unable to save barber qualifications.');
                  } finally {
                    setQualificationBusy(null);
                  }
                }}>
                  <div className={styles.accountCard}>
                    <p className={styles.status}>{barber.barberName}</p>
                    <fieldset>
                      <legend>Qualified services</legend>
                      {services.filter(item => item.active).length === 0 && <p>Add an active service first.</p>}
                      {services.filter(item => item.active).map(service => (
                        <label key={service.id}>
                          <input name="serviceIds" type="checkbox" value={service.id} defaultChecked={barber.serviceIds.includes(service.id)} /> {service.name} - ₹{service.price}
                        </label>
                      ))}
                    </fieldset>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button className={styles.submit} disabled={qualificationBusy === barber.barberId}>
                        {qualificationBusy === barber.barberId ? 'Saving...' : 'Save qualifications'}
                      </button>
                      {barber.serviceIds.length > 0 && (
                        <button type="button" className={styles.secondaryButton} onClick={() => setEditingQualificationBarberId(null)}>
                          Cancel
                        </button>
                      )}
                      <button type="button" className={styles.secondaryButton} disabled={qualificationBusy === barber.barberId} onClick={async () => {
                        setQualificationBusy(barber.barberId);
                        setQualificationError('');
                        try {
                          const csrfResponse = await fetch('/api/auth/csrf');
                          const csrf = await csrfResponse.json() as { token: string; headerName: string };
                          const response = await fetch(`/api/salons/mine/barbers/${barber.barberId}`, {
                            method: 'DELETE',
                            headers: { [csrf.headerName]: csrf.token }
                          });
                          if (!response.ok) throw await editError(response, 'Unable to remove barber from salon.');
                          setOwnerBarbers(ownerBarbers.filter(item => item.barberId !== barber.barberId));
                          if (barber.barberId === account.id) {
                            const meResponse = await fetch('/api/auth/me');
                            if (meResponse.ok) setAccount(await meResponse.json() as Account);
                          }
                        } catch (error) {
                          setQualificationError(error instanceof Error ? error.message : 'Unable to remove barber from salon.');
                        } finally {
                          setQualificationBusy(null);
                        }
                      }}>
                        Remove barber
                      </button>
                    </div>
                  </div>
                </form>
              );
            }
            const barberAppts = ownerAppointments.filter(a => a.barberId === barber.barberId || a.barberName === barber.barberName);
            const activeCount = barberAppts.filter(a => a.status === 'CONFIRMED' || a.status === 'IN_PROGRESS').length;
            const completedCount = barberAppts.filter(a => a.status === 'COMPLETED').length;
            const revenueEarned = barberAppts.filter(a => a.status === 'COMPLETED').reduce((sum, a) => sum + (a.totalPrice || 0), 0);

            return (
              <div key={barber.barberId} className={styles.accountCard}>
                <p className={styles.status}>{barber.barberName}</p>
                <div style={{ display: 'flex', gap: '1rem', background: '#f5f7f2', border: '1px solid #dcded5', borderRadius: '6px', padding: '0.5rem 0.75rem', margin: '0.6rem 0', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                  <div><span style={{ color: '#666' }}>Active Clients:</span> <strong style={{ color: '#0369a1' }}>{activeCount}</strong></div>
                  <div><span style={{ color: '#666' }}>Clients Served:</span> <strong style={{ color: '#166534' }}>{completedCount}</strong></div>
                  <div><span style={{ color: '#666' }}>Revenue:</span> <strong style={{ color: '#1b4332' }}>₹{revenueEarned}</strong></div>
                </div>
                <p style={{ margin: '0.5rem 0' }}>
                  <strong>Qualified services:</strong>{' '}
                  {services
                    .filter(s => barber.serviceIds.includes(s.id))
                    .map(s => `${s.name} (₹${s.price})`)
                    .join(', ') || `${barber.serviceIds.length} service(s) assigned`}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    style={{ fontWeight: 600, color: '#1b4332', borderColor: '#224c3e' }}
                    onClick={() => setInspectedBarberClients(barber)}
                  >
                    👥 View Assigned Customers ({barberAppts.length})
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={qualificationBusy === barber.barberId}
                    onClick={() => setEditingQualificationBarberId(barber.barberId)}
                  >
                    Edit qualifications
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={qualificationBusy === barber.barberId}
                    onClick={async () => {
                      if (activeCount > 0) {
                        setOffboardingBarber(barber);
                        setReassignError('');
                        return;
                      }
                      await handleRemoveBarber(barber.barberId);
                    }}
                  >
                    Remove barber
                  </button>
                </div>
              </div>
            );
          })}
          {qualificationError && <p className={styles.error} role="alert">{qualificationError}</p>}

          {/* BARBER ASSIGNED CUSTOMERS MODAL */}
          {inspectedBarberClients && (() => {
            const barberAppts = ownerAppointments.filter(a => a.barberId === inspectedBarberClients.barberId || a.barberName === inspectedBarberClients.barberName);
            const activeAppts = barberAppts.filter(a => a.status === 'CONFIRMED' || a.status === 'IN_PROGRESS');
            const completedAppts = barberAppts.filter(a => a.status === 'COMPLETED');
            const totalRev = completedAppts.reduce((sum, a) => sum + (a.totalPrice || 0), 0);

            const customerMap = new Map<string, { customerName: string; totalBookings: number; completedCount: number; lastVisit: string; totalSpent: number; services: Set<string> }>();
            barberAppts.forEach(a => {
              const name = a.customerName || 'Customer';
              const existing = customerMap.get(name) || { customerName: name, totalBookings: 0, completedCount: 0, lastVisit: a.date, totalSpent: 0, services: new Set<string>() };
              existing.totalBookings += 1;
              if (a.status === 'COMPLETED') {
                existing.completedCount += 1;
                existing.totalSpent += (a.totalPrice || 0);
              }
              if (a.date >= existing.lastVisit) existing.lastVisit = a.date;
              if (a.serviceName) existing.services.add(a.serviceName);
              customerMap.set(name, existing);
            });
            const clientList = Array.from(customerMap.values());

            return (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                <div style={{ background: '#fff', borderRadius: '12px', maxWidth: '600px', width: '100%', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1b4332' }}>Assigned Customers: {inspectedBarberClients.barberName}</h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
                        Staff client book & assigned appointments at {salon?.name || 'your salon'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspectedBarberClients(null)}
                      style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#9ca3af' }}
                      aria-label="Close client book"
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '0.6rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#0369a1', display: 'block' }}>Active / In-Chair</span>
                      <strong style={{ fontSize: '1.1rem', color: '#0c4a6e' }}>{activeAppts.length}</strong>
                    </div>
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.6rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#166534', display: 'block' }}>Total Clients Served</span>
                      <strong style={{ fontSize: '1.1rem', color: '#14532d' }}>{clientList.length}</strong>
                    </div>
                    <div style={{ background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '6px', padding: '0.6rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#57534e', display: 'block' }}>Revenue Earned</span>
                      <strong style={{ fontSize: '1.1rem', color: '#1b4332' }}>₹{totalRev}</strong>
                    </div>
                  </div>

                  <h4 style={{ margin: '1rem 0 0.5rem 0', fontSize: '0.95rem', color: '#1b4332' }}>
                    🕒 Active & Upcoming Customers ({activeAppts.length})
                  </h4>
                  {activeAppts.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic', margin: '0.25rem 0 1rem 0' }}>
                      No active customers currently assigned to {inspectedBarberClients.barberName}.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                      {activeAppts.map(item => (
                        <div key={item.bookingReference} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong>Customer: {item.customerName || 'Customer'}</strong>
                            <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: item.status === 'IN_PROGRESS' ? '#e0f2fe' : '#dcfce7', color: item.status === 'IN_PROGRESS' ? '#0369a1' : '#166534', fontWeight: 700 }}>
                              {item.status}
                            </span>
                          </div>
                          <div style={{ margin: '0.25rem 0', color: '#4b5563' }}>
                            {item.date} · {item.startTime.slice(0, 5)} - {item.endTime.slice(0, 5)} · {item.serviceName}{item.addonSummary ? ` + ${item.addonSummary}` : ''} · ₹{item.totalPrice}
                          </div>
                          {paymentNotes[item.bookingReference] && (
                            <span style={{ display: 'inline-block', fontSize: '0.75rem', background: '#e9ede3', color: '#1b4332', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                              💳 {paymentNotes[item.bookingReference]}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <h4 style={{ margin: '1rem 0 0.5rem 0', fontSize: '0.95rem', color: '#1b4332' }}>
                    👥 Client History & Clientele ({clientList.length} unique customers)
                  </h4>
                  {clientList.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic' }}>
                      No past customer visits recorded for {inspectedBarberClients.barberName} yet.
                    </p>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
                            <th style={{ padding: '0.5rem 0.6rem' }}>Customer</th>
                            <th style={{ padding: '0.5rem 0.6rem' }}>Bookings</th>
                            <th style={{ padding: '0.5rem 0.6rem' }}>Last Visit</th>
                            <th style={{ padding: '0.5rem 0.6rem' }}>Services Booked</th>
                            <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right' }}>Total Spent</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientList.map((client, idx) => (
                            <tr key={client.customerName} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                              <td style={{ padding: '0.5rem 0.6rem', fontWeight: 600 }}>{client.customerName}</td>
                              <td style={{ padding: '0.5rem 0.6rem' }}>{client.totalBookings} ({client.completedCount} completed)</td>
                              <td style={{ padding: '0.5rem 0.6rem', whiteSpace: 'nowrap' }}>{client.lastVisit}</td>
                              <td style={{ padding: '0.5rem 0.6rem' }}>{Array.from(client.services).join(', ') || 'Service'}</td>
                              <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 700, color: '#1b4332' }}>₹{client.totalSpent}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <button
                    type="button"
                    className={styles.submit}
                    style={{ width: '100%', marginTop: '1.25rem' }}
                    onClick={() => setInspectedBarberClients(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            );
          })()}

          {/* STAFF DEPARTURE & REASSIGNMENT WIZARD MODAL */}
          {offboardingBarber && (() => {
            const barberAppts = ownerAppointments.filter(
              a => a.barberId === offboardingBarber.barberId || a.barberName === offboardingBarber.barberName
            );
            const activeAppts = barberAppts.filter(
              a => a.status === 'CONFIRMED' || a.status === 'IN_PROGRESS'
            );
            const otherBarbers = ownerBarbers.filter(
              b => b.barberId !== offboardingBarber.barberId
            );

            return (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                  padding: '1rem'
                }}
              >
                <div
                  style={{
                    background: '#fff',
                    borderRadius: '12px',
                    maxWidth: '650px',
                    width: '100%',
                    padding: '1.5rem',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
                    maxHeight: '90vh',
                    overflowY: 'auto'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      borderBottom: '1px solid #e5e7eb',
                      paddingBottom: '0.75rem',
                      marginBottom: '1rem'
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#991b1b' }}>
                        Staff Departure: {offboardingBarber.barberName}
                      </h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
                        Reassign scheduled customer bookings before removing staff
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOffboardingBarber(null);
                        setReassignError('');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '1.25rem',
                        cursor: 'pointer',
                        color: '#9ca3af'
                      }}
                      aria-label="Close reassignment wizard"
                    >
                      ✕
                    </button>
                  </div>

                  {reassignError && (
                    <div
                      role="alert"
                      style={{
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        padding: '0.75rem',
                        color: '#991b1b',
                        fontSize: '0.85rem',
                        marginBottom: '1rem'
                      }}
                    >
                      {reassignError}
                    </div>
                  )}

                  {activeAppts.length > 0 ? (
                    <>
                      <div
                        style={{
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          borderRadius: '6px',
                          padding: '0.75rem',
                          fontSize: '0.85rem',
                          color: '#92400e',
                          marginBottom: '1rem'
                        }}
                      >
                        <strong>Active Appointments Detected:</strong> {offboardingBarber.barberName} has{' '}
                        <strong>{activeAppts.length}</strong> upcoming appointment(s). Reassign each booking
                        to an available colleague or cancel it before removing the barber.
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        {activeAppts.map(appt => {
                          const candidates = candidateBarbersMap[appt.bookingReference] || [];
                          const isLoadingCandidates = candidateLoadingMap[appt.bookingReference];
                          const selectedBarberId = reassignTargetBarbers[appt.bookingReference] || (candidates.length > 0 ? String(candidates[0].barberId) : (otherBarbers.length > 0 ? String(otherBarbers[0].barberId) : ''));
                          const isBusy = reassignBusy === appt.bookingReference;

                          return (
                            <div
                              key={appt.bookingReference}
                              style={{
                                background: '#f9fafb',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '0.85rem',
                                fontSize: '0.85rem'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                <strong style={{ color: '#111827' }}>
                                  👤 Client: {appt.customerName || 'Customer'}
                                </strong>
                                <span
                                  style={{
                                    fontSize: '0.75rem',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '4px',
                                    background: appt.status === 'IN_PROGRESS' ? '#e0f2fe' : '#dcfce7',
                                    color: appt.status === 'IN_PROGRESS' ? '#0369a1' : '#166534',
                                    fontWeight: 700
                                  }}
                                >
                                  {appt.status}
                                </span>
                              </div>

                              <div style={{ color: '#4b5563', marginBottom: '0.5rem' }}>
                                📅 {appt.date} · 🕒 {appt.startTime.slice(0, 5)} - {appt.endTime.slice(0, 5)} · 💇 {appt.serviceName}{appt.addonSummary ? ` + ${appt.addonSummary}` : ''} · ₹{appt.totalPrice}
                              </div>

                              {isLoadingCandidates ? (
                                <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0.25rem 0' }}>
                                  Checking vacant staff for this slot...
                                </p>
                              ) : candidates.length > 0 ? (
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
                                    Transfer to vacant colleague:
                                    <select
                                      aria-label={`Target barber for ${appt.bookingReference}`}
                                      value={selectedBarberId}
                                      onChange={e => {
                                        const val = e.target.value;
                                        setReassignTargetBarbers(prev => ({ ...prev, [appt.bookingReference]: val }));
                                      }}
                                      style={{
                                        marginLeft: '0.4rem',
                                        padding: '0.35rem 0.5rem',
                                        borderRadius: '4px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '0.8rem'
                                      }}
                                      disabled={isBusy}
                                    >
                                      {candidates.map(c => (
                                        <option key={c.barberId} value={c.barberId}>
                                          ✓ {c.barberName} (Vacant & Qualified)
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <button
                                    type="button"
                                    disabled={!selectedBarberId || isBusy}
                                    onClick={() => void handleReassignAppointment(appt.bookingReference, Number(selectedBarberId))}
                                    style={{
                                      background: '#224c3e',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '4px',
                                      padding: '0.35rem 0.75rem',
                                      fontSize: '0.8rem',
                                      cursor: 'pointer',
                                      fontWeight: 600
                                    }}
                                  >
                                    {isBusy ? 'Transferring...' : '🔄 Transfer Booking'}
                                  </button>

                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void handleCancelAppointmentInWizard(appt.bookingReference)}
                                    style={{
                                      background: '#fff',
                                      color: '#dc2626',
                                      border: '1px solid #fca5a5',
                                      borderRadius: '4px',
                                      padding: '0.35rem 0.65rem',
                                      fontSize: '0.8rem',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Cancel Booking
                                  </button>
                                </div>
                              ) : (
                                <div
                                  style={{
                                    background: '#fff7ed',
                                    border: '1px solid #fed7aa',
                                    borderRadius: '6px',
                                    padding: '0.6rem 0.8rem',
                                    marginTop: '0.5rem',
                                    fontSize: '0.82rem',
                                    color: '#9a3412'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
                                    <span>⚠️</span>
                                    <strong>No Vacant Barber During This Slot:</strong>
                                  </div>
                                  <p style={{ margin: '0 0 0.5rem 0', color: '#7c2d12', lineHeight: 1.4 }}>
                                    No colleague in your salon is both qualified and has vacant time (no overlapping bookings and on duty) during {appt.date} ({appt.startTime.slice(0, 5)} - {appt.endTime.slice(0, 5)}). Bookings can only be transferred to a colleague with vacant time in this slot.
                                  </p>
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => void handleCancelAppointmentInWizard(appt.bookingReference)}
                                      style={{
                                        background: '#dc2626',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '0.35rem 0.75rem',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                      }}
                                    >
                                      Cancel Booking
                                    </button>
                                    <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                                      (Or adjust a colleague's schedule so they have vacant time in this slot)
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '8px',
                        padding: '1.25rem',
                        textAlign: 'center',
                        marginBottom: '1.25rem'
                      }}
                    >
                      <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.35rem' }}>✓</span>
                      <strong style={{ color: '#166534', fontSize: '1rem', display: 'block' }}>
                        All Active Bookings Cleared
                      </strong>
                      <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: '#4b5563' }}>
                        {offboardingBarber.barberName} has no remaining active appointments. It is now safe to
                        remove this barber from the salon.
                      </p>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                    {activeAppts.length === 0 ? (
                      <button
                        type="button"
                        className={styles.submit}
                        style={{
                          background: '#dc2626',
                          borderColor: '#b91c1c',
                          color: '#fff',
                          width: '100%'
                        }}
                        disabled={qualificationBusy === offboardingBarber.barberId}
                        onClick={() => void handleRemoveBarber(offboardingBarber.barberId)}
                      >
                        {qualificationBusy === offboardingBarber.barberId ? 'Removing...' : `Confirm & Remove ${offboardingBarber.barberName}`}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        style={{ width: '100%' }}
                        onClick={() => {
                          setOffboardingBarber(null);
                          setReassignError('');
                        }}
                      >
                        Keep Staff & Return
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </section>}
      {account?.roles.includes('SALON_OWNER') && salon && <section className={styles.authSection} aria-labelledby="services-heading">
        <div><p className={styles.eyebrow}>FEATURE 04 / 12</p><h2 id="services-heading">Service catalogue</h2><p>Create the bookable services offered by {salon.name}. Each service records its price and estimated duration.</p></div>
        <div className={styles.authForm}><form onSubmit={async (event) => { event.preventDefault(); setServiceBusy(true); setServiceError(''); const formElement = event.currentTarget; const form = new FormData(formElement); try { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch('/api/salons/mine/services', { method: 'POST', headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify({ name: String(form.get('name')), description: String(form.get('description') ?? ''), price: Number(form.get('price')), durationMinutes: Number(form.get('durationMinutes')) }) }); if (!response.ok) throw new Error(response.status === 409 ? 'A service with this name already exists.' : 'Unable to create the service.'); setServices([...services, await response.json() as SalonService]); formElement.reset() } catch (error) { setServiceError(error instanceof Error ? error.message : 'Unable to create the service.') } finally { setServiceBusy(false) } }}><label>Service name<input name="name" required maxLength={160} /></label><label>Description<input name="description" maxLength={1000} /></label><label>Price<input name="price" type="number" min="0" step="0.01" required /></label><label>Duration (minutes)<input name="durationMinutes" type="number" min="5" max="480" required /></label>{serviceError && <p className={styles.error} role="alert">{serviceError}</p>}<button className={styles.submit} disabled={serviceBusy}>{serviceBusy ? 'Adding...' : 'Add service'}</button></form>{services.length > 0 && <div className={styles.accountCard}><p className={styles.status}>Your services</p>{services.map(item => <p key={item.id}><strong>{item.name}</strong> - ₹{item.price} - {item.durationMinutes} minutes {item.active ? '' : '(inactive)'} <button type="button" onClick={async () => { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch(`/api/salons/mine/services/${item.id}`, { method: 'DELETE', headers: { [csrf.headerName]: csrf.token } }); if (response.ok) setServices(services.map(service => service.id === item.id ? { ...service, active: false } : service)) }}>Deactivate</button></p>)}</div>}</div>
      </section>}
      {account?.roles.includes('SALON_OWNER') && salon && <section className={styles.authSection} aria-labelledby="addons-heading">
        <div><p className={styles.eyebrow}>FEATURE 05 / 12</p><h2 id="addons-heading">Add-on selection</h2><p>Offer compatible extras such as a beard trim or hair wash. Each add-on adds its own price and duration.</p></div>
        <div className={styles.authForm}><form onSubmit={async (event) => { event.preventDefault(); setAddonBusy(true); setAddonError(''); const formElement = event.currentTarget; const form = new FormData(formElement); try { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch('/api/salons/mine/addons', { method: 'POST', headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify({ name: String(form.get('name')), description: String(form.get('description') ?? ''), price: Number(form.get('price')), durationMinutes: Number(form.get('durationMinutes')), serviceId: Number(form.get('serviceId')) }) }); if (!response.ok) throw new Error(response.status === 409 ? 'An add-on with this name already exists.' : 'Unable to create the add-on.'); setAddons([...addons, await response.json() as AddOn]); formElement.reset() } catch (error) { setAddonError(error instanceof Error ? error.message : 'Unable to create the add-on.') } finally { setAddonBusy(false) } }}><label>Add-on name<input name="name" required maxLength={160} /></label><label>Compatible service<select name="serviceId" required defaultValue=""><option value="" disabled>Select a service</option>{services.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Description<input name="description" maxLength={1000} /></label><label>Extra price<input name="price" type="number" min="0" step="0.01" required /></label><label>Extra duration (minutes)<input name="durationMinutes" type="number" min="1" max="240" required /></label>{services.filter(item => item.active).length === 0 && <p>Add an active service first.</p>}{addonError && <p className={styles.error} role="alert">{addonError}</p>}<button className={styles.submit} disabled={addonBusy || services.filter(item => item.active).length === 0}>{addonBusy ? 'Adding...' : 'Add add-on'}</button></form>{addons.length > 0 && <div className={styles.accountCard}><p className={styles.status}>Your add-ons</p>{addons.map(item => <p key={item.id}><strong>{item.name}</strong> - ₹{item.price} - +{item.durationMinutes} minutes {item.active ? '' : '(inactive)'} <button type="button" onClick={async () => { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch(`/api/salons/mine/addons/${item.id}`, { method: 'DELETE', headers: { [csrf.headerName]: csrf.token } }); if (response.ok) setAddons(addons.map(addon => addon.id === item.id ? { ...addon, active: false } : addon)) }}>Deactivate</button></p>)}</div>}</div>
      </section>}
      {account?.roles.includes('SALON_OWNER') && salon && <section className={styles.authSection} aria-labelledby="owner-appointments-heading">
        <div><p className={styles.eyebrow}>FEATURE 10 / 12</p><h2 id="owner-appointments-heading">Salon appointment dashboard</h2><p>Overview of all appointments across your salon. Filter by date, manage bookings, and inspect financial transactions.</p></div>
        <div className={styles.authForm}>
          {(() => {
            const newBookings = ownerAppointments.filter(
              item => (item.status === 'CONFIRMED' || item.status === 'IN_PROGRESS') &&
              !acknowledgedBookingIds.has(item.bookingReference)
            );

            return (
              <>
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setOwnerViewMode('APPOINTMENTS')}
                    style={{
                      flex: 1,
                      padding: '0.65rem 1rem',
                      borderRadius: '8px',
                      border: ownerViewMode === 'APPOINTMENTS' ? '2px solid #224c3e' : '1px solid #cbd4c7',
                      background: ownerViewMode === 'APPOINTMENTS' ? '#e9ede3' : '#fff',
                      color: '#224c3e',
                      fontWeight: ownerViewMode === 'APPOINTMENTS' ? 700 : 500,
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    📅 Operational Appointments {newBookings.length > 0 && <span style={{ background: '#ca8a04', color: '#fff', padding: '0.1rem 0.45rem', borderRadius: '10px', fontSize: '0.75rem', marginLeft: '0.35rem', fontWeight: 700 }}>{newBookings.length} new</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOwnerViewMode('TRANSACTIONS')}
                    style={{
                      flex: 1,
                      padding: '0.65rem 1rem',
                      borderRadius: '8px',
                      border: ownerViewMode === 'TRANSACTIONS' ? '2px solid #224c3e' : '1px solid #cbd4c7',
                      background: ownerViewMode === 'TRANSACTIONS' ? '#e9ede3' : '#fff',
                      color: '#224c3e',
                      fontWeight: ownerViewMode === 'TRANSACTIONS' ? 700 : 500,
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    💳 Transaction & Sales Ledger
                  </button>
                </div>

                {/* 🔔 RECENT BOOKING ALERTS & ACTIVITY FEED FOR SALON OWNER */}
                <div style={{ marginBottom: '1.25rem' }}>
                  {newBookings.length > 0 && (
                    <div
                      data-testid="new-booking-alert-banner"
                      style={{
                        background: '#fefce8',
                        border: '2px solid #ca8a04',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '0.75rem',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.4rem' }}>🔔</span>
                          <div>
                            <strong style={{ fontSize: '1.05rem', color: '#854d0e', display: 'block' }}>
                              New Booking Alert ({newBookings.length} new reservation{newBookings.length > 1 ? 's' : ''})
                            </strong>
                            <span style={{ fontSize: '0.8rem', color: '#713f12' }}>
                              Customer reservations recently placed with your salon staff
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const newSet = new Set([...acknowledgedBookingIds, ...newBookings.map(b => b.bookingReference)]);
                              setAcknowledgedBookingIds(newSet);
                              try { localStorage.setItem('trimtime_ack_bookings', JSON.stringify(Array.from(newSet))); } catch {}
                            }}
                            style={{
                              background: '#854d0e',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            ✓ Mark all as read
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {newBookings.map(nb => (
                          <div
                            key={nb.bookingReference}
                            style={{
                              background: '#fff',
                              border: '1px solid #fde047',
                              borderRadius: '6px',
                              padding: '0.75rem 1rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '0.75rem'
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span style={{ background: '#fef08a', color: '#854d0e', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                                  NEW
                                </span>
                                <span style={{ fontSize: '0.95rem' }}>
                                  Reserved by: <strong>Client {nb.customerName || 'Customer'}</strong>
                                </span>
                                <span style={{ color: '#6b7280' }}>booked with</span>
                                <span style={{ fontSize: '0.95rem', color: '#166534', fontWeight: 700 }}>
                                  Staff: {nb.barberName}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '0.3rem' }}>
                                📅 {nb.date} · 🕒 {nb.startTime.slice(0, 5)} - {nb.endTime.slice(0, 5)} · 💇 {nb.serviceName}{nb.addonSummary ? ` (+ ${nb.addonSummary})` : ''} · <strong>₹{nb.totalPrice}</strong>
                                {paymentNotes[nb.bookingReference] && (
                                  <span style={{ marginLeft: '0.5rem', background: '#e9ede3', color: '#1b4332', padding: '0.1rem 0.4rem', borderRadius: '3px', fontSize: '0.75rem', fontWeight: 600 }}>
                                    💳 {paymentNotes[nb.bookingReference]}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setOwnerViewMode('APPOINTMENTS');
                                  setOwnerBarberFilter(nb.barberName);
                                }}
                                style={{
                                  background: '#e9ede3',
                                  color: '#1b4332',
                                  border: '1px solid #224c3e',
                                  borderRadius: '4px',
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  fontWeight: 600
                                }}
                              >
                                🎯 Focus {nb.barberName}'s Chair
                              </button>
                              <button
                                type="button"
                                onClick={() => setInspectedReceipt(nb)}
                                style={{
                                  background: '#f3f4f6',
                                  color: '#1f2937',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '4px',
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  fontWeight: 600
                                }}
                              >
                                Receipt
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const newSet = new Set([...acknowledgedBookingIds, nb.bookingReference]);
                                  setAcknowledgedBookingIds(newSet);
                                  try { localStorage.setItem('trimtime_ack_bookings', JSON.stringify(Array.from(newSet))); } catch {}
                                }}
                                style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '1.1rem', cursor: 'pointer', padding: '0 0.35rem' }}
                                aria-label={`Dismiss alert for ${nb.customerName || 'booking'}`}
                                title="Dismiss alert"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8faf6', border: '1px solid #e1e4db', borderRadius: '6px', padding: '0.5rem 0.85rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#4b5563' }}>
                      {newBookings.length > 0 ? (
                        <span style={{ color: '#b45309', fontWeight: 600 }}>🔔 {newBookings.length} unread new reservation alert{newBookings.length > 1 ? 's' : ''}</span>
                      ) : (
                        <span style={{ color: '#166534', fontWeight: 500 }}>✓ All salon bookings acknowledged ({ownerAppointments.length} total)</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowRecentBookingsFeed(prev => !prev)}
                      style={{ background: 'none', border: 'none', color: '#224c3e', fontWeight: 600, cursor: 'pointer', padding: '0.2rem 0.4rem', fontSize: '0.85rem' }}
                    >
                      {showRecentBookingsFeed ? 'Hide Recent Activity Feed ▴' : '📋 Recent Activity Feed ▾'}
                    </button>
                  </div>

                  {showRecentBookingsFeed && (
                    <div style={{ background: '#fff', border: '1px solid #cbd4c7', borderTop: 'none', borderRadius: '0 0 6px 6px', padding: '0.75rem', maxHeight: '260px', overflowY: 'auto' }}>
                      <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, fontSize: '0.85rem', color: '#1b4332' }}>
                        📋 Recent Salon Booking Activity ({ownerAppointments.length} total)
                      </p>
                      {ownerAppointments.length === 0 ? (
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic' }}>No appointments booked yet.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {ownerAppointments.slice(0, 10).map(item => (
                            <div key={item.bookingReference} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.35rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                              <div>
                                {!acknowledgedBookingIds.has(item.bookingReference) && (item.status === 'CONFIRMED' || item.status === 'IN_PROGRESS') && (
                                  <span style={{ background: '#fef08a', color: '#854d0e', padding: '0.1rem 0.35rem', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 700, marginRight: '0.4rem' }}>
                                    NEW
                                  </span>
                                )}
                                <strong>Client: {item.customerName || 'Customer'}</strong> → <span style={{ color: '#166534', fontWeight: 600 }}>Staff: {item.barberName}</span> ({item.serviceName})
                                <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>{item.date} · {item.startTime.slice(0, 5)} - {item.endTime.slice(0, 5)} · ₹{item.totalPrice}</div>
                              </div>
                              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.75rem', color: item.status === 'COMPLETED' ? '#166534' : item.status === 'IN_PROGRESS' ? '#0284c7' : item.status === 'CONFIRMED' ? '#1b4332' : '#991b1b' }}>{item.status}</span>
                                <button
                                  type="button"
                                  onClick={() => setInspectedReceipt(item)}
                                  style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '3px', padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}
                                >
                                  Receipt
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          <form onSubmit={(event) => { event.preventDefault(); void loadOwnerAppointments() }} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <label style={{ margin: 0 }}>Filter by date<input type="date" value={ownerAppointmentDate} onChange={(event) => setOwnerAppointmentDate(event.currentTarget.value)} /></label>
            <button className={styles.submit} disabled={ownerAppointmentsBusy}>{ownerAppointmentsBusy ? 'Loading...' : 'Filter appointments'}</button>
            <button type="button" className={styles.secondaryButton} disabled={ownerAppointmentsBusy} onClick={() => void loadOwnerAppointments(ownerAppointmentDate)}>🔄 Refresh schedule</button>
            {ownerAppointmentDate && <button type="button" className={styles.secondaryButton} onClick={() => { setOwnerAppointmentDate(''); void loadOwnerAppointments('') }}>Clear date filter</button>}
          </form>
          {ownerAppointmentsError && <p className={styles.error} role="alert">{ownerAppointmentsError}</p>}

          {ownerViewMode === 'APPOINTMENTS' ? (
            <div className={styles.accountCard}>
              <p className={styles.status}>Salon appointments</p>
              {(() => {
                const barberOptions = Array.from(new Set([
                  ...ownerBarbers.map(b => b.barberName),
                  ...ownerAppointments.map(a => a.barberName)
                ])).filter(Boolean);

                const baseOwnerAppts = ownerBarberFilter === 'ALL'
                  ? ownerAppointments
                  : ownerAppointments.filter(item => item.barberName === ownerBarberFilter);

                const activeOwnerAppts = baseOwnerAppts.filter(item => item.status === 'CONFIRMED' || item.status === 'IN_PROGRESS');
                const historyOwnerAppts = baseOwnerAppts.filter(item => item.status === 'COMPLETED' || item.status === 'NO_SHOW' || item.status === 'CANCELLED');
                const completedOwnerAppts = historyOwnerAppts.filter(item => item.status === 'COMPLETED');
                const totalOwnerRevenue = completedOwnerAppts.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
                const displayedAppts = ownerTab === 'ACTIVE' ? activeOwnerAppts : historyOwnerAppts;

                return (
                  <>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      <label style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        Filter by Barber:
                        <select
                          aria-label="Filter appointments by barber"
                          value={ownerBarberFilter}
                          onChange={(e) => setOwnerBarberFilter(e.target.value)}
                          style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd4c7', fontSize: '0.9rem' }}
                        >
                          <option value="ALL">All Barbers ({ownerAppointments.length})</option>
                          {barberOptions.map(name => {
                            const count = ownerAppointments.filter(a => a.barberName === name).length;
                            return <option key={name} value={name}>{name} ({count})</option>;
                          })}
                        </select>
                      </label>
                      {ownerBarberFilter !== 'ALL' && (
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => setOwnerBarberFilter('ALL')}
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                        >
                          Clear barber filter
                        </button>
                      )}
                    </div>

                    {ownerBarberFilter !== 'ALL' && (
                      <div style={{ background: '#e9ede3', border: '1px solid #c2cdc0', borderRadius: '6px', padding: '0.6rem 0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#1b4332' }}>
                          Filtering chair schedule for: <strong>{ownerBarberFilter}</strong> ({baseOwnerAppts.length} appointments)
                        </span>
                        {ownerBarbers.find(b => b.barberName === ownerBarberFilter) && (
                          <button
                            type="button"
                            onClick={() => {
                              const found = ownerBarbers.find(b => b.barberName === ownerBarberFilter);
                              if (found) setInspectedBarberClients(found);
                            }}
                            style={{ background: '#224c3e', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.35rem 0.7rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                          >
                            👥 View {ownerBarberFilter}'s Client Book
                          </button>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                      <button
                        type="button"
                        onClick={() => setOwnerTab('ACTIVE')}
                        style={{
                          flex: 1,
                          padding: '0.6rem 0.8rem',
                          borderRadius: '6px',
                          border: ownerTab === 'ACTIVE' ? '2px solid #224c3e' : '1px solid #cbd4c7',
                          background: ownerTab === 'ACTIVE' ? '#e9ede3' : '#fff',
                          color: '#224c3e',
                          fontWeight: ownerTab === 'ACTIVE' ? 700 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        🕒 Active Schedule ({activeOwnerAppts.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setOwnerTab('HISTORY')}
                        style={{
                          flex: 1,
                          padding: '0.6rem 0.8rem',
                          borderRadius: '6px',
                          border: ownerTab === 'HISTORY' ? '2px solid #224c3e' : '1px solid #cbd4c7',
                          background: ownerTab === 'HISTORY' ? '#e9ede3' : '#fff',
                          color: '#224c3e',
                          fontWeight: ownerTab === 'HISTORY' ? 700 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        ✅ Completed & History ({historyOwnerAppts.length})
                      </button>
                    </div>
                    {ownerTab === 'HISTORY' && (
                      <div style={{ background: '#f5f7f2', border: '1px solid #dcded5', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: '#666', display: 'block' }}>Completed Services</span>
                          <strong style={{ fontSize: '1.2rem', color: '#1b4332' }}>{completedOwnerAppts.length}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: '#666', display: 'block' }}>Completed Revenue</span>
                          <strong style={{ fontSize: '1.2rem', color: '#1b4332' }}>₹{totalOwnerRevenue}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: '#666', display: 'block' }}>No-shows / Cancelled</span>
                          <strong style={{ fontSize: '1.2rem', color: '#888' }}>{historyOwnerAppts.length - completedOwnerAppts.length}</strong>
                        </div>
                      </div>
                    )}
                    {displayedAppts.length === 0 ? (
                      <p>{ownerTab === 'ACTIVE' ? 'No active appointments scheduled.' : 'No past or completed appointments.'}</p>
                    ) : (
                      displayedAppts.map(item => (
                        <p key={item.bookingReference}>
                          {!acknowledgedBookingIds.has(item.bookingReference) && (item.status === 'CONFIRMED' || item.status === 'IN_PROGRESS') && (
                            <span style={{ background: '#fef08a', color: '#854d0e', padding: '0.12rem 0.4rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, marginRight: '0.4rem' }}>
                              ✨ NEW
                            </span>
                          )}
                          <strong>{item.date} · {item.startTime.slice(0, 5)}-{item.endTime.slice(0, 5)}{item.timezone && ` ${item.timezone}`}</strong> · Customer: <strong>{item.customerName || 'Customer'}</strong> · Barber: <strong>{item.barberName}</strong> · {item.serviceName} · ₹{item.totalPrice} · <span style={{ fontWeight: 600, color: item.status === 'COMPLETED' ? '#166534' : item.status === 'IN_PROGRESS' ? '#0284c7' : item.status === 'CONFIRMED' ? '#1b4332' : '#991b1b' }}>{item.status}</span>
                          {item.status === 'CONFIRMED' && <>
                            {' '}<button type="button" disabled={ownerAppointmentsBusy} onClick={() => void updateOwnerAppointmentStatus(item.bookingReference, 'IN_PROGRESS')}>Start service</button>
                            {' '}<button type="button" disabled={ownerAppointmentsBusy} onClick={() => void updateOwnerAppointmentStatus(item.bookingReference, 'COMPLETED')}>Complete</button>
                            {' '}<button type="button" disabled={ownerAppointmentsBusy} onClick={() => void updateOwnerAppointmentStatus(item.bookingReference, 'NO_SHOW')}>Mark no-show</button>
                            {' '}<button type="button" disabled={ownerAppointmentsBusy} onClick={async () => {
                              setOwnerAppointmentsBusy(true);
                              setOwnerAppointmentsError('');
                              try {
                                const csrfResponse = await fetch('/api/auth/csrf');
                                const csrf = await csrfResponse.json() as { token: string; headerName: string };
                                const response = await fetch(`/api/salons/mine/appointments/${item.bookingReference}/cancel`, {
                                  method: 'POST',
                                  headers: { [csrf.headerName]: csrf.token }
                                });
                                if (!response.ok) throw await editError(response, 'Unable to cancel this appointment.');
                                const updated = await response.json() as Appointment;
                                setOwnerAppointments(current => current.map(appt => appt.bookingReference === updated.bookingReference ? updated : appt));
                              } catch (error) {
                                setOwnerAppointmentsError(error instanceof Error ? error.message : 'Unable to cancel this appointment.');
                              } finally {
                                setOwnerAppointmentsBusy(false);
                              }
                            }}>Cancel appointment</button>
                          </>}
                          {item.status === 'IN_PROGRESS' && <>
                            {' '}<button type="button" disabled={ownerAppointmentsBusy} onClick={() => void updateOwnerAppointmentStatus(item.bookingReference, 'COMPLETED')}>Complete</button>
                          </>}
                          {item.addonSummary && ` · Add-ons: ${item.addonSummary}`}
                          {item.items && item.items.length > 0 && <><br />Items: {item.items.map(line => `${line.name} (${line.durationMinutes} min, ₹${line.price})`).join(' · ')}</>}
                          {paymentNotes[item.bookingReference] && <><br /><span style={{ display: 'inline-block', fontSize: '0.8rem', background: '#e9ede3', color: '#1b4332', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600, marginTop: '0.3rem' }}>💳 {paymentNotes[item.bookingReference]}</span></>}
                        </p>
                      ))
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            <div className={styles.accountCard}>
              <p className={styles.status}>Financial Transaction & Sales Ledger</p>
              {(() => {
                const barberOptions = Array.from(new Set([
                  ...ownerBarbers.map(b => b.barberName),
                  ...ownerAppointments.map(a => a.barberName)
                ])).filter(Boolean);

                const completedAppts = ownerAppointments.filter(a => a.status === 'COMPLETED');
                const inProgressAppts = ownerAppointments.filter(a => a.status === 'IN_PROGRESS');
                const confirmedAppts = ownerAppointments.filter(a => a.status === 'CONFIRMED');
                const cancelledAppts = ownerAppointments.filter(a => a.status === 'CANCELLED' || a.status === 'NO_SHOW');

                const settledRevenue = completedAppts.reduce((sum, a) => sum + (a.totalPrice || 0), 0);
                const inFlightRevenue = inProgressAppts.reduce((sum, a) => sum + (a.totalPrice || 0), 0);
                const projectedRevenue = confirmedAppts.reduce((sum, a) => sum + (a.totalPrice || 0), 0);

                const onlineAppts = ownerAppointments.filter(a => {
                  const note = paymentNotes[a.bookingReference] || '';
                  return note.includes('Paid online');
                });
                const counterAppts = ownerAppointments.filter(a => {
                  const note = paymentNotes[a.bookingReference] || '';
                  return !note.includes('Paid online');
                });
                const onlineRevenue = onlineAppts.filter(a => a.status === 'COMPLETED').reduce((sum, a) => sum + (a.totalPrice || 0), 0);
                const counterRevenue = counterAppts.filter(a => a.status === 'COMPLETED').reduce((sum, a) => sum + (a.totalPrice || 0), 0);

                const filteredTxns = ownerAppointments.filter(item => {
                  if (txnStatusFilter !== 'ALL') {
                    if (txnStatusFilter === 'CANCELLED') {
                      if (item.status !== 'CANCELLED' && item.status !== 'NO_SHOW') return false;
                    } else if (item.status !== txnStatusFilter) {
                      return false;
                    }
                  }
                  if (txnBarberFilter !== 'ALL' && item.barberName !== txnBarberFilter) {
                    return false;
                  }
                  const note = paymentNotes[item.bookingReference] || '';
                  const isOnline = note.includes('Paid online');
                  if (txnPaymentFilter === 'ONLINE' && !isOnline) return false;
                  if (txnPaymentFilter === 'SALON' && isOnline) return false;
                  return true;
                });

                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.85rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Settled Revenue</span>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#14532d', marginTop: '0.2rem' }}>₹{settledRevenue}</div>
                        <span style={{ fontSize: '0.75rem', color: '#166534' }}>{completedAppts.length} completed</span>
                      </div>
                      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '0.85rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>In-Service (Active)</span>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0c4a6e', marginTop: '0.2rem' }}>₹{inFlightRevenue}</div>
                        <span style={{ fontSize: '0.75rem', color: '#0369a1' }}>{inProgressAppts.length} in-progress</span>
                      </div>
                      <div style={{ background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: '8px', padding: '0.85rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#57534e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Projected</span>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#292524', marginTop: '0.2rem' }}>₹{projectedRevenue}</div>
                        <span style={{ fontSize: '0.75rem', color: '#57534e' }}>{confirmedAppts.length} confirmed</span>
                      </div>
                      <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: '8px', padding: '0.85rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#854d0e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Split</span>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#713f12', marginTop: '0.2rem' }}>₹{onlineRevenue} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>online</span></div>
                        <div style={{ fontSize: '0.85rem', color: '#854d0e' }}>₹{counterRevenue} counter</div>
                      </div>
                    </div>

                    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                      <label style={{ margin: 0, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        Status:
                        <select
                          aria-label="Filter ledger by status"
                          value={txnStatusFilter}
                          onChange={(e) => setTxnStatusFilter(e.target.value)}
                          style={{ padding: '0.35rem 0.6rem', borderRadius: '4px', border: '1px solid #cbd4c7' }}
                        >
                          <option value="ALL">All Statuses ({ownerAppointments.length})</option>
                          <option value="COMPLETED">Completed ({completedAppts.length})</option>
                          <option value="IN_PROGRESS">In Progress ({inProgressAppts.length})</option>
                          <option value="CONFIRMED">Confirmed ({confirmedAppts.length})</option>
                          <option value="CANCELLED">Cancelled / No-show ({cancelledAppts.length})</option>
                        </select>
                      </label>

                      {barberOptions.length > 0 && (
                        <label style={{ margin: 0, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          Barber:
                          <select
                            aria-label="Filter ledger by barber"
                            value={txnBarberFilter}
                            onChange={(e) => setTxnBarberFilter(e.target.value)}
                            style={{ padding: '0.35rem 0.6rem', borderRadius: '4px', border: '1px solid #cbd4c7' }}
                          >
                            <option value="ALL">All Staff / Barbers</option>
                            {barberOptions.map(name => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        </label>
                      )}

                      <label style={{ margin: 0, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        Payment:
                        <select
                          aria-label="Filter ledger by payment method"
                          value={txnPaymentFilter}
                          onChange={(e) => setTxnPaymentFilter(e.target.value)}
                          style={{ padding: '0.35rem 0.6rem', borderRadius: '4px', border: '1px solid #cbd4c7' }}
                        >
                          <option value="ALL">All Payment Methods</option>
                          <option value="ONLINE">Paid Online (Test Mode)</option>
                          <option value="SALON">Pay at Salon (Counter)</option>
                        </select>
                      </label>

                      {(txnStatusFilter !== 'ALL' || txnBarberFilter !== 'ALL' || txnPaymentFilter !== 'ALL') && (
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', margin: 0 }}
                          onClick={() => {
                            setTxnStatusFilter('ALL');
                            setTxnBarberFilter('ALL');
                            setTxnPaymentFilter('ALL');
                          }}
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>

                    <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>
                            <th style={{ padding: '0.65rem 0.75rem' }}>Ref ID</th>
                            <th style={{ padding: '0.65rem 0.75rem' }}>Date & Time</th>
                            <th style={{ padding: '0.65rem 0.75rem' }}>Customer</th>
                            <th style={{ padding: '0.65rem 0.75rem' }}>Barber</th>
                            <th style={{ padding: '0.65rem 0.75rem' }}>Service & Items</th>
                            <th style={{ padding: '0.65rem 0.75rem' }}>Payment</th>
                            <th style={{ padding: '0.65rem 0.75rem' }}>Status</th>
                            <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Amount</th>
                            <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTxns.length === 0 ? (
                            <tr>
                              <td colSpan={9} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
                                No transaction records match the current filters.
                              </td>
                            </tr>
                          ) : (
                            filteredTxns.map((item, idx) => {
                              const note = paymentNotes[item.bookingReference] || '';
                              const isOnline = note.includes('Paid online');
                              const statusBg =
                                item.status === 'COMPLETED' ? '#dcfce7' :
                                item.status === 'IN_PROGRESS' ? '#e0f2fe' :
                                item.status === 'CONFIRMED' ? '#f3f4f6' : '#fee2e2';
                              const statusColor =
                                item.status === 'COMPLETED' ? '#166534' :
                                item.status === 'IN_PROGRESS' ? '#0369a1' :
                                item.status === 'CONFIRMED' ? '#374151' : '#991b1b';

                              return (
                                <tr key={item.bookingReference} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace', fontWeight: 600, color: '#1b4332' }}>
                                    #{item.bookingReference.slice(0, 10)}
                                  </td>
                                  <td style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap' }}>
                                    {item.date} · {item.startTime.slice(0, 5)}
                                  </td>
                                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>
                                    {!acknowledgedBookingIds.has(item.bookingReference) && (item.status === 'CONFIRMED' || item.status === 'IN_PROGRESS') && (
                                      <span style={{ background: '#fef08a', color: '#854d0e', padding: '0.1rem 0.35rem', borderRadius: '3px', fontSize: '0.68rem', fontWeight: 700, marginRight: '0.35rem' }}>
                                        NEW
                                      </span>
                                    )}
                                    {item.customerName || 'Customer'}
                                  </td>
                                  <td style={{ padding: '0.65rem 0.75rem' }}>
                                    {item.barberName}
                                  </td>
                                  <td style={{ padding: '0.65rem 0.75rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.serviceName}{item.addonSummary ? ` + ${item.addonSummary}` : ''}
                                  </td>
                                  <td style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap' }}>
                                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.45rem', borderRadius: '4px', background: isOnline ? '#e0f2fe' : '#fef3c7', color: isOnline ? '#0369a1' : '#92400e', fontWeight: 600 }}>
                                      {isOnline ? '💳 Online (Test)' : '💵 Pay at Salon'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.65rem 0.75rem' }}>
                                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: statusBg, color: statusColor, fontWeight: 700 }}>
                                      {item.status}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700, color: item.status === 'CANCELLED' ? '#9ca3af' : '#1b4332' }}>
                                    {item.status === 'CANCELLED' ? <del>₹{item.totalPrice}</del> : `₹${item.totalPrice}`}
                                  </td>
                                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px', border: '1px solid #cbd4c7', background: '#fff' }}
                                      onClick={() => setInspectedReceipt(item)}
                                    >
                                      Receipt
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* DIGITAL RECEIPT MODAL */}
          {inspectedReceipt && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
              <div style={{ background: '#fff', borderRadius: '12px', maxWidth: '440px', width: '100%', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1b4332' }}>Digital Sales Receipt</h3>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#6b7280' }}>{salon?.name || 'Trim-Time Salon'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectedReceipt(null)}
                    style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#9ca3af' }}
                    aria-label="Close receipt"
                  >
                    ✕
                  </button>
                </div>

                <div style={{ fontSize: '0.85rem', color: '#374151', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>Booking Reference:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{inspectedReceipt.bookingReference}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>Date & Slot:</span>
                    <span>{inspectedReceipt.date} · {inspectedReceipt.startTime.slice(0, 5)} - {inspectedReceipt.endTime.slice(0, 5)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>Customer:</span>
                    <span style={{ fontWeight: 600 }}>{inspectedReceipt.customerName || 'Customer'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>Staff (Barber):</span>
                    <span style={{ fontWeight: 600 }}>{inspectedReceipt.barberName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>Service Status:</span>
                    <span style={{ fontWeight: 700, color: inspectedReceipt.status === 'COMPLETED' ? '#166534' : inspectedReceipt.status === 'IN_PROGRESS' ? '#0369a1' : '#374151' }}>{inspectedReceipt.status}</span>
                  </div>
                </div>

                <div style={{ borderTop: '1px dashed #d1d5db', borderBottom: '1px dashed #d1d5db', padding: '0.75rem 0', margin: '0.75rem 0' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, fontSize: '0.85rem' }}>Line Items</p>
                  {inspectedReceipt.items && inspectedReceipt.items.length > 0 ? (
                    inspectedReceipt.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', margin: '0.25rem 0' }}>
                        <span>{item.name} ({item.durationMinutes}m)</span>
                        <span>₹{item.price}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span>{inspectedReceipt.serviceName}</span>
                      <span>₹{inspectedReceipt.totalPrice}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.75rem 0' }}>
                  <strong style={{ fontSize: '1rem' }}>Total Amount:</strong>
                  <strong style={{ fontSize: '1.25rem', color: '#1b4332' }}>₹{inspectedReceipt.totalPrice}</strong>
                </div>

                <div style={{ background: '#f9fafb', borderRadius: '6px', padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: '#4b5563', marginBottom: '1.25rem' }}>
                  <strong>Payment Note:</strong>
                  <div>{paymentNotes[inspectedReceipt.bookingReference] || 'Pay at salon (Cash / UPI on arrival)'}</div>
                </div>

                <button
                  type="button"
                  className={styles.submit}
                  style={{ width: '100%' }}
                  onClick={() => setInspectedReceipt(null)}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </section>}
      {account?.roles.includes('BARBER') && <section className={styles.authSection} aria-labelledby="availability-heading">
        <div><p className={styles.eyebrow}>FEATURE 06 / 12</p><h2 id="availability-heading">Your availability</h2><p>Select all your regular working days, set the hours once, and save the weekly schedule. You can still update an individual day later.</p></div>
        <div className={styles.authForm}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => void selectWeek(thisWeekMonday)}
              style={{
                flex: 1,
                padding: '0.6rem 0.8rem',
                borderRadius: '6px',
                border: scheduleWeek === thisWeekMonday ? '2px solid #224c3e' : '1px solid #cbd4c7',
                background: scheduleWeek === thisWeekMonday ? '#e9ede3' : '#fff',
                color: '#224c3e',
                fontWeight: scheduleWeek === thisWeekMonday ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              This Week ({formatDisplayDate(thisWeekMonday).slice(0, 5)} - {dayDate(thisWeekMonday, 7).slice(0, 5)})
            </button>
            <button
              type="button"
              onClick={() => void selectWeek(nextWeekMonday)}
              style={{
                flex: 1,
                padding: '0.6rem 0.8rem',
                borderRadius: '6px',
                border: scheduleWeek === nextWeekMonday ? '2px solid #224c3e' : '1px solid #cbd4c7',
                background: scheduleWeek === nextWeekMonday ? '#e9ede3' : '#fff',
                color: '#224c3e',
                fontWeight: scheduleWeek === nextWeekMonday ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              Next Week ({formatDisplayDate(nextWeekMonday).slice(0, 5)} - {dayDate(nextWeekMonday, 7).slice(0, 5)})
            </button>
          </div>
          <div style={{ marginBottom: '1rem', padding: '0.5rem 0.75rem', background: '#f5f7f2', borderRadius: '6px', fontSize: '0.85rem', color: '#1b4332' }}>
            Configuring schedule for: <strong>{scheduleWeek === thisWeekMonday ? 'This Week' : 'Next Week'} ({weekDateRange(scheduleWeek)})</strong>
          </div>
          <form onSubmit={async (event) => { event.preventDefault(); setAvailabilityBusy(true); setAvailabilityError(''); const form = new FormData(event.currentTarget); try { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch('/api/barber/availability/hours/bulk', { method: 'PUT', headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify({ daysOfWeek: selectedWorkingDays, weekStartDate: scheduleWeek, startTime: String(form.get('startTime')), endTime: String(form.get('endTime')) }) }); if (!response.ok) throw await editError(response, 'Unable to save these hours.'); const saved = await response.json() as WorkingHour[]; setWorkingHours(saved); setSelectedWorkingDays(saved.map(item => item.dayOfWeek)); setBarberBreaks(current => current.filter(item => saved.some(hour => hour.dayOfWeek === item.dayOfWeek))) } catch (error) { setAvailabilityError(error instanceof Error ? error.message : 'Unable to save availability.') } finally { setAvailabilityBusy(false) } }}>
            <input name="weekStartDate" type="hidden" value={scheduleWeek} />
            <fieldset><legend>Working days</legend>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => { const dayNumber = index + 1; return <label key={day}><input name="daysOfWeek" type="checkbox" value={dayNumber} checked={selectedWorkingDays.includes(dayNumber)} onChange={(event) => setSelectedWorkingDays(event.currentTarget.checked ? [...selectedWorkingDays, dayNumber].sort() : selectedWorkingDays.filter(item => item !== dayNumber))} /> {day}</label> })}</fieldset><label>Start time<input name="startTime" type="time" defaultValue="09:00" required /></label><label>End time<input name="endTime" type="time" defaultValue="17:00" required /></label><button className={styles.submit} disabled={availabilityBusy}>{availabilityBusy ? 'Saving...' : 'Save weekly schedule'}</button>
          </form>
          {workingHours.length > 0 ? (
            <div className={styles.accountCard}>
              <p className={styles.status}>{account ? `${account.displayName}'s weekly schedule (Private to you)` : 'Weekly hours'}</p>
              <p style={{ fontWeight: 600, color: '#1b4332', margin: '0.25rem 0' }}>Week: {weekDateRange(scheduleWeek)} ({scheduleWeek === thisWeekMonday ? 'This Week' : 'Next Week'})</p>
              <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0', marginBottom: '0.75rem' }}>Only you can view or modify this schedule. You can edit any individual day's hours below, or re-save the whole week using the form above.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {workingHours.map(item => {
                  const dayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][item.dayOfWeek - 1];
                  const isEditing = editingDayHourId === item.id;
                  const dateLabel = dayDate(scheduleWeek, item.dayOfWeek);
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid #f0f0f0', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {isEditing ? (
                        <form style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', flexWrap: 'wrap' }} onSubmit={async (e) => {
                          e.preventDefault();
                          setAvailabilityBusy(true);
                          setAvailabilityError('');
                          try {
                            const csrfResponse = await fetch('/api/auth/csrf');
                            const csrf = await csrfResponse.json() as { token: string; headerName: string };
                            const response = await fetch('/api/barber/availability/hours', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
                              body: JSON.stringify({
                                dayOfWeek: item.dayOfWeek,
                                weekStartDate: scheduleWeek,
                                startTime: editingDayStart || item.startTime.slice(0, 5),
                                endTime: editingDayEnd || item.endTime.slice(0, 5)
                              })
                            });
                            if (!response.ok) throw await editError(response, `Unable to update hours for ${dayName}.`);
                            const updated = await response.json() as WorkingHour;
                            setWorkingHours(current => current.map(h => h.id === updated.id ? updated : h));
                            setEditingDayHourId(null);
                          } catch (err) {
                            setAvailabilityError(err instanceof Error ? err.message : `Unable to update ${dayName}.`);
                          } finally {
                            setAvailabilityBusy(false);
                          }
                        }}>
                          <strong>{dayName} ({dateLabel})</strong>
                          <input type="time" defaultValue={item.startTime.slice(0, 5)} required onChange={(e) => setEditingDayStart(e.target.value)} style={{ padding: '0.2rem' }} />
                          <span>to</span>
                          <input type="time" defaultValue={item.endTime.slice(0, 5)} required onChange={(e) => setEditingDayEnd(e.target.value)} style={{ padding: '0.2rem' }} />
                          <button type="submit" disabled={availabilityBusy} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>Save</button>
                          <button type="button" className={styles.secondaryButton} onClick={() => setEditingDayHourId(null)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>Cancel</button>
                        </form>
                      ) : (
                        <>
                          <span>
                            <span>{dayName} - {item.startTime.slice(0, 5)}-{item.endTime.slice(0, 5)}</span>
                            <span style={{ color: '#666', fontSize: '0.85rem', marginLeft: '0.4rem' }}>({dateLabel})</span>
                          </span>
                          <button type="button" className={styles.secondaryButton} onClick={() => {
                            setEditingDayHourId(item.id);
                            setEditingDayStart(item.startTime.slice(0, 5));
                            setEditingDayEnd(item.endTime.slice(0, 5));
                          }} style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}>Edit hours</button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className={styles.accountCard}>
              <p className={styles.status}>{account ? `${account.displayName}'s weekly schedule (Private to you)` : 'Weekly hours'}</p>
              <p style={{ fontWeight: 600, color: '#1b4332', margin: '0.25rem 0' }}>Week: {weekDateRange(scheduleWeek)} ({scheduleWeek === thisWeekMonday ? 'This Week' : 'Next Week'})</p>
              <p style={{ color: '#666', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>No hours configured for {scheduleWeek === thisWeekMonday ? 'this week' : 'next week'} yet. Select your regular working days above and click "Save weekly schedule".</p>
            </div>
          )}
          {(() => {
            const isThisWeek = scheduleWeek === thisWeekMonday;
            const currentDayNumber = isThisWeek ? (new Date().getDay() || 7) : 0;
            const isTodayWorking = isThisWeek && workingHours.some(item => item.dayOfWeek === currentDayNumber);
            return (
              <form onSubmit={async (event) => { event.preventDefault(); setAvailabilityBusy(true); setAvailabilityError(''); const formElement = event.currentTarget; const form = new FormData(formElement); try { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch('/api/barber/availability/breaks', { method: 'POST', headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify({ weekStartDate: scheduleWeek, dayOfWeek: Number(form.get('breakDay')), startTime: String(form.get('breakStart')), endTime: String(form.get('breakEnd')) }) }); if (!response.ok) throw await editError(response, 'Unable to save this break.'); const saved = await response.json() as BarberBreak; setBarberBreaks(current => [...current, saved].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))); formElement.reset() } catch (error) { setAvailabilityError(error instanceof Error ? error.message : 'Unable to save this break.') } finally { setAvailabilityBusy(false) } }}>
                <p className={styles.status}>Add break</p>
                <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '-0.25rem', marginBottom: '0.5rem' }}>Schedule lunch or rest breaks for {scheduleWeek === thisWeekMonday ? 'this week' : 'next week'} to block customer bookings during those hours.</p>
                <label>Break weekday<select name="breakDay" defaultValue={isTodayWorking ? String(currentDayNumber) : ''} required disabled={workingHours.length === 0}><option value="">Select a working day</option>{workingHours.map(item => <option key={item.dayOfWeek} value={item.dayOfWeek}>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][item.dayOfWeek - 1]}{isThisWeek && item.dayOfWeek === currentDayNumber ? ' (Today)' : ''} ({dayDate(scheduleWeek, item.dayOfWeek)})</option>)}</select></label><label>Break start<input name="breakStart" type="time" required /></label><label>Break end<input name="breakEnd" type="time" required /></label><button className={styles.submit} disabled={availabilityBusy || workingHours.length === 0}>{availabilityBusy ? 'Saving...' : 'Save break'}</button>
              </form>
            );
          })()}
          {barberBreaks.length > 0 && <div className={styles.accountCard}><p className={styles.status}>Breaks</p>{barberBreaks.map(item => <p key={item.id}>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][item.dayOfWeek - 1]} · {item.startTime.slice(0, 5)}-{item.endTime.slice(0, 5)} <button type="button" disabled={availabilityBusy} onClick={async () => { setAvailabilityBusy(true); setAvailabilityError(''); try { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch(`/api/barber/availability/breaks/${item.id}`, { method: 'DELETE', headers: { [csrf.headerName]: csrf.token } }); if (!response.ok) throw await editError(response, 'Unable to remove this break.'); setBarberBreaks(current => current.filter(saved => saved.id !== item.id)) } catch (error) { setAvailabilityError(error instanceof Error ? error.message : 'Unable to remove this break.') } finally { setAvailabilityBusy(false) } }}>Remove break</button></p>)}</div>}
          <form onSubmit={async (event) => { event.preventDefault(); setAvailabilityBusy(true); setAvailabilityError(''); const formElement = event.currentTarget; const form = new FormData(formElement); const customHours = form.get('specialType') === 'custom'; const specialDate = String(form.get('date')); try { const targetWeek = mondayFor(specialDate); const scheduleResponse = await fetch(`/api/barber/availability/hours?weekStartDate=${targetWeek}`); const targetHours = scheduleResponse.ok ? await scheduleResponse.json() as WorkingHour[] : []; const day = new Date(`${specialDate}T00:00:00Z`).getUTCDay() || 7; if (!targetHours.some(item => item.dayOfWeek === day)) throw new Error('A special date can only be added for a weekday marked as working in that week.'); const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch('/api/barber/availability/days-off', { method: 'POST', headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify({ date: specialDate, startTime: customHours ? String(form.get('specialStart')) : null, endTime: customHours ? String(form.get('specialEnd')) : null, reason: String(form.get('reason') ?? '') }) }); if (!response.ok) throw await editError(response, 'Unable to save the special schedule.'); setDaysOff([...daysOff, await response.json() as DayOff].sort((a, b) => a.date.localeCompare(b.date))); formElement.reset() } catch (error) { setAvailabilityError(error instanceof Error ? error.message : 'Unable to save the special schedule.') } finally { setAvailabilityBusy(false) } }}><p className={styles.status}>Special date schedule</p><label>Date<input name="date" type="date" required /></label><label>Type<select name="specialType" defaultValue="off"><option value="off">Unavailable all day</option><option value="custom">Custom hours</option></select></label><label>Special start time<input name="specialStart" type="time" /></label><label>Special end time<input name="specialEnd" type="time" /></label><label>Reason<input name="reason" maxLength={255} /></label><button className={styles.submit} disabled={availabilityBusy}>{availabilityBusy ? 'Saving...' : 'Save special date'}</button></form>
          {daysOff.length > 0 && <div className={styles.accountCard}><p className={styles.status}>Special date schedules</p>{daysOff.map(item => <p key={item.id}>{item.date} · {item.startTime && item.endTime ? `${item.startTime.slice(0, 5)}-${item.endTime.slice(0, 5)}` : 'Unavailable all day'} {item.reason && `- ${item.reason}`} <button type="button" disabled={availabilityBusy} onClick={async () => { setAvailabilityBusy(true); setAvailabilityError(''); try { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch(`/api/barber/availability/days-off/${item.id}`, { method: 'DELETE', headers: { [csrf.headerName]: csrf.token } }); if (!response.ok) throw await editError(response, 'Unable to remove the special schedule.'); setDaysOff(daysOff.filter(day => day.id !== item.id)) } catch (error) { setAvailabilityError(error instanceof Error ? error.message : 'Unable to remove the special schedule.') } finally { setAvailabilityBusy(false) } }}>Remove</button></p>)}</div>}
          {availabilityError && <p className={styles.error} role="alert">{availabilityError}</p>}
          <div className={styles.accountCard}>
            <p className={styles.status}>Barber departure</p>
            <p>End your barber membership and leave this salon.</p>
            <button type="button" className={styles.secondaryButton} disabled={availabilityBusy} onClick={async () => {
              setAvailabilityBusy(true); setAvailabilityError('');
              try {
                const csrfResponse = await fetch('/api/auth/csrf');
                const csrf = await csrfResponse.json() as { token: string; headerName: string };
                const response = await fetch('/api/barber/membership', { method: 'DELETE', headers: { [csrf.headerName]: csrf.token } });
                if (!response.ok) throw await editError(response, 'Unable to leave the salon.');
                const meResponse = await fetch('/api/auth/me');
                if (meResponse.ok) setAccount(await meResponse.json() as Account);
                setWorkingHours([]); setSelectedWorkingDays([]); setBarberBreaks([]); setDaysOff([]); setBarberAppointments([]);
                const barbersResponse = await fetch('/api/salons/mine/barbers');
                if (barbersResponse.ok) setOwnerBarbers(await barbersResponse.json() as BarberQualification[]);
              } catch (error) {
                setAvailabilityError(error instanceof Error ? error.message : 'Unable to leave the salon.');
              } finally {
                setAvailabilityBusy(false);
              }
            }}>Leave salon</button>
          </div>
        </div>
      </section>}
      {account?.roles.includes('BARBER') && <section className={styles.authSection} aria-labelledby="barber-schedule-heading">
        <div><p className={styles.eyebrow}>FEATURE 10 / 12</p><h2 id="barber-schedule-heading">Barber appointment schedule</h2><p>View upcoming customer bookings assigned to you. Filter by date to review your day.</p></div>
        <div className={styles.authForm}>
          <form onSubmit={(event) => { event.preventDefault(); void loadBarberAppointments() }}>
            <label>Filter by date<input type="date" value={barberAppointmentDate} onChange={(event) => setBarberAppointmentDate(event.currentTarget.value)} /></label>
            <button className={styles.submit} disabled={barberAppointmentsBusy}>{barberAppointmentsBusy ? 'Loading...' : 'Filter schedule'}</button>
            {barberAppointmentDate && <button type="button" className={styles.secondaryButton} onClick={() => { setBarberAppointmentDate(''); void loadBarberAppointments('') }}>Clear date filter</button>}
          </form>
          {barberAppointmentsError && <p className={styles.error} role="alert">{barberAppointmentsError}</p>}
          <div className={styles.accountCard}>
            <p className={styles.status}>Assigned appointments</p>
            {(() => {
              const activeBarberAppts = barberAppointments.filter(item => item.status === 'CONFIRMED' || item.status === 'IN_PROGRESS');
              const historyBarberAppts = barberAppointments.filter(item => item.status === 'COMPLETED' || item.status === 'NO_SHOW' || item.status === 'CANCELLED');
              const completedBarberAppts = historyBarberAppts.filter(item => item.status === 'COMPLETED');
              const totalBarberEarnings = completedBarberAppts.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
              const displayedAppts = barberTab === 'ACTIVE' ? activeBarberAppts : historyBarberAppts;

              return (
                <>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <button
                      type="button"
                      onClick={() => setBarberTab('ACTIVE')}
                      style={{
                        flex: 1,
                        padding: '0.6rem 0.8rem',
                        borderRadius: '6px',
                        border: barberTab === 'ACTIVE' ? '2px solid #224c3e' : '1px solid #cbd4c7',
                        background: barberTab === 'ACTIVE' ? '#e9ede3' : '#fff',
                        color: '#224c3e',
                        fontWeight: barberTab === 'ACTIVE' ? 700 : 500,
                        cursor: 'pointer'
                      }}
                    >
                      🕒 Active Schedule ({activeBarberAppts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBarberTab('HISTORY')}
                      style={{
                        flex: 1,
                        padding: '0.6rem 0.8rem',
                        borderRadius: '6px',
                        border: barberTab === 'HISTORY' ? '2px solid #224c3e' : '1px solid #cbd4c7',
                        background: barberTab === 'HISTORY' ? '#e9ede3' : '#fff',
                        color: '#224c3e',
                        fontWeight: barberTab === 'HISTORY' ? 700 : 500,
                        cursor: 'pointer'
                      }}
                    >
                      ✅ Completed & History ({historyBarberAppts.length})
                    </button>
                  </div>
                  {barberTab === 'HISTORY' && (
                    <div style={{ background: '#f5f7f2', border: '1px solid #dcded5', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', color: '#666', display: 'block' }}>Completed Services</span>
                        <strong style={{ fontSize: '1.2rem', color: '#1b4332' }}>{completedBarberAppts.length}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.8rem', color: '#666', display: 'block' }}>Total Earnings Handled</span>
                        <strong style={{ fontSize: '1.2rem', color: '#1b4332' }}>₹{totalBarberEarnings}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.8rem', color: '#666', display: 'block' }}>No-shows / Cancelled</span>
                        <strong style={{ fontSize: '1.2rem', color: '#888' }}>{historyBarberAppts.length - completedBarberAppts.length}</strong>
                      </div>
                    </div>
                  )}
                  {displayedAppts.length === 0 ? (
                    <p>{barberTab === 'ACTIVE' ? 'No active appointments scheduled.' : 'No past or completed appointments.'}</p>
                  ) : (
                    displayedAppts.map(item => (
                      <p key={item.bookingReference}>
                        <strong>{item.date} · {item.startTime.slice(0, 5)}-{item.endTime.slice(0, 5)}{item.timezone && ` ${item.timezone}`}</strong> · Customer: <strong>{item.customerName || 'Customer'}</strong> · {item.serviceName} · ₹{item.totalPrice} · <span style={{ fontWeight: 600, color: item.status === 'COMPLETED' ? '#166534' : item.status === 'IN_PROGRESS' ? '#0284c7' : item.status === 'CONFIRMED' ? '#1b4332' : '#991b1b' }}>{item.status}</span>
                        {item.status === 'CONFIRMED' && <>
                          {' '}<button type="button" disabled={barberAppointmentsBusy} onClick={() => void updateBarberAppointmentStatus(item.bookingReference, 'IN_PROGRESS')}>Start service</button>
                          {' '}<button type="button" disabled={barberAppointmentsBusy} onClick={() => void updateBarberAppointmentStatus(item.bookingReference, 'COMPLETED')}>Complete</button>
                          {' '}<button type="button" disabled={barberAppointmentsBusy} onClick={() => void updateBarberAppointmentStatus(item.bookingReference, 'NO_SHOW')}>Mark no-show</button>
                        </>}
                        {item.status === 'IN_PROGRESS' && <>
                          {' '}<button type="button" disabled={barberAppointmentsBusy} onClick={() => void updateBarberAppointmentStatus(item.bookingReference, 'COMPLETED')}>Complete</button>
                        </>}
                        {item.addonSummary && ` · Add-ons: ${item.addonSummary}`}
                        {item.items && item.items.length > 0 && <><br />Items: {item.items.map(line => `${line.name} (${line.durationMinutes} min, ₹${line.price})`).join(' · ')}</>}
                        {paymentNotes[item.bookingReference] && <><br /><span style={{ display: 'inline-block', fontSize: '0.8rem', background: '#e9ede3', color: '#1b4332', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600, marginTop: '0.3rem' }}>💳 {paymentNotes[item.bookingReference]}</span></>}
                      </p>
                    ))
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </section>}
      {account && <section className={styles.authSection} aria-labelledby="slots-heading">
        <div><p className={styles.eyebrow}>FEATURE 07 / 12</p><h2 id="slots-heading">Find an appointment slot</h2><p>Choose a salon, one or more services, add-ons, and date. Slots include the complete combined duration and price.</p></div>
        <div className={styles.authForm}><form onSubmit={async (event) => { event.preventDefault(); setSlotBusy(true); setSlotError(''); setSelectedSlot(null); try { const params = new URLSearchParams({ salonId: slotSalonId, date: slotDate }); slotServiceIds.forEach(id => params.append('serviceIds', String(id))); slotAddonIds.forEach(id => params.append('addonIds', String(id))); const response = await fetch(`/api/slots?${params.toString()}`); if (!response.ok) throw new Error(response.status === 400 ? 'Select at least one service and check the selected add-ons and date.' : 'Unable to calculate slots.'); setSlots(await response.json() as Slot[]) } catch (error) { setSlotError(error instanceof Error ? error.message : 'Unable to calculate slots.') } finally { setSlotBusy(false) } }}>
          <label>Salon<select value={slotSalonId} onChange={async (event) => { const id = event.currentTarget.value; setSlotSalonId(id); setSlotServiceIds([]); setSlotAddonIds([]); setSlotAddons([]); setSlots([]); setSelectedSlot(null); setSelectedSalonPhotos([]); if (!id) { setSlotServices([]); return } const [response, photoResponse] = await Promise.all([fetch(`/api/salons/${id}/services`), fetch(`/api/salons/${id}/photos`)]); if (response.ok) setSlotServices(await response.json() as SalonService[]); if (photoResponse.ok) setSelectedSalonPhotos(await photoResponse.json() as SalonPhoto[]) }} required><option value="" disabled>Select a salon</option>{directorySalons.map(item => <option key={item.id} value={item.id}>{item.name} - {item.address}</option>)}</select></label>
          {selectedSalonPhotos.length > 0 && <div className={styles.accountCard}><p className={styles.status}>Salon gallery</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>{selectedSalonPhotos.map(p => <img key={p.id} src={p.url} alt="Salon preview" style={{ width: '100px', height: '75px', objectFit: 'cover', borderRadius: '4px' }} />)}</div></div>}
          <fieldset><legend>Services</legend>{slotServices.filter(item => item.active).length === 0 && <p>Select a salon to view active services.</p>}{slotServices.filter(item => item.active).map(item => <label key={item.id}><input type="checkbox" checked={slotServiceIds.includes(item.id)} onChange={async (event) => { const selected = event.currentTarget.checked ? [...slotServiceIds, item.id] : slotServiceIds.filter(id => id !== item.id); setSlotServiceIds(selected); setSlotAddonIds([]); setSlots([]); setSelectedSlot(null); if (selected.length === 0 || !slotSalonId) { setSlotAddons([]); return } const responses = await Promise.all(selected.map(serviceId => fetch(`/api/salons/${slotSalonId}/services/${serviceId}/addons`))); const addonLists = await Promise.all(responses.filter(response => response.ok).map(response => response.json() as Promise<AddOn[]>)); const merged = addonLists.flat().filter((addon, index, all) => all.findIndex(candidate => candidate.id === addon.id) === index); setSlotAddons(merged) }} /> {item.name} - ₹{item.price} - {item.durationMinutes} minutes</label>)}</fieldset>
          {slotAddons.length > 0 && <fieldset><legend>Add-ons</legend>{slotAddons.map(item => <label key={item.id}><input type="checkbox" checked={slotAddonIds.includes(item.id)} onChange={(event) => { setSlotAddonIds(event.currentTarget.checked ? [...slotAddonIds, item.id] : slotAddonIds.filter(id => id !== item.id)); setSlots([]); setSelectedSlot(null); }} /> {item.name} - ₹{item.price} - +{item.durationMinutes} minutes</label>)}</fieldset>}
          {slotServiceIds.length > 0 && (() => {
            const currentServices = slotServices.filter(s => slotServiceIds.includes(s.id));
            const currentAddons = slotAddons.filter(a => slotAddonIds.includes(a.id));
            const runningTotal = currentServices.reduce((acc, s) => acc + s.price, 0) + currentAddons.reduce((acc, a) => acc + a.price, 0);
            const runningDuration = currentServices.reduce((acc, s) => acc + s.durationMinutes, 0) + currentAddons.reduce((acc, a) => acc + a.durationMinutes, 0);
            return (
              <div style={{ background: '#f5f7f2', border: '1px solid #dcded5', borderRadius: '6px', padding: '0.6rem 0.8rem', marginBottom: '0.8rem', fontSize: '0.85rem' }}>
                <strong>Selected services & add-ons ({currentServices.length + currentAddons.length}):</strong>
                <div style={{ margin: '0.3rem 0', color: '#444' }}>
                  {currentServices.map(s => `${s.name} (₹${s.price})`).concat(currentAddons.map(a => `${a.name} (₹${a.price})`)).join(' · ')}
                </div>
                <div style={{ fontWeight: 700, color: '#1b4332' }}>
                  Total: ₹{runningTotal} · {runningDuration} minutes
                </div>
              </div>
            );
          })()}
          {(() => {
            const selectedDirSalon = directorySalons.find(item => String(item.id) === slotSalonId);
            const horizon = selectedDirSalon?.bookingHorizonDays ?? 7;
            const maxDate = new Date();
            maxDate.setDate(maxDate.getDate() + horizon);
            const maxDateStr = maxDate.toISOString().slice(0, 10);
            return (
              <>
                <label>Date<input type="date" value={slotDate} min={new Date().toISOString().slice(0, 10)} max={maxDateStr} onChange={(event) => { setSlotDate(event.currentTarget.value); setSlots([]); setSelectedSlot(null); }} required /></label>
                {selectedDirSalon && <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '-0.25rem', marginBottom: '0.5rem' }}>Booking window: up to {horizon} days in advance ({maxDateStr}) · Grid: {selectedDirSalon.slotIncrementMinutes ? `${selectedDirSalon.slotIncrementMinutes} min` : 'Service duration'}</p>}
              </>
            );
          })()}{slotError && <p className={styles.error} role="alert">{slotError}</p>}<button className={styles.submit} disabled={slotBusy || !slotSalonId || slotServiceIds.length === 0}>{slotBusy ? 'Finding...' : 'Find available slots'}</button>
        </form>
        {slots.length > 0 && (
          <div className={styles.accountCard}>
            <p className={styles.status}>Available slots</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {slots.map(slot => {
                const isSelected = selectedSlot?.startTime === slot.startTime;
                return (
                  <div
                    key={`${slot.date}-${slot.startTime}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '6px',
                      border: isSelected ? '2px solid #224c3e' : '1px solid #e1e4db',
                      background: isSelected ? '#f2f6ee' : '#fafbf6',
                      flexWrap: 'wrap',
                      gap: '0.5rem'
                    }}
                  >
                    <span>
                      <strong>{slot.startTime.slice(0, 5)}-{slot.endTime.slice(0, 5)}</strong>{slot.timezone && ` ${slot.timezone}`} · {slot.durationMinutes} minutes · ₹{slot.totalPrice}
                    </span>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      style={{ margin: 0, padding: '0.3rem 0.8rem', fontSize: '0.85rem', fontWeight: isSelected ? 700 : 400 }}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {isSelected ? 'Selected ✓' : 'Select slot'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {selectedSlot && (() => {
          const currentSalon = directorySalons.find(item => String(item.id) === slotSalonId);
          const currentServices = slotServices.filter(s => slotServiceIds.includes(s.id));
          const currentAddons = slotAddons.filter(a => slotAddonIds.includes(a.id));
          return (
            <div className={styles.accountCard} style={{ border: '2px solid #224c3e', background: '#ffffff', marginTop: '1rem' }}>
              <p className={styles.status} style={{ fontSize: '1.1rem', marginBottom: '0.8rem' }}>📋 Review your booking</p>
              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '0.35rem 0.5rem', fontSize: '0.95rem' }}>
                <span style={{ color: '#666' }}>Salon:</span>
                <strong>{currentSalon?.name || 'Selected Salon'}</strong>
                <span style={{ color: '#666' }}>Date & Time:</span>
                <strong>{formatBookingDateTime(selectedSlot.date, selectedSlot.startTime, selectedSlot.endTime)}</strong>
                <span style={{ color: '#666' }}>Duration:</span>
                <span>{selectedSlot.durationMinutes} minutes</span>
              </div>
              <div style={{ margin: '1rem 0 0.5rem' }}>
                <p style={{ fontWeight: 600, margin: '0 0 0.4rem 0', fontSize: '0.9rem' }}>Services:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {currentServices.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.1rem 0' }}>
                      <span>• {s.name}</span>
                      <span>₹{s.price}</span>
                    </div>
                  ))}
                  {currentAddons.map(a => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.1rem 0' }}>
                      <span>• {a.name} (Add-on)</span>
                      <span>₹{a.price}</span>
                    </div>
                  ))}
                </div>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid #cbd4c7', margin: '0.6rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem', color: '#1b4332', marginBottom: '1rem' }}>
                <span>Total Amount to Pay:</span>
                <span>₹{selectedSlot.totalPrice}</span>
              </div>
              <div style={{ background: '#f8faf6', border: '1px solid #dcded5', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
                <p style={{ fontWeight: 600, margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Payment Method:</p>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.4rem' }}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="ONLINE_TEST"
                    checked={paymentMethod === 'ONLINE_TEST'}
                    onChange={() => setPaymentMethod('ONLINE_TEST')}
                  />
                  <span><strong>Simulated Online Payment</strong> (Test Mode)</span>
                </label>
                {paymentMethod === 'ONLINE_TEST' && (
                  <div style={{ marginLeft: '1.5rem', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#2d6a4f', background: '#eaf4ee', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                    🟢 <strong>Demo Payment Mode:</strong> Instant dummy UPI / Card confirmation. No real money will be charged.
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0 }}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="PAY_AT_SALON"
                    checked={paymentMethod === 'PAY_AT_SALON'}
                    onChange={() => setPaymentMethod('PAY_AT_SALON')}
                  />
                  <span><strong>Pay at Salon</strong> (Cash / UPI upon visit)</span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={styles.submit}
                  style={{ flex: 1 }}
                  disabled={bookingBusy}
                  onClick={async () => {
                    setBookingBusy(true);
                    setBookingError('');
                    if (paymentMethod === 'ONLINE_TEST') {
                      await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    const requestIdentity = JSON.stringify({
                      salonId: Number(slotSalonId),
                      serviceIds: [...slotServiceIds].sort((a, b) => a - b),
                      addonIds: [...slotAddonIds].sort((a, b) => a - b),
                      date: selectedSlot.date,
                      startTime: selectedSlot.startTime
                    });
                    const requestKey = bookingRequestKeys.current.get(requestIdentity) || crypto.randomUUID();
                    bookingRequestKeys.current.set(requestIdentity, requestKey);
                    try {
                      const csrfResponse = await fetch('/api/auth/csrf');
                      const csrf = await csrfResponse.json() as { token: string; headerName: string };
                      const response = await fetch('/api/appointments', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Idempotency-Key': requestKey,
                          [csrf.headerName]: csrf.token
                        },
                        body: requestIdentity
                      });
                      if (!response.ok) throw await editError(response, response.status === 409 ? 'That slot was just taken. Search again.' : 'Unable to confirm this appointment.');
                      const appointment = await response.json() as Appointment;
                      bookingRequestKeys.current.delete(requestIdentity);
                      const demoTxn = paymentMethod === 'ONLINE_TEST' ? `TXN_DEMO_${Math.floor(100000 + Math.random() * 900000)}` : null;
                      const paymentSummary = demoTxn ? `Paid online (Test Mode · ${demoTxn})` : 'Pay at salon (Cash / UPI on arrival)';
                      const updatedNotes = { ...paymentNotes, [appointment.bookingReference]: paymentSummary };
                      setPaymentNotes(updatedNotes);
                      try { localStorage.setItem('trimtime_payment_notes', JSON.stringify(updatedNotes)); } catch {}
                      setAppointments(current => current.some(item => item.bookingReference === appointment.bookingReference) ? current : [appointment, ...current]);
                      setOwnerAppointments(current => current.some(item => item.bookingReference === appointment.bookingReference) ? current : [appointment, ...current]);
                      setSlots(current => current.filter(item => item.startTime !== selectedSlot.startTime));
                      setSelectedSlot(null);
                      setBookingError('');
                    } catch (error) {
                      setBookingError(error instanceof Error ? error.message : 'Unable to confirm this appointment.');
                    } finally {
                      setBookingBusy(false);
                    }
                  }}
                >
                  {bookingBusy ? (paymentMethod === 'ONLINE_TEST' ? 'Processing test payment...' : 'Confirming...') : 'Confirm your booking'}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  style={{ margin: 0 }}
                  disabled={bookingBusy}
                  onClick={() => setSelectedSlot(null)}
                >
                  Choose different time
                </button>
              </div>
            </div>
          );
        })()}
        {bookingError && <p className={styles.error} role="alert">{bookingError}</p>}
        {(appointments.length > 0 || customerAppointmentStatus || customerAppointmentTotalElements > 0) && (
          <div className={styles.accountCard}>
            <p className={styles.status}>Your appointments</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <label style={{ margin: 0 }}>
                Filter by status:
                <select
                  aria-label="Filter appointments by status"
                  value={customerAppointmentStatus}
                  style={{ marginLeft: '0.5rem' }}
                  onChange={(event) => {
                    const newStatus = event.currentTarget.value
                    setCustomerAppointmentStatus(newStatus)
                    void loadCustomerAppointments(newStatus, 0)
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="NO_SHOW">No show</option>
                </select>
              </label>
              {customerAppointmentStatus && (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={customerAppointmentsBusy}
                  onClick={() => {
                    setCustomerAppointmentStatus('')
                    void loadCustomerAppointments('', 0)
                  }}
                >
                  Clear filter
                </button>
              )}
            </div>
            {customerAppointmentsError && <p className={styles.error} role="alert">{customerAppointmentsError}</p>}
            {appointments.length === 0 ? (
              <p>No appointments found.</p>
            ) : (
              appointments.map(item => (
                <p key={item.bookingReference}>
                  <strong>{item.date} · {item.startTime.slice(0, 5)}-{item.endTime.slice(0, 5)}{item.timezone && ` ${item.timezone}`}</strong> · {item.salonName} · {item.serviceName} · ₹{item.totalPrice} · {item.status}
                  {item.status === 'CONFIRMED' && (
                    <>
                      {' '}<button type="button" disabled={bookingBusy || customerAppointmentsBusy} onClick={async () => {
                        setBookingBusy(true); setBookingError('');
                        try {
                          const csrfResponse = await fetch('/api/auth/csrf');
                          const csrf = await csrfResponse.json() as { token: string; headerName: string };
                          const response = await fetch(`/api/appointments/${item.bookingReference}/cancel`, {
                            method: 'POST',
                            headers: { [csrf.headerName]: csrf.token }
                          });
                          if (!response.ok) throw await editError(response, 'Unable to cancel this appointment.');
                          const updated = await response.json() as Appointment;
                          setAppointments(current => current.map(appt => appt.bookingReference === updated.bookingReference ? updated : appt));
                        } catch (error) {
                          setBookingError(error instanceof Error ? error.message : 'Unable to cancel this appointment.');
                        } finally {
                          setBookingBusy(false);
                        }
                      }}>Cancel appointment</button>
                    </>
                  )}
                  <br />Assigned barber: <strong>{item.barberName}</strong>
                  {item.addonSummary && ` · Add-ons: ${item.addonSummary}`}
                  {item.items && item.items.length > 0 && (
                    <><br />Items: {item.items.map(line => `${line.name} (${line.durationMinutes} min, ₹${line.price})`).join(' · ')}</>
                  )}
                  {paymentNotes[item.bookingReference] && (
                    <><br /><span style={{ display: 'inline-block', fontSize: '0.8rem', background: '#e9ede3', color: '#1b4332', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600, marginTop: '0.3rem' }}>💳 {paymentNotes[item.bookingReference]}</span></>
                  )}
                </p>
              ))
            )}
            {customerAppointmentTotalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={customerAppointmentsBusy || customerAppointmentPage <= 0}
                  onClick={() => void loadCustomerAppointments(customerAppointmentStatus, customerAppointmentPage - 1)}
                >
                  Previous page
                </button>
                <span>Page {customerAppointmentPage + 1} of {customerAppointmentTotalPages}</span>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={customerAppointmentsBusy || customerAppointmentPage >= customerAppointmentTotalPages - 1}
                  onClick={() => void loadCustomerAppointments(customerAppointmentStatus, customerAppointmentPage + 1)}
                >
                  Next page
                </button>
              </div>
            )}
          </div>
        )}
        {slotSalonId && slotServiceIds.length > 0 && !slotBusy && slots.length === 0 && !slotError && <p>No matching slots were found for this date.</p>}
        </div>
      </section>}
      <footer>Trim-Time <span>Built with care. Developed step by step.</span></footer>
    </main>
  )
}
