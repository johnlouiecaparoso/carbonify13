import { describe, it, expect } from 'vitest'
import {
  buildCertificateSignaturePayload,
  computeCertificateHash,
} from '@/services/certificateService'

const legacyCert = {
  certificate_number: 'CERT-1',
  certificate_type: 'purchase',
  project_title: 'Mangrove A',
  project_category: 'Blue Carbon',
  credits_quantity: 10,
  vintage_year: 2025,
  beneficiary_name: 'Acme Corp',
}

describe('buildCertificateSignaturePayload — registry back-compat', () => {
  it('hashes legacy (non-registry) certs over exactly the original 7 fields', () => {
    const expected = ['CERT-1', 'purchase', 'Mangrove A', 'Blue Carbon', 10, 2025, 'Acme Corp']
      .map((v) => String(v ?? ''))
      .join('|')
    expect(buildCertificateSignaturePayload(legacyCert)).toBe(expected)
  })

  it('a null registry_serial does NOT change the legacy payload', () => {
    const withNulls = { ...legacyCert, registry_serial: null, registry_receipt_url: null }
    expect(buildCertificateSignaturePayload(withNulls)).toBe(
      buildCertificateSignaturePayload(legacyCert),
    )
  })

  it('extends the payload only when a registry_serial is present', () => {
    const registryCert = {
      ...legacyCert,
      registry_serial: 'ECO-MOCK-REG-1',
      registry_receipt_url: 'https://mock.local/registry/retire/o1',
    }
    const payload = buildCertificateSignaturePayload(registryCert)
    expect(payload).toContain('ECO-MOCK-REG-1')
    expect(payload).toContain('https://mock.local/registry/retire/o1')
    expect(payload).not.toBe(buildCertificateSignaturePayload(legacyCert))
  })

  it('computeCertificateHash is stable for legacy certs (verify page recompute matches)', async () => {
    const a = await computeCertificateHash(legacyCert)
    const b = await computeCertificateHash({ ...legacyCert, registry_serial: null })
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })
})
