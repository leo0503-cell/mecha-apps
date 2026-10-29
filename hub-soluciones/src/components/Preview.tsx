import {
  ArrowUpRight,
  Box,
  Check,
  MoreHorizontal,
  Play,
  Sparkles,
} from "lucide-react";
export function Preview({
  kind,
  hero = false,
}: {
  kind: string;
  hero?: boolean;
}) {
  if (kind === "cubicarga")
    return (
      <div className="mini-load">
        <div className="mini-toolbar">
          <Box size={13} /> Planificador de carga <span>Vista 3D</span>
        </div>
        <div className="truck-scene">
          <div className="truck-grid" />
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              className="cargo"
              style={{
                left: `${25 + (i % 3) * 16}%`,
                top: `${30 + Math.floor(i / 3) * 12}%`,
                zIndex: 10 - i,
              }}
            />
          ))}
        </div>
        <div className="mini-bottom">
          <span>Tu carga. Mejor distribuida.</span>
          <span>↗</span>
        </div>
      </div>
    );
  if (kind === "academy")
    return (
      <div className="mini-course">
        <div className="mini-toolbar">
          UNIVERSIDAD TMM <MoreHorizontal size={15} />
        </div>
        <div className="course-row">
          <div className="course-play">
            <Play size={22} fill="currentColor" />
          </div>
          <div>
            <small>RUTA DE APRENDIZAJE</small>
            <h4>Crece con tu equipo.</h4>
            <p>Seguridad · Operación · Desarrollo</p>
          </div>
        </div>
        <div className="course-track">
          <span />
          <span />
          <span />
        </div>
        <div className="mini-bottom">
          <span>
            <Check size={12} /> Aprende a tu ritmo
          </span>
          <span>Continuar →</span>
        </div>
      </div>
    );
  if (kind === "prende")
    return (
      <div className="mini-ai">
        <Sparkles size={28} />
        <h4>
          De “¿por dónde empiezo?”
          <br />a “ya está resuelto”.
        </h4>
        <div className="fake-input">
          Ayúdame a responder una cotización <ArrowUpRight size={16} />
        </div>
      </div>
    );
  if (kind === "relevo")
    return (
      <div className="mini-knowledge">
        <div className="mini-toolbar">
          MAPA DE CONOCIMIENTO <span>Relevo</span>
        </div>
        {[
          "Lo que sabe el experto",
          "Lo que practica el equipo",
          "Lo que se queda en tu empresa",
        ].map((t, i) => (
          <div key={t} className="knowledge-row">
            <span>0{i + 1}</span>
            {t}
            <Check size={13} />
          </div>
        ))}
      </div>
    );
  if (kind === "traba")
    return (
      <div className="mini-invoices">
        <div className="mini-toolbar">
          BANDEJA DE SEGUIMIENTO <span>Traba</span>
        </div>
        {["En revisión", "Falta evidencia", "Listo para conciliar"].map(
          (t, i) => (
            <div className="invoice-row" key={t}>
              <div className="invoice-icon">↗</div>
              <div>
                Expediente de muestra<small>{t}</small>
              </div>
              <span className={`state state-${i}`} />
            </div>
          ),
        )}
      </div>
    );
  return (
    <div className={`mini-dashboard ${hero ? "hero-dashboard" : ""}`}>
      <div className="mini-toolbar">
        <span>
          <i className="tiny-logo" /> INVENTARIO VIVO
        </span>
        <span className="live">
          <i /> Vista de muestra
        </span>
      </div>
      <div className="dash-layout">
        <aside>
          <span className="side-active">▦</span>
          <Box size={15} />
          <span>↗</span>
          <span>☷</span>
        </aside>
        <div className="dash-main">
          <div className="dash-heading">
            <div>
              <small>CONTROL OPERATIVO</small>
              <h4>Todo en su lugar.</h4>
            </div>
            <span className="mini-pill">Almacén demo ⌄</span>
          </div>
          <div className="dash-stats">
            {["Existencias", "Movimientos", "Ubicaciones"].map((s, i) => (
              <div key={s}>
                <small>{s}</small>
                <strong>
                  {["128", "24", "36"][i]}
                  <span>↗</span>
                </strong>
                <em>Datos ficticios</em>
              </div>
            ))}
          </div>
          <div className="dash-lower">
            <div className="chart">
              <small>Actividad del almacén</small>
              <div className="bars">
                {[35, 57, 43, 79, 59, 89, 68, 95, 80, 66, 86, 100].map(
                  (h, i) => (
                    <span key={i} style={{ height: `${h}%` }} />
                  ),
                )}
              </div>
              <div className="chart-axis">
                <span>Lun</span>
                <span>Mar</span>
                <span>Mié</span>
                <span>Jue</span>
                <span>Vie</span>
              </div>
            </div>
            <div className="warehouse">
              <small>Mapa de ubicaciones</small>
              <div>
                {Array.from({ length: 24 }, (_, i) => (
                  <span className={i % 7 === 0 ? "empty" : ""} key={i} />
                ))}
              </div>
              <small>
                <i /> Disponible
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
