import assert from 'node:assert/strict'
import test from 'node:test'
import { identifyAdsContext, sessionKey } from '../src/domain'

test('detecta Meta Ads Manager y el candidato act', () => {
  assert.deepEqual(identifyAdsContext('https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=123456789'), {
    platform:'meta_ads',accountCandidate:'123456789',candidateSource:'act',
  })
})
test('detecta Google Ads con ID candidato en URL', () => {
  assert.deepEqual(identifyAdsContext('https://ads.google.com/aw/overview?cid=123-456-7890'), {
    platform:'google_ads',accountCandidate:'1234567890',candidateSource:'cid',
  })
})
test('no confunde ocid con ID de cliente confirmado', () => {
  assert.deepEqual(identifyAdsContext('https://ads.google.com/aw/overview?ocid=1944205'), {
    platform:'google_ads',accountCandidate:null,candidateSource:null,
  })
})
test('ignora Google fuera de Ads y business suite fuera de Ads Manager', () => {
  assert.equal(identifyAdsContext('https://www.google.com/search?q=ads'),null)
  assert.equal(identifyAdsContext('https://business.facebook.com/latest/home'),null)
})
test('permite detectar cuenta desconocida sin inventar cliente', () => {
  assert.deepEqual(identifyAdsContext('https://adsmanager.facebook.com/adsmanager/manage/ads'),{
    platform:'meta_ads',accountCandidate:null,candidateSource:null,
  })
  assert.equal(sessionKey('google_ads',null),'google_ads:unknown')
})
