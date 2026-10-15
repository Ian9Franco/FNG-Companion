import { createClient } from '@supabase/supabase-js'
import { sessionEvent, STORAGE_KEY, type CompanionState, type Session } from './domain'
import { CATALOG_TTL, emptyCatalog, validCatalog, type Catalog } from './catalog'

export const CLOUD_STATUS_KEY = 'fng_cloud_status'
const UPLOADED_KEY = 'fng_cloud_uploaded'
const CATALOG_KEY = 'fng_private_catalog'
const client = createClient('https://zxhxerhksohymmyofvqb.supabase.co', 'sb_publishable_YSd3oVUS4cKUAXokW-hoxg_ao3LN1xI', {
  auth: {
    autoRefreshToken: false, detectSessionInUrl: false, persistSession: true,
    storage: {
      getItem: async key => (await chrome.storage.local.get(key))[key] as string | null ?? null,
      setItem: async (key, value) => { await chrome.storage.local.set({ [key]: value }) },
      removeItem: async key => { await chrome.storage.local.remove(key) },
    },
  },
})
let nextRetry = 0
let failures = 0
export async function cloudLogin(email: string, password: string) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  await chrome.storage.local.set({ [CLOUD_STATUS_KEY]: { email: data.user.email, userId: data.user.id, message: 'Conectado. Las sesiones pendientes se enviarán a tu cuenta.' } })
  nextRetry = 0; failures = 0
  await cloudCatalog(true)
}
export async function cloudLogout() {
  await client.auth.signOut({ scope: 'local' })
  await chrome.storage.local.remove([UPLOADED_KEY,CATALOG_KEY])
  await chrome.storage.local.set({ [CLOUD_STATUS_KEY]: { email: null, message: 'Sincronización desconectada.' } })
}
export async function cloudOwner(): Promise<string | null> { return (await chrome.storage.local.get(CLOUD_STATUS_KEY))[CLOUD_STATUS_KEY]?.userId ?? null }
export async function cloudCatalog(force=false): Promise<Catalog> {
  const owner=await cloudOwner()
  if(!owner)return emptyCatalog
  const cached=(await chrome.storage.local.get(CATALOG_KEY))[CATALOG_KEY] as {userId:string;catalog:Catalog;fetchedAt:number;retryAt?:number}|undefined
  const valid=cached?.userId===owner&&validCatalog(cached.catalog)
  if(!force&&cached?.userId===owner&&((valid&&Date.now()-cached.fetchedAt<CATALOG_TTL)||(cached.retryAt??0)>Date.now()))return valid?cached.catalog:emptyCatalog
  try {
    const {data:{session}}=await client.auth.getSession()
    if(!session||session.user.id!==owner)throw Error('Sesión no disponible')
    const {data,error}=await client.rpc('fng_companion_catalog')
    if(error||!validCatalog(data))throw Error('Catálogo no disponible')
    await chrome.storage.local.set({[CATALOG_KEY]:{userId:owner,catalog:data,fetchedAt:Date.now()}})
    return data
  } catch {
    await chrome.storage.local.set({[CATALOG_KEY]:{userId:owner,catalog:valid?cached.catalog:emptyCatalog,fetchedAt:valid?cached.fetchedAt:0,retryAt:Date.now()+60000}})
    return valid?cached.catalog:emptyCatalog
  }
}
export async function uploadSessions(sessions: Session[]) {
  if (Date.now() < nextRetry) return
  const owner=await cloudOwner()
  if(!owner)return
  const saved = (await chrome.storage.local.get(UPLOADED_KEY))[UPLOADED_KEY] as { userId: string; ids: string[] } | undefined
  const uploaded = new Set(saved?.userId === owner ? saved.ids : [])
  const pending = sessions.filter(item => item.status === 'pending' && (!item.ownerUserId || item.ownerUserId === owner) && !uploaded.has(item.id)).slice(0, 50)
  if (!pending.length) return
  const { data: { session } } = await client.auth.getSession()
  if (!session || session.user.id!==owner) return
  const catalog=await cloudCatalog()
  // Bind legacy local sessions before sending; a different login cannot receive them later.
  const captured = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] as CompanionState
  const pendingIds = new Set(pending.map(item => item.id))
  if (captured) await chrome.storage.local.set({ [STORAGE_KEY]: { ...captured, sessions: captured.sessions.map(item => pendingIds.has(item.id) ? { ...item, ownerUserId: session.user.id } : item) } })
  const { error } = await client.rpc('fng_ingest_activity', { events: pending.map(item=>sessionEvent(item,catalog)) })
  if (error) {
    failures += 1
    nextRetry = Date.now() + Math.min(60 * 60 * 1000, 30000 * 2 ** Math.min(failures, 7))
    await chrome.storage.local.set({ [CLOUD_STATUS_KEY]: { email: session.user.email, userId: session.user.id, message: `Pendiente de envío. ${error.message}` } })
    return
  }
  pending.forEach(item => uploaded.add(item.id))
  failures = 0; nextRetry = 0
  const existing = new Set(sessions.map(item => item.id))
  await chrome.storage.local.set({ [UPLOADED_KEY]: { userId: session.user.id, ids: [...uploaded].filter(id => existing.has(id)) }, [CLOUD_STATUS_KEY]: { email: session.user.email, userId: session.user.id, message: `${pending.length} sesiones enviadas. Tu teléfono las verá en Informes FNG.` } })
}
