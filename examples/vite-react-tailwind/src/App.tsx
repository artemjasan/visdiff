import type { JSX } from 'react'

function App(): JSX.Element {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 antialiased">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">v</span>
          <span className="text-base font-semibold tracking-tight text-slate-900">northstar</span>
        </div>
        <nav aria-label="Main navigation" className="flex items-center gap-6 text-sm">
          <a href="#features" className="text-slate-600 hover:text-slate-900">Features</a>
          <a href="#pricing" className="text-slate-600 hover:text-slate-900">Pricing</a>
          <button className="rounded-full border border-slate-300 px-4 py-1 font-medium text-slate-700">Sign in</button>
        </nav>
      </header>

      <section className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-8 md:flex-row">
        <div className="flex max-w-md flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">Design that moves with you</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Make room for<br /><span className="text-sky-600">better ideas.</span></h1>
          <p className="text-sm text-slate-600">A calmer workspace for ambitious teams. Shape your next big thing without losing the small details.</p>
          <button className="w-fit rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white">Explore the workspace <span aria-hidden="true">→</span></button>
        </div>
        <div id="preview-card" className="w-64 rounded-2xl border border-slate-200 bg-white p-gutter shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" />Project overview</span>
            <span>Just now</span>
          </div>
          <h2 className="mt-3 text-xl font-semibold text-slate-900">Spring launch</h2>
          <p className="mt-1 text-sm text-slate-600">Everything your team needs, moving in one direction.</p>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>Progress</span><strong className="text-slate-900">68%</strong></div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-100"><span className="block h-1.5 w-[68%] rounded-full bg-sky-500" /></div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span className="flex -space-x-2">
              <span className="flex size-6 items-center justify-center rounded-full border-2 border-white bg-sky-200 text-[10px] font-semibold text-sky-900">AM</span>
              <span className="flex size-6 items-center justify-center rounded-full border-2 border-white bg-emerald-200 text-[10px] font-semibold text-emerald-900">JK</span>
              <span className="flex size-6 items-center justify-center rounded-full border-2 border-white bg-amber-200 text-[10px] font-semibold text-amber-900">+3</span>
            </span>
            <span>Due Oct 24</span>
          </div>
        </div>
      </section>
      <section id="features" className="mx-auto grid max-w-5xl grid-cols-3 gap-6 px-6 pb-8">
        <article className="rounded-2xl border border-slate-200 bg-white p-5"><span className="text-lg text-sky-600">✦</span><strong className="mt-2 block text-sm font-semibold text-slate-900">Thoughtful by default</strong><p className="mt-1 text-xs text-slate-600">Small details, handled with care.</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5"><span className="text-lg text-sky-600">↗</span><strong className="mt-2 block text-sm font-semibold text-slate-900">Built for momentum</strong><p className="mt-1 text-xs text-slate-600">Keep good work moving forward.</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5"><span className="text-lg text-sky-600">◎</span><strong className="mt-2 block text-sm font-semibold text-slate-900">Space to focus</strong><p className="mt-1 text-xs text-slate-600">Less noise. More meaningful work.</p></article>
      </section>
    </main>
  )
}

export { App }
