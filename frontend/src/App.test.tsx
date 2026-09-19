import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
