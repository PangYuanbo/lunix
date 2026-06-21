import React from 'react';
import { createRoot } from 'react-dom/client';
import './plan-b.css';

const media = '/media/';

const features = [
  ['Provider-owned sign-in', 'Connect Claude Code with your own subscription. Lunix never stores an API key.', 'lunix-agent'],
  ['Workspace runtime', 'Browse the real project, files, and processes without coupling them to the agent.', 'lunix-workspace'],
  ['Browser runtime', 'Open a real browser near the task, then take over whenever you want.', 'lunix-browser'],
];

function Video({ name }) {
  return <video autoPlay loop muted playsInline preload="metadata" poster={`${media}${name}.jpg`}><source src={`${media}${name}.mp4`} type="video/mp4" /></video>;
}

function PlanB() {
  return <main>
    <header>
      <a className="brand" href="/plan-b"><span>L</span><b>lunix</b></a>
      <nav><a href="#runtimes">Runtimes</a><a href="#system">System</a><a className="button secondary" href="/cloud-browser">Plan A</a></nav>
    </header>

    <section className="hero">
      <div className="hero-copy">
        <div className="mark">L</div>
        <h1>Lunix</h1>
        <p className="tagline">An operating system for agentic work.</p>
        <p className="intro">The desktop renders locally. Agent, workspace, and browser runtimes can live anywhere.</p>
        <div className="actions"><a className="button primary" href="/">Open Lunix <span>↗</span></a><a className="button" href="#runtimes">See how it works</a></div>
      </div>
      <div className="hero-media"><Video name="lunix-desktop" /></div>
    </section>

    <section className="section" id="runtimes">
      <div className="section-copy"><h2>Three runtimes.<br/>One operating system.</h2><p>Each runtime has one job. Lunix composes them into a desktop you can see, touch, and control.</p></div>
      <div className="runtime-grid">
        {features.map(([title, text, name]) => <article className="feature-card" key={name}><div className={`media ${name}`}><Video name={name} /></div><h3>{title}</h3><p>{text}</p></article>)}
      </div>
    </section>

    <section className="section" id="system">
      <div className="section-copy"><h2>Everything stays visible.</h2><p>No remote desktop stream. No hidden black box. The work appears as real windows in your local shell.</p></div>
      <div className="system-media"><Video name="lunix-desktop" /></div>
    </section>

    <section className="principles">
      <h2>Built for where software is going.</h2>
      <div>{[['Local shell','Windows, dock, files, and interaction render on your device.'],['Runtime freedom','Swap providers and regions without replacing your desktop.'],['Human control','Open, edit, take over, pause, or stop any part of the work.']].map(([title,text])=><article key={title}><span>✓</span><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>

    <section className="cta"><div><div className="mark small">L</div><h2>Your operating system stays with you.</h2><p>Compute can live anywhere.</p></div><a className="button primary" href="/">Open Lunix <span>↗</span></a></section>
    <footer><span>lunix</span><p>Local interface. Remote intelligence.</p><a href="/cloud-browser">View Plan A</a></footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<PlanB />);
