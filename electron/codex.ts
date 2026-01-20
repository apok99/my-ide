import { spawn } from 'node:child_process'

export const runCodex = (prompt: string, cwd: string) => {
  return new Promise<{ ok: boolean; output?: string; error?: string }>((resolve) => {
    const cmd = process.env.CODEX_CMD || 'codex'
    const proc = spawn(cmd, [], { cwd, stdio: 'pipe' })

    let output = ''
    let error = ''

    proc.stdout.on('data', (data) => {
      output += data.toString()
    })

    proc.stderr.on('data', (data) => {
      error += data.toString()
    })

    proc.on('error', (err) => {
      resolve({ ok: false, error: String(err) })
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true, output })
      } else {
        resolve({ ok: false, output, error: error || `Exit code ${code}` })
      }
    })

    proc.stdin.write(`${prompt}\n`)
    proc.stdin.end()
  })
}
