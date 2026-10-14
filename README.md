# FNG Companion

**Extensión de Chrome (Manifest V3)** para ayudarte a recordar en qué cuentas publicitarias estuviste trabajando y cuánto tiempo aproximado pasaste en cada una. Complementa a [INFORMES FNG](https://github.com/Ian9Franco/INFORMES_FNG), la app Next.js + Supabase que contiene las revisiones e informes.

**Estado:** esqueleto técnico experimental **v0.0.x**, sin release ni integración remota; el nombre del repo no lleva versión. **No es una herramienta de auditoría de campañas.**

## Qué contiene esta base

- React + TypeScript en el panel lateral de Chrome y empaquetado sencillo con esbuild (sin Next.js y sin Vite).
- Worker MV3 con eventos de pestañas, foco e inactividad, y un chequeo periódico usando `chrome.alarms`.
- Detección por hostname/ruta de **Meta Ads Manager y Google Ads**.
- Lectura de **IDs candidatos** únicamente cuando existen parámetros explícitos en la URL. Google `ocid` no se interpreta como ID verificado.
- Sesiones guardadas solo en `chrome.storage.local`: plataforma, candidato de cuenta, marcas de tiempo, minutos aproximados en primer plano y cantidad de señales de navegación.
- Panel con sesiones pendientes de documentar, copia de resumen, opción para descartar y pausa de seguimiento.
- Test unitarios de detección de URL y pipeline CI.

**No implementa:** conexión a INFORMES FNG / Supabase, asociación de IDs con nombre comercial, notificaciones de escritorio o celular, comparación con revisiones, recordatorios de cuentas no visitadas, lectura profunda de DOM, capturas ni API de Meta/Google. Todo eso está definido como desarrollo posterior.

## Primer inicio

Requisitos: Node.js 22, npm y Chrome 116+.

```bash
git clone https://github.com/Ian9Franco/FNG-Companion.git
cd FNG-Companion
git switch feat/extension-foundation
npm install
npm run check
```

En Chrome:

1. Ir a `chrome://extensions`.
2. Activar **Modo de desarrollador**.
3. Pulsar **Cargar descomprimida** y elegir la carpeta **`dist/`**.
4. Fijar la extensión y hacer clic en su ícono para abrir el **side panel**.
5. Abrir Ads Manager o Google Ads, mantener la pestaña en primer plano y luego cambiar de pestaña para cerrar la sesión.

`npm run check` ejecuta TypeScript, pruebas de detección de URL y compilación. `npm run build` solo genera `dist/`. Al editar, recompilar y pulsar «Actualizar» en `chrome://extensions`.

## Permisos y privacidad

| Permiso | Motivo |
| --- | --- |
| `tabs` | Conocer tab activa y URL de las plataformas permitidas |
| `idle` | No contabilizar cuando Chrome detecta inactividad |
| `alarms` | Reconcilia tiempo aproximadamente cada minuto; workers MV3 pueden dormirse |
| `storage` | Persistencia local de sesiones |
| `sidePanel` | Mostrar el panel lateral |
| Hosts específicos | `adsmanager.facebook.com`, rutas de Ads Manager en `business.facebook.com` y `ads.google.com` |

**No** lee cookies, passwords, tokens, contenido de campañas, pulsaciones de teclado ni tráfico privado. No recorre todas las páginas. No envía datos a servidor alguno. Se guardan solo IDs candidatos y metadatos de las sesiones, no las URLs completas.

Por diseño el cálculo de tiempo es una **estimación**, no un cronómetro perfecto: Chrome puede suspender workers o pestañas, hay eventos de foco/idle con latencia y URLs que no revelan el ID real. Las señales de navegación **no indican modificaciones de campañas**. Las sesiones están acotadas a las 500 más recientes en este prototipo: no representan un archivo histórico perpetuo.

## Contrato futuro con INFORMES FNG

Una sesión de navegador **no es** una revisión declarada o verificada. Una cuenta externa se identifica por **(plataforma, cuenta)** y luego se vincula al cliente de FNG. Un cliente podría tener varias cuentas en cualquiera de las plataformas.

El intercambio futuro debe utilizar autenticación validada, idempotencia por `source_event_id` y filas con RLS. No reutilizar directamente el JSONB completo `public.workspaces` para los eventos ni copiar un token de sesión de la PWA a la extensión. Ver [contrato de integración](docs/INTEGRACION.md) y el [contrato de la app](https://github.com/Ian9Franco/INFORMES_FNG/blob/feat/pwa-foundation/docs/COMPANION_INTEGRACION.md).

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
