const downloads = {
  mac: '/downloads/deivids-magic-studio-mac.dmg',
  windows: '/downloads/deivids-magic-studio-windows-x64.exe',
}

const highlights = [
  {
    title: 'Editor + terminal en un solo flujo',
    body: 'Abre, modifica y empaqueta sin saltar entre apps. Todo queda en un panel limpio y rapido.',
  },
  {
    title: 'Builds listas para distribuir',
    body: 'Descarga instaladores para tu equipo de macOS y Windows desde esta misma landing.',
  },
  {
    title: 'Interfaz pensada para shipping',
    body: 'Menos ruido, mas foco en iterar producto y entregar versiones estables.',
  },
]

export function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0a0f14] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(255,117,24,0.25),transparent_45%),radial-gradient(circle_at_85%_20%,rgba(0,169,255,0.22),transparent_40%),radial-gradient(circle_at_55%_80%,rgba(8,208,156,0.18),transparent_45%)]" />
      <div className="pointer-events-none absolute -top-40 right-[-10%] h-96 w-96 rounded-full bg-[#f25f2b]/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-20%] left-[-10%] h-[28rem] w-[28rem] rounded-full bg-[#00a9ff]/15 blur-3xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-black/30 text-sm font-bold tracking-wide">
            DMS
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/45">Desktop Release</p>
            <p className="text-lg font-semibold">Deivids Magic Studio</p>
          </div>
        </div>
        <a
          href={downloads.windows}
          download
          className="hidden rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition hover:-translate-y-0.5 md:inline-flex"
        >
          Descargar Windows
        </a>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-14 px-6 pb-16 pt-4">
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.55em] text-white/50">Build once. Ship faster.</p>
            <h1 className="text-4xl font-semibold leading-tight text-white md:text-6xl">
              Descarga Deivids Magic Studio para
              <span className="block bg-gradient-to-r from-[#ff9f5a] via-[#ffd7a2] to-[#84d8ff] bg-clip-text text-transparent">
                macOS y Windows
              </span>
            </h1>
            <p className="max-w-2xl text-base text-white/70 md:text-lg">
              Elige tu plataforma y empieza a trabajar con el IDE de tres paneles enfocado en desarrollo de apps de escritorio.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href={downloads.mac}
                download
                className="inline-flex items-center justify-center rounded-2xl bg-[#ff9f5a] px-6 py-3 text-sm font-semibold text-black shadow-[0_18px_45px_rgba(255,159,90,0.35)] transition hover:-translate-y-0.5 hover:bg-[#ffb682]"
              >
                Descargar para macOS
              </a>
              <a
                href={downloads.windows}
                download
                className="inline-flex items-center justify-center rounded-2xl border border-white/25 bg-black/25 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/45"
              >
                Descargar para Windows
              </a>
            </div>

            <p className="text-sm text-white/50">
              Tip: coloca los instaladores en <span className="font-mono text-white/80">public/downloads</span> para que estos botones funcionen al desplegar.
            </p>
          </div>

          <div className="rounded-3xl border border-white/15 bg-black/30 p-6 shadow-[0_40px_100px_rgba(0,0,0,0.45)]">
            <p className="text-sm uppercase tracking-[0.35em] text-white/45">Downloads</p>
            <div className="mt-5 grid gap-4">
              <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-lg font-semibold">macOS</p>
                <p className="mt-1 text-sm text-white/65">Intel y Apple Silicon (DMG)</p>
                <a
                  href={downloads.mac}
                  download
                  className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"
                >
                  Descargar Mac
                </a>
              </article>
              <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-lg font-semibold">Windows</p>
                <p className="mt-1 text-sm text-white/65">x64 (instalador EXE)</p>
                <a
                  href={downloads.windows}
                  download
                  className="mt-4 inline-flex rounded-xl bg-[#1da1ff] px-4 py-2 text-sm font-semibold text-[#02131f]"
                >
                  Descargar Windows
                </a>
              </article>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {highlights.map((item) => (
            <article key={item.title} className="rounded-2xl border border-white/10 bg-black/25 p-5">
              <h2 className="text-base font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm text-white/65">{item.body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}
