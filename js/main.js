/* Terminales Latinas — interacción y movimiento
   GSAP + ScrollTrigger (cargados vía CDN, defer). Todo degrada a contenido visible si no cargan.
   Presupuesto: 60 fps. Lo que depende del scroll pasa por un solo requestAnimationFrame
   (el propio de ScrollTrigger, o el planificador de abajo para lo que no es GSAP). */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  /* Dispositivos lentos: heurística conservadora (ahorro de datos, red 2G, ≤2 GB
     o ≤2 hilos). El CSS apaga el movimiento decorativo continuo vía
     html[data-motion="low"]; aquí además se omite el parallax con scrub. */
  const conn = navigator.connection || {};
  const lowEnd =
    conn.saveData === true ||
    /(^|-)2g$/.test(conn.effectiveType || '') ||
    (navigator.deviceMemory > 0 && navigator.deviceMemory <= 2) ||
    (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 2);
  if (lowEnd) document.documentElement.dataset.motion = 'low';

  /* Scroll-driven animations nativas: si existen, el CSS ya dibuja la línea del
     corredor en el compositor y no hace falta escribir --progress desde JS. */
  const nativeTimeline =
    typeof CSS !== 'undefined' && !!CSS.supports && CSS.supports('animation-timeline: view()');

  /* ---------------------------------------------------------------- Nav */
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('menu');

  // Una lectura por cuadro: el evento scroll solo levanta una bandera y el
  // trabajo ocurre en requestAnimationFrame. Solo se escribe al DOM si cambia.
  let navScrolled = null;
  let navFrame = 0;
  const applyNavState = () => {
    navFrame = 0;
    const next = window.scrollY > 40;
    if (next === navScrolled) return;
    navScrolled = next;
    nav.classList.toggle('is-scrolled', next);
  };
  const onScroll = () => { if (!navFrame) navFrame = requestAnimationFrame(applyNavState); };
  applyNavState();
  window.addEventListener('scroll', onScroll, { passive: true });

  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) nav.classList.add('is-scrolled');
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false); });

  /* ------------------------------------------------------------ Servicios */
  const list = document.getElementById('servicesList');
  const visuals = document.querySelectorAll('.services__visual img');
  const caption = document.getElementById('servicesCaption');
  const captions = {
    intl: 'Carretera CA-1 · tránsito internacional',
    ports: 'Puerto · importación y exportación',
    local: 'Área metropolitana · movimientos locales',
  };

  const activate = (item) => {
    list.querySelectorAll('.service').forEach((li) => {
      const on = li === item;
      li.classList.toggle('is-active', on);
      li.querySelector('.service__btn').setAttribute('aria-expanded', String(on));
    });
    const key = item.dataset.image;
    visuals.forEach((img) => img.classList.toggle('is-active', img.dataset.key === key));
    caption.textContent = captions[key] || '';
  };
  list.querySelectorAll('.service__btn').forEach((btn) => {
    const li = btn.closest('.service');
    btn.addEventListener('click', () => activate(li));
    // Hover en escritorio adelanta la imagen sin abrir el panel
    li.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      visuals.forEach((img) => img.classList.toggle('is-active', img.dataset.key === li.dataset.image));
      caption.textContent = captions[li.dataset.image] || '';
    });
    li.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      const active = list.querySelector('.service.is-active');
      if (active) {
        visuals.forEach((img) => img.classList.toggle('is-active', img.dataset.key === active.dataset.image));
        caption.textContent = captions[active.dataset.image] || '';
      }
    });
  });

  /* ------------------------------------------------------------ Formulario */
  const form = document.getElementById('quoteForm');
  const status = document.getElementById('formStatus');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    status.removeAttribute('data-state');

    if (!form.checkValidity()) {
      form.querySelector(':invalid')?.focus();
      status.dataset.state = 'error';
      status.textContent = 'Revisa los campos marcados: nombre, teléfono, origen y destino son obligatorios.';
      return;
    }

    const endpoint = form.dataset.endpoint;
    const data = Object.fromEntries(new FormData(form).entries());

    if (!endpoint) {
      // Sin backend configurado: el mensaje queda listo para enviar por teléfono.
      status.dataset.state = 'ok';
      status.textContent = 'Solicitud registrada. Para confirmarla de inmediato llámanos al 2413-0808.';
      form.reset();
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(String(res.status));
      status.dataset.state = 'ok';
      status.textContent = 'Recibimos tu solicitud. Un coordinador te contactará pronto.';
      form.reset();
    } catch {
      status.dataset.state = 'error';
      status.textContent = 'No pudimos enviar el formulario. Llámanos al 2413-0808 y te atendemos de inmediato.';
    } finally {
      btn.disabled = false;
    }
  });

  /* ------------------------------------------------------------- Movimiento */
  if (!hasGsap || reduceMotion) {
    // Estado final sin animar: la línea del corredor completa.
    document.getElementById('route')?.style.setProperty('--progress', '1');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'expo.out', duration: 1 });

  /* Hero: coreografía de carga */
  const heroTl = gsap.timeline({ delay: 0.15 });
  heroTl
    .from('.hero__media img', { scale: 1.12, duration: 2.2, ease: 'power2.out' }, 0)
    .from('[data-hero="kicker"]', { y: 16, autoAlpha: 0, duration: 0.8 }, 0.2)
    .from('.hero h1 .line > span', { yPercent: 110, duration: 1.1, stagger: 0.09 }, 0.3)
    .from('[data-hero="lede"]', { y: 24, autoAlpha: 0, duration: 0.9 }, 0.75)
    .from('[data-hero="actions"] .btn', { y: 20, autoAlpha: 0, duration: 0.8, stagger: 0.08 }, 0.9)
    .from('[data-hero="meta"] li', { y: 12, autoAlpha: 0, duration: 0.7, stagger: 0.06 }, 1.05)
    .from('.route-marquee', { yPercent: 100, duration: 0.9 }, 0.9)
    .from('.nav__inner', { y: -12, autoAlpha: 0, duration: 0.8 }, 0.4);

  /* Hero: parallax suave de la foto (se omite en dispositivos lentos) */
  if (!lowEnd) {
    gsap.to('.hero__media img', {
      yPercent: 14,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
  }

  /* Reveals: cada tipo con su propio gesto */
  document.querySelectorAll('[data-reveal="lines"]').forEach((el) => {
    gsap.from(el, {
      y: 36, autoAlpha: 0, duration: 1.1,
      clipPath: 'inset(0 0 100% 0)',
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });

  // Agrupa los "up" por sección para escalonarlos entre sí
  document.querySelectorAll('section, .pledge').forEach((sec) => {
    const items = sec.querySelectorAll('[data-reveal="up"]');
    if (!items.length) return;
    ScrollTrigger.batch(items, {
      start: 'top 88%',
      onEnter: (batch) => gsap.from(batch, { y: 28, autoAlpha: 0, duration: 0.9, stagger: 0.1, overwrite: true }),
      once: true,
    });
  });

  document.querySelectorAll('[data-reveal="photo"]').forEach((el) => {
    const img = el.querySelector('img, iframe');
    gsap.from(el, {
      clipPath: 'inset(8% 6% 8% 6%)', autoAlpha: 0, duration: 1.3,
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
    if (img) {
      gsap.fromTo(img, { scale: 1.12 }, {
        scale: 1, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    }
  });

  /* Servicios: filas entran en cascada */
  gsap.from('.service', {
    y: 24, autoAlpha: 0, duration: 0.9, stagger: 0.1,
    scrollTrigger: { trigger: '.services__list', start: 'top 85%' },
  });
  gsap.from('.services__visual', {
    clipPath: 'inset(0 0 100% 0)', duration: 1.3,
    scrollTrigger: { trigger: '.services__visual', start: 'top 85%' },
  });

  /* Corredor: la línea se dibuja con el scroll; paradas y aduanas aparecen en orden */
  const route = document.getElementById('route');
  if (route) {
    // La línea: nativa en CSS si el navegador puede (animation-timeline: view());
    // si no, GSAP la escribe con scrub, una vez por cuadro.
    if (!nativeTimeline) {
      const progress = { v: 0 };
      gsap.to(progress, {
        v: 1, ease: 'none',
        onUpdate: () => route.style.setProperty('--progress', progress.v.toFixed(4)),
        scrollTrigger: { trigger: route, start: 'top 75%', end: 'bottom 55%', scrub: 0.6 },
      });
    }
    gsap.from(route.querySelectorAll('.stop__dot'), {
      scale: 0, duration: 0.6, stagger: 0.12, ease: 'back.out(1.6)',
      transformOrigin: 'center',
      scrollTrigger: { trigger: route, start: 'top 75%' },
    });
    gsap.from(route.querySelectorAll('.stop__body, .border-x__body'), {
      y: 18, autoAlpha: 0, duration: 0.8, stagger: 0.07,
      scrollTrigger: { trigger: route, start: 'top 75%' },
    });
  }

  /* Flota: las barras crecen a escala */
  gsap.from('.unit__bar', {
    scaleX: 0, duration: 1.4, stagger: 0.15, ease: 'expo.out',
    scrollTrigger: { trigger: '#scale', start: 'top 80%' },
  });
  gsap.from('.unit__head, .unit__note, .scale__ruler', {
    y: 14, autoAlpha: 0, duration: 0.8, stagger: 0.06,
    scrollTrigger: { trigger: '#scale', start: 'top 80%' },
  });

  /* Empresa: foto de fondo con desplazamiento lento (se omite en dispositivos lentos) */
  if (!lowEnd) {
    gsap.to('.company__photo img', {
      yPercent: 12, ease: 'none',
      scrollTrigger: { trigger: '.company', start: 'top bottom', end: 'bottom top', scrub: true },
    });
  }
})();
