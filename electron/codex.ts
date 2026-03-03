import { spawn } from 'node:child_process'

type AiProvider = 'codex' | 'claude'

const resolveCliCommand = (provider: AiProvider) => {
  if (provider === 'claude') {
    return process.env.CLAUDE_CMD || 'claude'
  }
  return process.env.CODEX_CMD || 'codex'
}

const stripAnsi = (value: string) =>
  value
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\u001B\][^\u0007]*(\u0007|\u001B\\)/g, '')
    .replace(/\u001B[PX^_].*?\u001B\\/g, '')
    .replace(/\u001B[@-_]/g, '')

const getArgsForProvider = (provider: AiProvider, prompt: string) => {
  if (provider === 'claude') {
    return ['--print', '--permission-mode', 'bypassPermissions', prompt]
  }
  return ['exec', '--color', 'never', '--skip-git-repo-check', '--full-auto', prompt]
}

export const runCodex = (prompt: string, cwd: string, provider: AiProvider = 'codex') => {
  return new Promise<{ ok: boolean; output?: string; error?: string }>((resolve) => {
    const cmd = resolveCliCommand(provider)
    const args = getArgsForProvider(provider, prompt)
    let stdout = ''
    let stderr = ''
    let resolved = false

    const finish = (payload: { ok: boolean; output?: string; error?: string }) => {
      if (resolved) {
        return
      }
      resolved = true
      resolve(payload)
    }

    try {
      const proc = spawn(cmd, args, {
        cwd,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM')
        const output = stripAnsi(`${stdout}\n${stderr}`.trim())
        finish({ ok: false, output, error: `${provider} timeout` })
      }, 180000)

      proc.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      proc.on('error', (error) => {
        clearTimeout(timeout)
        finish({ ok: false, error: String(error), output: stripAnsi(`${stdout}\n${stderr}`.trim()) })
      })

      proc.on('close', (code) => {
        clearTimeout(timeout)
        const output = stripAnsi(`${stdout}\n${stderr}`.trim())
        if (code === 0) {
          finish({ ok: true, output })
        } else {
          finish({ ok: false, output, error: `Exit code ${code}` })
        }
      })
    } catch (err) {
      finish({ ok: false, error: String(err) })
    }
  })
}
