// Parallax de Mecha — GSAP 3 + ScrollTrigger.
//
// Cada escena tiene dos capas animadas por separado:
//   [data-parallax] → solo `y`: se mueve 20% más lento que el scroll.
//   [data-revelar]  → `scale` 0.7 → 1.2 y `opacity` 0 → 1 en 600 px de recorrido.
// Separarlas evita que dos tweens escriban el mismo `transform`.

gsap.registerPlugin(ScrollTrigger);

const RECORRIDO_REVELADO = 600; // px de scroll para ir de 0.7/0 a 1.2/1
const LENTITUD = 0.2; // 20% más lento que el scroll

const mm = gsap.matchMedia();

// Sin movimiento: estado final directo. Con matchMedia, si la preferencia
// cambia con la página abierta, GSAP revierte un bloque y monta el otro.
mm.add("(prefers-reduced-motion: reduce)", () => {
  gsap.set("[data-revelar]", { scale: 1, opacity: 1 });
});

mm.add("(prefers-reduced-motion: no-preference)", () => {
  // 1) Portada: entrada del título y el robot.
  gsap
    .timeline({ defaults: { ease: "power3.out" } })
    .from(".linea > span", { yPercent: 110, duration: 1, stagger: 0.12 })
    .from(".portada__bajada", { opacity: 0, y: 20, duration: 0.8 }, "-=0.5")
    .from(
      ".portada__robot",
      { opacity: 0, y: 60, scale: 0.9, duration: 1.2 },
      0.2,
    );

  // El robot de la portada también se queda atrás al bajar.
  gsap.to(".portada__robot", {
    yPercent: 25,
    ease: "none",
    scrollTrigger: {
      trigger: ".portada",
      start: "top top",
      end: "bottom top",
      scrub: true,
    },
  });

  // 2) Escenas.
  document.querySelectorAll(".escena").forEach((escena) => {
    const marco = escena.querySelector(".escena__marco");
    const capa = escena.querySelector("[data-parallax]");
    const img = escena.querySelector("[data-revelar]");

    // Escala + opacidad: arranca cuando el borde superior de la imagen
    // entra por abajo de la pantalla y termina 600 px después. El disparador
    // es el marco (sin transform) para que el parallax no mueva las medidas.
    // scrub: true → el valor final llega exactamente a los 600 px, sin retraso.
    gsap.fromTo(
      img,
      { scale: 0.7, opacity: 0 },
      {
        scale: 1.2,
        opacity: 1,
        ease: "power2.out",
        scrollTrigger: {
          trigger: marco,
          start: "top bottom",
          end: `+=${RECORRIDO_REVELADO}`,
          scrub: true,
        },
      },
    );

    // Parallax vertical. Mientras la escena cruza la pantalla el scroll
    // avanza (alto de ventana + alto de escena) px. Para que la imagen
    // recorra solo el 80% de eso, la desplazamos +20% en sentido del
    // scroll a lo largo del trayecto, centrado en 0 para que a media
    // pantalla quede en su sitio.
    const trayecto = () => window.innerHeight + escena.offsetHeight;
    gsap.fromTo(
      capa,
      { y: () => -trayecto() * LENTITUD * 0.5 },
      {
        y: () => trayecto() * LENTITUD * 0.5,
        ease: "none",
        scrollTrigger: {
          trigger: escena,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
          invalidateOnRefresh: true,
        },
      },
    );

    // Texto de la escena: entra un poco después que la imagen.
    gsap.from(escena.querySelectorAll(".escena__num, h2, .escena__texto p"), {
      opacity: 0,
      y: 40,
      stagger: 0.08,
      ease: "power2.out",
      scrollTrigger: {
        trigger: escena.querySelector(".escena__texto"),
        start: "top 85%",
        end: "top 55%",
        scrub: 0.6,
      },
    });
  });

  // 3) Cierre.
  gsap.from(".cierre > *", {
    opacity: 0,
    y: 50,
    stagger: 0.1,
    ease: "power2.out",
    scrollTrigger: {
      trigger: ".cierre",
      start: "top 80%",
      end: "top 40%",
      scrub: 0.6,
    },
  });
});
// Las imágenes de escena tienen aspect-ratio fijo, así que cargar con
// loading="lazy" no mueve el alto de la página ni los disparadores.
