import type { JSX } from 'react'

function App(): JSX.Element {
  return (
    <main className="page">
      <header className="topbar">
        <span className="brand-mark">v</span>
        <span className="brand-name">northstar</span>
        <nav aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <button className="nav-button">Sign in</button>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">DESIGN THAT MOVES WITH YOU</p>
          <h1>Make room for<br /><span>better ideas.</span></h1>
          <p className="lede">A calmer workspace for ambitious teams. Shape your next big thing without losing the small details.</p>
          <button className="primary-button">Explore the workspace <span aria-hidden="true">→</span></button>
        </div>
        <div className="preview-card">
          <div className="card-topline"><span className="status-dot" /> Project overview <span className="card-date">Just now</span></div>
          <h2>Spring launch</h2>
          <p className="card-copy">Everything your team needs, moving in one direction.</p>
          <div className="progress-label"><span>Progress</span><strong>68%</strong></div>
          <div className="progress-track"><span /></div>
          <div className="avatar-row"><span className="avatar avatar-a">AM</span><span className="avatar avatar-b">JK</span><span className="avatar avatar-c">+3</span><span className="due-date">Due Oct 24</span></div>
        </div>
      </section>
      <section className="bottom-row" id="features">
        <article><span className="feature-icon">✦</span><strong>Thoughtful by default</strong><p>Small details, handled with care.</p></article>
        <article><span className="feature-icon">↗</span><strong>Built for momentum</strong><p>Keep good work moving forward.</p></article>
        <article><span className="feature-icon">◎</span><strong>Space to focus</strong><p>Less noise. More meaningful work.</p></article>
      </section>
    </main>
  )
}

export { App }
