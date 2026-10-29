import { useState } from "react";
import {
  ArrowRight,
  Box,
  Check,
  CheckCircle2,
  Search,
  Sparkles,
} from "lucide-react";
export function DemoApps({ id }: { id: string }) {
  if (id === "inventario") return <Inventory />;
  if (id === "cubicarga") return <Cargo />;
  if (id === "academy") return <Academy />;
  if (id === "traba") return <Invoices />;
  if (id === "relevo") return <Knowledge />;
  return <AiRecipe />;
}
const fixtures = [
  {
    sku: "DEMO-001",
    name: "Tablero natural · 18 mm",
    qty: 48,
    location: "A-01",
    status: "Disponible",
  },
  {
    sku: "DEMO-002",
    name: "Melamina blanco · 16 mm",
    qty: 32,
    location: "B-03",
    status: "Disponible",
  },
  {
    sku: "DEMO-003",
    name: "Triplay estándar · 12 mm",
    qty: 12,
    location: "C-02",
    status: "Stock bajo",
  },
  {
    sku: "DEMO-004",
    name: "Tablero nogal · 18 mm",
    qty: 36,
    location: "A-04",
    status: "Disponible",
  },
];
function Inventory() {
  const [rows, setRows] = useState(fixtures);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("Existencias");
  return (
    <>
      <div className="app-heading">
        <div>
          <div className="eyebrow">CONTROL OPERATIVO</div>
          <h2>Tu almacén, a la vista.</h2>
          <p>Busca un material y registra una salida de muestra.</p>
        </div>
        <Box size={32} />
      </div>
      <div className="app-kpis">
        <div>
          <small>Piezas disponibles</small>
          <strong>{rows.reduce((s, r) => s + r.qty, 0)}</strong>
        </div>
        <div>
          <small>Materiales</small>
          <strong>{rows.length}</strong>
        </div>
        <div>
          <small>Ubicaciones</small>
          <strong>{new Set(rows.map((r) => r.location)).size}</strong>
        </div>
      </div>
      <div className="app-tabs">
        {["Existencias", "Mapa de almacén"].map((t) => (
          <button
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
            key={t}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Existencias" ? (
        <>
          <label className="search app-search">
            <Search size={16} />
            <input
              placeholder="Buscar material o clave…"
              aria-label="Buscar material"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Material / clave</th>
                  <th>Ubicación</th>
                  <th>Existencias</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) =>
                    `${r.name} ${r.sku}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((r) => (
                    <tr key={r.sku}>
                      <td>
                        {r.name}
                        <small>{r.sku}</small>
                      </td>
                      <td>
                        <span className="tag">{r.location}</span>
                      </td>
                      <td>{r.qty} pzas.</td>
                      <td>
                        <button
                          disabled={!r.qty}
                          className="app-button"
                          onClick={() => {
                            setRows(
                              rows.map((a) =>
                                a.sku === r.sku ? { ...a, qty: a.qty - 1 } : a,
                              ),
                            );
                            setNotice(
                              `Salida de 1 pieza registrada: ${r.name}.`,
                            );
                          }}
                        >
                          Registrar salida <ArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="map-grid">
          {rows.map((r) => (
            <div key={r.sku}>
              <Box />
              <h3>{r.location}</h3>
              <p>{r.name}</p>
              <span>{r.qty} piezas</span>
            </div>
          ))}
        </div>
      )}
      <p className="app-notice" role="status">
        {notice ||
          "Datos ficticios. Las salidas solo afectan esta sesión de prueba."}
      </p>
    </>
  );
}
function Cargo() {
  const [size, setSize] = useState({
    length: 60,
    width: 40,
    height: 40,
    quantity: 20,
  });
  const [calculated, setCalculated] = useState(false);
  const volume = (size.length * size.width * size.height * size.quantity) / 1e6;
  return (
    <>
      <div className="app-heading">
        <div>
          <div className="eyebrow">CUBICARGA / CALCULADORA</div>
          <h2>Cada centímetro cuenta.</h2>
          <p>Cambia las dimensiones y calcula el volumen de tu carga.</p>
        </div>
        <Box size={32} />
      </div>
      <div className="cargo-app">
        <div className="app-panel">
          <h3>Configura tu carga</h3>
          {(
            [
              ["length", "Largo (cm)"],
              ["width", "Ancho (cm)"],
              ["height", "Alto (cm)"],
              ["quantity", "Cantidad de cajas"],
            ] as const
          ).map(([k, label]) => (
            <label key={k}>
              {label}
              <input
                type="number"
                value={size[k]}
                min="1"
                max={k === "quantity" ? 10000 : 1000}
                onChange={(e) => {
                  setSize({
                    ...size,
                    [k]: Math.max(
                      1,
                      Math.min(
                        k === "quantity" ? 10000 : 1000,
                        Number(e.target.value) || 1,
                      ),
                    ),
                  });
                  setCalculated(false);
                }}
              />
            </label>
          ))}
          <button
            className="button primary"
            onClick={() => setCalculated(true)}
          >
            Calcular volumen <ArrowRight size={16} />
          </button>
        </div>
        <div className="cargo-result">
          <div className="large-cube">
            <Box size={110} strokeWidth={0.8} />
          </div>
          <small>{calculated ? "VOLUMEN TOTAL" : "VISTA PREVIA"}</small>
          <strong>
            {calculated
              ? volume.toLocaleString("es-MX", { maximumFractionDigits: 3 })
              : "—"}{" "}
            <span>m³</span>
          </strong>
          <p>
            {size.quantity} cajas de {size.length} × {size.width} ×{" "}
            {size.height} cm
          </p>
          <p className="app-notice">
            Cálculo geométrico de muestra. No incluye acomodo 3D, peso ni
            restricciones de transporte.
          </p>
        </div>
      </div>
    </>
  );
}
function Academy() {
  const [lesson, setLesson] = useState(0);
  const [answer, setAnswer] = useState("");
  const [done, setDone] = useState(false);
  return (
    <>
      <div className="app-heading">
        <div>
          <div className="eyebrow">UNIVERSIDAD TMM / RUTA DE MUESTRA</div>
          <h2>Aprende. Practica. Avanza.</h2>
          <p>Explora una lección y comprueba lo aprendido.</p>
        </div>
      </div>
      <div className="lesson-layout">
        <aside className="app-panel">
          <h3>Seguridad en almacén</h3>
          {["Antes de empezar", "Comprueba lo aprendido"].map((s, i) => (
            <button
              className={`lesson-link ${lesson === i ? "active" : ""}`}
              key={s}
              onClick={() => setLesson(i)}
            >
              {i + 1}. {s}
              {done && i === 1 && <Check size={15} />}
            </button>
          ))}
          <p>
            Contenido ilustrativo. Sigue los procedimientos aprobados de tu
            empresa.
          </p>
        </aside>
        <div className="app-panel lesson-body">
          {lesson === 0 ? (
            <>
              <div className="lesson-icon">
                <Box size={40} />
              </div>
              <h3>Antes de mover un material</h3>
              <p>
                Revisa el estado del material, identifica la ubicación de
                destino y confirma que el paso esté libre. Si detectas una
                condición insegura, detén la maniobra y avisa al responsable.
              </p>
              <button className="button primary" onClick={() => setLesson(1)}>
                Ir a la evaluación <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <>
              <h3>¿Qué haces si el paso está obstruido?</h3>
              {[
                "Continúo con cuidado",
                "Detengo la maniobra y aviso al responsable",
                "Cambio el destino sin avisar",
              ].map((a) => (
                <label className="answer" key={a}>
                  <input
                    type="radio"
                    name="quiz"
                    value={a}
                    checked={answer === a}
                    onChange={() => {
                      setAnswer(a);
                      setDone(false);
                    }}
                  />
                  {a}
                </label>
              ))}
              <button
                disabled={!answer}
                className="button primary"
                onClick={() => setDone(true)}
              >
                Comprobar respuesta
              </button>
              {done && (
                <p role="status" className="app-notice">
                  {answer === "Detengo la maniobra y aviso al responsable"
                    ? "Correcto. Primero confirma que la maniobra sea segura."
                    : "Revisa la lección: detén la maniobra y avisa al responsable."}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
function Invoices() {
  const [selected, setSelected] = useState(0);
  const [reviewed, setReviewed] = useState<number[]>([]);
  const bills = [
    {
      folio: "DEMO-F01",
      reason: "Falta orden de compra",
      owner: "Ventas",
      next: "Solicitar la orden de compra al contacto responsable.",
    },
    {
      folio: "DEMO-F02",
      reason: "Acuse pendiente",
      owner: "Logística",
      next: "Reunir evidencia de entrega y validar el acuse.",
    },
    {
      folio: "DEMO-F03",
      reason: "Pago por conciliar",
      owner: "Administración",
      next: "Validar la referencia con el estado de cuenta.",
    },
  ];
  const b = bills[selected];
  return (
    <>
      <div className="app-heading">
        <div>
          <div className="eyebrow">TRABA / BANDEJA DE SEGUIMIENTO</div>
          <h2>Un bloqueo. Un siguiente paso.</h2>
          <p>Selecciona un expediente para revisar qué falta.</p>
        </div>
      </div>
      <div className="lesson-layout">
        <aside className="app-panel">
          {bills.map((b, i) => (
            <button
              className={`invoice-select ${selected === i ? "active" : ""}`}
              key={b.folio}
              onClick={() => setSelected(i)}
            >
              <strong>{b.folio}</strong>
              <span>{b.reason}</span>
              {reviewed.includes(i) && <Check size={15} />}
            </button>
          ))}
        </aside>
        <div className="app-panel invoice-detail">
          <span className="tag">
            {reviewed.includes(selected)
              ? "Revisado en esta demo"
              : "Pendiente de revisión"}
          </span>
          <h3>{b.folio}</h3>
          <dl>
            <dt>Motivo del bloqueo</dt>
            <dd>{b.reason}</dd>
            <dt>Siguiente responsable</dt>
            <dd>{b.owner}</dd>
            <dt>Acción sugerida</dt>
            <dd>{b.next}</dd>
          </dl>
          <button
            disabled={reviewed.includes(selected)}
            className="button primary"
            onClick={() => setReviewed([...reviewed, selected])}
          >
            {reviewed.includes(selected)
              ? "Expediente revisado"
              : "Marcar como revisado"}
            <Check size={16} />
          </button>
          <p className="app-notice">
            Expedientes ficticios. Marcar como revisado no confirma un pago ni
            resuelve el bloqueo.
          </p>
        </div>
      </div>
    </>
  );
}
function Knowledge() {
  const [practiced, setPracticed] = useState(false);
  const [choice, setChoice] = useState("");
  return (
    <>
      <div className="app-heading">
        <div>
          <div className="eyebrow">RELEVO / CONOCIMIENTO OPERATIVO</div>
          <h2>Que la experiencia se quede.</h2>
          <p>Prueba cómo una regla se convierte en conocimiento practicado.</p>
        </div>
      </div>
      <div className="app-panel knowledge-detail">
        <span className="tag">FICHA DE MUESTRA · RECEPCIÓN DE MATERIAL</span>
        <h3>El material llega con una diferencia</h3>
        <p>
          <b>Señal:</b> la cantidad recibida no coincide con el documento.
        </p>
        <p>
          <b>Regla:</b> registra la diferencia, conserva evidencia y solicita
          revisión del responsable antes de confirmar la recepción.
        </p>
        <hr />
        <h3>Tu turno: ¿qué harías primero?</h3>
        <select
          aria-label="Respuesta de práctica"
          value={choice}
          onChange={(e) => {
            setChoice(e.target.value);
            setPracticed(false);
          }}
        >
          <option value="">Elige una respuesta</option>
          <option value="accept">
            Confirmar todo lo que dice el documento
          </option>
          <option value="review">
            Documentar la diferencia y pedir revisión
          </option>
        </select>
        <button
          className="button primary"
          disabled={!choice}
          onClick={() => setPracticed(true)}
        >
          Comprobar práctica <CheckCircle2 size={16} />
        </button>
        {practiced && (
          <p className="app-notice" role="status">
            {choice === "review"
              ? "Práctica correcta en esta muestra. En Relevo, la vigencia también requiere validación del experto y del responsable cuando aplique."
              : "Revisa la regla: conserva evidencia y pide revisión antes de confirmar."}
          </p>
        )}
      </div>
    </>
  );
}
function AiRecipe() {
  const [task, setTask] = useState("Responder una cotización");
  const [business, setBusiness] = useState("");
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  return (
    <>
      <div className="app-heading">
        <div>
          <div className="eyebrow">PRENDE / MESA DE TRABAJO</div>
          <h2>Un buen inicio para usar IA.</h2>
          <p>Arma una instrucción útil con el contexto de tu negocio.</p>
        </div>
        <Sparkles size={30} />
      </div>
      <div className="cargo-app">
        <div className="app-panel">
          <label>
            ¿Qué necesitas hacer?
            <select value={task} onChange={(e) => setTask(e.target.value)}>
              {[
                "Responder una cotización",
                "Dar seguimiento a un prospecto",
                "Crear una publicación comercial",
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            ¿Qué vende tu empresa?
            <input
              value={business}
              maxLength={150}
              onChange={(e) => setBusiness(e.target.value)}
              placeholder="Por ejemplo: muebles a medida"
            />
          </label>
          <button
            className="button primary"
            onClick={() => {
              setPrompt(
                `Ayúdame a ${task.toLowerCase()} para una empresa que vende ${business.trim() || "<producto o servicio>"}.\n\nUsa español de México, un tono claro y un siguiente paso concreto. Antes de redactar, pregunta por el destinatario y el contexto. No inventes precios, descuentos, plazos ni disponibilidad. Marca los datos faltantes entre <corchetes>.`,
              );
              setCopied(false);
            }}
          >
            Preparar instrucción <Sparkles size={16} />
          </button>
        </div>
        <div className="app-panel prompt-output">
          <h3>Tu instrucción, lista para usar.</h3>
          <pre>
            {prompt ||
              "Completa el contexto y prepara tu instrucción. Puedes llevarla a ChatGPT o Claude."}
          </pre>
          {prompt && (
            <button
              className="app-button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(prompt);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copiado" : "Copiar instrucción"}
            </button>
          )}
          <p className="app-notice">
            Generador de instrucciones por plantilla. Esta muestra no llama a un
            modelo de IA.
          </p>
        </div>
      </div>
    </>
  );
}
