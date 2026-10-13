import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { STORAGE_KEY, initialState, formatMinutes, type CompanionState, type Session } from '../domain'
import './panel.css'

const labels = { meta_ads: 'Meta Ads', google_ads: 'Google Ads' } as const
const pretty = (iso: string) => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
function App() {
  const [state, setState] = useState<CompanionState>(initialState)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    void chrome.storage.local.get(STORAGE_KEY).then(data => {
      if (data[STORAGE_KEY]) setState(data[STORAGE_KEY] as CompanionState)
    })
    const onChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && changes[STORAGE_KEY]?.newValue) setState(changes[STORAGE_KEY].newValue as CompanionState)
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
    <footer>Los eventos de navegación NO verifican cambios en campañas. No se sincroniza con la PWA todavía.</footer>
  </main>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>)
