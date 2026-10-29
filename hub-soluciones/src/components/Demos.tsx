import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  Timer,
  X,
} from "lucide-react";
import { projects, type Project } from "../data/projects";
import { Preview } from "./Preview";
export function Demos({ onOpen }: { onOpen: (p: Project) => void }) {
  const [filter, setFilter] = useState("Todas");
  const [search, setSearch] = useState("");
  const categories = [
    "Todas",
    "Operación",
    "Logística",
    "Talento",
    "Finanzas",
    "IA",
  ];
  const visible = projects.filter(
    (p) =>
      (filter === "Todas" || p.category === filter) &&
      `${p.name} ${p.description}`
        .toLocaleLowerCase("es")
        .includes(search.toLocaleLowerCase("es")),
  );
  return (
    <section id="demos" className="section demos container">
      <div className="section-heading">
        <div>
          <div className="eyebrow">02 / EXPLORA EL LAB</div>
          <h2>
            Menos promesas.
            <br />
            <span className="muted">Más cosas que puedes probar.</span>
          </h2>
        </div>
        <div className="demo-intro">
          <p>
            Herramientas construidas para problemas reales.
            <br />
            Entra, explora y descubre qué podemos hacer por ti.
          </p>
          <span className="trial-label">
            <Timer size={15} /> 30 segundos por demo. Sin registro.
          </span>
        </div>
      </div>
      <div className="catalog-toolbar">
        <div
          className="filters"
          role="group"
          aria-label="Filtrar demos por categoría"
        >
          {categories.map((c) => (
            <button
              aria-pressed={filter === c}
              className={filter === c ? "active" : ""}
              key={c}
              onClick={() => setFilter(c)}
            >
              {c}
              {c === "Todas" && <span>{projects.length}</span>}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Buscar demo"
            placeholder="Buscar una solución…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button aria-label="Limpiar búsqueda" onClick={() => setSearch("")}>
              <X size={13} />
            </button>
          )}
        </label>
      </div>
      <div className="project-grid">
        {visible.map((p) => (
          <article className={`project-card ${p.color}`} key={p.id}>
            <button
              className="project-preview"
              onClick={() => onOpen(p)}
              aria-label={`Probar ${p.name}`}
            >
              <div className="preview-overlay">
                <span>
                  Explorar demo <ArrowUpRight size={15} />
                </span>
              </div>
              <Preview kind={p.id} />
            </button>
            <div className="project-body">
              <div className="project-meta">
                <span>
                  <p.icon size={13} />
                  {p.category}
                </span>
                <span>DEMO INTERACTIVA</span>
              </div>
              <h3>
                {p.name}
                <ArrowUpRight size={19} />
              </h3>
              <p>{p.description}</p>
              <div className="project-bottom">
                <button onClick={() => onOpen(p)}>
                  Probar demo en vivo <ArrowRight size={16} />
                </button>
                <span>
                  <Timer size={12} /> 00:30
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
      {visible.length === 0 && (
        <div className="empty-state">
          <SlidersHorizontal />
          <h3>No encontramos esa solución.</h3>
          <p>Prueba con otro nombre o categoría.</p>
          <button
            className="button"
            onClick={() => {
              setFilter("Todas");
              setSearch("");
            }}
          >
            Ver todas las demos
          </button>
        </div>
      )}
      <div className="demo-footnote">
        <span>
          <span className="status-dot" /> Un vistazo a lo que es posible.
        </span>
        <p>
          Versiones de muestra con datos ficticios. Los proyectos TMM forman
          parte de la experiencia del equipo; TMM no es cliente de Mecha.
        </p>
      </div>
    </section>
  );
}
