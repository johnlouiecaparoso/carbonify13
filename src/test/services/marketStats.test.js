import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/supabaseClient', () => ({
  getSupabase: vi.fn(),
}))

import { getMarketStats } from '@/services/registryService'
import { getSupabase } from '@/services/supabaseClient'

describe('getMarketStats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps the RPC payload to numbers', async () => {
    getSupabase.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: {
          active_listings: '4',
          credits_available: '120',
          avg_price: '85.5',
          min_price: '50',
          max_price: '120',
          total_retired: '30',
          total_issued: '150',
          listed_projects: '3',
        },
        error: null,
      }),
    })

    const s = await getMarketStats()
    expect(s.active_listings).toBe(4)
    expect(s.avg_price).toBe(85.5)
    expect(s.total_retired).toBe(30)
    expect(s.listed_projects).toBe(3)
  })

  it('returns zeroed defaults on RPC error', async () => {
    getSupabase.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'missing function' } }),
    })
    const s = await getMarketStats()
    expect(s).toEqual({
      active_listings: 0,
      credits_available: 0,
      avg_price: 0,
      min_price: 0,
      max_price: 0,
      total_retired: 0,
      total_issued: 0,
      listed_projects: 0,
    })
  })

  it('returns zeroed defaults when supabase is unavailable', async () => {
    getSupabase.mockReturnValue(null)
    const s = await getMarketStats()
    expect(s.total_issued).toBe(0)
  })
})
