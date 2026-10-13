# Contrato propuesto de integración FNG (no implementado)

Este contrato describe **cómo** se conectaría Companion a INFORMES FNG. Ninguno de los endpoints/tablas nuevos se ha creado ni se está enviando actividad a Supabase.

## Entidades canónicas

```ts
type Platform = 'meta_ads' | 'google_ads'
type AdAccount = {
  id: string                    // ID interno UUID en FNG
  client_id: string             // referencia al cliente comercial
  platform: Platform
  external_id: string | null    // confirmado por usuario o fuente confiable
  display_name: string | null
  active: boolean
}
type BrowserSession = {
  id: string                    // UUID remoto
  source_event_id: string       // UUID generado en Companion, idempotente por usuario
  platform: Platform
  account_candidate: string | null
  account_id: string | null     // vínculo validado al configurar mapeo
  started_at: string            // ISO 8601 UTC
  ended_at: string              // ISO 8601 UTC
  focused_ms: number            // duración estimada activa
  navigation_signals: number    // NO cantidad de modificaciones de campañas
  status: 'unmatched' | 'needs_review' | 'linked' | 'dismissed'
}
```

Un cliente puede tener múltiples cuentas Meta Ads y Google Ads. La identidad externa debe resolverse mediante `(usuario, plataforma, external_id)`, **nunca** un ID aislado (puede repetirse en otras plataformas). Cuando una cuenta es desconocida, se solicita mapeo manual y se persiste solo tras confirmarlo.

## Flujo de carga futura

1. Companion registra eventos localmente y los agrega por sesión.
2. Usuario autoriza integración por flujo de autenticación diseñado explícitamente para extensiones (redirect Chrome Identity o procedimiento seguro equivalente). Sin copiar cookies ni credenciales.
3. Ingesta valida usuario, versión del payload, timestamps, duración y origen; no permite ID de otro usuario.
4. Insertar por `(user_id, source_event_id)` con restricción UNIQUE y RLS; duplicados se ignoran.
5. La PWA muestra sesiones aún no vinculadas / aún no documentadas.
6. Una revisión real del cliente/plataforma y fecha puede reconciliar la sesión; **no marcar automáticamente revisado** solo porque hubo una pestaña abierta.

## Convenciones de contrato

- Timestamp UTC, mostrar fechas en zona local `America/Argentina/Buenos_Aires` u otra seleccionada por usuario.
- Duración `focused_ms` no representa necesariamente edición activa de campañas.
- Diferenciar `observed`, `user_confirmed` y `externally_verified`; ninguna sesión de navegador otorga `externally_verified`.
- No agregar Google Ads o Meta Ads a la Marketing API; la extensión no consume ninguna de ellas.
- Nunca almacenar `service_role` ni secretos de servidor en la extensión.

Ver [diseño de recordatorios](RECORDATORIOS.md).
