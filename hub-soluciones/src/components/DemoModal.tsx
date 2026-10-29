import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, LockKeyhole, Timer, X } from "lucide-react";
import type { Project } from "../data/projects";
import { getDeadline, secondsRemaining } from "../trial";
import { DemoApps } from "./DemoApps";
export function TrialLock({
  onQuote,
  onExplore,
}: {
  onQuote: () => void;
  onExplore: () => void;
}) {
  return (
    <div className="lock-overlay">
      <div className="lock-card">
        <div className="lock-icon">
          <LockKeyhole size={25} />
        </div>
        <div className="eyebrow">TU SIGUIENTE PASO EMPIEZA AQUÍ</div>
        <h2>
          ¿Quieres implementar esta solución o una similar 100% personalizada
          para tu empresa?
        </h2>
        <p>
          Haz que tu equipo trabaje más rápido con herramientas hechas a la
          medida de tu operación.
        </p>
        <button autoFocus className="button primary" onClick={onQuote}>
          Ver paquetes y cotizar mi proyecto <ArrowUpRight size={17} />
        </button>
        <button className="text-link" onClick={onExplore}>
          Explorar otras demos →
        </button>
      </div>
    </div>
  );
}
export function DemoModal({
  project,
  onClose,
  onQuote,
}: {
  project: Project;
  onClose: () => void;
  onQuote: (project: Project) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [deadline] = useState(() => getDeadline(project.id));
  const [remaining, setRemaining] = useState(() =>
    secondsRemaining(deadline, Date.now()),
  );
  const expired = remaining === 0;
  const quoteButton = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    el.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      el.close();
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    const update = () => setRemaining(secondsRemaining(deadline, Date.now()));
    const id = window.setInterval(update, 100);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", update);
    };
  }, [deadline]);
  useEffect(() => {
    if (expired) quoteButton.current?.querySelector("button")?.focus();
  }, [expired]);
  return (
    <dialog
      ref={dialog}
      className="demo-dialog"
      aria-labelledby="demo-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="demo-shell">
        <header className="demo-header">
          <div>
            <project.icon size={21} />
            <div>
              <h2 id="demo-title">{project.name}</h2>
              <small>{project.origin} · Versión de muestra</small>
            </div>
          </div>
          <div className="demo-controls">
            <span
              className={`timer ${remaining <= 10 ? "urgent" : ""}`}
              role="timer"
              aria-label={`Tiempo de prueba gratuita: ${remaining} segundos`}
            >
              <Timer size={17} />
              <span>Tiempo de prueba gratuita:</span>{" "}
              <strong>00:{String(remaining).padStart(2, "0")}</strong>
            </span>
            <button
              className="icon-button"
              aria-label="Cerrar demo"
              onClick={onClose}
            >
              <X size={22} />
            </button>
          </div>
        </header>
        <div className="demo-content">
          <div
            inert={expired}
            className={`app-sandbox ${expired ? "expired" : ""}`}
            aria-hidden={expired}
          >
            <DemoApps id={project.id} />
          </div>
          {expired && (
            <div ref={quoteButton}>
              <TrialLock
                onQuote={() => onQuote(project)}
                onExplore={() => {
                  onClose();
                  document
                    .getElementById("demos")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              />
            </div>
          )}
        </div>
        <footer className="demo-disclaimer">
          <span className="status-dot" /> Entorno de muestra · Datos ficticios ·
          Cambios solo durante la prueba<span>MECHA / SOLUTIONS LAB</span>
        </footer>
      </div>
    </dialog>
  );
}
