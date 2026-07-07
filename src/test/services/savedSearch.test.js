import { describe, it, expect } from 'vitest'
import {
  sanitizeCriteria,
  listingMatchesSearch,
  findNewMatches,
  describeCriteria,
} from '@/services/savedSearchService'

const listing = {
  id: 'l1',
  category: 'reforestation',
  source: 'local',
  price_per_credit: 200,
  location: 'Palawan, Philippines',
  co_benefits: ['SDG13', 'SDG15'],
  project_title: 'Mangrove Restoration',
  project_description: 'Coastal blue carbon',
  created_at: '2026-06-20T00:00:00Z',
}

describe('sanitizeCriteria', () => {
  it('drops empty, null, and "all" sentinel values', () => {
    expect(
      sanitizeCriteria({ category: 'all', source: '', country: null, maxPrice: 250, search: '' }),
    ).toEqual({ maxPrice: 250 })
  })

  it('keeps non-empty arrays and copies them', () => {
    const sdgs = ['SDG13']
    const out = sanitizeCriteria({ sdgs })
    expect(out).toEqual({ sdgs: ['SDG13'] })
    expect(out.sdgs).not.toBe(sdgs) // copied, not referenced
  })

  it('ignores unknown keys', () => {
    expect(sanitizeCriteria({ forceRefresh: true, page: 2, category: 'solar' })).toEqual({
      category: 'solar',
    })
  })
})

describe('describeCriteria', () => {
  it('labels an empty criteria as All listings', () => {
    expect(describeCriteria({})).toBe('All listings')
  })

  it('joins the active filters into a readable label', () => {
    expect(describeCriteria({ category: 'reforestation', source: 'local', maxPrice: 250 })).toBe(
      'reforestation · local · ≤ ₱250',
    )
    expect(describeCriteria({ source: 'supplier' })).toBe('registry')
  })
})

describe('listingMatchesSearch', () => {
  it('matches everything on empty criteria', () => {
    expect(listingMatchesSearch(listing, {})).toBe(true)
  })

  it('filters by category and source', () => {
    expect(listingMatchesSearch(listing, { category: 'reforestation' })).toBe(true)
    expect(listingMatchesSearch(listing, { category: 'solar' })).toBe(false)
    expect(listingMatchesSearch(listing, { source: 'supplier' })).toBe(false)
  })

  it('treats a missing source as local', () => {
    const { source, ...noSource } = listing
    void source
    expect(listingMatchesSearch(noSource, { source: 'local' })).toBe(true)
  })

  it('applies the price ceiling (the price alert) and floor', () => {
    expect(listingMatchesSearch(listing, { maxPrice: 250 })).toBe(true)
    expect(listingMatchesSearch(listing, { maxPrice: 150 })).toBe(false)
    expect(listingMatchesSearch(listing, { minPrice: 300 })).toBe(false)
  })

  it('matches SDGs by intersection and location substring', () => {
    expect(listingMatchesSearch(listing, { sdgs: ['SDG15'] })).toBe(true)
    expect(listingMatchesSearch(listing, { sdgs: ['SDG7'] })).toBe(false)
    expect(listingMatchesSearch(listing, { country: 'philippines' })).toBe(true)
    expect(listingMatchesSearch(listing, { country: 'kenya' })).toBe(false)
  })

  it('matches a keyword against title/description/location', () => {
    expect(listingMatchesSearch(listing, { search: 'mangrove' })).toBe(true)
    expect(listingMatchesSearch(listing, { search: 'blue carbon' })).toBe(true)
    expect(listingMatchesSearch(listing, { search: 'wind' })).toBe(false)
  })

  it('requires ALL criteria to hold', () => {
    expect(listingMatchesSearch(listing, { category: 'reforestation', maxPrice: 250 })).toBe(true)
    expect(listingMatchesSearch(listing, { category: 'reforestation', maxPrice: 100 })).toBe(false)
  })

  it('returns false for a null listing', () => {
    expect(listingMatchesSearch(null, {})).toBe(false)
  })
})

describe('findNewMatches', () => {
  const search = { criteria: { category: 'reforestation' }, last_seen_at: '2026-06-15T00:00:00Z' }

  it('returns matching listings created after last_seen_at', () => {
    const listings = [
      { ...listing, id: 'new', created_at: '2026-06-20T00:00:00Z' }, // after -> included
      { ...listing, id: 'old', created_at: '2026-06-10T00:00:00Z' }, // before -> excluded
      { ...listing, id: 'wrongcat', category: 'solar', created_at: '2026-06-25T00:00:00Z' }, // no match
    ]
    const res = findNewMatches(search, listings)
    expect(res.map((r) => r.id)).toEqual(['new'])
  })

  it('treats no last_seen_at as epoch (all matches are new)', () => {
    const res = findNewMatches({ criteria: {} }, [listing])
    expect(res).toHaveLength(1)
  })

  it('handles empty inputs safely', () => {
    expect(findNewMatches(null, [listing])).toEqual([])
    expect(findNewMatches(search, [])).toEqual([])
  })
})
