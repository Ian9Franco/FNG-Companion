# Changelog — FNG Companion

Se usa una secuencia de versiones independiente de INFORMES FNG. No hay tags ni releases publicados todavía.

## [Unreleased] — 2026-10-13

### Actualización de integración y privacidad
- IDs y vínculos reales eliminados del código: catálogo autenticado desde Supabase, caché privada por usuario de una hora, fallback offline y botón «Actualizar cuentas». Sólo identificadores ficticios en pruebas.
- Calendario/compositor Meta y contextos Google se asocian únicamente mediante vínculos privados confirmados de la DB; se ignoran IDs de usuario, negocio y campaña. Historial Git pendiente, sin force-push.
- Login de la misma cuenta de Informes, cola local y carga autenticada de sesiones observadas en lotes de hasta 50; deduplicación en servidor.
- Sin permiso global `tabs`, historial ni scripts de contenido; dominios exactos, HTTPS y rutas Ads con límites de segmento. Cambios a otros sitios sólo cierran la sesión Ads anterior; no guardan navegación ajena.
- Sólo navegación de pestaña activa modifica señales. No hay escrituras de estado mientras se navega fuera del alcance sin una sesión Ads abierta.
- Google `cid`/`customerId` exige 10 dígitos; IDs internos `__c`/`ocid`/`uscid` y `asset_id` de Meta no se vinculan como cuentas reales. Payload remoto explícito y saneamiento de candidatos antiguos.
- 17 pruebas de detección, permisos, payload, caché y worker con adaptadores aislados, sin cuentas ni escrituras reales.

### Added
- Base de extensión Chrome Manifest V3: background worker y panel lateral React + TypeScript.
- Compilación esbuild, CI y tests de URLs de Meta Ads Manager y Google Ads.
- Sesiones locales aproximadas mediante pestaña activa, foco, inactividad y alarmas.
- Interfaz para ver pendientes, copiar resúmenes, descartar avisos y pausar.
- Documentación de integración, arquitectura, recordatorios, backlog y roadmap.

### Not implemented
- Avisos programados, Web Push y descubrimiento automático de contextos Google/páginas Business Suite; los vínculos confirmados en DB sí funcionan.
- Identificación oficial de cambios en campañas; la sincronización de sesiones con la PWA sí está implementada.

## Versión planificada [0.1.0] (sin publicar)

La primera release requiere validación en Chrome real, corrección de sesiones/cambio de cuenta, e identificación honesta de IDs desconocidos. Ninguna sesión debe contarse como modificación de campañas.
