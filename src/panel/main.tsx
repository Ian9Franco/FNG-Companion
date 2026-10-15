import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { STORAGE_KEY, initialState, formatMinutes, type CompanionState, type Session } from '../domain'
import './panel.css'

const labels = { meta_ads: 'Meta Ads', google_ads: 'Google Ads' } as const
const pretty = (iso: string) => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
function App() {
  const [state, setState] = useState<CompanionState>(initialState)
  const [notice, setNotice] = useState('')
  const [cloud, setCloud] = useState<{ email?: string | null; message?: string }>({})
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void chrome.storage.local.get(STORAGE_KEY).then(data => {
      if (data[STORAGE_KEY]) setState(data[STORAGE_KEY] as CompanionState)
    })
    void chrome.storage.local.get('fng_cloud_status').then(data => setCloud(data.fng_cloud_status ?? {}))
    const onChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && changes[STORAGE_KEY]?.newValue) setState(changes[STORAGE_KEY].newValue as CompanionState)
      if (area === 'local' && changes.fng_cloud_status?.newValue) setCloud(changes.fng_cloud_status.newValue)
    }
    chrome.storage.onChanged.addListener(onChange)
    return () => chrome.storage.onChanged.removeListener(onChange)
  }, [])
  async function command(message: object) {
    try {
      const result = await chrome.runtime.sendMessage(message) as {ok: boolean; error?: string}
      if (!result.ok) setNotice(result.error ?? 'No se pudo guardar')
    } catch { setNotice('No se pudo comunicar con la extensión') }
  }
  async function copySummary(session: Session) {
    const text = `${labels[session.platform]} | ID candidato: ${session.accountCandidate ?? 'sin identificar'} | ${pretty(session.startedAt)} | ${formatMinutes(session.focusedMs)} min aprox. | ${session.navigationSignals} señales de navegación. Pendiente de documentar en INFORMES FNG.`
    try { await navigator.clipboard.writeText(text); setNotice('Resumen copiado') }
    catch { setNotice('No se pudo copiar el resumen') }
  }
  const pending = state.sessions.filter(s => s.status === 'pending')
  return <main className="panel">
    <header><div className="eyebrow">FNG COMPANION · ALFA</div><h1>Sesiones de Ads</h1><p>Registro local, sin API de Meta ni Google.</p></header>
    <label className="toggle"><input type="checkbox" checked={state.enabled} onChange={e => void command({ type: 'FNG_SET_ENABLED', enabled: e.target.checked })}/> Seguimiento activo</label>
    <section className="cloud-connect"><h2>Sincronización con Informes FNG</h2>{cloud.email ? <><p>{cloud.email}</p><button disabled={busy} onClick={async () => { setBusy(true); try { await command({ type: 'FNG_CATALOG_REFRESH' }) } finally { setBusy(false) } }}>{busy ? 'Actualizando…' : 'Actualizar cuentas'}</button><button onClick={() => void command({ type: 'FNG_CLOUD_LOGOUT' })}>Desconectar nube</button></> : <form onSubmit={async event => { event.preventDefault(); setBusy(true); await command({ type: 'FNG_CLOUD_LOGIN', email, password }); setPassword(''); setBusy(false) }}><p>Usá el mismo correo de la web. Podés definir tu contraseña en Clientes → Conectar Companion. Al conectar se enviarán las sesiones pendientes.</p><label>Correo<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label><label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label><button disabled={busy}>{busy ? 'Conectando…' : 'Conectar y sincronizar'}</button></form>}{cloud.message ? <p role="status">{cloud.message}</p> : null}</section>
    {state.open && <section className="active"><span>Cuenta en primer plano</span><strong>{labels[state.open.platform]}</strong><p>ID candidato: {state.open.accountCandidate ?? 'No identificado'}</p><small>{formatMinutes(state.open.focusedMs)} min estimados · seguimiento aproximado</small></section>}
    <section><h2>Sin documentar <span>{pending.length}</span></h2>
      {pending.length === 0 && <p className="muted">Todavía no hay sesiones pendientes. Probá cambiar de pestaña después de trabajar en Ads Manager.</p>}
      {pending.slice(0,40).map(s => <article key={s.id}>
        <div className="session-head"><strong>{labels[s.platform]}</strong><small>{pretty(s.startedAt)}</small></div>
        <p>Cuenta: <b>{s.accountCandidate ?? 'Sin ID detectable'}</b></p>
        <p>{formatMinutes(s.focusedMs)} minutos estimados · {s.navigationSignals} señales de navegación</p>
        <div className="actions"><button onClick={() => void copySummary(s)}>Copiar</button><button onClick={() => void command({type:'FNG_DISMISS_SESSION',sessionId:s.id})}>Descartar aviso</button></div>
      </article>)}
    </section>
    {notice && <p role="status" className="notice">{notice}</p>}
    <footer>Las sesiones se sincronizan si conectaste tu cuenta. Navegar no verifica cambios en campañas: confirmá la revisión desde la web.</footer>
  </main>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>)
