import { contextBinding, contextSource, confirmedSessionSource, emptyCatalog, knownAccount, type Catalog } from './catalog'
import type { WorkService } from './catalog'

export type Platform = 'meta_ads' | 'google_ads'
export type AccountContext = {
  platform: Platform
  service?: WorkService
  accountCandidate: string | null
  candidateSource: string | null
}
export type Session = {
  ownerUserId?: string | null
  id: string
  platform: Platform
  service?: WorkService
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
export function identifyAdsContext(rawUrl: string, catalog: Catalog = emptyCatalog): AccountContext | null {
  let url: URL
  try { url = new URL(rawUrl) } catch { return null }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
  const host = url.hostname.toLowerCase()
  if ((host === 'adsmanager.facebook.com' || host === 'business.facebook.com') && /^\/adsmanager(?:\/|$)/.test(url.pathname)) {
    const raw = url.searchParams.getAll('act').length === 1 ? url.searchParams.get('act') : null
    const candidate=validNumericId(raw)
    return { platform: 'meta_ads', accountCandidate: knownAccount(catalog,'meta_ads',candidate) ? candidate : null, candidateSource: knownAccount(catalog,'meta_ads',candidate) ? 'act' : null }
  }
  if (host === 'business.facebook.com' && /^\/latest\/(?:content_calendar|story_composer)\/?$/.test(url.pathname)) {
    const binding = contextBinding(catalog,'meta_ads',url.searchParams)
    const act = url.searchParams.get('act')
    const conflict = url.searchParams.has('act') && (url.searchParams.getAll('act').length !== 1 || act !== binding?.accountId)
    return { platform: 'meta_ads', service: 'meta_organic', accountCandidate: binding && !conflict ? binding.accountId : null, candidateSource: binding && !conflict ? contextSource(binding) : null }
  }
  if (host === 'ads.google.com' && /^\/(?:aw|nav)(?:\/|$)/.test(url.pathname)) {
    const binding = contextBinding(catalog,'google_ads',url.searchParams)
    let explicit: { accountCandidate: string; candidateSource: string } | null = null
    for (const param of ['customerId','cid']) {
      const raw = url.searchParams.get(param)
      if (!url.searchParams.has(param)) continue
      const candidate = validNumericId(raw)
      if (url.searchParams.getAll(param).length !== 1 || !candidate || !/^\d{10}$/.test(candidate) || (explicit && explicit.accountCandidate !== candidate) || (binding && binding.accountId !== candidate)) return { platform: 'google_ads', accountCandidate: null, candidateSource: null }
      explicit = { accountCandidate: candidate, candidateSource: param }
    }
    if (explicit && knownAccount(catalog,'google_ads',explicit.accountCandidate)) return { platform: 'google_ads', ...explicit }
    // Only a user-confirmed exact context pair can bridge an internal ID to a real customer ID.
    if (binding) return { platform: 'google_ads', accountCandidate: binding.accountId, candidateSource: contextSource(binding) }
    return { platform: 'google_ads', accountCandidate: null, candidateSource: null }
  }
  return null
}
export const sessionKey = (platform: Platform, id: string | null) => `${platform}:${id ?? 'unknown'}`
export const formatMinutes = (ms: number) => Math.max(0, Math.floor(ms / 60000))

/** Explicit upload allowlist, including old local sessions captured before stricter URL rules. */
export function sessionEvent(session: Session, catalog: Catalog = emptyCatalog) {
  const service = session.platform==='meta_ads' && (session.service==='meta_organic'||session.candidateSource?.startsWith('context:meta_page:')) ? 'meta_organic' : session.platform
  const candidate = !knownAccount(catalog,session.platform,session.accountCandidate,service) ? null : confirmedSessionSource(catalog,session.platform, session.accountCandidate, session.candidateSource) ? session.accountCandidate : session.platform === 'google_ads'
    ? ['customerId', 'cid'].includes(session.candidateSource ?? '') && /^\d{10}$/.test(session.accountCandidate ?? '') ? session.accountCandidate : null
    : session.candidateSource === 'act' && /^\d{5,20}$/.test(session.accountCandidate ?? '') ? session.accountCandidate : null
  return { id: session.id, platform: session.platform, service, accountCandidate: candidate, startedAt: session.startedAt, endedAt: session.endedAt, focusedMs: session.focusedMs, navigationSignals: session.navigationSignals }
}
