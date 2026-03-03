# INSTRUCCIONES_AGENTES.md

Guia operativa para cualquier agente que trabaje en este proyecto.

## Objetivo

Mantener el IDE sincronizado en tiempo real con:
- `agents-kanban.json` (tareas por estado: todo/doing/review/done/blocked)
- `agents-work.json` (estado de agentes para Mission Control)

Si no actualizas estos archivos, el equipo pierde visibilidad.

## Archivos obligatorios

1. `agents-kanban.json`
2. `agents-work.json`

## Reglas obligatorias

1. Antes de empezar, crea o actualiza tu tarea en `agents-kanban.json` con `status: "doing"`.
2. En paralelo, registra tu estado en `agents-work.json` con `status: "in_progress"`.
3. Solo puedes editar tus propias entradas (por `agent` en kanban y por `id` en agents-work).
4. Cada cambio de estado debe actualizar `updatedAt` en formato ISO 8601 UTC.
5. Si te bloqueas, marca:
- kanban: `status: "blocked"` + `blockedBy`
- agents-work: `status: "blocked"` + `blocker`
6. Al terminar:
- kanban: `status: "done"` (o `review` si necesita aprobacion humana)
- agents-work: `status: "completed"`
7. No rompas el JSON: siempre valida estructura y comas.

## Flujo de trabajo estandar

1. Inicio
- Lee `AGENTS_KANBAN_PROMPT.md`.
- Define un `agent id` estable (ejemplo: `ag_front_01`).
- Crea/actualiza tu tarea en `agents-kanban.json`.
- Crea/actualiza tu entrada en `agents-work.json`.

2. Ejecucion
- Cada avance real, actualiza:
- `task`
- `activeFile`
- `status`
- `updatedAt`

3. Bloqueo
- Describe bloqueo concreto (no genericos).
- Incluye dependencia real: dato, endpoint, credencial, revision, etc.

4. Cierre
- Deja trazabilidad final en descripcion/task.
- Marca estados finales y ETA null si ya terminaste.

## Contrato de datos

### agents-kanban.json (resumen)

Cada tarea debe incluir como minimo:
- `id`
- `title`
- `status`
- `agent`
- `createdAt`
- `updatedAt`

Estados validos:
- `todo`
- `doing`
- `review`
- `done`
- `blocked`

### agents-work.json (resumen)

Ruta esperada: `seed.agents[]`

Cada agente debe incluir como minimo:
- `id`
- `name`
- `status` (`pending | in_progress | blocked | completed`)
- `task`
- `updatedAt`

Campos recomendados:
- `repo`
- `branch`
- `activeFile`
- `etaMinutes`
- `blocker`

## Plantillas rapidas

### Plantilla tarea kanban

```json
{
  "id": "task-front-modal-001",
  "title": "Implementar modal de preview",
  "description": "Construccion UI y validaciones",
  "status": "doing",
  "agent": "ag_front_01",
  "priority": "high",
  "tags": ["front", "ui"],
  "createdAt": "2026-03-03T09:00:00.000Z",
  "updatedAt": "2026-03-03T09:15:00.000Z"
}
```

### Plantilla agente mission control

```json
{
  "id": "ag_front_01",
  "name": "Front UI Agent",
  "status": "in_progress",
  "task": "Maquetando modal de preview",
  "repo": "front",
  "branch": "feat/modal-preview",
  "activeFile": "front/src/components/ModalPreview.tsx",
  "etaMinutes": 20,
  "updatedAt": "2026-03-03T09:15:00.000Z"
}
```

## Checklist rapido (antes de responder al usuario)

1. `agents-kanban.json` actualizado.
2. `agents-work.json` actualizado.
3. `updatedAt` correcto en UTC.
4. Estado final correcto (`done/review` y `completed` o `blocked`).
5. Sin tocar tareas/entradas de otros agentes.

## Convencion recomendada de IDs

- Agentes: `ag_<area>_<numero>`
- Tareas: `task-<area>-<tema>-<numero>`

Ejemplos:
- `ag_back_02`
- `task-back-mail-template-003`

## Nota final

Si hay conflicto entre instrucciones, prioriza:
1. Seguridad del sistema
2. Integridad de datos JSON
3. Trazabilidad en kanban + mission control
4. Entrega tecnica
