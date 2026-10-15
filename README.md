# FNG Companion

**Extensión de Chrome (Manifest V3)** para ayudarte a recordar en qué cuentas publicitarias estuviste trabajando y cuánto tiempo aproximado pasaste en cada una. Complementa a [INFORMES FNG](https://github.com/Ian9Franco/INFORMES_FNG), la app Next.js + Supabase que contiene las revisiones e informes.

**Estado:** alfa experimental **v0.0.x**, con registro local y sincronización autenticada con Informes FNG; sin release estable. **No es una herramienta de auditoría de campañas.**

## Qué contiene esta base

- React + TypeScript en el panel lateral de Chrome y empaquetado sencillo con esbuild (sin Next.js y sin Vite).
- Worker MV3 con eventos de pestañas, foco e inactividad, y un chequeo periódico usando `chrome.alarms`.
- Detección por hostname/ruta de **Meta Ads Manager y Google Ads**.
- Lectura de **IDs candidatos** explícitos: Meta `act`; Google `cid`/`customerId` de 10 dígitos. `__c`, `ocid`, `uscid`, `asset_id`, IDs de campañas/grupos y usuarios no se equiparan al ID real de cliente.
- Cola de sesiones en `chrome.storage.local`: plataforma, candidato de cuenta, marcas de tiempo, minutos aproximados en primer plano y cantidad de señales de navegación; envío a Supabase al conectar la cuenta.
- Panel con sesiones pendientes de documentar, copia de resumen, opción para descartar y pausa de seguimiento.
- Test unitarios de detección de URL y pipeline CI.

**Implementado:** login explícito y envío deduplicado a Supabase. Informes resuelve los IDs reales contra sus clientes, incluyendo el catálogo de cuentas Google. Una sesión observada nunca confirma una revisión.

**No implementa:** detección de acciones reales, descubrimiento automático de vínculos no confirmados, notificaciones, reconciliación automática con revisiones, recordatorios, lectura de DOM, capturas ni API de Meta/Google.

## Primer inicio

Requisitos: Node.js 22, npm y Chrome 116+.

```bash
git clone https://github.com/Ian9Franco/FNG-Companion.git
cd FNG-Companion
git switch main
npm install
npm run check
```

En Chrome:

1. Ir a `chrome://extensions`.
2. Activar **Modo de desarrollador**.
3. Pulsar **Cargar descomprimida** y elegir la carpeta **`dist/`**.
4. Fijar la extensión y hacer clic en su ícono para abrir el **side panel**.
5. Conectar el mismo correo y contraseña que en Informes para cargar el catálogo privado. Abrir Ads Manager o Google Ads, mantener la pestaña en primer plano al menos 15 segundos y luego cambiar de pestaña para cerrar la sesión.

`npm run check` ejecuta TypeScript, pruebas de detección de URL y compilación. `npm run build` solo genera `dist/`. Al editar, recompilar y pulsar «Actualizar» en `chrome://extensions`.

## Permisos y privacidad

| Permiso | Motivo |
| --- | --- |
| Sin permiso general `tabs` | Las URLs sólo están disponibles por permisos de host; los eventos de cambio de pestaña permiten cerrar la sesión anterior |
| `idle` | No contabilizar cuando Chrome detecta inactividad |
| `alarms` | Reconcilia tiempo aproximadamente cada minuto; workers MV3 pueden dormirse |
| `storage` | Persistencia local de sesiones |
| `sidePanel` | Mostrar el panel lateral |
| Hosts específicos | `adsmanager.facebook.com`, rutas de Ads Manager en `business.facebook.com` y `ads.google.com` |

No lee cookies, contenido de campañas, pulsaciones ni tráfico privado; tampoco inyecta scripts. El login recibe únicamente las credenciales que ingresás expresamente, conserva la sesión en `chrome.storage.local` y envía sólo eventos de Ads si conectaste la cuenta. Nunca guarda URLs completas.

El detector admite únicamente HTTPS en Ads Manager, Google Ads (`/aw` o `/nav`) y las rutas explícitas `/latest/content_calendar` y `/latest/story_composer` de Business Suite. No procesa Facebook personal, búsquedas Google, Business Suite general ni sitios ajenos. Recibir eventos de cambio de pestaña sólo permite finalizar una sesión Ads, sin guardar el destino.

Las cuentas y contextos se cargan desde Supabase tras iniciar sesión, con RLS y caché local por usuario de una hora. No existe un catálogo real en el código. `act` y los candidatos Google se validan contra ese catálogo; `ocid`/`__c` o páginas Meta sólo se vinculan si la DB contiene una relación confirmada. No se interpretan como acciones realizadas. Para renovar inmediatamente: **Actualizar cuentas**. La caché se elimina al desconectar; las sesiones pendientes conservan su propietario.

Al salir de Ads no se guarda el destino. Sin sesión activa no se escribe navegación ajena. La salida remota contiene sólo campos permitidos y el ID canónico; no transmite URLs, parámetros internos, cookies ni credenciales. Nunca se identifica un cliente sólo por `business_id`, usuario o campaña.

Por diseño el cálculo de tiempo es una **estimación**, no un cronómetro perfecto: Chrome puede suspender workers o pestañas, hay eventos de foco/idle con latencia y URLs que no revelan el ID real. Las señales de navegación **no indican modificaciones de campañas**. Las sesiones están acotadas a las 500 más recientes en este prototipo: no representan un archivo histórico perpetuo.

## Contrato con INFORMES FNG

Una sesión de navegador **no es** una revisión declarada o verificada. Una cuenta externa se identifica por **(plataforma, cuenta)** y luego se vincula al cliente de FNG. Un cliente podría tener varias cuentas en cualquiera de las plataformas.

El intercambio usa Auth, `fng_ingest_activity` y registros `event` deduplicados por usuario/ID con RLS. No escribe snapshots completos ni copia la sesión de la PWA. Ver el estado implementado en [SINCRONIZACION_V1](https://github.com/Ian9Franco/INFORMES_FNG/blob/main/docs/SINCRONIZACION_V1.md); [el contrato inicial](docs/INTEGRACION.md) conserva el diseño histórico.

## Documentos

- [Arquitectura y limitaciones](docs/ARQUITECTURA.md)
- [Contrato de integración](docs/INTEGRACION.md)
- [Reglas de recordatorios](docs/RECORDATORIOS.md)
- [Backlog](docs/BACKLOG.md)
- [Roadmap](docs/ROADMAP.md)
- [Changelog](CHANGELOG.md)

## Comandos

| Comando | Descripción |
| --- | --- |
| `npm run typecheck` | Revisión estática TS |
| `npm run test` | Tests de identificación básica |
| `npm run build` | Compila en `dist/` |
| `npm run check` | Typecheck + tests + build |

## Convenciones

No registrar actividad de dominios ajenos a Ads Manager/Google Ads. Evitar inspección DOM y scraping automático sin revisión legal/técnica. Mantener los cambios de producto en el backlog y las releases en etiquetas, empezando por `v0.1.0` **solo cuando** pueda probarse el MVP del panel en Chrome real.

## Sincronización autenticada con Informes FNG

El panel permite conectar Supabase con el mismo correo y contraseña de la web. Se envían lotes de hasta 50 sesiones finalizadas, con deduplicación por ID y reintentos progresivos. Las sesiones se asocian al usuario que las capturó para no reenviarlas a otro login. No se envían URLs, cookies ni acciones de campaña inferidas.

Si la web usa magic link, definir una contraseña desde **Clientes → Conectar Companion**. Después de actualizar el código ejecutar `npm install`, `npm run build` y recargar `dist` en Chrome. El nuevo permiso de host es exclusivamente el proyecto Supabase de Informes FNG.

Las sesiones aparecen como evidencia en la jornada compartida; sólo guardar una revisión explícita completa el contador. Los avisos push siguen siendo una fase posterior.
