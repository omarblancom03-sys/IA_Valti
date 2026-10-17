// Utilidades compartidas por toda la animación.

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function html(cadena) {
  const t = document.createElement('template');
  t.innerHTML = cadena.trim();
  return t.content.firstElementChild;
}

// ─────────── Cancelación: al avanzar rápido, las animaciones en curso se interrumpen ───────────

export const CANCELADO = Symbol('cancelado');

export class Token {
  constructor() {
    this.cancelado = false;
    this.oyentes = new Set();
  }
  cancelar() {
    if (this.cancelado) return;
    this.cancelado = true;
    for (const f of this.oyentes) f();
    this.oyentes.clear();
  }
  alCancelar(f) {
    if (this.cancelado) f();
    else this.oyentes.add(f);
    return () => this.oyentes.delete(f);
  }
}

export function esperar(ms, token) {
  return new Promise((resolver, rechazar) => {
    if (token?.cancelado) return rechazar(CANCELADO);
    let quitar = null;
    const id = setTimeout(() => {
      quitar?.();
      resolver();
    }, ms);
    quitar = token?.alCancelar(() => {
      clearTimeout(id);
      rechazar(CANCELADO);
    });
  });
}

// ─────────── Matemáticas ───────────

export const lerp = (a, b, t) => a + (b - a) * t;
export const limitar = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const salida = (t) => 1 - Math.pow(1 - t, 3);
export const rebote = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const azar = (a, b) => a + Math.random() * (b - a);

export function rgba(c, a) {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}
export function mezclar(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

export const COLORES = {
  mono: [92, 210, 255],
  monoClaro: [200, 239, 255],
  nm: [255, 79, 216],
  violeta: [176, 114, 255],
  nmClaro: [255, 211, 246],
  oro: [255, 207, 90],
  verde: [93, 255, 180],
  rojo: [255, 61, 94],
  ambar: [255, 171, 61],
  hielo: [215, 240, 255],
  gris: [138, 147, 171],
  blanco: [255, 255, 255],
};

// Ruido de Perlin 3D (para todo lo orgánico de la IA no-monótona)
const P = new Uint8Array(512);
{
  const p = [...Array(256).keys()];
  let s = 1337;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
}
const desvanecer = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function gradiente(h, x, y, z) {
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return (h & 1 ? -u : u) + (h & 2 ? -v : v);
}
export function ruido(x, y, z) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);
  const u = desvanecer(x);
  const v = desvanecer(y);
  const w = desvanecer(z);
  const A = P[X] + Y;
  const AA = P[A] + Z;
  const AB = P[A + 1] + Z;
  const B = P[X + 1] + Y;
  const BA = P[B] + Z;
  const BB = P[B + 1] + Z;
  return lerp(
    lerp(lerp(gradiente(P[AA] & 15, x, y, z), gradiente(P[BA] & 15, x - 1, y, z), u), lerp(gradiente(P[AB] & 15, x, y - 1, z), gradiente(P[BB] & 15, x - 1, y - 1, z), u), v),
    lerp(
      lerp(gradiente(P[AA + 1] & 15, x, y, z - 1), gradiente(P[BA + 1] & 15, x - 1, y, z - 1), u),
      lerp(gradiente(P[AB + 1] & 15, x, y - 1, z - 1), gradiente(P[BB + 1] & 15, x - 1, y - 1, z - 1), u),
      v,
    ),
    w,
  );
}

// ─────────── Escala del escenario y lienzos nítidos ───────────

export const Escala = { valor: 1, escenario: null };

export function rectEnEscenario(el) {
  const r = el.getBoundingClientRect();
  const e = Escala.escenario.getBoundingClientRect();
  const s = Escala.valor;
  return { x: (r.left - e.left) / s, y: (r.top - e.top) / s, w: r.width / s, h: r.height / s };
}

export class Lienzo {
  static todos = new Set();
  constructor(canvas, ancho, alto) {
    this.canvas = canvas;
    this.w = ancho;
    this.h = alto;
    this.ctx = canvas.getContext('2d');
    canvas.style.width = `${ancho}px`;
    canvas.style.height = `${alto}px`;
    Lienzo.todos.add(this);
    this.ajustar();
  }
  ajustar() {
    const f = Math.min(2.25, Escala.valor * (window.devicePixelRatio || 1));
    this.factor = f;
    this.canvas.width = Math.max(1, Math.round(this.w * f));
    this.canvas.height = Math.max(1, Math.round(this.h * f));
    this.ctx.setTransform(f, 0, 0, f, 0, 0);
  }
  limpiar() {
    this.ctx.setTransform(this.factor, 0, 0, this.factor, 0, 0);
    this.ctx.clearRect(0, 0, this.w, this.h);
  }
  static reajustar() {
    for (const l of Lienzo.todos) l.ajustar();
  }
}

// Destellos pre-renderizados (mucho más baratos que shadowBlur)
const destellos = new Map();
export function destello(color, radio = 32) {
  const clave = `${color.join(',')}|${radio}`;
  let c = destellos.get(clave);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = radio * 2;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(radio, radio, 0, radio, radio, radio);
    grad.addColorStop(0, rgba([255, 255, 255], 1));
    grad.addColorStop(0.12, rgba(color, 0.95));
    grad.addColorStop(0.4, rgba(color, 0.32));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, radio * 2, radio * 2);
    destellos.set(clave, c);
  }
  return c;
}

// ─────────── Íconos ───────────

export const ICONOS = {
  deduccion: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5.5" r="2.3"/><circle cx="5.5" cy="17.5" r="2.3"/><circle cx="18.5" cy="17.5" r="2.3"/></svg>',
  acumula: '<svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5"/><path d="M3 17l9 5 9-5"/></svg>',
  candado: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  supuesto: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke-dasharray="3 2.6"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.2-1 .7-1 1.3v.6"/><path d="M12 16.6v.4"/></svg>',
  revisa: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 0 1-14.2 5"/><path d="M4 12a8 8 0 0 1 14.2-5"/><path d="M18.6 3.2v4h-4"/><path d="M5.4 20.8v-4h4"/></svg>',
  excepcion: '<svg viewBox="0 0 24 24"><path d="M5 4v6c0 3 2 5 5 5h9"/><path d="M15.5 11.5L19 15l-3.5 3.5"/><path d="M5 20v-3"/></svg>',
  ojo: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3.2"/></svg>',
  ojoTachado: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3.2"/><path d="M3.5 3.5l17 17"/></svg>',
};
