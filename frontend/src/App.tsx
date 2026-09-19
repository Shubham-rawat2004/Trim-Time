import { useEffect, useState } from 'react'
import styles from './App.module.css'

type Connection = 'checking' | 'connected' | 'unavailable'
type Account = { id: number; email: string; displayName: string; roles: string[] }
type Salon = { id: number; ownerId: number; name: string; description: string; address: string; contact: string; timezone: string }
type BarberApplication = { id: number; barberUserId: number; barberName: string; salonId: number; salonName: string; message: string; status: string; createdAt: string }
type DirectorySalon = { id: number; name: string; description: string; address: string; contact: string; ownerName: string }
type SalonService = { id: number; salonId: number; name: string; description: string; price: number; durationMinutes: number; active: boolean }
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
  const [directorySalons, setDirectorySalons] = useState<DirectorySalon[]>([])
  const [services, setServices] = useState<SalonService[]>([])
  const [selectedSalonServices, setSelectedSalonServices] = useState<SalonService[]>([])
  const [serviceError, setServiceError] = useState('')
  const [serviceBusy, setServiceBusy] = useState(false)
  const [barberError, setBarberError] = useState('')
  const [barberBusy, setBarberBusy] = useState(false)
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
      const catalogue = await fetch('/api/salons/mine/services')
      if (catalogue?.ok) setServices(await catalogue.json() as SalonService[])
    } catch (error) { setAuthError(error instanceof Error ? error.message : 'Unable to complete the request.') }
    finally { setAuthBusy(false) }
  }

  async function logout() {
    try {
      const csrfResponse = await fetch('/api/auth/csrf')
      const csrf = await csrfResponse.json() as { token: string; headerName: string }
      await fetch('/api/auth/logout', { method: 'POST', headers: { [csrf.headerName]: csrf.token } })
    } finally {
      setAccount(null); setSalon(null); setApplications([]); setOwnerApplications([]); setDirectorySalons([]); setServices([]); setSelectedSalonServices([]); setAuthError(''); setBarberError('')
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
        {account ? <div className={styles.accountCard}><p className={styles.status}>Signed in</p><h3>{account.displayName}</h3><p>{account.email}</p><span>{account.roles.join(' · ')}</span><button type="button" className={styles.secondaryButton} onClick={logout}>Log out</button></div> : <form className={styles.authForm} onSubmit={authenticate}>
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
        {salon ? (editingSalon ? <form className={styles.authForm} onSubmit={async (event) => { event.preventDefault(); setSalonBusy(true); setSalonError(''); const form = new FormData(event.currentTarget); try { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch('/api/salons/mine', { method: 'PUT', headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify({ name: String(form.get('name')), description: String(form.get('description') ?? ''), address: String(form.get('address')), contact: String(form.get('contact')), timezone: String(form.get('timezone') || 'Asia/Kolkata') }) }); if (!response.ok) throw new Error('Unable to update the salon.'); setSalon(await response.json() as Salon); setEditingSalon(false) } catch (error) { setSalonError(error instanceof Error ? error.message : 'Unable to update the salon.') } finally { setSalonBusy(false) } }}><label>Salon name<input name="name" defaultValue={salon.name} required maxLength={160} /></label><label>Address<input name="address" defaultValue={salon.address} required maxLength={255} /></label><label>Contact<input name="contact" defaultValue={salon.contact} required maxLength={40} /></label><label>Description<input name="description" defaultValue={salon.description} maxLength={500} /></label><label>Timezone<input name="timezone" defaultValue={salon.timezone} required /></label>{salonError && <p className={styles.error} role="alert">{salonError}</p>}<button className={styles.submit} disabled={salonBusy}>{salonBusy ? 'Saving...' : 'Save changes'}</button><button type="button" className={styles.secondaryButton} onClick={() => setEditingSalon(false)}>Cancel</button></form> : <div className={styles.accountCard}><p className={styles.status}>Salon created</p><h3>{salon.name}</h3><p>{salon.address} · {salon.contact}</p><span>{salon.timezone}</span><button type="button" className={styles.secondaryButton} onClick={() => setEditingSalon(true)}>Edit salon</button></div>) : <form className={styles.authForm} onSubmit={async (event) => { event.preventDefault(); setSalonBusy(true); setSalonError(''); const form = new FormData(event.currentTarget); try { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch('/api/salons', { method: 'POST', headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify({ name: String(form.get('name')), description: String(form.get('description') ?? ''), address: String(form.get('address')), contact: String(form.get('contact')), timezone: String(form.get('timezone') || 'Asia/Kolkata') }) }); if (!response.ok) throw new Error(response.status === 409 ? 'This account already owns a salon.' : 'Unable to create the salon.'); setSalon(await response.json() as Salon); const refreshed = await fetch('/api/auth/me'); if (refreshed.ok) setAccount(await refreshed.json() as Account) } catch (error) { setSalonError(error instanceof Error ? error.message : 'Unable to create the salon.') } finally { setSalonBusy(false) } }}>
          <label>Salon name<input name="name" required maxLength={160} /></label><label>Address<input name="address" required maxLength={255} /></label><label>Contact<input name="contact" required maxLength={40} /></label><label>Description<input name="description" maxLength={500} /></label><label>Timezone<input name="timezone" defaultValue="Asia/Kolkata" required /></label>{salonError && <p className={styles.error} role="alert">{salonError}</p>}<button className={styles.submit} disabled={salonBusy}>{salonBusy ? 'Creating...' : 'Create salon'}</button>
        </form>}
      </section>}
      {account && <section className={styles.authSection} aria-labelledby="barber-heading">
        <div><p className={styles.eyebrow}>FEATURE 03 / 12</p><h2 id="barber-heading">Barber onboarding</h2><p>Barbers apply to join a salon. Owners review pending applications and approve or reject them.</p></div>
        <div className={styles.authForm}>
          <form onSubmit={async (event) => { event.preventDefault(); setBarberBusy(true); setBarberError(''); const form = new FormData(event.currentTarget); try { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch(`/api/barber/applications/${String(form.get('salonId'))}`, { method: 'POST', headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify({ message: String(form.get('message') ?? ''), bio: String(form.get('bio') ?? ''), experienceYears: Number(form.get('experienceYears') || 0) }) }); if (!response.ok) throw new Error(response.status === 409 ? 'You already have a pending request or salon membership.' : 'Unable to submit the application.'); setApplications([await response.json() as BarberApplication, ...applications]) } catch (error) { setBarberError(error instanceof Error ? error.message : 'Unable to submit the application.') } finally { setBarberBusy(false) } }}>
            <label>Choose a salon<select name="salonId" required defaultValue="" onChange={async (event) => { const salonId = event.currentTarget.value; setSelectedSalonServices([]); if (!salonId) return; const response = await fetch(`/api/salons/${salonId}/services`); if (response.ok) setSelectedSalonServices(await response.json() as SalonService[]) }}><option value="" disabled>Select a salon</option>{directorySalons.map(item => <option key={item.id} value={item.id}>{item.name} — {item.address} · Owner: {item.ownerName}</option>)}</select></label>{selectedSalonServices.length > 0 && <div className={styles.accountCard}><p className={styles.status}>Active services at this salon</p>{selectedSalonServices.map(item => <p key={item.id}><strong>{item.name}</strong> · ₹{item.price} · {item.durationMinutes} minutes</p>)}</div>}{selectedSalonServices.length === 0 && directorySalons.length > 0 && <p>Select a salon to view its active services.</p>}<label>Experience (years)<input name="experienceYears" type="number" min="0" max="80" defaultValue="0" /></label><label>Short bio<input name="bio" maxLength={1000} /></label><label>Message to owner<input name="message" maxLength={1000} /></label>{directorySalons.length === 0 && <p>No active salons are available yet.</p>}{barberError && <p className={styles.error} role="alert">{barberError}</p>}<button className={styles.submit} disabled={barberBusy || directorySalons.length === 0}>{barberBusy ? 'Submitting...' : 'Apply to join salon'}</button>
          </form>
          {applications.length > 0 && <div className={styles.accountCard}><p className={styles.status}>Your applications</p>{applications.map(application => <p key={application.id}>{application.salonName} · <strong>{application.status}</strong></p>)}</div>}
          {ownerApplications.length > 0 && <div className={styles.accountCard}><p className={styles.status}>Pending owner approvals</p>{ownerApplications.map(application => <p key={application.id}>{application.barberName} · {application.message || 'No message'} <button type="button" onClick={async () => { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch(`/api/salons/mine/barber-applications/${application.id}/approve`, { method: 'POST', headers: { [csrf.headerName]: csrf.token } }); if (response.ok) setOwnerApplications(ownerApplications.filter(item => item.id !== application.id)) }}>Approve</button> <button type="button" onClick={async () => { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch(`/api/salons/mine/barber-applications/${application.id}/reject`, { method: 'POST', headers: { [csrf.headerName]: csrf.token } }); if (response.ok) setOwnerApplications(ownerApplications.filter(item => item.id !== application.id)) }}>Reject</button></p>)}</div>}
        </div>
      </section>}
      {account?.roles.includes('SALON_OWNER') && salon && <section className={styles.authSection} aria-labelledby="services-heading">
        <div><p className={styles.eyebrow}>FEATURE 04 / 12</p><h2 id="services-heading">Service catalogue</h2><p>Create the bookable services offered by {salon.name}. Each service records its price and estimated duration.</p></div>
        <div className={styles.authForm}><form onSubmit={async (event) => { event.preventDefault(); setServiceBusy(true); setServiceError(''); const form = new FormData(event.currentTarget); try { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch('/api/salons/mine/services', { method: 'POST', headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify({ name: String(form.get('name')), description: String(form.get('description') ?? ''), price: Number(form.get('price')), durationMinutes: Number(form.get('durationMinutes')) }) }); if (!response.ok) throw new Error(response.status === 409 ? 'A service with this name already exists.' : 'Unable to create the service.'); setServices([...services, await response.json() as SalonService]); event.currentTarget.reset() } catch (error) { setServiceError(error instanceof Error ? error.message : 'Unable to create the service.') } finally { setServiceBusy(false) } }}><label>Service name<input name="name" required maxLength={160} /></label><label>Description<input name="description" maxLength={1000} /></label><label>Price<input name="price" type="number" min="0" step="0.01" required /></label><label>Duration (minutes)<input name="durationMinutes" type="number" min="5" max="480" required /></label>{serviceError && <p className={styles.error} role="alert">{serviceError}</p>}<button className={styles.submit} disabled={serviceBusy}>{serviceBusy ? 'Adding...' : 'Add service'}</button></form>{services.length > 0 && <div className={styles.accountCard}><p className={styles.status}>Your services</p>{services.map(item => <p key={item.id}><strong>{item.name}</strong> · ₹{item.price} · {item.durationMinutes} minutes {item.active ? '' : '(inactive)'} <button type="button" onClick={async () => { const csrfResponse = await fetch('/api/auth/csrf'); const csrf = await csrfResponse.json() as { token: string; headerName: string }; const response = await fetch(`/api/salons/mine/services/${item.id}`, { method: 'DELETE', headers: { [csrf.headerName]: csrf.token } }); if (response.ok) setServices(services.map(service => service.id === item.id ? { ...service, active: false } : service)) }}>Deactivate</button></p>)}</div>}</div>
      </section>}
      <footer>Trim-Time <span>Built with care. Developed step by step.</span></footer>
    </main>
  )
}
