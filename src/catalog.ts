export type Platform = 'meta_ads' | 'google_ads'
export type Account = { platform: Platform; accountId: string; clientId: string; name: string; active: boolean }
export type Context = { platform: Platform; kind: 'google_context' | 'meta_page'; key: string; accountId: string }
export type Catalog = { version: 1; accounts: Account[]; contexts: Context[] }
export const emptyCatalog: Catalog = { version: 1, accounts: [], contexts: [] }
export const CATALOG_TTL = 60 * 60 * 1000
export function validCatalog(value: unknown): value is Catalog {
  if (!value || typeof value !== 'object') return false
  const data=value as Catalog
  if(data.version!==1 || !Array.isArray(data.accounts) || !Array.isArray(data.contexts) || data.accounts.length>5000 || data.contexts.length>10000) return false
  if(!data.accounts.every(a=>a&&['meta_ads','google_ads'].includes(a.platform)&&typeof a.accountId==='string'&&(a.platform==='google_ads'?/^\d{10}$/:/^[1-9]\d{0,29}$/).test(a.accountId)&&typeof a.clientId==='string'&&typeof a.name==='string'&&typeof a.active==='boolean'))return false
  if(new Set(data.accounts.map(a=>`${a.platform}:${a.accountId}`)).size!==data.accounts.length)return false
  if(!data.contexts.every(c=>c&&typeof c.key==='string'&&((c.kind==='google_context'&&c.platform==='google_ads'&&/^\d{5,20}:\d{5,20}$/.test(c.key))||(c.kind==='meta_page'&&c.platform==='meta_ads'&&/^\d{5,30}$/.test(c.key)))&&data.accounts.some(a=>a.platform===c.platform&&a.accountId===c.accountId)))return false
  return new Set(data.contexts.map(c=>`${c.kind}:${c.key}`)).size===data.contexts.length
}
export const knownAccount = (catalog: Catalog, platform: Platform, id: string | null) => catalog.accounts.some(account=>account.active&&account.platform===platform&&account.accountId===id)
const one=(params:URLSearchParams,key:string)=>params.getAll(key).length===1?params.get(key):null
export function contextBinding(catalog: Catalog, platform: Platform, params: URLSearchParams): Context | undefined {
  let key: string | null=null
  const kind=platform==='google_ads'?'google_context':'meta_page'
  if(platform==='google_ads') {
    const ocid=one(params,'ocid'),context=one(params,'__c')
    if(ocid&&context&&(!params.has('uscid')||one(params,'uscid')===ocid))key=`${ocid}:${context}`
  } else {
    const asset=one(params,'asset_id'),page=one(params,'page_id')
    if((asset||page)&&(!params.has('asset_id')||asset)&&(!params.has('page_id')||page)&&(!asset||!page||asset===page))key=asset??page
  }
  return catalog.contexts.find(binding=>binding.platform===platform&&binding.kind===kind&&binding.key===key&&knownAccount(catalog,platform,binding.accountId))
}
export const contextSource=(context:Context)=>`context:${context.kind}:${context.key}`
export function confirmedSessionSource(catalog:Catalog,platform:Platform,accountId:string|null,source:string|null) {
  return catalog.contexts.some(binding=>binding.platform===platform&&binding.accountId===accountId&&contextSource(binding)===source&&knownAccount(catalog,platform,accountId))
}
