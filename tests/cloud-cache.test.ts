import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import vm from 'node:vm'
import { catalog } from './fixtures'
import { CATALOG_TTL } from '../src/catalog'
const compiled=await build({entryPoints:['src/cloud.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'sdk-isolation',setup(b){b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'sdk',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export function createClient(){return globalThis.mockClient}'}))}}]})
function harness() {
  let now=Date.parse('2026-10-15T12:00:00Z'),user='a',offline=false,reads=0,authReads=0,uploads=0
  const storage:Record<string,any>={fng_cloud_status:{userId:user,email:'a@example.invalid'}}
  const mockClient={auth:{getSession:async()=>{authReads++;return{data:{session:{user:{id:user,email:`${user}@example.invalid`}}}}},signOut:async()=>{},signInWithPassword:async()=>({data:{user:{id:user,email:`${user}@example.invalid`}},error:null})},rpc:async(name:string)=>{if(name==='fng_companion_catalog'){reads++;if(offline)throw Error('Offline');return{data:structuredClone(catalog),error:null}}uploads++;return{error:null}}}
  const chrome={storage:{local:{get:async(key:string)=>structuredClone({[key]:storage[key]}),set:async(values:Record<string,unknown>)=>Object.assign(storage,structuredClone(values)),remove:async(keys:string|string[])=>{for(const key of Array.isArray(keys)?keys:[keys])delete storage[key]}}}}
  class Clock extends Date {static now(){return now}}
  const module={exports:{}}
  vm.runInNewContext(compiled.outputFiles[0].text,{module,exports:module.exports,chrome,mockClient,Date:Clock,URL,URLSearchParams,console})
  return{api:module.exports as typeof import('../src/cloud'),storage,advance:(ms:number)=>{now+=ms},switchUser:(id:string)=>{user=id;storage.fng_cloud_status={userId:id}},offline:()=>{offline=true},get reads(){return reads},get authReads(){return authReads},get uploads(){return uploads}}
}
test('catalog is fetched once and reused across navigation',async()=>{
  const h=harness()
  await h.api.cloudCatalog();await h.api.cloudCatalog();await h.api.cloudCatalog()
  assert.equal(h.reads,1)
  h.advance(CATALOG_TTL+1);await h.api.cloudCatalog()
  assert.equal(h.reads,2)
})
test('offline refresh retains the private cache and applies a persisted retry delay',async()=>{
  const h=harness();await h.api.cloudCatalog();h.advance(CATALOG_TTL+1);h.offline()
  assert.equal((await h.api.cloudCatalog()).accounts.length,catalog.accounts.length)
  await h.api.cloudCatalog();assert.equal(h.reads,2)
  h.advance(60001);await h.api.cloudCatalog();assert.equal(h.reads,3)
})
test('cache is not reused for a different user and is cleared on sign out',async()=>{
  const h=harness();await h.api.cloudCatalog();h.switchUser('b');h.offline()
  assert.equal((await h.api.cloudCatalog()).accounts.length,0)
  await h.api.cloudLogout();assert.equal(h.storage.fng_private_catalog,undefined)
})
test('no pending activity means no Auth or database requests',async()=>{
  const h=harness();await h.api.uploadSessions([])
  assert.equal(h.reads,0);assert.equal(h.authReads,0);assert.equal(h.uploads,0)
})
