import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { build } from 'esbuild'
import vm from 'node:vm'
import { catalog } from './fixtures'

// Execute the real worker with isolated Chrome/cloud adapters; no browser profile or remote writes.
const compiled = await build({entryPoints:['src/background.ts'],bundle:true,write:false,platform:'node',format:'iife',plugins:[{name:'isolated-cloud',setup(builder){builder.onResolve({filter:/^\.\/cloud$/},()=>({path:'cloud',namespace:'mock'}));builder.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`export async function cloudOwner(){return null} export async function cloudLogin(){} export async function cloudLogout(){} export async function cloudCatalog(){return ${JSON.stringify(catalog)}} export async function uploadSessions(sessions){if(sessions.length)globalThis.sent.push(structuredClone(sessions))}`}))}}]})

function harness() {
  let now=Date.parse('2026-10-15T15:00:00Z'),url:string|undefined,focused=true,writes=0
  const storage:Record<string,unknown>={},sent:unknown[][]=[],errors:unknown[][]=[]
  const event=()=>{const handlers:((...args:any[])=>unknown)[]=[];return{addListener:(handler:(...args:any[])=>unknown)=>handlers.push(handler),emit:(...args:any[])=>handlers.forEach(handler=>handler(...args))}}
  const installed=event(),activated=event(),updated=event(),alarm=event(),windowFocus=event(),idle=event()
  class Clock extends Date { static now(){return now} }
  const chrome={storage:{local:{get:async(key:string)=>structuredClone({[key]:storage[key]}),set:async(values:Record<string,unknown>)=>{writes++;Object.assign(storage,structuredClone(values))}}},windows:{getLastFocused:async()=>({id:1,focused}),onFocusChanged:windowFocus},idle:{queryState:async()=> 'active',onStateChanged:idle},tabs:{query:async()=>[{id:1,url,active:true}],onActivated:activated,onUpdated:updated,onRemoved:event()},alarms:{get:async()=>({name:'fng-companion-heartbeat'}),create:async()=>{},onAlarm:alarm},sidePanel:{setPanelBehavior:async()=>{}},runtime:{onInstalled:installed,onStartup:event(),onMessage:event()}}
  vm.runInNewContext(compiled.outputFiles[0].text,{chrome,URL,Date:Clock,crypto:{randomUUID},sent,structuredClone,console:{error:(...args:unknown[])=>errors.push(args)}})
  const settle=async()=>{await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(errors,[])}
  return {storage,sent,installed,activated,updated,alarm,windowFocus,settle,get writes(){return writes},setUrl:(value:string|undefined)=>{url=value},advance:(ms:number)=>{now+=ms},setFocus:(value:boolean)=>{focused=value}}
}

test('unrelated sites, restricted URL fields and periodic checks create no local activity',async()=>{
  const h=harness()
  for(const url of [undefined,'https://example.com/private?token=secret','https://ads.google.com/home','https://business.facebook.com/latest/home']) {
    h.setUrl(url);h.activated.emit({tabId:1});h.alarm.emit({name:'fng-companion-heartbeat'});await h.settle()
  }
  assert.equal(h.writes,0)
  assert.deepEqual(h.storage,{})
  assert.equal(h.sent.length,0)
})

test('leaving Ads closes only its session and ignores later browsing without storing URLs',async()=>{
  const h=harness()
  h.setUrl('https://adsmanager.facebook.com/adsmanager/manage/ads?act=900000000000001&private=secret')
  h.activated.emit({tabId:1});await h.settle();h.advance(30000)
  h.setUrl(undefined);h.activated.emit({tabId:2});await h.settle()
  const state=h.storage.fng_companion_v0 as {open:unknown;sessions:{platform:string;accountCandidate:string;focusedMs:number}[]}
  assert.equal(state.open,null)
  assert.equal(state.sessions.length,1)
  assert.equal(state.sessions[0].platform,'meta_ads')
  assert.equal(state.sessions[0].accountCandidate,'900000000000001')
  assert.equal(state.sessions[0].focusedMs,30000)
  assert.doesNotMatch(JSON.stringify(h.storage),/https:|private|secret/)
  const writes=h.writes
  h.advance(60000);h.alarm.emit({name:'fng-companion-heartbeat'});await h.settle()
  assert.equal(h.writes,writes)
})

test('background-tab navigation is not attributed to the account in the foreground',async()=>{
  const h=harness()
  h.setUrl('https://ads.google.com/aw/campaigns?cid=9000000001')
  h.activated.emit({tabId:1});await h.settle()
  h.updated.emit(2,{url:'https://adsmanager.facebook.com/adsmanager/manage/ads?act=900000000000001'},{active:false});await h.settle()
  assert.equal((h.storage.fng_companion_v0 as any).open.navigationSignals,1)
  h.advance(1000);h.updated.emit(1,{url:'https://ads.google.com/aw/assetgroup/edit?cid=9000000001'},{active:true});await h.settle()
  assert.equal((h.storage.fng_companion_v0 as any).open.navigationSignals,2)
})

test('DB context resolves one client across Google, Meta Ads and Business Suite with no URL storage',async()=>{
  const h=harness()
  for(const [url,expected] of [
    ['https://ads.google.com/aw/campaigns?ocid=8000000001&__c=8000000002&workspaceId=0','9000000001'],
    ['https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=900000000000001','900000000000001'],
    ['https://business.facebook.com/latest/content_calendar?asset_id=900000000000101&page_id=900000000000101','900000000000001'],
  ]) {
    h.setUrl(url);h.activated.emit({tabId:1});await h.settle()
    assert.equal((h.storage.fng_companion_v0 as any).open.accountCandidate,expected)
    h.advance(30000)
  }
  h.setUrl(undefined);h.activated.emit({tabId:2});await h.settle()
  const sessions=(h.storage.fng_companion_v0 as any).sessions
  assert.ok(sessions.every((session:any)=>['9000000001','900000000000001'].includes(session.accountCandidate)))
  assert.doesNotMatch(JSON.stringify(h.storage),/https:|workspaceId|page_id/)
})
