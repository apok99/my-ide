type SettingsModalProps = {
  open: boolean
  onClose: () => void
}

type HotkeyGroup = {
  title: string
  items: Array<{ keys: string; action: string }>
}

const hotkeyGroups: HotkeyGroup[] = [
  {
    title: 'Busqueda y navegacion',
    items: [
      { keys: 'Shift Shift', action: 'Abrir buscador rapido de archivos' },
      { keys: 'Cmd/Ctrl + Shift + O', action: 'Abrir paleta de archivos' },
      { keys: 'Cmd/Ctrl + Shift + F', action: 'Buscar en archivos' },
      { keys: 'Cmd/Ctrl + T', action: 'Buscar simbolos del archivo' },
      { keys: 'Cmd/Ctrl + G', action: 'Ir a linea/columna' },
      { keys: 'Escape', action: 'Cerrar paletas o ajustes' },
    ],
  },
  {
    title: 'Paneles y layout',
    items: [
      { keys: 'Shift + C', action: 'Alternar fullscreen del editor' },
      { keys: 'Shift + E', action: 'Ocultar/mostrar Explorer' },
      { keys: 'Shift + W', action: 'Ocultar/mostrar Editor' },
      { keys: 'Cmd/Ctrl + Alt + 1/2/3', action: 'Presets del split terminal/editor' },
      { keys: 'Cmd/Ctrl + Alt + <- / ->', action: 'Ajustar split terminal/editor' },
    ],
  },
  {
    title: 'Trabajo diario',
    items: [
      { keys: 'Cmd/Ctrl + S', action: 'Guardar archivo activo' },
      { keys: 'Cmd/Ctrl + B', action: 'Ir al panel Agents' },
      { keys: 'Cmd/Ctrl + Shift + M', action: 'Mostrar/ocultar panel Problems' },
    ],
  },
]

const panelTips = [
  'Arrastra el divisor del Explorer para cambiar su ancho.',
  'Doble click en el divisor del Explorer para ocultarlo rapido.',
  'Arrastra el divisor central para cambiar ancho Terminal/Editor.',
  'El ancho y visibilidad de paneles se guardan automaticamente.',
]

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-white/10 bg-[#12141b] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-white">Ajustes</p>
            <p className="text-xs text-white/50">Hotkeys, layout y productividad</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-white/15 px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white"
          >
            Cerrar
          </button>
        </div>

        <div className="grid max-h-[70vh] grid-cols-1 gap-4 overflow-y-auto p-4 md:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            {hotkeyGroups.map((group) => (
              <section key={group.title} className="rounded border border-white/10 bg-[#0f1117] p-3">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/60">
                  {group.title}
                </h3>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div
                      key={`${group.title}-${item.keys}-${item.action}`}
                      className="flex items-center justify-between gap-3 rounded bg-white/[0.03] px-2 py-1.5"
                    >
                      <span className="text-xs text-white/80">{item.action}</span>
                      <code className="rounded border border-white/15 bg-black/30 px-2 py-0.5 text-[11px] text-blue-200">
                        {item.keys}
                      </code>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="space-y-4">
            <section className="rounded border border-white/10 bg-[#0f1117] p-3">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/60">
                Tips de paneles
              </h3>
              <div className="space-y-2">
                {panelTips.map((tip) => (
                  <p key={tip} className="rounded bg-white/[0.03] px-2 py-1.5 text-xs text-white/75">
                    {tip}
                  </p>
                ))}
              </div>
            </section>

            <section className="rounded border border-white/10 bg-[#0f1117] p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">
                Acceso rapido
              </h3>
              <p className="text-xs text-white/75">
                Abre este menu con <code className="text-blue-200">Cmd/Ctrl + ,</code>
              </p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
