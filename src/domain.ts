export type Platform = 'meta_ads' | 'google_ads'
export type AccountContext = {
  platform: Platform
  accountCandidate: string | null
  candidateSource: string | null
}
export type Session = {
  ownerUserId?: string | null
  id: string
  platform: Platform
  accountCandidate: string | null
  candidateSource: string | null
  startedAt: string
  endedAt: string
  focusedMs: number
  navigationSignals: number
  status: 'pending' | 'dismissed'
}
export type OpenSession = Omit<Session, 'endedAt' | 'status'> & {
  tabId: number
  lastTickAt: string
}
export type CompanionState = {
  enabled: boolean
  sessions: Session[]
  open: OpenSession | null
}
export const STORAGE_KEY = 'fng_companion_v0'
export const initialState = (): CompanionState => ({ enabled: true, sessions: [], open: null })
const validNumericId = (value: string | null) => {
  if (!value) return null
  const normalized = value.replaceAll('-', '').replaceAll(' ', '')
  return /^\d{5,20}$/.test(normalized) ? normalized : null
}
/**
 * Only identifies platform and URL-visible account *candidates*.
 * Do not claim these are authoritative account IDs or campaign changes.
 * Never persist a complete URL or querystring.
 */
export function identifyAdsContext(rawUrl: string): AccountContext | null {
  let url: URL
  try { url = new URL(rawUrl) } catch { return null }
  const host = url.hostname.toLowerCase()
  if (host === 'adsmanager.facebook.com' ||
      (host === 'business.facebook.com' && /(^|\/)adsmanager(\/|$)/.test(url.pathname))) {
    const raw = url.searchParams.get('act')
    return { platform: 'meta_ads', accountCandidate: validNumericId(raw), candidateSource: raw ? 'act' : null }
  }
  if (host === 'ads.google.com' && (url.pathname.startsWith('/aw') || url.pathname.startsWith('/nav'))) {
    // 'ocid' is intentionally excluded: URL parameters are not proof of a customer ID.
    for (const param of ['customerId','cid','__c']) {
      const raw = url.searchParams.get(param)
      if (!raw) continue
      return { platform: 'google_ads', accountCandidate: validNumericId(raw), candidateSource: param }
    }
    return { platform: 'google_ads', accountCandidate: null, candidateSource: null }
  }
  return null
}
export const sessionKey = (platform: Platform, id: string | null) => `${platform}:${id ?? 'unknown'}`
export const formatMinutes = (ms: number) => Math.max(0, Math.floor(ms / 60000))
