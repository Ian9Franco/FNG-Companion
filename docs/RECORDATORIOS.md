# Motor de recordatorios propuesto (NO implementado)

## Dos reglas distintas

**A. Sesión sin documentar**: hubo sesión en una cuenta/plataforma, pero no consta una revisión o nota suficiente. Regla inicial sugerida: generar un candidato de aviso tras finalizar sesión si `focused_ms >= 10 min` y esperar 20 minutos después de la última edición de la PWA antes de notificar. La existencia de un registro debe silenciar el aviso. «Suficiente» no se determina por cantidad de palabras ni por tiempo trabajado; podrá configurarse como revisión confirmada o nota asociada.

**B. Revisión omitida**: una cuenta/plataforma tenía revisión **programada** para hoy o para un día/hora concreta y no consta ni sesión ni revisión. Solo funciona con calendario explícito por cuenta: no asumir que todos los clientes Meta y Google requieren revisión diaria.

## Anti-spam y preferencias

- Confirmar asociación de cuenta y cliente antes de generar avisos con nombres.
- Un aviso por regla, cuenta, jornada y ventana; claves idempotentes y cooldown.
- No alertar durante una sesión activa ni mientras el formulario de registro está abierto/editándose.
- Días laborables, horas silenciosas, zona horaria y límite máximo de notificaciones diarios.
- Posponer hasta mañana, próxima semana o fecha elegida; no crear duplicados al posponer.
- Botones: **Documentar**, **Ya documentado**, **Recordar mañana**, **Próxima semana**, **Descartar**.
- Dejar visible en la PWA una **bandeja silenciosa** incluso si push está desactivado.
- Para `3 eventos` indicar **señales de navegación detectadas**, no cambios verificados.

## Ejemplos de texto que no exageran

> Tolentinos · Meta Ads: detectamos 42 min estimados y 3 señales de navegación a las 12:34. No encontramos una revisión asociada. ¿Querés documentarla?

> Da Milán · Google Ads: estaba prevista una revisión hoy y no encontramos actividad registrada. Podés revisarla o posponerla.

La ausencia de actividad observada **no demuestra** que no se haya trabajado desde otro dispositivo/navegador. Mensaje honesto y opción «Ya lo hice».

## Notificaciones del teléfono a futuro

La instalación de una PWA en pantalla de inicio **no genera notificaciones automáticamente**. Para push real hace falta HTTPS, service worker de la web, `PushSubscription` y permisos aceptados por el usuario, backend con suscripción por dispositivo y un proceso programado (cron/worker/función programada) que evalúe reglas y envíe Web Push con VAPID u otra infraestructura compatible. En iPhone la compatibilidad de Web Push depende de una web app elegible instalada en Inicio y del soporte del sistema/navegador. Validar la plataforma real antes de lanzar.

La extensión puede ofrecer recordatorios en Chrome usando `chrome.notifications` en otra etapa, pero **no puede enviar directamente avisos al celular solo por estar instalada en desktop**. El scheduler de servidor debe consumir sesiones sincronizadas y revisiones en DB con autorización.

## Prioridad técnica

1. Sincronizar sesiones y revisiones sin pérdida ni duplicados.
2. Resolver nombres de cuentas y planes de revisión por plataforma.
3. Bandeja de sugerencias silenciosa en PWA.
4. Snooze y reglas de no molestar.
5. Service worker/Push y backend programado con pruebas en dispositivos.
