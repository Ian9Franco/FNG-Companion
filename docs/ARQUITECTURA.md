# Arquitectura y decisiones

## Responsabilidad y límites

La extensión es un **sensor local y recordatorio contextual**. La web [INFORMES FNG](https://github.com/Ian9Franco/INFORMES_FNG) sigue siendo la fuente de verdad para revisiones, notas, tareas y reportes entregados. No se infiere que haber abierto una cuenta equivale a haber trabajado bien en ella.

```text
Chrome (pestaña activa)
  └─ APIs tabs/windows/idle/alarms (MV3)
     └─ background.ts -> chrome.storage.local
        └─ Panel lateral -> sesiones por documentar

Implementado:
  Companion -> Auth/ingesta fng_ingest_activity -> Supabase (RLS)
  INFORMES FNG <- consulta sesiones y cruza con revisiones registradas

Etapa futura:
  Scheduler -> reglas + dispositivos push -> notificaciones (opt-in)
```

## Detección sin API

- **Meta Ads:** dominios de Ads Manager; `act` puede aportar un ID candidato numérico.
- **Google Ads:** `ads.google.com/aw` o `/nav`; sólo `cid`/`customerId` de 10 dígitos aportan candidatos. `__c`, `ocid` y `uscid` son contexto interno no vinculado automáticamente.
- **Business Suite:** calendario/compositor no forman parte del detector actual; `asset_id` no equivale a `act` ni garantiza una publicación.
- Siempre hay fallback «plataforma detectada, cuenta desconocida», que más adelante permitirá asignación manual.
- No guardar URL íntegra ni contenido de navegación.
- Si Meta/Google alteran sus rutas, los detectores pueden fallar. No depender de DOM profundo.

## Tiempo y actividad

La base usa el tiempo entre observaciones sobre una **pestaña de plataforma activa y Chrome enfocado**, mientras la API de idle reporta estado activo. Cada marca periódica se limita a 70 s para evitar contabilizar toda una ausencia luego de una suspensión larga.

Precauciones: el estado idle tiene retardo, la suspensión de Chrome pierde tiempo y eventos de pestaña pueden fusionarse. Mostrar siempre **«minutos estimados»**. El contador de señales indica aperturas/navegaciones, **NO cambios de campañas**. No almacenar capturas automáticas.

## Desarrollo

`npm run check` compila y prueba el código estático. El build deja un Manifest V3 y `panel.html`, `background.js`, `panel.js` y `panel.css` en `dist/`. Se necesitan pruebas manuales en Chrome para confirmar permiso, vista lateral, foco, pausa, idle, ruta SPA y multi-ventana.

## Seguridad futura

- Autenticación explícita de la extensión. Nunca extraer el token de la sesión de la web mediante lectura de cookies/DOM.
- Sin permiso general `tabs`: URLs restringidas por hosts declarados y rutas filtradas en el detector. Eventos globales de activación sólo permiten finalizar el trabajo anterior; no se persisten destinos ajenos.
- Nada de APIs privadas, interceptación de tráfico o scraping no autorizado.
- Ingesta con RLS y validación. La clave publicable de Supabase no reemplaza Auth.
- Los datos de sesiones tendrán expiración/borrado y opción de exportación si pasan al servidor.
