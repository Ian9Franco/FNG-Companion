import { identifyAdsContext, initialState, STORAGE_KEY, type CompanionState, type OpenSession, type Session } from './domain'
import { cloudCatalog, cloudLogin, cloudLogout, cloudOwner, uploadSessions } from './cloud'

const HEARTBEAT = 'fng-companion-heartbeat'
const IDLE_SECONDS = 120
const MAX_TICK_MS = 70_000
const MAX_SESSIONS = 500
let queue: Promise<void> = Promise.resolve()

async function readState(): Promise<CompanionState> {
  const obj = await chrome.storage.local.get(STORAGE_KEY)
  const value: unknown = obj[STORAGE_KEY]
  if (!value || typeof value !== 'object' || !('sessions' in value) || !Array.isArray(value.sessions)) return initialState()
  return value as CompanionState
}
async function saveState(state: CompanionState) { await chrome.storage.local.set({ [STORAGE_KEY]: state }) }

async function focusedAccount(): Promise<{ tabId: number; context: NonNullable<ReturnType<typeof identifyAdsContext>> } | null> {
  const [window, idle] = await Promise.all([
    chrome.windows.getLastFocused({ populate: false }),
    chrome.idle.queryState(IDLE_SECONDS),
  ])
  if (!window.focused || typeof window.id !== 'number' || idle !== 'active') return null
  const tabs = await chrome.tabs.query({ active: true, windowId: window.id })
  const tab = tabs[0]
  if (!tab?.id || !tab.url) return null
  if(!identifyAdsContext(tab.url))return null
  const context = identifyAdsContext(tab.url,await cloudCatalog())
  return context ? { tabId: tab.id, context } : null
}

async function reconcile(reason: 'heartbeat' | 'navigation' | 'focus') {
  const state = await readState()
  const now = Date.now()
  const owner = await cloudOwner()
  const focus = state.enabled ? await focusedAccount() : null
  const existing = state.open
  if (!existing && !focus) return // No storage writes for unrelated browsing or paused tracking.
  const same = Boolean(existing && focus && existing.tabId === focus.tabId &&
    existing.platform === focus.context.platform &&
    (existing.ownerUserId ?? null) === owner &&
    existing.accountCandidate === focus.context.accountCandidate &&
    (existing.accountCandidate !== null || reason !== 'navigation'))

  if (existing) {
    // Conservative time estimate: only short, periodically observed foreground intervals.
    const elapsed = Math.max(0, Math.min(now - Date.parse(existing.lastTickAt), MAX_TICK_MS))
    existing.focusedMs += elapsed
    existing.lastTickAt = new Date(now).toISOString()
    if (same) {
      if (reason === 'navigation') existing.navigationSignals += 1
      state.open = existing
      await saveState(state)
      return
    }
    if (existing.focusedMs >= 15_000) {
      const { tabId: _tabId, lastTickAt: _lastTickAt, ...session } = existing
      const finalized: Session = { ...session, endedAt: new Date(now).toISOString(), status: 'pending' }
      state.sessions = [finalized, ...state.sessions].slice(0, MAX_SESSIONS)
    }
    state.open = null
  }

  if (focus) {
    const startedAt = new Date(now).toISOString()
    const next: OpenSession = {
      id: crypto.randomUUID(), tabId: focus.tabId,
      ownerUserId: owner,
      platform: focus.context.platform, accountCandidate: focus.context.accountCandidate,
      candidateSource: focus.context.candidateSource, startedAt, lastTickAt: startedAt,
      focusedMs: 0, navigationSignals: 1,
    }
    state.open = next
  }
  await saveState(state)
}

function enqueue(reason: 'heartbeat' | 'navigation' | 'focus') {
  queue = queue.then(async () => { await reconcile(reason); if (reason === 'heartbeat' || reason === 'focus') await uploadSessions((await readState()).sessions) }).catch(err => console.error('[FNG Companion]', err))
}

async function setup() {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  await chrome.alarms.create(HEARTBEAT, { periodInMinutes: 1 })
  enqueue('focus')
}
chrome.runtime.onInstalled.addListener(() => { void setup() })
chrome.runtime.onStartup.addListener(() => { void setup() })
chrome.tabs.onActivated.addListener(() => enqueue('focus'))
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url) enqueue('navigation')
})
chrome.tabs.onRemoved.addListener(() => enqueue('focus'))
chrome.windows.onFocusChanged.addListener(() => enqueue('focus'))
chrome.idle.onStateChanged.addListener(() => enqueue('focus'))
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === HEARTBEAT) enqueue('heartbeat') })

// Ensure the alarm exists after extension worker revival or during development.
void chrome.alarms.get(HEARTBEAT).then(alarm => { if (!alarm) void setup() })

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!message || typeof message !== 'object' || !('type' in message)) return
  if (message.type === 'FNG_CLOUD_LOGIN' || message.type === 'FNG_CLOUD_LOGOUT' || message.type === 'FNG_CATALOG_REFRESH') {
    queue = queue.then(async () => {
      if (message.type === 'FNG_CLOUD_LOGIN' && 'email' in message && 'password' in message && typeof message.email === 'string' && typeof message.password === 'string') { await cloudLogin(message.email, message.password); await reconcile('focus'); await uploadSessions((await readState()).sessions) }
      else if (message.type === 'FNG_CLOUD_LOGOUT') await cloudLogout()
      else if (message.type === 'FNG_CATALOG_REFRESH') { await cloudCatalog(true); await reconcile('focus') }
      else throw new Error('Credenciales inválidas')
    }).then(() => sendResponse({ ok: true })).catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }))
    return true
  }
  if (message.type !== 'FNG_SET_ENABLED' && message.type !== 'FNG_DISMISS_SESSION') return
  queue = queue.then(async () => {
    const state = await readState()
    if (message.type === 'FNG_SET_ENABLED' && 'enabled' in message) {
      state.enabled = message.enabled === true
    }
    if (message.type === 'FNG_DISMISS_SESSION' && 'sessionId' in message && typeof message.sessionId === 'string') {
      state.sessions = state.sessions.map(s => s.id === message.sessionId ? { ...s, status: 'dismissed' } : s)
    }
    await saveState(state)
    if (message.type === 'FNG_SET_ENABLED') await reconcile('focus')
  }).then(() => sendResponse({ ok: true })).catch(err => sendResponse({ ok: false, error: String(err) }))
  return true
})
