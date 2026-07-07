import { describe, it, expect } from 'vitest'
import { aggregateSalesByProject } from '@/services/payoutService'

describe('aggregateSalesByProject', () => {
  it('returns an empty array for no rows', () => {
    expect(aggregateSalesByProject([])).toEqual([])
    expect(aggregateSalesByProject()).toEqual([])
  })

  it('groups completed sales per project and sums credits + gross', () => {
    const rows = [
      { project_id: 'p1', project_title: 'Mangrove', quantity: 10, total_amount: 500, status: 'completed', date: '2026-06-01' },
      { project_id: 'p1', project_title: 'Mangrove', quantity: 5, total_amount: 250, status: 'completed', date: '2026-06-10' },
      { project_id: 'p2', project_title: 'Solar', quantity: 2, total_amount: 100, status: 'completed', date: '2026-06-05' },
    ]
    const r = aggregateSalesByProject(rows)
    expect(r).toHaveLength(2)
    const p1 = r.find((x) => x.projectId === 'p1')
    expect(p1.salesCount).toBe(2)
    expect(p1.creditsSold).toBe(15)
    expect(p1.grossEarnings).toBe(750)
    expect(p1.lastSaleDate).toBe('2026-06-10') // most recent of the two
  })

  it('excludes non-completed sales (pending/refunded)', () => {
    const rows = [
      { project_id: 'p1', project_title: 'Mangrove', quantity: 10, total_amount: 500, status: 'completed', date: '2026-06-01' },
      { project_id: 'p1', project_title: 'Mangrove', quantity: 5, total_amount: 250, status: 'refunded', date: '2026-06-02' },
      { project_id: 'p1', project_title: 'Mangrove', quantity: 3, total_amount: 150, status: 'pending', date: '2026-06-03' },
    ]
    const r = aggregateSalesByProject(rows)
    expect(r).toHaveLength(1)
    expect(r[0].salesCount).toBe(1)
    expect(r[0].creditsSold).toBe(10)
    expect(r[0].grossEarnings).toBe(500)
  })

  it('sorts by gross earnings, highest first', () => {
    const rows = [
      { project_id: 'small', project_title: 'A', quantity: 1, total_amount: 100, status: 'completed' },
      { project_id: 'big', project_title: 'B', quantity: 1, total_amount: 900, status: 'completed' },
      { project_id: 'mid', project_title: 'C', quantity: 1, total_amount: 400, status: 'completed' },
    ]
    const r = aggregateSalesByProject(rows)
    expect(r.map((x) => x.projectId)).toEqual(['big', 'mid', 'small'])
  })

  it('falls back gracefully on missing project id/title and rounds money', () => {
    const rows = [
      { quantity: 2, total_amount: 33.335, status: 'completed' },
    ]
    const r = aggregateSalesByProject(rows)
    expect(r[0].projectId).toBe('unknown')
    expect(r[0].projectTitle).toBe('Unknown Project')
    expect(r[0].grossEarnings).toBe(33.34)
  })
})
