# Terminales Latinas, S.A. — Landing page

Sitio estático (HTML + CSS + JS), sin build. Reemplazo de tlasa.com.gt.

## Estructura

- `index.html` — página única con secciones: hero, compromiso, servicios, corredor, flota, control (monitoreo/BASC), empresa, cotización, footer.
- `css/styles.css` — tokens de diseño (OKLCH), componentes, responsive, `prefers-reduced-motion`.
- `js/main.js` — navegación, índice de servicios, formulario, animaciones (GSAP + ScrollTrigger vía CDN).
- `assets/logo.jpg` — logo original.
- `PRODUCT.md` — brief estratégico (registro, usuarios, personalidad, principios).

## Probar en local

```bash
python3 -m http.server 8765
# abrir http://localhost:8765
```

## Antes de publicar

1. **Formulario de cotización**: en `index.html`, el `<form id="quoteForm" data-endpoint="">` no tiene backend.
   Poner en `data-endpoint` la URL de un servicio de formularios (Formspree, Basin, Getform, o un endpoint propio)
   que acepte JSON por POST. Sin endpoint, el formulario muestra el teléfono como vía de confirmación.
2. **Fotografías**: son de Unsplash (licencia libre para uso comercial). Reemplazar por fotos reales de la flota
   cuando existan; las rutas están en `index.html` (buscar `images.unsplash.com`).
3. **Textos a confirmar con la empresa**: sección "Compromiso" (infraestructura, sistemas, personal), descripciones
   de servicios (DUCA-T, puertos), párrafos de Monitoreo y BASC. Misión, visión, teléfono y dirección se tomaron
   del sitio anterior.
4. **Correo de contacto**: no aparece en el sitio anterior; agregarlo en la sección de contacto y footer si existe.
5. **Favicon**: hoy usa `assets/logo.jpg`; conviene exportar un PNG/SVG cuadrado.

## Publicar

Cualquier hosting estático sirve (Netlify, Vercel, GitHub Pages, cPanel del dominio actual): subir la carpeta completa.
