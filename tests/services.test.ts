import test from 'node:test'
import assert from 'node:assert/strict'
import { catalog } from './fixtures'
import { validCatalog } from '../src/catalog'
import { identifyAdsContext, sessionEvent, type Session } from '../src/domain'

test('organic-only Meta access resolves page contexts, never an Ads Manager account',()=>{
  const scoped=structuredClone(catalog)
  const meta=scoped.accounts.find(a=>a.platform==='meta_ads')!
  meta.services=['meta_organic']
  assert.equal(validCatalog(scoped),true)
  assert.equal(identifyAdsContext(`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${meta.accountId}`,scoped)?.accountCandidate,null)
  const organic=identifyAdsContext('https://business.facebook.com/latest/content_calendar?asset_id=900000000000101',scoped)
  assert.equal(organic?.accountCandidate,meta.accountId);assert.equal(organic?.service,'meta_organic')
  const session={...organic,id:'session',startedAt:'2026-10-16T12:00:00Z',endedAt:'2026-10-16T12:01:00Z',focusedMs:60000,navigationSignals:1,status:'pending'} as Session
  assert.equal(sessionEvent(session,scoped).service,'meta_organic')
  assert.equal(sessionEvent(session,scoped).accountCandidate,meta.accountId)
  meta.services=[]
  assert.equal(sessionEvent(session,scoped).accountCandidate,null)
})

test('provider/service mismatches and duplicate service grants are rejected',()=>{
  const scoped=structuredClone(catalog)
  scoped.accounts[0].services=['meta_ads','meta_ads']
  assert.equal(validCatalog(scoped),false)
  scoped.accounts[0].services=['meta_ads','google_ads']
  assert.equal(validCatalog(scoped),false)
})
