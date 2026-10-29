/** Descarta lecturas antiguas y difiere las consultas fuera del callback de Auth. */
export function crearSincronizador<T>(
  cargar: () => Promise<T>,
  publicar: (dato: T) => void,
  fallar: () => void,
) {
  let revision = 0,
    vivo = true,
    timer: ReturnType<typeof setTimeout> | undefined;
  async function iniciar() {
    if (!vivo) return;
    const turno = ++revision;
    try {
      const dato = await cargar();
      if (vivo && turno === revision) publicar(dato);
    } catch {
      if (vivo && turno === revision) fallar();
    }
  }
  return {
    iniciar,
    cambio() {
      if (!vivo) return;
      revision++;
      clearTimeout(timer);
      timer = setTimeout(() => {
        void iniciar();
      }, 0);
    },
    detener() {
      vivo = false;
      revision++;
      clearTimeout(timer);
    },
  };
}
