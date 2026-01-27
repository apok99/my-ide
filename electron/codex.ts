import * as pty from 'node-pty'

export const runCodex = (prompt: string, cwd: string) => {
  return new Promise<{ ok: boolean; output?: string; error?: string }>((resolve) => {
    const cmd = process.env.CODEX_CMD || 'codex'
    let output = ''
    let resolved = false

    const finish = (payload: { ok: boolean; output?: string; error?: string }) => {
      if (resolved) {
        return
      }
      resolved = true
      resolve(payload)
    }

    try {
      const proc = pty.spawn(cmd, [], {
        cwd,
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        env: process.env,
      })

      const timeout = setTimeout(() => {
        proc.kill()
        finish({ ok: false, output, error: 'Codex timeout' })
      }, 120000)

      proc.onData((data) => {
        output += data
      })

      proc.onExit(({ exitCode }) => {
        clearTimeout(timeout)
        if (exitCode === 0) {
          finish({ ok: true, output })
        } else {
          finish({ ok: false, output, error: `Exit code ${exitCode}` })
        }
      })

      setTimeout(() => {
        proc.write(`${prompt}\r`)
      }, 80)
    } catch (err) {
      finish({ ok: false, error: String(err) })
    }
  })
}
