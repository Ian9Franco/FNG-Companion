import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { identifyAdsContext, sessionEvent, type Session } from '../src/domain'
import { contextSource, validCatalog, type Catalog } from '../src/catalog'
import { catalog } from './fixtures'
test('extension source has no bundled numeric account/context IDs',async()=>{
  for(const file of await readdir(new URL('../src/',import.meta.url),{recursive:true})) {
    if(!/\.(?:ts|tsx)$/.test(file))continue
    assert.doesNotMatch(await readFile(new URL(`../src/${file.replaceAll('\\','/')}`,import.meta.url),'utf8'),/["'`]\d{8,}["'`]/,file)
  }
})
const identify=(url:string)=>identifyAdsContext(url,catalog)
const google='ocid=8000000001&__c=8000000002&uscid=8000000001'

test('real account IDs must exist in the signed-in user catalog',()=>{
  assert.equal(identify('https://adsmanager.facebook.com/adsmanager/manage/ads?act=900000000000001')?.accountCandidate,'900000000000001')
  assert.equal(identify('https://ads.google.com/aw/campaigns?cid=900-000-0001')?.accountCandidate,'9000000001')
  assert.equal(identify('https://ads.google.com/aw/campaigns?cid=9999999999')?.accountCandidate,null)
  assert.equal(identifyAdsContext('https://adsmanager.facebook.com/adsmanager/manage/ads?act=900000000000001')?.accountCandidate,null)
})
test('database contexts resolve campaigns and asset groups without treating internal IDs as customer IDs',()=>{
  for(const path of ['campaigns','assetgroup/edit'])assert.deepEqual(identify(`https://ads.google.com/aw/${path}?${google}&euid=7000000001&campaignId=6000000001`),{platform:'google_ads',accountCandidate:'9000000001',candidateSource:contextSource(catalog.contexts[0])})
})
test('only confirmed Meta page bindings resolve calendar and composer',()=>{
  for(const path of ['content_calendar','story_composer/'])assert.equal(identify(`https://business.facebook.com/latest/${path}?asset_id=900000000000101&page_id=900000000000101&business_id=700000000000001`)?.accountCandidate,'900000000000001')
  assert.equal(identify('https://business.facebook.com/latest/content_calendar?asset_id=999999999999999')?.accountCandidate,null)
  assert.equal(identify('https://business.facebook.com/latest/content_calendar?business_id=700000000000001')?.accountCandidate,null)
})
test('rejects conflicting, duplicated, partial and unconfirmed context identifiers',()=>{
  for(const query of ['ocid=8000000001','__c=8000000002',`${google}&cid=9000000002`,`${google}&__c=9999999999`,`${google}&uscid=9999999999`,'cid=9000000001&customerId=9000000002'])assert.equal(identify(`https://ads.google.com/aw/campaigns?${query}`)?.accountCandidate,null)
  assert.equal(identify('https://business.facebook.com/latest/content_calendar?asset_id=900000000000101&page_id=999999999999999')?.accountCandidate,null)
})
test('ignores other websites, lookalike paths, insecure URLs and general Business Suite',()=>{
  for(const url of ['https://example.com/private','https://www.google.com/search','https://www.facebook.com','https://adsmanager.facebook.com.evil.test/adsmanager','https://adsmanager.facebook.com/help','https://business.facebook.com/latest/home','https://business.facebook.com/foo/adsmanager','https://ads.google.com/awards','https://ads.google.com/navigation','http://ads.google.com/aw','https://user:pass@ads.google.com/aw','https://ads.google.com:8443/aw','chrome://extensions'])assert.equal(identify(url),null,url)
})
test('archived accounts and malformed/ambiguous catalogs are never resolved',()=>{
  const archived=structuredClone(catalog);archived.accounts[0].active=false
  assert.equal(identifyAdsContext('https://business.facebook.com/latest/content_calendar?asset_id=900000000000101',archived)?.accountCandidate,null)
  assert.ok(validCatalog(catalog))
  assert.ok(!validCatalog({...catalog,accounts:[...catalog.accounts,catalog.accounts[0]]}))
  assert.ok(!validCatalog({...catalog,contexts:[{...catalog.contexts[0],accountId:'missing'}]}))
  assert.ok(!validCatalog({version:1,accounts:'bad',contexts:[]}))
})
test('remote payload contains only canonical IDs and allowed session fields',()=>{
  const session={id:'s',platform:'google_ads',accountCandidate:'9000000001',candidateSource:contextSource(catalog.contexts[0]),startedAt:'2026-10-15T12:00:00Z',endedAt:'2026-10-15T12:01:00Z',focusedMs:60000,navigationSignals:1,status:'pending',url:'https://private.invalid/?secret=1'} as Session
  assert.equal(sessionEvent(session,catalog).accountCandidate,'9000000001')
  assert.equal(sessionEvent({...session,candidateSource:'__c'},catalog).accountCandidate,null)
  assert.equal(sessionEvent({...session,accountCandidate:'9000000002'},catalog).accountCandidate,null)
  assert.equal(sessionEvent(session).accountCandidate,null)
  assert.doesNotMatch(JSON.stringify(sessionEvent(session,catalog)),/private|secret|8000000001|context/)
})
test('no global URL/history/scripting permission or content scripts',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/manifest.json',import.meta.url),'utf8'))
  for(const permission of ['tabs','history','scripting'])assert.ok(!manifest.permissions.includes(permission))
  assert.equal(manifest.content_scripts,undefined)
  assert.ok(manifest.host_permissions.every((host:string)=>host.startsWith('https://')&&!host.includes('<all_urls>')&&!host.startsWith('https://*')))
})
