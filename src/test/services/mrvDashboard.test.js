import { describe, it, expect } from 'vitest'
import { aggregateMrvDashboard } from '@/services/mrvDashboardService'

// Fixed "now" for deterministic compliance math: 2026-07-08.
const NOW = new Date('2026-07-08T00:00:00Z').getTime()

describe('aggregateMrvDashboard', () => {
  it('returns an empty dashboard for no input', () => {
    const d = aggregateMrvDashboard()
    expect(d.totals.projects).toBe(0)
    expect(d.totals.reportsTotal).toBe(0)
    expect(d.perProject).toEqual([])
    expect(d.trend.labels).toEqual([])
  })

  it('tallies report statuses and sums proposed/verified/pending VERs', () => {
    const d = aggregateMrvDashboard({
      projects: [{ id: 'p1', title: 'Rice', category: 'Biochar & Bio-briquettes', created_at: '2026-01-01' }],
      reports: [
        { id: 'r1', project_id: 'p1', status: 'approved', proposed_vers: 100, period_end: '2026-03-31' },
        { id: 'r2', project_id: 'p1', status: 'submitted', proposed_vers: 40, period_end: '2026-06-30' },
        { id: 'r3', project_id: 'p1', status: 'draft', proposed_vers: 0, created_at: '2026-07-01' },
      ],
      vers: [
        { project_id: 'p1', approved_quantity: 90, status: 'approved', approved_at: '2026-04-10' },
        { project_id: 'p1', approved_quantity: 30, status: 'pending', created_at: '2026-07-01' },
      ],
      now: NOW,
    })
    expect(d.totals.byStatus.approved).toBe(1)
    expect(d.totals.byStatus.submitted).toBe(1)
    expect(d.totals.byStatus.draft).toBe(1)
    expect(d.totals.proposedVers).toBe(140)
    expect(d.totals.verifiedVers).toBe(90)
    expect(d.totals.pendingVers).toBe(30)
    expect(d.totals.projectsReporting).toBe(1)
  })

  it('sums activity data per metric with labels, sorted desc', () => {
    const d = aggregateMrvDashboard({
      projects: [{ id: 'p1' }],
      reports: [{ id: 'r1', project_id: 'p1', status: 'approved', proposed_vers: 10 }],
      activity: [
        { report_id: 'r1', metric_key: 'biochar_tonnes', value: 5, unit: 'tonnes' },
        { report_id: 'r1', metric_key: 'biochar_tonnes', value: 3, unit: 'tonnes' },
        { report_id: 'r1', metric_key: 'energy_kwh', value: 1000, unit: 'kWh' },
      ],
      now: NOW,
    })
    expect(d.metricTotals).toHaveLength(2)
    expect(d.metricTotals[0]).toMatchObject({ metric_key: 'energy_kwh', value: 1000 })
    const biochar = d.metricTotals.find((m) => m.metric_key === 'biochar_tonnes')
    expect(biochar.value).toBe(8)
    expect(biochar.label).toBe('Biochar produced') // from METRICS_BY_TYPE
  })

  it('builds a monthly proposed-vs-verified trend, sorted chronologically', () => {
    const d = aggregateMrvDashboard({
      projects: [{ id: 'p1' }],
      reports: [
        { id: 'r1', project_id: 'p1', status: 'approved', proposed_vers: 50, period_end: '2026-03-31' },
        { id: 'r2', project_id: 'p1', status: 'approved', proposed_vers: 70, period_end: '2026-06-30' },
      ],
      vers: [{ project_id: 'p1', approved_quantity: 45, status: 'approved', approved_at: '2026-04-15' }],
      now: NOW,
    })
    expect(d.trend.labels).toEqual(['Mar 2026', 'Apr 2026', 'Jun 2026'])
    expect(d.trend.proposed).toEqual([50, 0, 70])
    expect(d.trend.verified).toEqual([0, 45, 0])
  })

  it('classifies compliance vs cadence (overdue / due_soon / on_track)', () => {
    const d = aggregateMrvDashboard({
      cadenceDays: 365,
      now: NOW,
      projects: [
        { id: 'overdue', title: 'Overdue', created_at: '2024-01-01' }, // last report long ago
        { id: 'soon', title: 'Soon' },
        { id: 'ok', title: 'OK' },
      ],
      reports: [
        { id: 'ro', project_id: 'overdue', status: 'approved', period_end: '2024-06-30' }, // +365d = 2025 → overdue
        { id: 'rs', project_id: 'soon', status: 'approved', period_end: '2025-07-20' }, // +365d ≈ 2026-07-20 → due soon
        { id: 'rk', project_id: 'ok', status: 'approved', period_end: '2026-06-30' }, // +365d = 2027 → on track
      ],
    })
    expect(d.compliance).toEqual({ overdue: 1, due_soon: 1, on_track: 1 })
    // Sorted most-urgent first.
    expect(d.perProject.map((p) => p.projectId)).toEqual(['overdue', 'soon', 'ok'])
    expect(d.perProject[0].compliance.state).toBe('overdue')
    expect(d.perProject[0].compliance.daysUntil).toBeLessThan(0)
  })

  it('marks a project that never reported and still dates it from project creation', () => {
    const d = aggregateMrvDashboard({
      cadenceDays: 365,
      now: NOW,
      projects: [{ id: 'p1', title: 'Silent', created_at: '2024-01-01' }],
      reports: [],
    })
    const row = d.perProject[0]
    expect(row.reportsCount).toBe(0)
    expect(row.compliance.hasEverReported).toBe(false)
    expect(row.compliance.state).toBe('overdue') // created 2024, cadence 365d → overdue by 2026
    expect(d.totals.projectsReporting).toBe(0)
  })
})
