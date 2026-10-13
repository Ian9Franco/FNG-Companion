# Backlog — FNG Companion

**Fecha:** 2026-10-13. No tratar planificados como hechos.

| ID | Prioridad | Estado | Tarea | Criterio de aceptación |
| --- | --- | --- | --- | --- |
| CMP-001 | P0 | Base | MV3 + panel React TS + build/CI | Se genera `dist/` con manifest correcto; CI verde |
| CMP-002 | P0 | Base | Detectar Meta y Google Ads por URL | Tests con rutas válidas y rutas ajenas sin falsos positivos |
| CMP-003 | P0 | Base | Sesiones locales visibles y pausables | Registro en primer plano; cambio de tab finaliza; pausa funciona |
| CMP-004 | P0 | Pendiente | Pruebas manuales en Chrome | Multi-tab, SPA, idle, suspend/resume sin inflar tiempos |
| CMP-005 | P0 | Pendiente | Documentar/descartar sin confundir registro con visita | Sesión no marca revisión FNG por sí sola |
| CMP-006 | P1 | Pendiente | Resolver ID/alias cliente | Google y Meta con varias cuentas por cliente, fallback manual |
| CMP-007 | P1 | Pendiente | Integración segura con FNG | Auth explícita + RLS, carga idempotente, errores visibles |
| CMP-008 | P1 | Pendiente | Reconciliar sesiones con revisiones reales | Sin avisos para trabajo ya registrado y sin falsos completos |
| CMP-009 | P1 | Pendiente | Mejorar cálculo de tiempo | Idle, cambio de ventanas, cierres/crashes, señales robustas |
| CMP-010 | P1 | Pendiente | Ajustar permisos de Chrome | Quitar `tabs` si bastan hosts/activeTab con todas las funciones |
| CMP-011 | P1 | Pendiente | Accesibilidad y filtros | Fechas, cuentas, plataformas, estados y teclado |
| CMP-012 | P2 | Pendiente | Notificación local Chrome | Permiso explícito, reglas sin spam y posponer |
| CMP-013 | P2 | Pendiente | Push a PWA móvil | Implementar en FNG backend/push, no en la extensión |
| CMP-014 | P2 | Diferido | Detección DOM autorizada | No afirmar confirmación de cambios sin evidencia |
| CMP-015 | P2 | Pendiente | Publicar primera release | Manual QA, versión y tag `v0.1.0` con notas verificadas |

**El PR inicial es fundacional**: código de arranque, documentación y tests estáticos; instalación/verificación real en Chrome queda pendiente.
