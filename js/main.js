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

  /* ------------------------------------------------------- Esfera 3D (canvas) */
  // Malla de meridianos y paralelos proyectada en perspectiva, centrada en el globo del logo.
  function startOrbit({ animate }) {
    const canvas = document.getElementById('orbit');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const CX = 0.664, CY = 0.481, R = 0.191 * 1.22;   // centro y radio relativos al ancho de la escena
    const TILT = (23 * Math.PI) / 180;
    let w = 0, h = 0, dpr = 1, angle = 0, raf = 0, visible = true, last = performance.now();

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.round(r.width); h = Math.round(r.height);
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    // proyecta un punto de la esfera unitaria rotado por `angle` alrededor de Y y con inclinación TILT en X
    const project = (lat, lon) => {
      let x = Math.cos(lat) * Math.sin(lon);
      let y = Math.sin(lat);
      let z = Math.cos(lat) * Math.cos(lon);
      const ca = Math.cos(angle), sa = Math.sin(angle);
      [x, z] = [x * ca + z * sa, -x * sa + z * ca];
      const ct = Math.cos(TILT), st = Math.sin(TILT);
      [y, z] = [y * ct - z * st, y * st + z * ct];
      const persp = 1 / (1 + z * 0.18);
      return { x: x * persp, y: y * persp, z };
    };

    const strokePath = (pts) => {
      const cx = w * CX, cy = h * CY, r = w * R;
      let open = false;
      for (const p of pts) {
        // sólo el hemisferio frontal, más nítido al centro
        if (p.z > -0.05) {
          if (!open) { ctx.beginPath(); open = true; ctx.moveTo(cx + p.x * r, cy - p.y * r); }
          else ctx.lineTo(cx + p.x * r, cy - p.y * r);
        } else if (open) { ctx.stroke(); open = false; }
      }
      if (open) ctx.stroke();
    };

    function draw() {
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'oklch(0.44 0.15 270 / 0.38)';
      const STEPS = 72;
      for (let m = 0; m < 12; m++) {                       // meridianos cada 30°
        const lon = (m * Math.PI) / 6;
        const pts = [];
        for (let i = 0; i <= STEPS; i++) pts.push(project(-Math.PI / 2 + (i / STEPS) * Math.PI, lon));
        strokePath(pts);
      }
      for (let k = -2; k <= 2; k++) {                      // paralelos cada 30°
        const lat = (k * Math.PI) / 6;
        const pts = [];
        for (let i = 0; i <= STEPS; i++) pts.push(project(lat, (i / STEPS) * Math.PI * 2));
        strokePath(pts);
      }
      // contorno exterior
      ctx.strokeStyle = 'oklch(0.44 0.15 270 / 0.26)';
      ctx.beginPath(); ctx.arc(w * CX, h * CY, w * R, 0, Math.PI * 2); ctx.stroke();
    }

    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      if (visible) { angle += dt * 0.22; draw(); }
      raf = requestAnimationFrame(tick);
    };

    new ResizeObserver(resize).observe(canvas);
    resize();
    if (!animate) return;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
    raf = requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------- Movimiento */
  if (!hasGsap || reduceMotion) {
    // Estado final sin animar: la línea del corredor completa.
    document.getElementById('route')?.style.setProperty('--progress', '1');
    startOrbit({ animate: false });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'expo.out', duration: 1 });

  /* Hero: coreografía de carga — el camión entra rodando y el globo se posa sobre la plataforma */
  const stage = document.getElementById('sceneStage');
  const truck = document.querySelector('.scene__layer--truck');
  const globe = document.querySelector('.scene__layer--globe');
  const road = document.querySelector('.scene__road');

  const heroTl = gsap.timeline({ delay: 0.1 });
  heroTl
    .from('.nav__inner', { y: -12, autoAlpha: 0, duration: 0.8 }, 0)
    .from('[data-hero="kicker"]', { y: 16, autoAlpha: 0, duration: 0.8 }, 0.15)
    .from('.hero h1 .line > span', { yPercent: 110, duration: 1.1, stagger: 0.09 }, 0.25)
    .from('[data-hero="lede"]', { y: 24, autoAlpha: 0, duration: 0.9 }, 0.7)
    .from('[data-hero="actions"] .btn', { y: 20, autoAlpha: 0, duration: 0.8, stagger: 0.08 }, 0.85)
    .from('[data-hero="meta"] li', { y: 12, autoAlpha: 0, duration: 0.7, stagger: 0.06 }, 1.0)
    .from('.route-marquee', { yPercent: 100, duration: 0.9 }, 0.9)
    // escena
    .from(road, { scaleX: 0, transformOrigin: 'left center', duration: 1.2, ease: 'power2.out' }, 0.2)
    .from(truck, { xPercent: -70, autoAlpha: 0, duration: 2.1, ease: 'power3.out' }, 0.25)
    .fromTo(road, { backgroundPositionX: '0px' }, { backgroundPositionX: '-480px', duration: 2.1, ease: 'power3.out' }, 0.25)
    .from(globe, { y: -40, scale: 0.86, autoAlpha: 0, transformOrigin: '66% 50%', duration: 1.5 }, 0.9)
    .from('#orbit', { autoAlpha: 0, duration: 1.2 }, 1.4);

  /* Escena en reposo: el globo flota y un brillo recorre la esfera */
  gsap.to(globe, { y: -7, duration: 3.4, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 2.4 });
  const glossTl = gsap.timeline({ repeat: -1, repeatDelay: 3.2, delay: 2.6 });
  glossTl.fromTo('.scene__gloss', { '--gx': '-70%' }, { '--gx': '70%', duration: 2.4, ease: 'sine.inOut' });

  /* Profundidad: inclinación con el puntero (escritorio) o con el scroll (táctil) */
  const hero = document.querySelector('.hero');
  const layers = [
    { el: truck, depth: 16 },
    { el: globe, depth: 8 },
    { el: document.getElementById('orbit'), depth: -22 },
  ];
  const rotX = gsap.quickTo(stage, 'rotationX', { duration: 0.9, ease: 'power3.out' });
  const rotY = gsap.quickTo(stage, 'rotationY', { duration: 0.9, ease: 'power3.out' });
  const movers = layers.map((l) => ({
    x: gsap.quickTo(l.el, 'x', { duration: 0.9, ease: 'power3.out' }),
    y: gsap.quickTo(l.el, 'y', { duration: 0.9, ease: 'power3.out' }),
    depth: l.depth,
  }));
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (finePointer) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;   // -1 … 1
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      rotY(nx * 7);
      rotX(-ny * 5);
      movers.forEach((m) => { m.x(nx * m.depth); m.y(ny * m.depth * 0.6); });
    });
    hero.addEventListener('pointerleave', () => {
      rotY(0); rotX(0);
      movers.forEach((m) => { m.x(0); m.y(0); });
    });
  } else {
    gsap.to(stage, {
      rotationX: -6, yPercent: -6, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
    });
    gsap.to(truck, {
      x: 40, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
    });
  }

  /* Esfera de alambre en 3D detrás del globo del logo */
  startOrbit({ animate: true });

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
