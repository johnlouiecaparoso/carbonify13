import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/supabaseClient', () => ({
  getSupabase: vi.fn(),
}))

import { requestWithdrawal } from '@/services/payoutService'
import { getSupabase } from '@/services/supabaseClient'

const goodDestination = {
  method: 'gcash',
  accountName: 'Jane Seller',
  accountNumber: '09171234567',
}

describe('requestWithdrawal validation', () => {
  let rpc
  beforeEach(() => {
    vi.clearAllMocks()
    rpc = vi.fn().mockResolvedValue({ data: 'payout_123', error: null })
    getSupabase.mockReturnValue({ rpc })
  })

  it('rejects a non-positive amount before hitting the RPC', async () => {
    await expect(requestWithdrawal({ amount: 0, destination: goodDestination })).rejects.toThrow(/positive amount/)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects an incomplete destination', async () => {
    await expect(
      requestWithdrawal({ amount: 500, destination: { method: 'gcash' } }),
    ).rejects.toThrow(/account name and account number/i)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('requires a bankCode for bank withdrawals', async () => {
    await expect(
      requestWithdrawal({
        amount: 500,
        destination: { method: 'bank', accountName: 'X', accountNumber: '123' },
      }),
    ).rejects.toThrow(/bank code/i)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('calls request_payout with the amount, destination and idempotency key on a valid request', async () => {
    const id = await requestWithdrawal({ amount: 500, destination: goodDestination, idempotencyKey: 'idem_1' })
    expect(id).toBe('payout_123')
    expect(rpc).toHaveBeenCalledWith('request_payout', {
      p_amount: 500,
      p_destination: goodDestination,
      p_idempotency_key: 'idem_1',
    })
  })

  it('passes a null idempotency key when none is supplied', async () => {
    await requestWithdrawal({ amount: 500, destination: goodDestination })
    expect(rpc).toHaveBeenCalledWith(
      'request_payout',
      expect.objectContaining({ p_idempotency_key: null }),
    )
  })

  it('surfaces an RPC error', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'insufficient balance' } })
    await expect(requestWithdrawal({ amount: 500, destination: goodDestination })).rejects.toThrow(
      /insufficient balance/,
    )
  })

  it('throws when the supabase client is unavailable', async () => {
    getSupabase.mockReturnValueOnce(null)
    await expect(requestWithdrawal({ amount: 500, destination: goodDestination })).rejects.toThrow(
      /client not available/i,
    )
  })
})
