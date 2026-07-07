import { describe, it, expect } from 'vitest'
import { buildEsgDataset, toCsv } from '@/services/esgReportService'

function fakeService() {
  return {
    getUserCreditPortfolio: async () => [
      { project_title: 'Mangrove A', project_category: 'Blue Carbon', quantity: 10, ownership_status: 'owned' },
      { project_title: 'Solar B', project_category: 'Renewable', quantity: 5, ownership_status: 'owned' },
      { project_title: 'Solar B', project_category: 'Renewable', quantity: 3, ownership_status: 'retired' },
    ],
    getUserTransactionHistory: async () => [
      { type: 'purchase', project_title: 'Mangrove A', project_category: 'Blue Carbon', quantity: 10 },
      { type: 'purchase', project_title: 'Solar B', project_category: 'Renewable', quantity: 8 },
      { type: 'retirement', project_title: 'Solar B', project_category: 'Renewable', quantity: 3 },
    ],
  }
}

describe('buildEsgDataset', () => {
  it('aggregates owned + retired credits into tCO2e totals and groupings', async () => {
    const data = await buildEsgDataset('user_1', { service: fakeService() })

    expect(data.totals.ownedCredits).toBe(15) // 10 + 5 (retired excluded from owned)
    expect(data.totals.retiredCredits).toBe(3)
    expect(data.totals.purchasedCredits).toBe(18)
    expect(data.totals.ownedTco2e).toBe(15)
    expect(data.totals.retiredTco2e).toBe(3)

    const mangrove = data.byProject.find((r) => r.label === 'Mangrove A')
    expect(mangrove.credits).toBe(10)
    const solar = data.byProject.find((r) => r.label === 'Solar B')
    expect(solar.credits).toBe(8) // 5 owned + 3 retired

    const blue = data.byCategory.find((r) => r.label === 'Blue Carbon')
    expect(blue.tco2e).toBe(10)
  })
})

describe('toCsv', () => {
  const cols = [
    { key: 'label', header: 'Project' },
    { key: 'credits', header: 'Credits' },
  ]

  it('emits a header even with no rows', () => {
    expect(toCsv([], cols)).toBe('Project,Credits')
  })

  it('quotes fields containing commas, quotes, or newlines (RFC-4180)', () => {
    const csv = toCsv(
      [
        { label: 'Plain', credits: 1 },
        { label: 'Has, comma', credits: 2 },
        { label: 'Has "quote"', credits: 3 },
        { label: 'Has\nnewline', credits: 4 },
      ],
      cols,
    )
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('Project,Credits')
    expect(lines[1]).toBe('Plain,1')
    expect(lines[2]).toBe('"Has, comma",2')
    expect(lines[3]).toBe('"Has ""quote""",3')
    expect(csv).toContain('"Has\nnewline",4')
  })
})
