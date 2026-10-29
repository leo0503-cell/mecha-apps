import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Code2,
  Menu,
  Play,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { Preview } from "./Preview";
export function Logo() {
  return (
    <a className="logo" href="#inicio" aria-label="Mecha, inicio">
      <svg viewBox="0 0 36 30" aria-hidden="true">
        <path
          d="M0 29V5h8l10 12L28 5h8v24H26V18l-8 10-8-10v11z"
          fill="currentColor"
        />
        <path d="m21 1 2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="var(--lime)" />
      </svg>
      mecha<span>®</span>
    </a>
  );
}
export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="header">
      <div className="container nav-wrap">
        <Logo />
        <nav
          aria-label="Navegación principal"
          className={open ? "nav open" : "nav"}
        >
          {[
            ["Inicio", "inicio"],
            ["Qué es Mecha", "mecha"],
            ["Soluciones", "paquetes"],
            ["Demos interactivas", "demos"],
          ].map(([t, id]) => (
            <a key={id} onClick={() => setOpen(false)} href={`#${id}`}>
              {t}
              {id === "demos" && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <a href="#contacto" className="button small nav-cta">
          Hablemos de tu proyecto <ArrowUpRight size={15} />
        </a>
        <button
          className="menu-button"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
export function Hero({ onDemo }: { onDemo: () => void }) {
  return (
    <section id="inicio" className="hero container">
      <motion.div
        className="hero-copy"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="eyebrow">
          <span className="status-dot" /> TECNOLOGÍA CON PROPÓSITO. IMPACTO
          REAL.
        </div>
        <h1>
          Menos fricción.
          <br />
          Más posibilidades.
          <br />
          <span>Eso es Mecha.</span>
        </h1>
        <p>
          Conectamos marketing, automatización e IA para transformar procesos
          complejos en herramientas que tu equipo sí quiere usar.
        </p>
        <div className="hero-actions">
          <a href="#demos" className="button primary">
            Explorar demos <ArrowUpRight size={18} />
          </a>
          <a href="#paquetes" className="text-link">
            Encuentra tu solución <ArrowRight size={17} />
          </a>
        </div>
        <div className="hero-note">
          <span>
            <Check size={13} /> Software a tu medida
          </span>
          <span>
            <Check size={13} /> Pensado para tu operación
          </span>
        </div>
      </motion.div>
      <motion.div
        className="hero-visual"
        initial={{ opacity: 0, y: 28, rotate: 1 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.8, delay: 0.15 }}
      >
        <div className="visual-label">
          <span className="status-dot" /> DEL PROBLEMA A LA SOLUCIÓN{" "}
          <span>MECHA LAB / 01</span>
        </div>
        <div className="hero-window">
          <div className="window-toolbar">
            <div>
              <i />
              <i />
              <i />
            </div>
            <span>mecha / soluciones / inventario-vivo</span>
            <span>↗</span>
          </div>
          <Preview kind="inventario" hero />
        </div>
        <div className="floating-card">
          <div className="floating-icon">
            <Zap size={18} />
          </div>
          <div>
            Tu operación, conectada.
            <small>Menos tareas manuales. Más control.</small>
          </div>
          <Check size={16} />
        </div>
        <button className="hero-demo button" onClick={onDemo}>
          <Play size={15} fill="currentColor" /> Pruébalo. Tienes 30 segundos.{" "}
          <ArrowUpRight size={16} />
        </button>
        <div className="orbit-mark">✳</div>
      </motion.div>
      <div className="hero-footer">
        <span>DEL “ASÍ LO HEMOS HECHO SIEMPRE” AL SIGUIENTE NIVEL.</span>
        <a href="#demos">
          Descubre lo que podemos construir <ArrowDown size={14} />
        </a>
      </div>
    </section>
  );
}
export function Capabilities() {
  return (
    <section id="mecha" className="capabilities section">
      <div className="container">
        <div className="section-heading">
          <div>
            <div className="eyebrow">01 / EL ESTUDIO</div>
            <h2>
              Tu siguiente ventaja
              <br />
              se construye aquí.
            </h2>
          </div>
          <p>
            Somos Mecha. Un estudio de tecnología para empresas que quieren
            avanzar. Partimos de lo que te frena y construimos una solución
            alrededor de tu equipo.
          </p>
        </div>
        <div className="cap-grid">
          {[
            {
              icon: Code2,
              title: "De idea a herramienta",
              text: "Prototipos que puedes tocar y software diseñado para resolver un proceso concreto.",
            },
            {
              icon: Workflow,
              title: "Todo mejor conectado",
              text: "Marketing, ventas y operación en el mismo flujo. Menos copiar y pegar, más seguimiento.",
            },
            {
              icon: Zap,
              title: "Hecho para evolucionar",
              text: "Integramos IA donde aporta valor y adaptamos cada solución al crecimiento de tu empresa.",
            },
          ].map(({ icon: Icon, title, text }, i) => (
            <article key={title}>
              <div className="cap-top">
                <Icon size={24} />
                <span>0{i + 1}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
