(() => {
  "use strict";

  const config = window.MECHA || {};
  const root = document.documentElement;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const pending = (value) => !value || /[<>]/.test(value);

  // Contacto: ningún placeholder se convierte en una liga externa.
  const number = String(config.whatsapp || "").trim();
  const validNumber = !pending(number) && /^\d{10,15}$/.test(number);
  document.querySelectorAll("[data-whatsapp]").forEach((link) => {
    if (!validNumber) {
      link.href = "#contacto";
      link.addEventListener("click", () => {
        const field = document.querySelector('[data-contact="whatsapp"]');
        field?.focus({ preventScroll: true });
      });
      return;
    }
    const message = link.dataset.package
      ? `Hola, me interesa el paquete ${link.dataset.package}`
      : config.mensajeWhatsApp;
    link.href = `https://wa.me/${number}?text=${encodeURIComponent(message || "")}`;
  });

  document.querySelectorAll("[data-contact]").forEach((field) => {
    const key = field.dataset.contact;
    const value = String(
      (key === "whatsapp" && config.whatsappVisible) ||
        config[key] ||
        field.textContent,
    ).trim();
    field.textContent = value;
    const isPending = pending(value) || (key === "whatsapp" && !validNumber);
    field.classList.toggle("pendiente", isPending);
    if (isPending) return;
    const link = document.createElement("a");
    link.textContent = value;
    if (key === "correo") link.href = `mailto:${value}`;
    if (key === "instagram") {
      link.href = `https://www.instagram.com/${encodeURIComponent(value.replace(/^@/, ""))}/`;
    }
    if (key === "whatsapp") link.href = `https://wa.me/${number}`;
    field.replaceChildren(link);
  });
  document.querySelectorAll("[data-city]").forEach((field) => {
    field.textContent = config.ciudad || field.textContent;
  });

  // Sistema → claro → oscuro. La persistencia es opcional para el navegador.
  const themes = ["system", "light", "dark"];
  const themeLabels = { system: "Sistema", light: "Claro", dark: "Oscuro" };
  const themeButton = document.querySelector("[data-theme-toggle]");
  let theme = "system";
  try {
    const saved = window.localStorage.getItem("mecha-theme");
    if (themes.includes(saved)) theme = saved;
  } catch {
    // También funciona al abrir index.html desde el disco.
  }
  function applyTheme() {
    if (theme === "system") root.removeAttribute("data-theme");
    else root.dataset.theme = theme;
    const next = themes[(themes.indexOf(theme) + 1) % themes.length];
    themeButton.querySelector("[data-theme-label]").textContent =
      themeLabels[theme];
    themeButton.setAttribute(
      "aria-label",
      `Tema actual: ${themeLabels[theme].toLowerCase()}. Cambiar a ${themeLabels[next].toLowerCase()}.`,
    );
    themeButton.title = `Cambiar a tema ${themeLabels[next].toLowerCase()}`;
    const dark =
      theme === "dark" || (theme === "system" && systemTheme.matches);
    const token = dark ? "--polvora" : "--ceniza";
    const color = getComputedStyle(root).getPropertyValue(token).trim();
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.content = color;
    });
  }
  themeButton.addEventListener("click", () => {
    theme = themes[(themes.indexOf(theme) + 1) % themes.length];
    applyTheme();
    try {
      window.localStorage.setItem("mecha-theme", theme);
    } catch {
      // El tema funciona aunque no se pueda guardar.
    }
  });
  systemTheme.addEventListener("change", applyTheme);
  applyTheme();

  // Menú de celular: cierre por enlace, Escape, clic fuera y cambio de ancho.
  const menu = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".site-nav");
  function closeMenu(restoreFocus = false) {
    nav.classList.remove("is-open");
    menu.setAttribute("aria-expanded", "false");
    menu.querySelector(".sr-only").textContent = "Abrir menú";
    if (restoreFocus) menu.focus();
  }
  menu.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") !== "true";
    menu.setAttribute("aria-expanded", String(open));
    menu.querySelector(".sr-only").textContent = open
      ? "Cerrar menú"
      : "Abrir menú";
    nav.classList.toggle("is-open", open);
  });
  nav
    .querySelectorAll("a")
    .forEach((link) => link.addEventListener("click", () => closeMenu()));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true")
      closeMenu(true);
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".site-header")) closeMenu();
  });
  window
    .matchMedia("(min-width: 901px)")
    .addEventListener("change", () => closeMenu());

  // Pestañas de la app: flechas, Inicio/Fin y un solo tab en el orden de foco.
  const tabs = [...document.querySelectorAll("[data-app-tab]")];
  const appPhone = document.querySelector("[data-app-phone]");
  function selectTab(tab, focus = false) {
    tabs.forEach((item) => {
      const selected = item === tab;
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
      document.getElementById(item.getAttribute("aria-controls")).hidden =
        !selected;
    });
    appPhone.querySelector("[data-phone-title]").textContent =
      tab.dataset.title;
    appPhone.querySelectorAll("[data-phone-nav]").forEach((item) => {
      item.classList.toggle(
        "active",
        item.dataset.phoneNav === tab.dataset.appTab,
      );
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowDown") next = (index + 1) % tabs.length;
      if (event.key === "ArrowUp")
        next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      selectTab(tabs[next], true);
    });
  });

  const strip = document.querySelector(".posts-strip");
  const stripButtons = [...document.querySelectorAll("[data-strip-direction]")];
  function updateStripButtons() {
    const end = strip.scrollWidth - strip.clientWidth;
    stripButtons.forEach((button) => {
      button.disabled =
        Number(button.dataset.stripDirection) < 0
          ? strip.scrollLeft <= 1
          : strip.scrollLeft >= end - 1;
    });
  }
  stripButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const first = strip.querySelector("li");
      const gap = parseFloat(getComputedStyle(strip).gap) || 0;
      strip.scrollBy({
        left:
          Number(button.dataset.stripDirection) *
          (first.getBoundingClientRect().width + gap),
        behavior: motion.matches ? "instant" : "smooth",
      });
    });
  });
  strip.addEventListener("scroll", updateStripButtons, { passive: true });
  window.addEventListener("resize", updateStripButtons);
  updateStripButtons();

  // El reel solo se reproduce dentro de pantalla. Con movimiento reducido,
  // la reproducción queda a cargo del usuario y conserva sus controles.
  const video = document.querySelector("video");
  let videoVisible = false;
  let userPaused = false;
  let internalPause = false;
  function syncVideo() {
    const mayPlay =
      videoVisible && !motion.matches && !document.hidden && !userPaused;
    if (mayPlay) {
      internalPause = false;
      video.play().catch(() => {
        /* Los controles permiten iniciar manualmente. */
      });
    } else if (!video.paused) {
      internalPause = true;
      video.pause();
    }
  }
  video.addEventListener("pause", () => {
    if (!internalPause && videoVisible && !document.hidden && !motion.matches)
      userPaused = true;
    internalPause = false;
  });
  video.addEventListener("play", () => {
    userPaused = false;
  });
  document.addEventListener("visibilitychange", syncVideo);
  motion.addEventListener("change", syncVideo);
  if ("IntersectionObserver" in window) {
    const videoObserver = new IntersectionObserver(
      (entries) => {
        videoVisible =
          entries[0].isIntersecting && entries[0].intersectionRatio >= 0.35;
        syncVideo();
      },
      { threshold: [0, 0.35] },
    );
    videoObserver.observe(video);

    if (!motion.matches) {
      const revealObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.08 },
      );
      document.querySelectorAll("[data-reveal]").forEach((element) => {
        element.classList.add("reveal-ready");
        revealObserver.observe(element);
      });
    }
  }
})();
