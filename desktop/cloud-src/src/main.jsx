import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import './styles.css';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const runtimes = [
  {
    id: '01',
    name: 'Agent Runtime',
    label: 'The brain',
    text: 'Runs Claude Code and future agents in isolated, resumable compute. Authentication, sessions, and model state stay outside the desktop.',
    detail: ['Provider-owned identity', 'Pause and resume', 'Replaceable harness'],
    icon: 'spark',
  },
  {
    id: '02',
    name: 'Workspace Runtime',
    label: 'The hands',
    text: 'Owns files, terminals, processes, and build tools. The agent can change while the project and its running services remain intact.',
    detail: ['Persistent project state', 'Shell and file APIs', 'Portable execution'],
    icon: 'folder',
  },
  {
    id: '03',
    name: 'Browser Runtime',
    label: 'The eyes',
    text: 'Provides a real browser close to the task. Lunix presents it inside a native-feeling window with human takeover whenever needed.',
    detail: ['Secure web sessions', 'Regional execution', 'Human handoff'],
    icon: 'browser',
  },
];

const principles = [
  ['Local shell', 'Windows, dock, files, previews, and interaction are rendered on your device. The desktop stays crisp because it is an application, not a video feed.'],
  ['Runtime freedom', 'Agent, workspace, and browser are contracts—not one giant VM. Each can move, scale, pause, or be replaced independently.'],
  ['Visible work', 'Files, terminal output, browser sessions, and agent events remain inspectable. Automation never has to become a black box.'],
  ['Human control', 'Take over the browser, edit a file, open a terminal, or stop a runtime without leaving the operating environment.'],
];

const flow = [
  ['Ask', 'Describe the application in the Agent window.'],
  ['Build', 'The agent writes and runs it inside the Workspace runtime.'],
  ['Expose', 'Nodus turns localhost into a scoped HTTPS preview URL.'],
  ['Preview', 'Browser runtime opens the app inside the Lunix desktop.'],
];

