import { describe, it, expect } from 'vitest'
import {
  parseDocuments,
  documentLabel,
  formatSize,
  aggregateAccessLog,
} from '@/services/dataRoomService'

describe('parseDocuments', () => {
  it('parses a JSON string column', () => {
    const project = {
      supporting_documents: JSON.stringify([{ name: 'pdd.pdf', type: 'pdd', path: 'a/b.pdf' }]),
    }
    expect(parseDocuments(project)).toHaveLength(1)
  })

  it('accepts an already-parsed array', () => {
    expect(parseDocuments({ supporting_documents: [{ name: 'x.pdf', path: 'p' }] })).toHaveLength(1)
  })

  it('returns [] for null, malformed JSON, or a non-array', () => {
    expect(parseDocuments({ supporting_documents: null })).toEqual([])
    expect(parseDocuments({ supporting_documents: '{not json' })).toEqual([])
    expect(parseDocuments({ supporting_documents: '{"a":1}' })).toEqual([])
    expect(parseDocuments(undefined)).toEqual([])
  })

  it('drops entries with neither a path nor a url — they cannot be opened', () => {
    const docs = parseDocuments({
      supporting_documents: [{ name: 'ghost.pdf' }, { name: 'real.pdf', path: 'p' }],
    })
    expect(docs.map((d) => d.name)).toEqual(['real.pdf'])
  })

  it('attaches a human label to each document', () => {
    const docs = parseDocuments({ supporting_documents: [{ name: 'x.pdf', type: 'pdd', path: 'p' }] })
    expect(docs[0].label).toBe('Project Design Document (PDD)')
  })
})

describe('documentLabel', () => {
  it('labels known document types', () => {
    expect(documentLabel({ type: 'mrv_report' })).toBe('MRV Report')
    expect(documentLabel({ type: 'feasibility' })).toBe('Feasibility Study')
  })

  it('falls back to the file name, then a generic label', () => {
    expect(documentLabel({ name: 'random.pdf' })).toBe('random.pdf')
    expect(documentLabel({})).toBe('Document')
  })
})

describe('formatSize', () => {
  it('scales bytes to KB and MB', () => {
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(2048)).toBe('2 KB')
    expect(formatSize(5 * 1024 * 1024)).toBe('5 MB')
  })

  it('renders nothing for a missing size', () => {
    expect(formatSize(0)).toBe('')
    expect(formatSize(undefined)).toBe('')
  })
})

describe('aggregateAccessLog', () => {
  const rows = [
    { project_id: 'p1', viewer_id: 'v1', document_name: 'PDD', created_at: '2026-05-01' },
    { project_id: 'p1', viewer_id: 'v1', document_name: 'PDD', created_at: '2026-06-01' },
    { project_id: 'p1', viewer_id: 'v2', document_name: 'Feasibility Study', created_at: '2026-04-01' },
    { project_id: 'p2', viewer_id: 'v3', document_name: 'PDD', created_at: '2026-03-01' },
  ]

  it('counts distinct viewers, not raw views', () => {
    // One investor refreshing a PDD ten times is one interested party.
    const [p1] = aggregateAccessLog(rows)
    expect(p1.projectId).toBe('p1')
    expect(p1.uniqueViewers).toBe(2)
    expect(p1.views).toBe(3)
  })

  it('keeps the most recent view timestamp', () => {
    const [p1] = aggregateAccessLog(rows)
    expect(p1.lastViewedAt).toBe('2026-06-01')
  })

  it('ranks documents by view count', () => {
    const [p1] = aggregateAccessLog(rows)
    expect(p1.topDocuments[0]).toEqual({ name: 'PDD', count: 2 })
    expect(p1.topDocuments[1]).toEqual({ name: 'Feasibility Study', count: 1 })
  })

  it('sorts projects by investor interest, most first', () => {
    const out = aggregateAccessLog(rows)
    expect(out.map((p) => p.projectId)).toEqual(['p1', 'p2'])
  })

  it('never leaks viewer identities into the roll-up', () => {
    const out = aggregateAccessLog(rows)
    expect(JSON.stringify(out)).not.toContain('v1')
    expect(out[0].viewers).toBeUndefined()
  })

  it('handles empty and non-array input', () => {
    expect(aggregateAccessLog([])).toEqual([])
    expect(aggregateAccessLog(undefined)).toEqual([])
  })

  it('skips rows with no project', () => {
    expect(aggregateAccessLog([{ viewer_id: 'v1' }])).toEqual([])
  })
})
