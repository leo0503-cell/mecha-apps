import { ArrowUpRight, Check, Send } from "lucide-react";
import { plans, projects } from "../data/projects";
export type Inquiry = { plan: string; demo: string };
export function Packages({
  inquiry,
  setInquiry,
}: {
  inquiry: Inquiry;
  setInquiry: (v: Inquiry) => void;
}) {
  return (
    <section id="paquetes" className="section packages">
      <div className="container">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              03 / UNA SOLUCIÓN PARA TU SIGUIENTE ETAPA
            </div>
            <h2>
              Empieza donde estás.
              <br />
              <span className="muted">Construyamos lo que sigue.</span>
            </h2>
          </div>
          <p>
            Elige un punto de partida. El alcance, las integraciones y la
            inversión se definen contigo, según lo que tu operación necesita.
          </p>
        </div>
        <div className="plans">
          {plans.map((p, i) => (
            <article
              key={p.name}
              className={`plan ${i === 1 ? "recommended" : ""}`}
            >
              <div className="plan-label">
                {p.label}
                {i === 1 && <span>PARA CONECTAR Y CRECER</span>}
              </div>
              <h3>
                {p.name}
                <span>↗</span>
              </h3>
              <p>{p.description}</p>
              <div className="plan-price">
                A la medida <small>Cotización según alcance</small>
              </div>
              <a
                className={`button ${i === 1 ? "primary" : ""}`}
                href="#contacto"
                onClick={() => setInquiry({ ...inquiry, plan: p.name })}
              >
                {p.cta}
                <ArrowUpRight size={17} />
              </a>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>
                    <Check size={15} />
                    {f}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
export function Contact({
  inquiry,
  setInquiry,
}: {
  inquiry: Inquiry;
  setInquiry: (v: Inquiry) => void;
}) {
  return (
    <section id="contacto" className="section container contact">
      <div>
        <div className="eyebrow">04 / HAGAMOS QUE SUCEDA</div>
        <h2>
          ¿Qué está frenando
          <br />a tu empresa<span className="lime-text">?</span>
        </h2>
        <p>
          Cuéntanos dónde se atora tu equipo.
          <br />
          Nosotros ponemos las ideas y la tecnología.
        </p>
        <a
          className="contact-link"
          href="https://wa.me/524491557494"
          target="_blank"
          rel="noreferrer"
        >
          Platiquemos por WhatsApp <ArrowUpRight size={18} />
        </a>
        <div className="contact-stamp">
          <span>m</span> IDEAS CLARAS.
          <br />
          SOLUCIONES QUE SE USAN.
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const text = `Hola Mecha, quiero cotizar un proyecto.\nNombre: ${data.get("name")}\nEmpresa: ${data.get("company")}\nCorreo: ${data.get("email")}\nPaquete: ${inquiry.plan || "Por definir"}\nDemo de interés: ${inquiry.demo || "Por definir"}\nNecesidad: ${data.get("need")}`;
          window.location.assign(
            `https://wa.me/524491557494?text=${encodeURIComponent(text)}`,
          );
        }}
      >
        <div className="form-row">
          <label>
            Tu nombre
            <input
              name="name"
              placeholder="¿Cómo te llamas?"
              required
              maxLength={100}
              autoComplete="name"
            />
          </label>
          <label>
            Empresa
            <input
              name="company"
              placeholder="Nombre de tu empresa"
              required
              maxLength={150}
              autoComplete="organization"
            />
          </label>
        </div>
        <label>
          Correo de trabajo
          <input
            type="email"
            name="email"
            placeholder="tu@empresa.com"
            required
            autoComplete="email"
            maxLength={150}
          />
        </label>
        <div className="form-row">
          <label>
            Solución que te interesa
            <select
              aria-label="Demo de interés"
              value={inquiry.demo}
              onChange={(e) => setInquiry({ ...inquiry, demo: e.target.value })}
            >
              <option value="">Quiero orientación</option>
              {projects.map((p) => (
                <option key={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label>
            Paquete
            <select
              aria-label="Paquete de interés"
              value={inquiry.plan}
              onChange={(e) => setInquiry({ ...inquiry, plan: e.target.value })}
            >
              <option value="">Por definir</option>
              {plans.map((p) => (
                <option key={p.name}>{p.name}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          ¿Qué te gustaría resolver?
          <textarea
            name="need"
            placeholder="Por ejemplo: cotizamos a mano y perdemos seguimiento de los prospectos…"
            required
            rows={3}
            maxLength={2000}
          />
        </label>
        <button className="button primary" type="submit">
          Preparar mi solicitud en WhatsApp <Send size={16} />
        </button>
        <small className="form-note">
          Abriremos WhatsApp con tu solicitud. Tú revisas y envías el mensaje.
          Estos datos no se guardan en el hub.
        </small>
      </form>
    </section>
  );
}
