import { describe, it, expect, vi, beforeEach } from 'vitest'

// NOTE: This suite was previously testing a non-existent functional API
// (initializePayment/confirmPayment/calculatePaymentFees/getAvailableProviders)
// via fake inline stubs, so it asserted behavior that exists nowhere in the
// codebase. It has been rewritten to exercise the real `PaymentService` class
// in src/services/paymentService.js. The payment layer is slated for a rebuild
// in Phase 1 (server-side amounts + provider abstraction); update these tests
// alongside that work.

vi.mock('@/services/auditService', () => ({
  logUserAction: vi.fn(),
}))

vi.mock('@/services/supabaseClient', () => ({
  getSupabase: vi.fn(),
}))

import { PaymentService } from '@/services/paymentService'
import { getSupabase } from '@/services/supabaseClient'

describe('PaymentService', () => {
  let service
  let mockSupabase

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = { from: vi.fn() }
    getSupabase.mockReturnValue(mockSupabase)
    service = new PaymentService()
  })

  describe('processPayment', () => {
    it('returns a completed result echoing the requested amount and currency', async () => {
      const result = await service.processPayment({ amount: 500, currency: 'PHP' })

      expect(result.success).toBe(true)
      expect(result.status).toBe('completed')
      expect(result.amount).toBe(500)
      expect(result.currency).toBe('PHP')
      expect(result.transactionId).toMatch(/^pay_/)
    })
  })

  describe('recordTransaction', () => {
    it('inserts a wallet transaction and returns the created row', async () => {
      const inserted = { id: 'txn_1', amount: 100 }
      const single = vi.fn().mockResolvedValue({ data: inserted, error: null })
      const select = vi.fn().mockReturnValue({ single })
      const insert = vi.fn().mockReturnValue({ select })
      mockSupabase.from.mockReturnValue({ insert })

      const result = await service.recordTransaction({
        userId: 'u1',
        amount: 100,
        transactionId: 'ref_1',
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('wallet_transactions')
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'u1', amount: 100, reference_id: 'ref_1' }),
      )
      expect(result).toEqual(inserted)
    })

    it('throws when the insert fails', async () => {
      const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
      const select = vi.fn().mockReturnValue({ single })
      const insert = vi.fn().mockReturnValue({ select })
      mockSupabase.from.mockReturnValue({ insert })

      await expect(
        service.recordTransaction({ userId: 'u1', amount: 100 }),
      ).rejects.toThrow('Failed to record payment')
    })

    it('returns null when the Supabase client is unavailable', async () => {
      getSupabase.mockReturnValue(null)

      const result = await service.recordTransaction({ userId: 'u1', amount: 100 })

      expect(result).toBeNull()
    })
  })

  describe('getUserPayments', () => {
    it('returns the user transactions ordered by created_at', async () => {
      const rows = [{ id: 'a' }, { id: 'b' }]
      const order = vi.fn().mockResolvedValue({ data: rows, error: null })
      const eq = vi.fn().mockReturnValue({ order })
      const select = vi.fn().mockReturnValue({ eq })
      mockSupabase.from.mockReturnValue({ select })

      const result = await service.getUserPayments('u1')

      expect(eq).toHaveBeenCalledWith('user_id', 'u1')
      expect(result).toEqual(rows)
    })

    it('returns an empty array on query error', async () => {
      const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'nope' } })
      const eq = vi.fn().mockReturnValue({ order })
      const select = vi.fn().mockReturnValue({ eq })
      mockSupabase.from.mockReturnValue({ select })

      const result = await service.getUserPayments('u1')

      expect(result).toEqual([])
    })
  })

  describe('refundPayment', () => {
    it('throws when the original transaction is not found', async () => {
      const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'missing' } })
      const eq = vi.fn().mockReturnValue({ single })
      const select = vi.fn().mockReturnValue({ eq })
      mockSupabase.from.mockReturnValue({ select })

      await expect(
        service.refundPayment('ref_1', 50, 'duplicate charge'),
      ).rejects.toThrow('Original transaction not found')
    })
  })
})
