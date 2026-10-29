# Relevo, por Mecha

Lo que sabe quien se va, probado por quien se queda.

Relevo transfiere el conocimiento tácito de una persona clave (retiro, cambio de
puesto) a su sucesor y **comprueba** que se transfirió: el experto valida cada
ficha, el sucesor la practica y solo lo practicado correctamente entra al manual.

## Demo

    uv run relevo demo
    uv run relevo procesar demo/datos
    open demo/datos/salida/mapa.html

Salidas en `demo/datos/salida/`: `mapa.html`, `manual.md` (solo fichas vigentes),
`ejercicios.md` y `relevo.json`. La guía de entrevista: `uv run relevo guia`.

## Formato de entrada

    <carpeta>/
      transcripciones/*.txt   entrevistas transcritas con formato guiado
      validaciones.csv        fecha,ficha,tipo(experto|responsable),nombre,version
      practica.csv            fecha,ficha,sucesor,respuesta,calificacion,correccion
      guia.toml               (opcional) guía propia del cliente

Cada línea de transcripción: `[P:decisiones-01] [02:40] decision: texto`.
Campos: situacion, senal, decision, porque, excepcion, limite, contacto,
`regla: si … entonces …` y `marca: seguridad|calidad`.

## Reglas

- Ninguna ficha es vigente sin validación del experto de su versión actual y una
  práctica correcta del sucesor sobre esa versión.
- Una corrección del experto crea versión nueva y anula la práctica anterior.
- Las fichas de seguridad o calidad exigen la firma de un responsable designado.

## Falta para un piloto

- Transcripción de audio (interfaz `Transcriptor`, sin implementar).
- Extracción desde texto libre con un modelo (interfaz `Extractor`).
- Captura de práctica y validaciones desde la página, no solo CSV.
- Consentimiento de grabación y tratamiento de datos (LFPDPPP) por cliente.
- Precio del piloto: `<importe por puesto crítico en MXN>`.

Las validaciones requieren fecha válida y firmante identificado; las prácticas requieren fecha, sucesor y respuesta. Las filas con columnas adicionales sin encabezado se descartan con aviso. Estos controles de integridad del CSV no autentican a la persona que lo escribió.
