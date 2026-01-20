export function Landing() {
  return (
    <div className="relative h-screen w-full overflow-y-auto bg-[#0b0d12] text-white">
      <div className="pointer-events-none absolute left-[-20%] top-[-30%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,155,80,0.45),transparent_65%)] blur-3xl" />
      <div className="pointer-events-none absolute right-[-10%] top-[10%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(52,120,255,0.35),transparent_70%)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-20%] left-[20%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,rgba(14,214,150,0.25),transparent_65%)] blur-3xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg font-semibold">
            DM
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-white/50">IDE</p>
            <p className="text-lg font-semibold">Deivids Magic Studio</p>
          </div>
        </div>
        <div className="hidden items-center gap-6 text-sm text-white/70 md:flex">
          <span>Explorera</span>
          <span>Editor</span>
          <span>Terminales</span>
          <span>macOS</span>
        </div>
        <a
          href="/downloads/deivids-magic-studio-mac.dmg"
          download
          className="rounded-full bg-[#ff9b50] px-5 py-2 text-sm font-semibold text-black shadow-[0_0_24px_rgba(255,155,80,0.35)] transition hover:translate-y-[-1px] hover:bg-[#ffb073]"
        >
          Descargar Magic
        </a>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-16 pt-6">
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <p className="text-sm font-medium uppercase tracking-[0.5em] text-white/50">
              Construye. Itera. Compila.
            </p>
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
              El IDE que combina <span className="text-[#ff9b50]">tres paneles</span> para mantener tu
              foco y entregar builds de escritorio en macOS.
            </h1>
            <p className="max-w-xl text-base text-white/70">
              Abre proyectos, edita codigo y corre tu terminal con una vista modular. Todo
              preparado para compilar y distribuir tu app de escritorio desde un solo lugar.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href="/downloads/deivids-magic-studio-mac.dmg"
                download
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:translate-y-[-1px]"
              >
                Descargar Magic
              </a>
              <button
                type="button"
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 transition hover:border-white/40"
              >
                Ver flujo de compilacion
              </button>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-white/60">
              <span>macOS ready</span>
              <span>Atajos tipo VS Code</span>
              <span>Git integrado</span>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_0_60px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/60">Vista previa del layout</p>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">3 paneles</span>
            </div>
            <div className="mt-6 grid gap-4">
              <div className="grid grid-cols-[1fr_2fr] gap-3">
                <div className="rounded-2xl border border-white/10 bg-[#11131c] p-4">
                  <p className="text-xs text-white/40">Explorera</p>
                  <div className="mt-3 space-y-2 text-xs text-white/60">
                    <p>src/</p>
                    <p>components/</p>
                    <p>terminales/</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#0f1118] p-4">
                  <p className="text-xs text-white/40">Editor</p>
                  <div className="mt-3 space-y-2 text-xs text-white/60">
                    <p>const build = () =&gt; ship;</p>
                    <p>app.compile();</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0e1016] p-4">
                <p className="text-xs text-white/40">Terminales</p>
                <p className="mt-2 text-xs text-white/60">$ npm run build:macos</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: 'Panel de codigo y busqueda veloz',
              body: 'Encuentra archivos con doble shift, aplica cambios y guarda en caliente.',
            },
            {
              title: 'Git con contexto',
              body: 'Revision rapida de estado, commits guiados y sincronizacion preparada.',
            },
            {
              title: 'Compilacion macOS integrada',
              body: 'Prepara releases con un flujo claro y boton de descarga listo.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70"
            >
              <p className="text-base font-semibold text-white">{item.title}</p>
              <p className="mt-2">{item.body}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-8 rounded-3xl border border-white/10 bg-[#12141b]/80 p-8 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">Compilar</p>
            <h2 className="text-2xl font-semibold">Tu build macOS listo para compartir</h2>
            <p className="text-sm text-white/70">
              Ejecuta el pipeline de compilacion desde el terminal embebido y distribuye el dmg
              desde el boton principal.
            </p>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-white/70">
              <p className="text-white/50">Comandos sugeridos</p>
              <p className="mt-2">$ npm install</p>
              <p>$ npm run build</p>
              <p>$ npm run build:macos</p>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
              <p className="text-base font-semibold text-white">Entrega inmediata</p>
              <p className="mt-2">
                Comparte el instalador macOS con tu equipo sin salir del IDE.
              </p>
            </div>
            <a
              href="/downloads/deivids-magic-studio-mac.dmg"
              download
              className="w-full rounded-2xl bg-[#ff9b50] px-6 py-4 text-center text-sm font-semibold text-black shadow-[0_0_30px_rgba(255,155,80,0.3)] transition hover:translate-y-[-1px]"
            >
              Descargar Magic ahora
            </a>
          </div>
        </section>
      </main>
    </div>
  )
}
