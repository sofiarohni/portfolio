/* =============================================
   Sofia Rohnefeld — Portfolio
   ============================================= */

/* ── Navigation ─────────────────────────────── */
const pages    = document.querySelectorAll('.page');
const navLinks = document.querySelectorAll('[data-page]');

function showPage(id) {
  pages.forEach(p => p.classList.remove('active'));
  navLinks.forEach(a => a.classList.remove('active'));
  const t = document.getElementById(id);
  if (t) t.classList.add('active');
  navLinks.forEach(a => { if (a.dataset.page === id) a.classList.add('active'); });
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (id === 'home') ring.resize();
}

navLinks.forEach(l => l.addEventListener('click', e => { e.preventDefault(); showPage(l.dataset.page); }));

/* ── Lightbox ────────────────────────────────── */
const lightbox    = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');

function openLightboxSrc(src, alt) {
  lightboxImg.src = src; lightboxImg.alt = alt || '';
  lightbox.classList.add('open'); document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  lightbox.classList.remove('open'); document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
lightboxImg.addEventListener('click', e => e.stopPropagation());

/* ══════════════════════════════════════════════
   3-D RING

   Eigene Bilder einfügen: ALL_IMAGES erweitern.
   ══════════════════════════════════════════════ */

const ALL_IMAGES = [
  'portfolio/images/work-1.jpg',
  'portfolio/images/work-2.jpg',
  'portfolio/images/work-3.jpg',
];

// ── Tuning ────────────────────────────────────
const RING_COUNT  = 3;    // Bilder gleichzeitig
const RING_RADIUS = 820;   // Kreisradius — groß, geht weit über Rand
const IMG_W       = 390;   // Bildbreite
const IMG_H       = 510;   // Bildhöhe
const RING_TILT_X = 0.68;  // Schräge des Rings (radians, ~39°)
// Jede Karte: zufälliger Eigen-Tilt ± diese Menge (radians)
const CARD_TILT_RANGE = 0.55;
// Jede Karte: zufälliger Größen-Faktor Variation
const CARD_SIZE_VAR   = 0.30; // ±30% Größe
// Jede Karte: zufällige Y-Verschiebung im Ring
const CARD_Y_OFFSET   = 160;  // px max Versatz entlang Ringachse
// ─────────────────────────────────────────────

let cardProps = []; // per-card random properties, fixed until shuffle

const ring = (() => {
  const canvas = document.getElementById('ring-canvas');
  const ctx    = canvas.getContext('2d');

  let rotX = RING_TILT_X;
  let rotY = 0.25;

  let isDragging = false;
  let lastMX = 0, lastMY = 0;
  let velX = 0, velY = 0.0025;
  let mouseIdleX = 0, mouseIdleY = 0;

  let imgs   = [];
  let hoverI = -1;

  /* ── Canvas size ── */
  function resize() {
    const el = canvas.parentElement;
    canvas.width  = el.offsetWidth  * devicePixelRatio;
    canvas.height = el.offsetHeight * devicePixelRatio;
    canvas.style.width  = el.offsetWidth  + 'px';
    canvas.style.height = el.offsetHeight + 'px';
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickRandom() {
    const n = Math.min(RING_COUNT, ALL_IMAGES.length);
    // Generate chaotic per-card properties
    cardProps = Array.from({ length: n }, () => ({
      tilt:    (Math.random() - 0.5) * 2 * CARD_TILT_RANGE,
      scaleW:  1 + (Math.random() - 0.5) * 2 * CARD_SIZE_VAR,
      scaleH:  1 + (Math.random() - 0.5) * 2 * CARD_SIZE_VAR,
      yOff:    (Math.random() - 0.5) * 2 * CARD_Y_OFFSET,
      // slight angle offset so cards aren't perfectly evenly spaced
      angleOff: (Math.random() - 0.5) * 0.18,
    }));
    return shuffle(ALL_IMAGES).slice(0, n);
  }

  function loadImages(srcs) {
    imgs = srcs.map((src, i) => {
      const obj = { src, loaded: false, img: new Image(), err: false };
      obj.img.onload  = () => { obj.loaded = true; };
      obj.img.onerror = () => { obj.loaded = true; obj.err = true; };
      obj.img.src = src;
      return obj;
    });
  }

  /* ── 3-D math ── */
  function rotateY3(x, y, z, a) {
    return { x: x*Math.cos(a) + z*Math.sin(a), y, z: -x*Math.sin(a) + z*Math.cos(a) };
  }
  function rotateX3(x, y, z, a) {
    return { x, y: y*Math.cos(a) - z*Math.sin(a), z: y*Math.sin(a) + z*Math.cos(a) };
  }

  function project(p3, cx, cy) {
    let { x, y, z } = p3;
    const ry = rotY + mouseIdleX;
    const rx = rotX + mouseIdleY;
    ({ x, y, z } = rotateY3(x, y, z, ry));
    ({ x, y, z } = rotateX3(x, y, z, rx));
    const fov  = 1200;
    const dist = fov + z;
    const s    = dist > 10 ? fov / dist : 0;
    return { sx: cx + x * s, sy: cy + y * s, scale: s, z };
  }

  /* Build the 4 corners of card i with its unique properties */
  function cardCorners(i, cx, cy) {
    const n     = imgs.length;
    const props = cardProps[i] || {};
    const baseAngle = (i / n) * Math.PI * 2 + (props.angleOff || 0);
    const tilt  = props.tilt  || 0;
    const sw    = props.scaleW || 1;
    const sh    = props.scaleH || 1;
    const yOff  = props.yOff  || 0;

    const bx = Math.sin(baseAngle) * RING_RADIUS;
    const bz = Math.cos(baseAngle) * RING_RADIUS;
    const by = yOff; // card floats up/down along ring axis

    const hw = (IMG_W * sw) / 2;
    const hh = (IMG_H * sh) / 2;

    const raw = [
      { x: -hw, y: -hh }, { x: hw, y: -hh },
      { x:  hw, y:  hh }, { x: -hw, y:  hh },
    ];

    const corners3 = raw.map(({ x, y }) => {
      // apply card's own tilt (2-D rotation in card plane)
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      const rx2 =  x * ct - y * st;
      const ry2 =  x * st + y * ct;
      return { x: bx + rx2, y: by + ry2, z: bz };
    });

    const projected = corners3.map(c => project(c, cx, cy));
    const center    = project({ x: bx, y: by, z: bz }, cx, cy);
    return { projected, center, z: center.z };
  }

  /* ── Hit test ── */
  function hitTest(mx, my, cx, cy) {
    const n     = imgs.length;
    const order = Array.from({ length: n }, (_, i) => i)
      .sort((a, b) => cardCorners(b, cx, cy).z - cardCorners(a, cx, cy).z);
    for (const i of order) {
      const { projected } = cardCorners(i, cx, cy);
      if (pointInQuad(mx, my, projected)) return i;
    }
    return -1;
  }

  function pointInQuad(px, py, pts) {
    for (let k = 0; k < 4; k++) {
      const a = pts[k], b = pts[(k + 1) % 4];
      if ((b.sx - a.sx) * (py - a.sy) - (b.sy - a.sy) * (px - a.sx) < 0) return false;
    }
    return true;
  }

  /* ── Draw ── */
  function draw() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2;
    // The ring is tilted ~39° on X. This makes the projected ring's
    // visual center drift downward because front cards are bigger (closer).
    // Compensate by shifting cy upward by roughly RING_RADIUS * sin(rotX) * 0.45
    const visualOffset = RING_RADIUS * Math.sin(rotX + mouseIdleY) * 0.45;
    const cy = H / 2 - visualOffset;

    const n = imgs.length;
    if (!n) return;

    const list = Array.from({ length: n }, (_, i) => {
      const { projected, center, z } = cardCorners(i, cx, cy);
      return { i, projected, center, z };
    }).sort((a, b) => a.z - b.z);

    for (const { i, projected, z } of list) {
      const obj = imgs[i];
      const p   = projected;
      const isHover = i === hoverI;

      // depth alpha
      const t     = Math.max(0, Math.min(1, (z + RING_RADIUS) / (2 * RING_RADIUS)));
      const alpha = 0.28 + t * 0.72;

      ctx.save();
      ctx.globalAlpha = isHover ? 1 : alpha;

      ctx.beginPath();
      ctx.moveTo(p[0].sx, p[0].sy);
      for (let k = 1; k < 4; k++) ctx.lineTo(p[k].sx, p[k].sy);
      ctx.closePath();
      ctx.clip();

      if (obj.loaded && !obj.err) {
        drawPerspectiveImage(ctx, obj.img, p);
      } else {
        ctx.fillStyle = '#e0ddd8';
        ctx.fill();
      }

      // shadow on back cards
      if (t < 0.4) {
        ctx.fillStyle = `rgba(0,0,0,${0.32 * (1 - t / 0.4)})`;
        ctx.fill();
      }

      ctx.restore();

      // hover border
      if (isHover) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p[0].sx, p[0].sy);
        for (let k = 1; k < 4; k++) ctx.lineTo(p[k].sx, p[k].sy);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2 * devicePixelRatio;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /* Perspective-correct image via two textured triangles */
  function drawPerspectiveImage(ctx, img, pts) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    drawTriImage(ctx, img, pts[0].sx, pts[0].sy, 0,  0,
                           pts[1].sx, pts[1].sy, iw, 0,
                           pts[2].sx, pts[2].sy, iw, ih);
    drawTriImage(ctx, img, pts[0].sx, pts[0].sy, 0,  0,
                           pts[2].sx, pts[2].sy, iw, ih,
                           pts[3].sx, pts[3].sy, 0,  ih);
  }

  function drawTriImage(ctx, img, x0,y0,u0,v0, x1,y1,u1,v1, x2,y2,u2,v2) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.lineTo(x2,y2);
    ctx.closePath(); ctx.clip();
    const d = (u1-u0)*(v2-v0)-(u2-u0)*(v1-v0);
    if (Math.abs(d) < 1e-6) { ctx.restore(); return; }
    const a=((x1-x0)*(v2-v0)-(x2-x0)*(v1-v0))/d;
    const b=((x2-x0)*(u1-u0)-(x1-x0)*(u2-u0))/d;
    const c=x0-a*u0-b*v0;
    const e=((y1-y0)*(v2-v0)-(y2-y0)*(v1-v0))/d;
    const f=((y2-y0)*(u1-u0)-(y1-y0)*(u2-u0))/d;
    const g=y0-e*u0-f*v0;
    ctx.transform(a,e,b,f,c,g);
    ctx.drawImage(img,0,0);
    ctx.restore();
  }

  /* ── Loop ── */
  function tick() {
    if (!isDragging) {
      rotY += velY;
      velY = velY * 0.97 + 0.0025 * 0.03;
      velX *= 0.93;
    }
    draw();
    requestAnimationFrame(tick);
  }

  function cc(e) {
    const r = canvas.getBoundingClientRect(), dpr = devicePixelRatio;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - r.left) * dpr, y: (src.clientY - r.top) * dpr };
  }

  function getCXY() {
    const W = canvas.width, H = canvas.height;
    const visualOffset = RING_RADIUS * Math.sin(rotX + mouseIdleY) * 0.45;
    return { cx: W / 2, cy: H / 2 - visualOffset };
  }

  let dragDist = 0;

  canvas.addEventListener('mousedown', e => {
    isDragging = true; velX = 0; velY = 0; dragDist = 0;
    const c = cc(e); lastMX = c.x; lastMY = c.y;
  });
  window.addEventListener('mousemove', e => {
    const c = cc(e);
    const { cx, cy } = getCXY();
    if (isDragging) {
      const dx = c.x - lastMX, dy = c.y - lastMY;
      dragDist += Math.sqrt(dx * dx + dy * dy);
      velY = dx * 0.004;
      velX = dy * 0.003;
      rotY += velY; rotX += velX;
      rotX = Math.max(-1.3, Math.min(1.3, rotX));
      lastMX = c.x; lastMY = c.y;
    } else {
      const W = canvas.width, H = canvas.height;
      mouseIdleX = ((c.x / W) - 0.5) * 0.55;
      mouseIdleY = ((c.y / H) - 0.5) * 0.40;
      hoverI = hitTest(c.x, c.y, cx, cy);
      canvas.style.cursor = hoverI >= 0 ? 'pointer' : 'grab';
    }
  });
  window.addEventListener('mouseup', () => { isDragging = false; });

  canvas.addEventListener('click', e => {
    // ignore if user was dragging
    if (dragDist > 6 * devicePixelRatio) return;
    const c = cc(e);
    const { cx, cy } = getCXY();
    const hit = hitTest(c.x, c.y, cx, cy);
    if (hit >= 0 && imgs[hit]) openLightboxSrc(imgs[hit].src, `Arbeit ${hit + 1}`);
  });

  canvas.addEventListener('touchstart', e => {
    isDragging = true; velX = 0; velY = 0;
    const c = cc(e); lastMX = c.x; lastMY = c.y;
  }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const c = cc(e);
    velY = (c.x - lastMX) * 0.004; velX = (c.y - lastMY) * 0.003;
    rotY += velY; rotX += velX;
    rotX = Math.max(-1.3, Math.min(1.3, rotX));
    lastMX = c.x; lastMY = c.y;
  }, { passive: true });
  canvas.addEventListener('touchend', () => { isDragging = false; });

  window.addEventListener('resize', resize);

  document.getElementById('shuffleBtn').addEventListener('click', () => {
    loadImages(pickRandom());
  });

  function init() {
    resize();
    loadImages(pickRandom());
    tick();
  }

  return { init, resize };
})();

ring.init();
