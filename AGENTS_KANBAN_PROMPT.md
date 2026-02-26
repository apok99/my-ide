# Agent Kanban — System Instructions

You have access to a shared Kanban board that the IDE displays in real time.
**Always keep this file up to date** so the developer can see what you are doing.

## File location

```
{PROJECT_ROOT}/agents-kanban.json
```

The IDE polls this file every 3 seconds and renders your tasks as a live Kanban board.

---

## JSON Schema

```json
{
  "version": "1.0",
  "updatedAt": "<ISO 8601 timestamp>",
  "tasks": [
    {
      "id": "<unique string, e.g. uuid or slug>",
      "title": "<short imperative title, max ~60 chars>",
      "description": "<optional: what you are doing or why>",
      "status": "todo | doing | review | done | blocked",
      "agent": "<your agent name / identifier>",
      "priority": "low | medium | high",
      "tags": ["optional", "tags"],
      "createdAt": "<ISO 8601>",
      "updatedAt": "<ISO 8601>",
      "blockedBy": "<optional: reason if status is blocked>"
    }
  ]
}
```

### Status values

| Value | Meaning |
|-------|---------|
| `todo` | Planned, not started |
| `doing` | Actively working on it right now |
| `review` | Work done, needs human review / approval |
| `done` | Fully completed |
| `blocked` | Cannot proceed — set `blockedBy` field |

---

## Rules

1. **Create a task before you start work.** Set status to `doing` when you begin.
2. **Update `status` and `updatedAt` as you progress.** Never leave a task stuck in `doing` after you finish.
3. **One task per logical unit of work.** Split large tasks into subtasks with unique IDs.
4. **Always preserve existing tasks** from other agents — only modify tasks whose `agent` field matches yours.
5. **Set `updatedAt`** every time you write to the file.
6. **If you are blocked**, set `status: "blocked"` and explain the blocker in the `blockedBy` field.

---

## Bash helper (read → update → write)

```bash
# Read current kanban
KANBAN="$(cat agents-kanban.json 2>/dev/null || echo '{"version":"1.0","tasks":[]}')"

# Use node/python/jq to merge your task update, then write back:
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('agents-kanban.json', 'utf8'));
const now = new Date().toISOString();

// Update an existing task
const idx = data.tasks.findIndex(t => t.id === 'YOUR_TASK_ID');
if (idx >= 0) {
  data.tasks[idx].status = 'doing';
  data.tasks[idx].updatedAt = now;
} else {
  // Or add a new task
  data.tasks.push({
    id: 'YOUR_TASK_ID',
    title: 'Your task title',
    description: 'What you are doing',
    status: 'doing',
    agent: 'your-agent-name',
    priority: 'medium',
    tags: [],
    createdAt: now,
    updatedAt: now
  });
}
data.updatedAt = now;
fs.writeFileSync('agents-kanban.json', JSON.stringify(data, null, 2));
"
```

---

## Python helper

```python
import json, uuid
from datetime import datetime, timezone
from pathlib import Path

KANBAN_PATH = Path("agents-kanban.json")

def load():
    if KANBAN_PATH.exists():
        return json.loads(KANBAN_PATH.read_text())
    return {"version": "1.0", "tasks": []}

def save(data):
    data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    KANBAN_PATH.write_text(json.dumps(data, indent=2))

def upsert_task(task_id, **fields):
    data = load()
    now = datetime.now(timezone.utc).isoformat()
    existing = next((t for t in data["tasks"] if t["id"] == task_id), None)
    if existing:
        existing.update(fields)
        existing["updatedAt"] = now
    else:
        data["tasks"].append({
            "id": task_id,
            "createdAt": now,
            "updatedAt": now,
            **fields,
        })
    save(data)

# Examples:
upsert_task("auth-001", title="Implement JWT auth", status="doing", agent="claude", priority="high")
upsert_task("auth-001", status="done")
upsert_task("auth-002", title="Write auth tests", status="todo", agent="claude", priority="medium", tags=["tests"])
```

---

## Initial file template

If `agents-kanban.json` does not exist, create it with this content:

```json
{
  "version": "1.0",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "tasks": []
}
```

---

## Example populated file

```json
{
  "version": "1.0",
  "updatedAt": "2024-06-15T14:32:00.000Z",
  "tasks": [
    {
      "id": "feat-auth-001",
      "title": "Implement JWT authentication",
      "description": "Adding token-based auth to all API endpoints using jose library",
      "status": "doing",
      "agent": "claude-backend",
      "priority": "high",
      "tags": ["backend", "auth", "api"],
      "createdAt": "2024-06-15T13:00:00.000Z",
      "updatedAt": "2024-06-15T14:32:00.000Z"
    },
    {
      "id": "feat-auth-002",
      "title": "Write auth unit tests",
      "description": "Cover login, refresh token and protected route cases",
      "status": "todo",
      "agent": "claude-backend",
      "priority": "medium",
      "tags": ["tests", "auth"],
      "createdAt": "2024-06-15T13:00:00.000Z",
      "updatedAt": "2024-06-15T13:00:00.000Z"
    },
    {
      "id": "ui-login-001",
      "title": "Build login form UI",
      "status": "review",
      "agent": "claude-frontend",
      "priority": "high",
      "tags": ["ui", "auth"],
      "createdAt": "2024-06-15T10:00:00.000Z",
      "updatedAt": "2024-06-15T14:00:00.000Z"
    },
    {
      "id": "db-migrate-001",
      "title": "Run database migrations",
      "status": "blocked",
      "agent": "claude-backend",
      "priority": "high",
      "blockedBy": "Waiting for production DB credentials from DevOps",
      "createdAt": "2024-06-15T09:00:00.000Z",
      "updatedAt": "2024-06-15T12:00:00.000Z"
    }
  ]
}
```
