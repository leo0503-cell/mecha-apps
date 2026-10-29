import { check } from "./errors.js";
import { id } from "./store.js";
export function terms(input) {
  const labels = {
    scope: "el alcance y entregables",
    exclusions: "qué queda fuera",
    delivery: "el plazo y condiciones",
    costs: "los costos externos",
  };
  const text = (key, min, max) => {
    check(typeof input[key] === "string", `Completa ${labels[key]}.`);
    const value = input[key].trim();
    check(
      value.length >= min && value.length <= max,
      `Revisa ${labels[key]}: de ${min} a ${max.toLocaleString("es-MX")} caracteres.`,
    );
    return value;
  };
  const scope = text("scope", 10, 5000),
    exclusions = text("exclusions", 3, 3000),
    delivery = text("delivery", 3, 500),
    costs = text("costs", 3, 1500);
  check(
    typeof input.amount === "string" &&
      /^\d{1,8}(\.\d{1,2})?$/.test(input.amount),
    "Confirma un monto en MXN con hasta dos decimales.",
  );
  const [whole, decimal = ""] = input.amount.split("."),
    amount_cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  check(
    Number.isSafeInteger(input.revisions) &&
      input.revisions >= 0 &&
      input.revisions <= 20,
    "Confirma cuántas rondas de ajustes incluye.",
  );
  return {
    scope,
    exclusions,
    delivery,
    costs,
    amount_cents,
    currency: "MXN",
    revisions: input.revisions,
  };
}
export function sendProposal(store, job, actor, input) {
  const proposal = terms(input);
  check(
    job.status !== "delivered",
    "Crea una solicitud de ajuste para cotizar cambios a una entrega.",
  );
  const expected = Number(input.updated);
  check(expected === job.updated, "El pedido cambió. Actualiza la vista.", 409);
  store.db.transaction(() => {
    const current = store.query(
      "SELECT updated,proposal_version FROM jobs WHERE id=?",
      job.id,
    );
    check(
      current && current.updated === expected,
      "El pedido cambió. Actualiza la vista.",
      409,
    );
    const now = Math.max(Date.now(), expected + 1),
      version = current.proposal_version + 1;
    store.run(
      "INSERT INTO proposals(job_id,version,terms,author_id,created) VALUES(?,?,?,?,?)",
      job.id,
      version,
      JSON.stringify(proposal),
      actor.id,
      now,
    );
    store.run(
      "UPDATE jobs SET proposal_version=?,proposal_required=1,status='awaiting_approval',updated=? WHERE id=?",
      version,
      now,
      job.id,
    );
    store.run(
      "INSERT INTO comments(id,job_id,author_id,role,body,created) VALUES(?,?,?,?,?,?)",
      id(),
      job.id,
      actor.id,
      "admin",
      "Mecha envió una propuesta con alcance, monto, plazo y ajustes para tu aprobación.",
      now,
    );
  })();
  return store.job(job.id, actor.id, true);
}
export function acceptProposal(store, job, actor, input) {
  check(input.accepted === true, "Confirma que revisaste la propuesta.");
  check(
    Number.isSafeInteger(input.version) && input.version > 0,
    "La versión de la propuesta no es válida.",
  );
  store.db.transaction(() => {
    const current = store.job(job.id, actor.id);
    check(
      current.proposal && current.proposal.version === input.version,
      "La propuesta cambió. Revisa la nueva versión.",
      409,
    );
    check(current.status !== "delivered", "El pedido ya está entregado.", 409);
    if (current.proposal.accepted_at) return;
    const now = Math.max(Date.now(), current.updated + 1);
    store.run(
      "UPDATE proposals SET accepted_at=? WHERE job_id=? AND version=?",
      now,
      job.id,
      input.version,
    );
    store.run(
      "UPDATE jobs SET status='in_progress',updated=? WHERE id=?",
      now,
      job.id,
    );
    store.run(
      "INSERT INTO comments(id,job_id,author_id,role,body,created) VALUES(?,?,?,?,?,?)",
      id(),
      job.id,
      actor.id,
      "client",
      "El cliente aceptó la propuesta de Mecha.",
      now,
    );
  })();
  return store.job(job.id, actor.id);
}
export function requireAgreement(job) {
  check(
    !job.proposal_required || job.proposal?.accepted_at,
    "El cliente debe aceptar la propuesta vigente antes de iniciar o publicar la entrega.",
    409,
  );
}
export function replyStatus(job) {
  if (!job.proposal_required) return "in_progress";
  if (job.proposal?.accepted_at) return "in_progress";
  return job.proposal ? "awaiting_approval" : "received";
}
