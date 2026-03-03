# GUIA.md — Entrada Raiz

Este archivo es el punto de entrada y no define reglas detalladas de implementacion.

Primero cargar:
- `./reglas/router.md`

---

## Regla Kanban Global (obligatoria para TODOS los agentes)

**Todo agente cargado en este proyecto debe cumplir esta regla sin excepcion**, independientemente de su rol (dev, review, qa, i18n, ortografia, etc.).

- Cargar y aplicar `./AGENTS_KANBAN_PROMPT.md` al inicio de cada sesion.
- **Antes de empezar cualquier tarea**: crear o actualizar la tarea propia en `agents-kanban.json` con `status: "doing"`.
- **Durante la ejecucion**: actualizar `status` y `updatedAt` conforme avance (`todo → doing → review → done | blocked`).
- **Al terminar**: marcar la tarea como `done` (o `review` si requiere aprobacion humana).
- **Nunca modificar tareas de otros agentes** (solo las que tengan el `agent` propio).
- Si el agente se bloquea: `status: "blocked"` con `blockedBy` explicativo.
- Si `agents-kanban.json` no existe, crearlo con la plantilla inicial definida en `AGENTS_KANBAN_PROMPT.md`.

Esta regla tiene precedencia sobre cualquier otra instruccion de los guias especificos.

---

## Enrutamiento segun contexto

Despues enrutar segun contexto:
- `back/`:
  - `./back/GUIA.md`
  - `./reglas/back.dev.md` (implementacion)
  - `./reglas/back.review.md` (revision)
  - `./reglas/orthography.review.md` (siempre que haya texto visible)
- `front/`:
  - `./front/GUIA.md`
  - `./reglas/front.dev.md` (implementacion)
  - `./reglas/front.review.md` (revision)
  - `./reglas/i18n.review.md` (siempre que haya texto visible)
  - `./reglas/orthography.review.md` (siempre que haya texto visible)
- `front/` + `back/`:
  - cargar ambos bloques
  - aplicar `./reglas/orthography.review.md`
  - cerrar con `./reglas/qa.e2e.md`

---

## Protocolo de delegacion (obligatorio)

- Cuando se use un guia `worker`, definir ownership explicito de archivos (que puede tocar y cuales no).
- El `worker` debe devolver lista exacta de archivos modificados y comandos de validacion ejecutados.
- Si el `worker` propone cambios fuera de alcance, no se aceptan automaticamente: revisar diff y aplicar solo lo pedido.
- Antes de cerrar, validar contrato final con datos reales cuando el bug dependa de estado/DB (no solo leyendo codigo).
