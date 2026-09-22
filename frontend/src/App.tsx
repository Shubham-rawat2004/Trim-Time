import { useEffect, useState } from 'react'
import styles from './App.module.css'

type Connection = 'checking' | 'connected' | 'unavailable'
type Account = { id: number; email: string; displayName: string; roles: string[] }
type Salon = { id: number; ownerId: number; name: string; description: string; address: string; contact: string; latitude: number | null; longitude: number | null; timezone: string }
type BarberApplication = { id: number; barberUserId: number; barberName: string; salonId: number; salonName: string; message: string; status: string; createdAt: string }
type BarberQualification = { barberId: number; barberName: string; serviceIds: number[] }
type DirectorySalon = { id: number; name: string; description: string; address: string; contact: string; ownerName: string; latitude: number | null; longitude: number | null; distanceKm: number | null }
type SalonService = { id: number; salonId: number; name: string; description: string; price: number; durationMinutes: number; active: boolean }
type AddOn = { id: number; salonId: number; name: string; description: string; price: number; durationMinutes: number; active: boolean; compatibleServiceIds: number[] }
type WorkingHour = { id: number; weekStartDate: string; dayOfWeek: number; startTime: string; endTime: string }
type DayOff = { id: number; date: string; startTime: string | null; endTime: string | null; reason: string }
type Slot = { date: string; startTime: string; endTime: string; durationMinutes: number; totalPrice: number }
type Appointment = { bookingReference: string; date: string; startTime: string; endTime: string; salonName: string; barberName: string; serviceName: string; addonSummary: string | null; durationMinutes: number; totalPrice: number; status: string }
function mondayFor(value: string) { const date = new Date(`${value}T00:00:00Z`); const offset = (date.getUTCDay() + 6) % 7; date.setUTCDate(date.getUTCDate() - offset); return date.toISOString().slice(0, 10) }
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
  const [daysOff, setDaysOff] = useState<DayOff[]>([])
  const [availabilityError, setAvailabilityError] = useState('')
  const [availabilityBusy, setAvailabilityBusy] = useState(false)
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
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [barberError, setBarberError] = useState('')
  const [barberBusy, setBarberBusy] = useState(false)
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
      if (mine?.ok) setSalon(await mine.json() as Salon)
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
      if (appointmentsResponse?.ok) setAppointments(await appointmentsResponse.json() as Appointment[])
      const hoursResponse = await fetch(`/api/barber/availability/hours?weekStartDate=${scheduleWeek}`)
      if (hoursResponse?.ok) setWorkingHours(await hoursResponse.json() as WorkingHour[])
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
      setAccount(null); setSalon(null); setApplications([]); setOwnerApplications([]); setOwnerBarbers([]); setDirectorySalons([]); setNearbySalons([]); setServices([]); setSelectedSalonServices([]); setAddons([]); setWorkingHours([]); setDaysOff([]); setSlots([]); setAppointments([]); setSlotSalonId(''); setSlotServices([]); setSlotAddons([]); setSlotServiceIds([]); setSlotAddonIds([]); setDiscoveryLatitude(''); setDiscoveryLongitude(''); setShowManualLocation(false); setDiscoveryError(''); setAuthError(''); setBarberError(''); setQualificationError(''); setAvailabilityError(''); setSlotError(''); setBookingError('')
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
        {salon ? (editingSalon ? <form className={styles.authForm} onSubmit={async (event) => { event.preventDefault(); setSalonBusy(true); setSalonError(''); const formElement = event.currentTarget; const form = new FormData(formElement); try { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const latitude = String(form.get('latitude') ?? '').trim(); const longitude = String(form.get('longitude') ?? '').trim(); const response = await fetch('/api/salons/mine', { method: 'PUT', headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify({ name: String(form.get('name')), description: String(form.get('description') ?? ''), address: String(form.get('address')), contact: String(form.get('contact')), latitude: latitude ? Number(latitude) : null, longitude: longitude ? Number(longitude) : null, timezone: String(form.get('timezone') || 'Asia/Kolkata') }) }); if (!response.ok) throw new Error('Unable to update the salon.'); setSalon(await response.json() as Salon); setEditingSalon(false) } catch (error) { setSalonError(error instanceof Error ? error.message : 'Unable to update the salon.') } finally { setSalonBusy(false) } }}><label>Salon name<input name="name" defaultValue={salon.name} required maxLength={160} /></label><label>Address<input name="address" defaultValue={salon.address} required maxLength={255} /></label><label>Contact<input name="contact" defaultValue={salon.contact} required maxLength={40} /></label><label>Latitude<input name="latitude" type="number" step="any" min="-90" max="90" defaultValue={salon.latitude ?? ''} /></label><label>Longitude<input name="longitude" type="number" step="any" min="-180" max="180" defaultValue={salon.longitude ?? ''} /></label><label>Description<input name="description" defaultValue={salon.description} maxLength={500} /></label><label>Timezone<input name="timezone" defaultValue={salon.timezone} required /></label>{salonError && <p className={styles.error} role="alert">{salonError}</p>}<button className={styles.submit} disabled={salonBusy}>{salonBusy ? 'Saving...' : 'Save changes'}</button><button type="button" className={styles.secondaryButton} onClick={() => setEditingSalon(false)}>Cancel</button></form> : <div className={styles.accountCard}><p className={styles.status}>Salon created</p><h3>{salon.name}</h3><p>{salon.address} - {salon.contact}</p><span>{salon.timezone}</span><button type="button" className={styles.secondaryButton} onClick={() => setEditingSalon(true)}>Edit salon</button></div>) : <form className={styles.authForm} onSubmit={async (event) => { event.preventDefault(); setSalonBusy(true); setSalonError(''); const formElement = event.currentTarget; const form = new FormData(formElement); try { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const latitude = String(form.get('latitude') ?? '').trim(); const longitude = String(form.get('longitude') ?? '').trim(); const response = await fetch('/api/salons', { method: 'POST', headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify({ name: String(form.get('name')), description: String(form.get('description') ?? ''), address: String(form.get('address')), contact: String(form.get('contact')), latitude: latitude ? Number(latitude) : null, longitude: longitude ? Number(longitude) : null, timezone: String(form.get('timezone') || 'Asia/Kolkata') }) }); if (!response.ok) throw new Error(response.status === 409 ? 'This account already owns a salon.' : 'Unable to create the salon.'); setSalon(await response.json() as Salon); const refreshed = await fetch('/api/auth/me'); if (refreshed.ok) setAccount(await refreshed.json() as Account) } catch (error) { setSalonError(error instanceof Error ? error.message : 'Unable to create the salon.') } finally { setSalonBusy(false) } }}>
          <label>Salon name<input name="name" required maxLength={160} /></label><label>Address<input name="address" required maxLength={255} /></label><label>Contact<input name="contact" required maxLength={40} /></label><label>Latitude<input name="latitude" type="number" step="any" min="-90" max="90" /></label><label>Longitude<input name="longitude" type="number" step="any" min="-180" max="180" /></label><label>Description<input name="description" maxLength={500} /></label><label>Timezone<input name="timezone" defaultValue="Asia/Kolkata" required /></label>{salonError && <p className={styles.error} role="alert">{salonError}</p>}<button className={styles.submit} disabled={salonBusy}>{salonBusy ? 'Creating...' : 'Create salon'}</button>
        </form>}
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
          <form onSubmit={async (event) => { event.preventDefault(); setBarberBusy(true); setBarberError(''); const formElement = event.currentTarget; const form = new FormData(formElement); try { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch(`/api/barber/applications/${String(form.get('salonId'))}`, { method: 'POST', headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify({ message: String(form.get('message') ?? ''), bio: String(form.get('bio') ?? ''), experienceYears: Number(form.get('experienceYears') || 0) }) }); if (!response.ok) throw new Error(response.status === 409 ? 'You already have a pending request or salon membership.' : 'Unable to submit the application.'); setApplications([await response.json() as BarberApplication, ...applications]) } catch (error) { setBarberError(error instanceof Error ? error.message : 'Unable to submit the application.') } finally { setBarberBusy(false) } }}>
            <label>Choose a salon<select name="salonId" required defaultValue="" onChange={async (event) => { const salonId = event.currentTarget.value; setSelectedSalonServices([]); if (!salonId) return; const response = await fetch(`/api/salons/${salonId}/services`); if (response.ok) setSelectedSalonServices(await response.json() as SalonService[]) }}><option value="" disabled>Select a salon</option>{directorySalons.map(item => <option key={item.id} value={item.id}>{item.name} — {item.address} - Owner: {item.ownerName}</option>)}</select></label>{selectedSalonServices.length > 0 && <div className={styles.accountCard}><p className={styles.status}>Active services at this salon</p>{selectedSalonServices.map(item => <p key={item.id}><strong>{item.name}</strong> - ₹{item.price} - {item.durationMinutes} minutes</p>)}</div>}{selectedSalonServices.length === 0 && directorySalons.length > 0 && <p>Select a salon to view its active services.</p>}<label>Experience (years)<input name="experienceYears" type="number" min="0" max="80" defaultValue="0" /></label><label>Short bio<input name="bio" maxLength={1000} /></label><label>Message to owner<input name="message" maxLength={1000} /></label>{directorySalons.length === 0 && <p>No active salons are available yet.</p>}{barberError && <p className={styles.error} role="alert">{barberError}</p>}<button className={styles.submit} disabled={barberBusy || directorySalons.length === 0}>{barberBusy ? 'Submitting...' : 'Apply to join salon'}</button>
          </form>
          {applications.length > 0 && <div className={styles.accountCard}><p className={styles.status}>Your applications</p>{applications.map(application => <p key={application.id}>{application.salonName} - <strong>{application.status}</strong></p>)}</div>}
          {ownerApplications.length > 0 && <div className={styles.accountCard}><p className={styles.status}>Pending owner approvals</p>{ownerApplications.map(application => <p key={application.id}>{application.barberName} - {application.message || 'No message'} <button type="button" onClick={async () => { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch(`/api/salons/mine/barber-applications/${application.id}/approve`, { method: 'POST', headers: { [csrf.headerName]: csrf.token } }); if (response.ok) { setOwnerApplications(ownerApplications.filter(item => item.id !== application.id)); const barberResponse = await fetch('/api/salons/mine/barbers'); if (barberResponse.ok) setOwnerBarbers(await barberResponse.json() as BarberQualification[]) } }}>Approve</button> <button type="button" onClick={async () => { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch(`/api/salons/mine/barber-applications/${application.id}/reject`, { method: 'POST', headers: { [csrf.headerName]: csrf.token } }); if (response.ok) setOwnerApplications(ownerApplications.filter(item => item.id !== application.id)) }}>Reject</button></p>)}</div>}
        </div>
      </section>}
      {account?.roles.includes('SALON_OWNER') && salon && <section className={styles.authSection} aria-labelledby="qualifications-heading">
        <div><p className={styles.eyebrow}>BARBER QUALIFICATIONS</p><h2 id="qualifications-heading">Assign services to your barbers</h2><p>Choose the services each approved barber can perform. Customers see slots only when a qualified barber is available.</p></div>
        <div className={styles.authForm}>
          {ownerBarbers.length === 0 && <p>No approved barbers yet. Approve a barber application first.</p>}
          {ownerBarbers.map(barber => <form key={barber.barberId} onSubmit={async (event) => { event.preventDefault(); setQualificationBusy(barber.barberId); setQualificationError(''); const formElement = event.currentTarget; const form = new FormData(formElement); const serviceIds = form.getAll('serviceIds').map(value => Number(value)); try { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch(`/api/salons/mine/barbers/${barber.barberId}/services`, { method: 'PUT', headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify({ serviceIds }) }); if (!response.ok) throw new Error(response.status === 400 ? 'Select valid active services.' : 'Unable to save barber qualifications.'); const saved = await response.json() as BarberQualification; setOwnerBarbers(ownerBarbers.map(item => item.barberId === saved.barberId ? saved : item)) } catch (error) { setQualificationError(error instanceof Error ? error.message : 'Unable to save barber qualifications.') } finally { setQualificationBusy(null) } }}>
            <div className={styles.accountCard}><p className={styles.status}>{barber.barberName}</p><fieldset><legend>Qualified services</legend>{services.filter(item => item.active).length === 0 && <p>Add an active service first.</p>}{services.filter(item => item.active).map(service => <label key={service.id}><input name="serviceIds" type="checkbox" value={service.id} defaultChecked={barber.serviceIds.includes(service.id)} /> {service.name} - ₹{service.price}</label>)}</fieldset><button className={styles.submit} disabled={qualificationBusy === barber.barberId}>{qualificationBusy === barber.barberId ? 'Saving...' : 'Save qualifications'}</button></div>
          </form>)}
          {qualificationError && <p className={styles.error} role="alert">{qualificationError}</p>}
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
      {account?.roles.includes('BARBER') && <section className={styles.authSection} aria-labelledby="availability-heading">
        <div><p className={styles.eyebrow}>FEATURE 06 / 12</p><h2 id="availability-heading">Your availability</h2><p>Select all your regular working days, set the hours once, and save the weekly schedule. You can still update an individual day later.</p></div>
        <div className={styles.authForm}>
          <form onSubmit={async (event) => { event.preventDefault(); setAvailabilityBusy(true); setAvailabilityError(''); const formElement = event.currentTarget; const form = new FormData(formElement); try { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const selectedDays = form.getAll('daysOfWeek').map(value => Number(value)); const response = await fetch('/api/barber/availability/hours/bulk', { method: 'PUT', headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify({ daysOfWeek: selectedDays, weekStartDate: scheduleWeek, startTime: String(form.get('startTime')), endTime: String(form.get('endTime')) }) }); if (!response.ok) throw new Error(response.status === 403 ? 'You must be an approved barber before setting availability.' : response.status === 400 ? 'Select at least one day and make sure the end time is after the start time.' : 'Unable to save these hours.'); const saved = await response.json() as WorkingHour[]; setWorkingHours([...workingHours.filter(item => !selectedDays.includes(item.dayOfWeek)), ...saved].sort((a, b) => a.dayOfWeek - b.dayOfWeek)); formElement.reset() } catch (error) { setAvailabilityError(error instanceof Error ? error.message : 'Unable to save availability.') } finally { setAvailabilityBusy(false) } }}>
            <label>Week starting (Monday)<input name="weekStartDate" type="date" value={scheduleWeek} onChange={async (event) => { const week = mondayFor(event.currentTarget.value); setScheduleWeek(week); setAvailabilityError(''); const response = await fetch(`/api/barber/availability/hours?weekStartDate=${week}`); if (response.ok) setWorkingHours(await response.json() as WorkingHour[]) }} required /></label><fieldset><legend>Working days</legend>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => <label key={day}><input name="daysOfWeek" type="checkbox" value={index + 1} defaultChecked={index < 6} /> {day}</label>)}</fieldset><label>Start time<input name="startTime" type="time" defaultValue="09:00" required /></label><label>End time<input name="endTime" type="time" defaultValue="17:00" required /></label><button className={styles.submit} disabled={availabilityBusy}>{availabilityBusy ? 'Saving...' : 'Save weekly schedule'}</button>
          </form>
          {workingHours.length > 0 && <div className={styles.accountCard}><p className={styles.status}>Weekly hours</p>{workingHours.map(item => <p key={item.id}>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][item.dayOfWeek - 1]} - {item.startTime.slice(0, 5)}-{item.endTime.slice(0, 5)}</p>)}</div>}
          <form onSubmit={async (event) => { event.preventDefault(); setAvailabilityBusy(true); setAvailabilityError(''); const formElement = event.currentTarget; const form = new FormData(formElement); const customHours = form.get('specialType') === 'custom'; const specialDate = String(form.get('date')); try { const targetWeek = mondayFor(specialDate); const scheduleResponse = await fetch(`/api/barber/availability/hours?weekStartDate=${targetWeek}`); const targetHours = scheduleResponse.ok ? await scheduleResponse.json() as WorkingHour[] : []; const day = new Date(`${specialDate}T00:00:00Z`).getUTCDay() || 7; if (!targetHours.some(item => item.dayOfWeek === day)) throw new Error('A special date can only be added for a weekday marked as working in that week.'); const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch('/api/barber/availability/days-off', { method: 'POST', headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify({ date: specialDate, startTime: customHours ? String(form.get('specialStart')) : null, endTime: customHours ? String(form.get('specialEnd')) : null, reason: String(form.get('reason') ?? '') }) }); if (!response.ok) throw new Error(response.status === 409 ? 'A special schedule already exists for this date.' : response.status === 400 ? 'Enter both special times and make sure the end time is after the start time.' : 'Unable to save the special schedule.'); setDaysOff([...daysOff, await response.json() as DayOff].sort((a, b) => a.date.localeCompare(b.date))); formElement.reset() } catch (error) { setAvailabilityError(error instanceof Error ? error.message : 'Unable to save the special schedule.') } finally { setAvailabilityBusy(false) } }}><p className={styles.status}>Special date schedule</p><label>Date<input name="date" type="date" required /></label><label>Type<select name="specialType" defaultValue="off"><option value="off">Unavailable all day</option><option value="custom">Custom hours</option></select></label><label>Special start time<input name="specialStart" type="time" /></label><label>Special end time<input name="specialEnd" type="time" /></label><label>Reason<input name="reason" maxLength={255} /></label><button className={styles.submit} disabled={availabilityBusy}>{availabilityBusy ? 'Saving...' : 'Save special date'}</button></form>
          {daysOff.length > 0 && <div className={styles.accountCard}><p className={styles.status}>Special date schedules</p>{daysOff.map(item => <p key={item.id}>{item.date} · {item.startTime && item.endTime ? `${item.startTime.slice(0, 5)}-${item.endTime.slice(0, 5)}` : 'Unavailable all day'} {item.reason && `- ${item.reason}`} <button type="button" onClick={async () => { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch(`/api/barber/availability/days-off/${item.id}`, { method: 'DELETE', headers: { [csrf.headerName]: csrf.token } }); if (response.ok) setDaysOff(daysOff.filter(day => day.id !== item.id)) }}>Remove</button></p>)}</div>}
          {availabilityError && <p className={styles.error} role="alert">{availabilityError}</p>}
        </div>
      </section>}
      {account && <section className={styles.authSection} aria-labelledby="slots-heading">
        <div><p className={styles.eyebrow}>FEATURE 07 / 12</p><h2 id="slots-heading">Find an appointment slot</h2><p>Choose a salon, one or more services, add-ons, and date. Slots include the complete combined duration and price.</p></div>
        <div className={styles.authForm}><form onSubmit={async (event) => { event.preventDefault(); setSlotBusy(true); setSlotError(''); try { const params = new URLSearchParams({ salonId: slotSalonId, date: slotDate }); slotServiceIds.forEach(id => params.append('serviceIds', String(id))); slotAddonIds.forEach(id => params.append('addonIds', String(id))); const response = await fetch(`/api/slots?${params.toString()}`); if (!response.ok) throw new Error(response.status === 400 ? 'Select at least one service and check the selected add-ons and date.' : 'Unable to calculate slots.'); setSlots(await response.json() as Slot[]) } catch (error) { setSlotError(error instanceof Error ? error.message : 'Unable to calculate slots.') } finally { setSlotBusy(false) } }}>
          <label>Salon<select value={slotSalonId} onChange={async (event) => { const id = event.currentTarget.value; setSlotSalonId(id); setSlotServiceIds([]); setSlotAddonIds([]); setSlotAddons([]); setSlots([]); if (!id) { setSlotServices([]); return } const response = await fetch(`/api/salons/${id}/services`); if (response.ok) setSlotServices(await response.json() as SalonService[]) }} required><option value="" disabled>Select a salon</option>{directorySalons.map(item => <option key={item.id} value={item.id}>{item.name} - {item.address}</option>)}</select></label>
          <fieldset><legend>Services</legend>{slotServices.filter(item => item.active).length === 0 && <p>Select a salon to view active services.</p>}{slotServices.filter(item => item.active).map(item => <label key={item.id}><input type="checkbox" checked={slotServiceIds.includes(item.id)} onChange={async (event) => { const selected = event.currentTarget.checked ? [...slotServiceIds, item.id] : slotServiceIds.filter(id => id !== item.id); setSlotServiceIds(selected); setSlotAddonIds([]); setSlots([]); if (selected.length === 0 || !slotSalonId) { setSlotAddons([]); return } const responses = await Promise.all(selected.map(serviceId => fetch(`/api/salons/${slotSalonId}/services/${serviceId}/addons`))); const addonLists = await Promise.all(responses.filter(response => response.ok).map(response => response.json() as Promise<AddOn[]>)); const merged = addonLists.flat().filter((addon, index, all) => all.findIndex(candidate => candidate.id === addon.id) === index); setSlotAddons(merged) }} /> {item.name} - ₹{item.price} - {item.durationMinutes} minutes</label>)}</fieldset>
          {slotAddons.length > 0 && <fieldset><legend>Add-ons</legend>{slotAddons.map(item => <label key={item.id}><input type="checkbox" checked={slotAddonIds.includes(item.id)} onChange={(event) => { setSlotAddonIds(event.currentTarget.checked ? [...slotAddonIds, item.id] : slotAddonIds.filter(id => id !== item.id)); setSlots([]) }} /> {item.name} - ₹{item.price} - +{item.durationMinutes} minutes</label>)}</fieldset>}
          <label>Date<input type="date" value={slotDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => { setSlotDate(event.currentTarget.value); setSlots([]) }} required /></label>{slotError && <p className={styles.error} role="alert">{slotError}</p>}<button className={styles.submit} disabled={slotBusy || !slotSalonId || slotServiceIds.length === 0}>{slotBusy ? 'Finding...' : 'Find available slots'}</button>
        </form>
        {slots.length > 0 && <div className={styles.accountCard}><p className={styles.status}>Available slots</p>{slots.map(slot => <p key={`${slot.date}-${slot.startTime}`}><strong>{slot.startTime.slice(0, 5)}-{slot.endTime.slice(0, 5)}</strong> · {slot.durationMinutes} minutes · ₹{slot.totalPrice} <button type="button" disabled={bookingBusy} onClick={async () => { setBookingBusy(true); setBookingError(''); try { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch('/api/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify({ salonId: Number(slotSalonId), serviceIds: slotServiceIds, addonIds: slotAddonIds, date: slot.date, startTime: slot.startTime }) }); if (!response.ok) throw new Error(response.status === 409 ? 'That slot was just taken. Search again.' : 'Unable to confirm this appointment.'); const appointment = await response.json() as Appointment; setAppointments([appointment, ...appointments]); setSlots(slots.filter(item => item.startTime !== slot.startTime)); setBookingError(''); } catch (error) { setBookingError(error instanceof Error ? error.message : 'Unable to confirm this appointment.') } finally { setBookingBusy(false) } }}>{bookingBusy ? 'Booking...' : 'Book this time'}</button></p>)}</div>}
        {bookingError && <p className={styles.error} role="alert">{bookingError}</p>}
        {appointments.length > 0 && <div className={styles.accountCard}><p className={styles.status}>Your appointments</p>{appointments.map(item => <p key={item.bookingReference}><strong>{item.date} · {item.startTime.slice(0, 5)}-{item.endTime.slice(0, 5)}</strong> · {item.salonName} · {item.serviceName} · ₹{item.totalPrice} · {item.status}<br />Assigned barber: <strong>{item.barberName}</strong>{item.addonSummary && ` · Add-ons: ${item.addonSummary}`}</p>)}</div>}
        {slotSalonId && slotServiceIds.length > 0 && !slotBusy && slots.length === 0 && !slotError && <p>No matching slots were found for this date.</p>}
        </div>
      </section>}      <footer>Trim-Time <span>Built with care. Developed step by step.</span></footer>
    </main>
  )
}