function Icon({ name }) {
  const paths = {
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="m19 16 .7 2 .7-2-.7-2Z"/></>,
    folder: <><path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h4l2 2.5h6A2.5 2.5 0 0 1 20.5 10v7A2.5 2.5 0 0 1 18 19.5H6A2.5 2.5 0 0 1 3.5 17Z"/><path d="M8 12h8M8 15h5"/></>,
    browser: <><rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M3 9.5h18M7 7h.01M10.5 7h.01"/></>,
    monitor: <><rect x="3" y="4" width="18" height="14" rx="2.5"/><path d="M8 21h8M12 18v3"/></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function LunixPage() {
  const root = useRef(null);

  useGSAP(() => {
    gsap.from('.hero-line', { yPercent: 105, duration: 1, stagger: 0.08, ease: 'power4.out' });
    gsap.from('.hero-fade', { y: 20, opacity: 0, duration: 0.8, stagger: 0.08, delay: 0.25, ease: 'power2.out' });
    gsap.from('.shell-demo', { y: 26, opacity: 0, scale: 0.985, duration: 1, delay: 0.3, ease: 'power3.out' });

    gsap.utils.toArray('.reveal').forEach((element) => {
      gsap.from(element, {
        y: 32,
        opacity: 0,
        duration: 0.75,
        ease: 'power2.out',
        scrollTrigger: { trigger: element, start: 'top 86%', toggleActions: 'play none none none' },
      });
    });

    gsap.to('.architecture-orbit', {
      rotate: 360,
      duration: 42,
      repeat: -1,
      ease: 'none',
    });

    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 300);
    return () => window.clearTimeout(refresh);
  }, { scope: root });

  return (
    <main ref={root} className="site-shell">
      <header className="topbar">
        <a className="wordmark" href="#home" aria-label="Lunix home"><b>L</b><span>lunix</span></a>
        <nav>
          <a href="#architecture">Architecture</a>
          <a href="#renderer">Renderer</a>
          <a href="#workflow">Workflow</a>
          <a href="#principles">Principles</a>
        </nav>
        <a className="nav-cta" href="/">Open Lunix <Icon name="arrow" /></a>
      </header>

      <section className="hero" id="home">
        <div className="hero-copy">
          <p className="eyebrow hero-fade"><span /> Agent-native operating system</p>
          <h1>
            <span className="hero-mask"><span className="hero-line">An OS for agents.</span></span>
            <span className="hero-mask"><span className="hero-line accent-line">Rendered where</span></span>
            <span className="hero-mask"><span className="hero-line accent-line">you are.</span></span>
          </h1>
          <p className="hero-description hero-fade">
            Lunix is a locally rendered desktop for remote intelligence. It separates the agent, workspace, and browser into independent runtimes—then composes them into one fast, inspectable operating environment.
          </p>
          <div className="hero-actions hero-fade">
            <a className="primary-button" href="/">Launch the desktop <Icon name="arrow" /></a>
            <a className="text-button" href="#architecture">See how it works <span>↓</span></a>
          </div>
          <div className="hero-note hero-fade">
            <span className="status-dot" /> No remote desktop. No full-screen pixel stream. The shell runs here.
          </div>
        </div>

        <DesktopDemo />
      </section>

      <section className="statement reveal">
        <p>01 / Thesis</p>
        <h2>The next operating system is not a bigger virtual machine.</h2>
        <p className="statement-copy">It is a local interface that can compose intelligence and compute from anywhere—without turning the entire desktop into an RDP session.</p>
      </section>

      <section className="section" id="architecture">
        <SectionHeading number="02" eyebrow="Architecture" title="One desktop. Three runtimes." text="Each runtime has one job and one lifecycle. Lunix connects them through explicit APIs instead of hiding everything inside a monolithic cloud computer." />
        <div className="runtime-grid">
          {runtimes.map((runtime) => <RuntimeCard runtime={runtime} key={runtime.id} />)}
        </div>
        <ArchitectureMap />
      </section>

      <section className="section renderer-section" id="renderer">
        <SectionHeading number="03" eyebrow="Local renderer" title="An application, not a livestream." text="Traditional cloud desktops encode the whole screen and send pixels back. Lunix renders the OS shell locally and connects only the runtime surfaces it needs." />
        <div className="comparison-grid">
          <div className="comparison-card muted-card reveal">
            <div className="comparison-label">Remote desktop</div>
            <h3>Cloud VM → encode every frame → stream pixels</h3>
            <div className="rdp-visual"><div className="cloud-box">Cloud desktop</div><div className="pixel-stream">▦ ▦ ▦ ▦ ▦</div><div className="device-box">Thin client</div></div>
            <ul><li>Whole desktop pays network latency</li><li>Text and controls arrive as pixels</li><li>One machine couples every workload</li></ul>
          </div>
          <div className="comparison-card local-card reveal">
            <div className="comparison-label">Lunix</div>
            <h3>Local OS renderer ↔ structured runtime connections</h3>
            <div className="local-visual">
              <div className="local-shell-mini"><span /><span /><span /><b>Local desktop shell</b></div>
              <div className="runtime-pills"><span>Agent events</span><span>Workspace FS</span><span>Browser surface</span></div>
            </div>
            <ul><li>Windowing and interaction stay local</li><li>Each runtime scales independently</li><li>Native-feeling input and composition</li></ul>
          </div>
        </div>
      </section>

      <section className="section" id="workflow">
        <SectionHeading number="04" eyebrow="Live development" title="From prompt to preview, inside one OS." text="The runtimes may live in different places. Nodus securely connects them so an app running on workspace localhost can open in the Browser window without a VPN mesh." />
        <div className="flow-grid">
          {flow.map(([title, text], index) => (
            <div className="flow-step reveal" key={title}>
              <span>0{index + 1}</span><div className="flow-icon"><Icon name={index === 0 ? 'spark' : index === 1 ? 'folder' : index === 2 ? 'arrow' : 'browser'} /></div>
              <h3>{title}</h3><p>{text}</p>
            </div>
          ))}
        </div>
        <div className="preview-protocol reveal">
          <div className="protocol-code"><span>$</span> npm run dev -- --host 0.0.0.0<br/><span>✓</span> Local: http://localhost:5173</div>
          <div className="protocol-arrow"><Icon name="arrow" /></div>
          <div className="protocol-result"><span className="status-dot" /> Scoped HTTPS preview<br/><small>Opened automatically in Browser runtime</small></div>
        </div>
      </section>

      <section className="section" id="principles">
        <SectionHeading number="05" eyebrow="System principles" title="Built around the work, not the machine." text="Lunix treats the desktop as a durable control surface while compute remains modular, observable, and disposable." />
        <div className="principle-grid">
          {principles.map(([title, text], index) => (
            <article className="principle-card reveal" key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>
          ))}
        </div>
      </section>

      <section className="final-cta reveal">
        <p className="eyebrow"><span /> The interface for autonomous work</p>
        <h2>Compute can live anywhere.<br/>Your operating system stays with you.</h2>
        <a className="primary-button" href="/">Enter Lunix <Icon name="arrow" /></a>
      </section>

      <footer>
        <a className="wordmark" href="#home"><b>L</b><span>lunix</span></a>
        <p>Local interface. Remote intelligence.</p>
        <p>Agent / Workspace / Browser</p>
      </footer>
    </main>
  );
}

function DesktopDemo() {
  return (
    <div className="shell-demo">
      <div className="demo-topbar"><div className="demo-brand">lu<b>n</b>ix</div><div className="demo-status"><span /> rendered locally</div></div>
      <div className="demo-canvas">
        <div className="demo-window agent-window">
          <WindowBar title="Agent" />
          <div className="agent-body"><div className="agent-spark"><Icon name="spark" /></div><div><small>Claude Code</small><p>Build a small analytics dashboard and open the preview.</p></div></div>
          <div className="agent-progress"><span /><span /><span /></div>
        </div>
        <div className="demo-window browser-window">
          <WindowBar title="Browser" />
          <div className="browser-address"><span /> preview.lunix.run</div>
          <div className="browser-content"><div className="chart-title">Workspace activity</div><div className="chart"><i /><i /><i /><i /><i /><i /></div><div className="chart-row"><span /><span /><span /></div></div>
        </div>
        <div className="demo-dock"><Icon name="spark" /><Icon name="folder" /><Icon name="browser" /><Icon name="monitor" /></div>
      </div>
      <div className="demo-footer"><span>Local renderer</span><i /><span>Modal runtimes connected</span></div>
    </div>
  );
}

function WindowBar({ title }) {
  return <div className="window-bar"><div><i /><i /><i /></div><span>{title}</span><b>+</b></div>;
}

function RuntimeCard({ runtime }) {
  return (
    <article className="runtime-card reveal">
      <div className="runtime-card-top"><span>{runtime.id}</span><div className="runtime-icon"><Icon name={runtime.icon} /></div></div>
      <p className="runtime-label">{runtime.label}</p><h3>{runtime.name}</h3><p>{runtime.text}</p>
      <ul>{runtime.detail.map((item) => <li key={item}><Icon name="check" /> {item}</li>)}</ul>
    </article>
  );
}

function ArchitectureMap() {
  return (
    <div className="architecture-map reveal">
      <div className="map-copy"><p className="eyebrow"><span /> Composition layer</p><h3>The desktop knows capabilities, not infrastructure.</h3><p>A browser can run near a website. A workspace can persist near its data. An agent can use the provider and region you choose. Lunix presents them as one system.</p></div>
      <div className="map-visual">
        <div className="architecture-orbit" />
        <div className="map-center"><Icon name="monitor" /><span>Lunix</span><small>local shell</small></div>
        <div className="map-node node-agent"><Icon name="spark" /><span>Agent</span></div>
        <div className="map-node node-workspace"><Icon name="folder" /><span>Workspace</span></div>
        <div className="map-node node-browser"><Icon name="browser" /><span>Browser</span></div>
      </div>
    </div>
  );
}

function SectionHeading({ number, eyebrow, title, text }) {
  return <div className="section-heading reveal"><div><span>{number}</span><p>{eyebrow}</p></div><h2>{title}</h2><p>{text}</p></div>;
}

createRoot(document.getElementById('root')).render(<LunixPage />);
