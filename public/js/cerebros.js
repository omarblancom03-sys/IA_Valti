// Los «cerebros» de las dos IAs, dibujados en 3D sobre canvas 2D.
//  · Monótona: un cristal geodésico rígido. Gira a golpes, como un reloj, y cada conclusión
//    le agrega un anillo que nunca se va. Si se contradice, se agrieta y estalla.
//  · No-monótona: una red orgánica que respira. Sus conclusiones son satélites que orbitan
//    y que pueden desprenderse cuando se retiran.

import { Lienzo, ruido, destello, rgba, mezclar, COLORES, lerp, azar } from './util.js';

const FOCAL = 620;
const CX = 160;
const CY = 160;

function rotar(x, y, z, yaw, pitch, salida, i) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  salida[i] = x1;
  salida[i + 1] = y * cp - z1 * sp;
  salida[i + 2] = y * sp + z1 * cp;
}

function hash(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

// Esfera geodésica: icosaedro subdividido una vez (42 vértices, 120 aristas)
function geodesica() {
  const t = (1 + Math.sqrt(5)) / 2;
  const v = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(([x, y, z]) => {
    const n = Math.hypot(x, y, z);
    return [x / n, y / n, z / n];
  });
  const caras = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const medios = new Map();
  const medio = (a, b) => {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (medios.has(k)) return medios.get(k);
    const p = [(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2];
    const n = Math.hypot(...p);
    v.push([p[0] / n, p[1] / n, p[2] / n]);
    medios.set(k, v.length - 1);
    return v.length - 1;
  };
  const aristas = new Set();
  const agregar = (a, b) => aristas.add(a < b ? `${a}_${b}` : `${b}_${a}`);
  for (const [a, b, c] of caras) {
    const ab = medio(a, b);
    const bc = medio(b, c);
    const ca = medio(c, a);
    for (const [p, q, r] of [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]) {
      agregar(p, q);
      agregar(q, r);
      agregar(r, p);
    }
  }
  return { vertices: v, aristas: [...aristas].map((k) => k.split('_').map(Number)) };
}

const CUBO_V = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z])));
const CUBO_A = [];
for (let i = 0; i < 8; i++) {
  for (let j = i + 1; j < 8; j++) {
    const d = CUBO_V[i].reduce((s, c, k) => s + (c !== CUBO_V[j][k] ? 1 : 0), 0);
    if (d === 1) CUBO_A.push([i, j]);
  }
}
const OCTA_V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const OCTA_A = [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5]];

// ═════════════════════════════ IA MONÓTONA ═════════════════════════════

export class CerebroMonotono {
  constructor(canvas) {
    this.l = new Lienzo(canvas, 320, 320);
    const g = geodesica();
    this.v = g.vertices.map(([x, y, z]) => [x * 96, y * 96, z * 96]);
    this.a = g.aristas;
    this.cubo = CUBO_V.map(([x, y, z]) => [x * 30, y * 30, z * 30]);
    this.octa = OCTA_V.map(([x, y, z]) => [x * 19, y * 19, z * 19]);
    this.rv = new Float32Array(this.v.length * 3);
    this.rc = new Float32Array(24);
    this.ro = new Float32Array(18);
    this.yaw = 0.5;
    this.yawObj = 0.5;
    this.giroCubo = 0;
    this.giroCuboObj = 0;
    this.pitch = -0.36;
    this.proximoTic = 0;
    this.pulso = 0;
    this.velocidad = 1;
    this.modo = 'espera';
    this.tModo = 0;
    this.t = 0;
    this.escaneo = -1;
    this.anillos = [];
    this.esquirlas = [];
    this.grietas = [];
    this.escarcha = [];
    this.color = [...COLORES.mono];
  }

  setModo(modo) {
    if (modo === this.modo) return;
    if (modo === 'roto' && !this.esquirlas.length) this.escombrosQuietos();
    if (modo !== 'roto' && modo !== 'contradiccion') {
      this.esquirlas = [];
      this.grietas = [];
    }
    if (modo !== 'paralizada') this.escarcha = [];
    this.modo = modo;
    this.tModo = 0;
  }

  setConclusiones(lista, animar = true) {
    const claves = new Set(lista.map((c) => c.lit));
    this.anillos = this.anillos.filter((a) => claves.has(a.lit));
    for (const c of lista) {
      if (this.anillos.some((a) => a.lit === c.lit)) continue;
      const k = this.anillos.length;
      this.anillos.push({ lit: c.lit, nace: animar ? this.t : -10, inclX: 1.05 + (k % 3) * 0.32, inclZ: k * 0.9 + hash(c.lit) * 0.6 });
    }
  }

  procesar() {
    this.escaneo = 0;
  }

  // Se rompe: cada arista del cristal se convierte en una esquirla que sale disparada.
  explotar() {
    this.esquirlas = [];
    const r = this.rv;
    for (const [i, j] of this.a) {
      const x1 = this.px(r[i * 3], r[i * 3 + 2]);
      const y1 = this.py(r[i * 3 + 1], r[i * 3 + 2]);
      const x2 = this.px(r[j * 3], r[j * 3 + 2]);
      const y2 = this.py(r[j * 3 + 1], r[j * 3 + 2]);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      let dx = mx - CX;
      let dy = my - CY;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      const v = azar(40, 170) * (0.6 + d / 110);
      this.esquirlas.push({
        x: mx, y: my, hx: (x2 - x1) / 2, hy: (y2 - y1) / 2, vx: dx * v + azar(-20, 20), vy: dy * v + azar(-20, 20),
        ang: 0, va: azar(-7, 7), vida: 1, tono: Math.random(),
      });
    }
    this.anillos = [];
    this.setModo('roto');
  }

  escombrosQuietos() {
    this.esquirlas = [];
    for (let k = 0; k < 120; k++) {
      const a = azar(0, Math.PI * 2);
      const d = azar(40, 150);
      const largo = azar(4, 14);
      const ang = azar(0, Math.PI * 2);
      this.esquirlas.push({
        x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d, hx: Math.cos(ang) * largo, hy: Math.sin(ang) * largo,
        vx: azar(-6, 6), vy: azar(-6, 6), ang: 0, va: azar(-0.6, 0.6), vida: 0.4, tono: Math.random(),
      });
    }
    this.anillos = [];
  }

  reiniciar() {
    this.esquirlas = [];
    this.grietas = [];
    this.escarcha = [];
    this.anillos = [];
    this.velocidad = 1;
    this.modo = 'espera';
  }

  px(x, z) {
    return CX + x * (FOCAL / (FOCAL + z));
  }
  py(y, z) {
    return CY + y * (FOCAL / (FOCAL + z));
  }

  dibujar(t, dt) {
    this.t = t;
    this.tModo += dt;
    const { ctx } = this.l;
    this.l.limpiar();
    const modo = this.modo;

    // Giro mecánico: «tic… tic…»
    const objetivoVel = modo === 'paralizada' ? 0 : 1;
    this.velocidad = lerp(this.velocidad, objetivoVel, 1 - Math.exp(-dt * (objetivoVel ? 3 : 0.9)));
    const intervalo = modo === 'procesando' ? 0.38 : modo === 'espera' ? 1.7 : 1.05;
    if (t >= this.proximoTic && this.velocidad > 0.06 && modo !== 'roto') {
      this.yawObj += Math.PI / 6;
      this.giroCuboObj -= Math.PI / 4;
      this.proximoTic = t + intervalo / this.velocidad;
      this.pulso = 1;
    }
    const k = 1 - Math.exp(-dt * 10 * Math.max(this.velocidad, 0.05));
    this.yaw += (this.yawObj - this.yaw) * k;
    this.giroCubo += (this.giroCuboObj - this.giroCubo) * k;
    this.pulso *= Math.exp(-dt * 4);

    // Color según el estado
    let objetivo = COLORES.mono;
    if (modo === 'paralizada') objetivo = COLORES.hielo;
    else if (modo === 'contradiccion' || modo === 'roto') objetivo = COLORES.rojo;
    else if (modo === 'duda') objetivo = [150, 170, 200];
    this.color = mezclar(this.color, objetivo, 1 - Math.exp(-dt * 3));
    const alfa = modo === 'espera' ? 0.4 : modo === 'duda' ? 0.6 : 1;

    // Escaneo durante el procesamiento: un plano que recorre el cristal
    this.yEsc = null;
    if (this.escaneo >= 0) {
      this.escaneo += dt * 1.6;
      this.yEsc = -110 + this.escaneo * 220;
      if (this.escaneo > 1) this.escaneo = modo === 'procesando' ? 0 : -1;
    }

    // Rotación de todos los vértices
    for (let i = 0; i < this.v.length; i++) rotar(...this.v[i], this.yaw, this.pitch, this.rv, i * 3);
    for (let i = 0; i < 8; i++) rotar(...this.cubo[i], this.giroCubo, this.pitch + 0.5, this.rc, i * 3);
    for (let i = 0; i < 6; i++) rotar(...this.octa[i], -this.yaw * 0.5, this.pitch, this.ro, i * 3);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (modo === 'contradiccion') {
      const j = Math.min(4, this.tModo * 3);
      ctx.translate(azar(-j, j), azar(-j, j));
    }

    if (modo === 'roto') {
      this.dibujarEsquirlas(ctx, dt);
    } else {
      this.dibujarNucleo(ctx, t, alfa);
      if (modo === 'contradiccion') {
        // Separación cromática: el cristal se «desdobla»
        const s = 2 + Math.sin(t * 40) * 2;
        this.dibujarCristal(ctx, [255, 40, 80], alfa * 0.8, -s, 0);
        this.dibujarCristal(ctx, [40, 220, 255], alfa * 0.6, s, 0);
        this.dibujarGrietas(ctx, dt);
      } else {
        this.dibujarCristal(ctx, this.color, alfa, 0, 0);
      }
      this.dibujarAnillos(ctx, t, alfa);
    }
    ctx.restore();

    if (modo === 'paralizada') this.dibujarEscarcha(ctx, t, dt);
    if (modo === 'duda') this.dibujarDuda(ctx, t);
  }

  dibujarNucleo(ctx, t, alfa) {
    const c = this.color;
    const r = 30 + this.pulso * 16;
    ctx.globalAlpha = (0.55 + this.pulso * 0.45) * alfa;
    const d = destello(c.map(Math.round), 64);
    ctx.drawImage(d, CX - r, CY - r, r * 2, r * 2);
    ctx.globalAlpha = alfa;
    // Octaedro interno
    ctx.strokeStyle = rgba(COLORES.blanco, 0.75 * alfa);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const [i, j] of OCTA_A) {
      ctx.moveTo(this.px(this.ro[i * 3], this.ro[i * 3 + 2]), this.py(this.ro[i * 3 + 1], this.ro[i * 3 + 2]));
      ctx.lineTo(this.px(this.ro[j * 3], this.ro[j * 3 + 2]), this.py(this.ro[j * 3 + 1], this.ro[j * 3 + 2]));
    }
    ctx.stroke();
    // Cubo interno
    ctx.strokeStyle = rgba(this.color, 0.55 * alfa);
    ctx.beginPath();
    for (const [i, j] of CUBO_A) {
      ctx.moveTo(this.px(this.rc[i * 3], this.rc[i * 3 + 2]), this.py(this.rc[i * 3 + 1], this.rc[i * 3 + 2]));
      ctx.lineTo(this.px(this.rc[j * 3], this.rc[j * 3 + 2]), this.py(this.rc[j * 3 + 1], this.rc[j * 3 + 2]));
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  dibujarCristal(ctx, color, alfa, ox, oy) {
    const r = this.rv;
    const yEsc = this.yEsc;
    const capas = [[], [], []];
    const brillantes = [];
    for (const [i, j] of this.a) {
      const z = (r[i * 3 + 2] + r[j * 3 + 2]) / 2;
      const capa = z > 25 ? 0 : z > -25 ? 1 : 2;
      capas[capa].push(i, j);
      if (yEsc !== null && Math.abs((r[i * 3 + 1] + r[j * 3 + 1]) / 2 - yEsc) < 14) brillantes.push(i, j);
    }
    const trazar = (lista) => {
      ctx.beginPath();
      for (let n = 0; n < lista.length; n += 2) {
        const i = lista[n];
        const j = lista[n + 1];
        ctx.moveTo(this.px(r[i * 3], r[i * 3 + 2]) + ox, this.py(r[i * 3 + 1], r[i * 3 + 2]) + oy);
        ctx.lineTo(this.px(r[j * 3], r[j * 3 + 2]) + ox, this.py(r[j * 3 + 1], r[j * 3 + 2]) + oy);
      }
    };
    const alfas = [0.16, 0.42, 0.85];
    for (let c = 0; c < 3; c++) {
      trazar(capas[c]);
      ctx.strokeStyle = rgba(color, alfas[c] * 0.25 * alfa);
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = rgba(color, alfas[c] * alfa);
      ctx.lineWidth = c === 2 ? 1.4 : 1;
      ctx.stroke();
    }
    if (brillantes.length) {
      trazar(brillantes);
      ctx.strokeStyle = rgba(COLORES.blanco, 0.95 * alfa);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Vértices como pequeños cuadrados (rígidos)
    ctx.fillStyle = rgba(COLORES.blanco, 0.9 * alfa);
    for (let i = 0; i < this.v.length; i++) {
      const z = r[i * 3 + 2];
      if (z > -10) continue;
      const x = this.px(r[i * 3], z) + ox;
      const y = this.py(r[i * 3 + 1], z) + oy;
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
  }

  dibujarAnillos(ctx, t, alfa) {
    const n = this.anillos.length;
    this.anillos.forEach((an, k) => {
      const edad = t - an.nace;
      const crece = Math.min(1, Math.max(0, edad / 0.7));
      const radio = (112 + k * 8) * (1 - Math.pow(1 - crece, 3));
      if (radio < 1) return;
      const destelloNace = Math.max(0, 1 - edad / 1.2);
      const cx = Math.cos(an.inclX);
      const sx = Math.sin(an.inclX);
      const cz = Math.cos(an.inclZ);
      const sz = Math.sin(an.inclZ);
      const pts = [];
      const tmp = new Float32Array(3);
      for (let s = 0; s <= 48; s++) {
        const a = (s / 48) * Math.PI * 2;
        let x = Math.cos(a) * radio;
        let y = 0;
        let z = Math.sin(a) * radio;
        const y1 = y * cx - z * sx;
        const z1 = y * sx + z * cx;
        const x2 = x * cz - y1 * sz;
        const y2 = x * sz + y1 * cz;
        rotar(x2, y2, z1, this.yaw * 0.25, this.pitch, tmp, 0);
        pts.push(this.px(tmp[0], tmp[2]), this.py(tmp[1], tmp[2]));
      }
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let s = 2; s < pts.length; s += 2) ctx.lineTo(pts[s], pts[s + 1]);
      ctx.strokeStyle = rgba(this.color, (0.28 + destelloNace * 0.6) * alfa);
      ctx.lineWidth = 1 + destelloNace * 2;
      ctx.stroke();
      // Cuenta del anillo: avanza a saltos, como todo en esta IA
      const paso = Math.floor(t / 1.05 + k) % 48;
      const bx = pts[paso * 2];
      const by = pts[paso * 2 + 1];
      ctx.fillStyle = rgba(COLORES.blanco, alfa);
      ctx.fillRect(bx - 2.5, by - 2.5, 5, 5);
      ctx.globalAlpha = 0.7 * alfa;
      ctx.drawImage(destello(COLORES.mono, 16), bx - 9, by - 9, 18, 18);
      ctx.globalAlpha = 1;
    });
    return n;
  }

  dibujarGrietas(ctx, dt) {
    if (Math.random() < dt * 9 && this.grietas.length < 16) {
      const a = azar(0, Math.PI * 2);
      const pts = [[CX + azar(-8, 8), CY + azar(-8, 8)]];
      let ang = a;
      for (let s = 0; s < 7; s++) {
        ang += azar(-0.6, 0.6);
        const [x, y] = pts[pts.length - 1];
        pts.push([x + Math.cos(ang) * azar(10, 22), y + Math.sin(ang) * azar(10, 22)]);
      }
      this.grietas.push({ pts, t: 0 });
    }
    for (const g of this.grietas) {
      g.t += dt;
      const visibles = Math.min(g.pts.length, 1 + Math.floor(g.t * 18));
      ctx.beginPath();
      ctx.moveTo(g.pts[0][0], g.pts[0][1]);
      for (let s = 1; s < visibles; s++) ctx.lineTo(g.pts[s][0], g.pts[s][1]);
      ctx.strokeStyle = 'rgba(255,90,120,0.35)';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,235,240,0.95)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
  }

  dibujarEsquirlas(ctx, dt) {
    // Núcleo moribundo que parpadea
    const parpadeo = Math.random() < 0.15 ? azar(0.2, 1) : 0.35;
    ctx.globalAlpha = parpadeo;
    ctx.drawImage(destello(COLORES.rojo, 64), CX - 26, CY - 26, 52, 52);
    ctx.globalAlpha = 1;
    for (const e of this.esquirlas) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      const freno = Math.exp(-dt * 1.7);
      e.vx *= freno;
      e.vy *= freno;
      if (Math.hypot(e.vx, e.vy) < 5) {
        e.vx += azar(-3, 3) * dt;
        e.vy += azar(-3, 3) * dt;
      }
      e.ang += e.va * dt;
      e.va *= Math.exp(-dt * 1.1);
      e.vida = Math.max(0.32, e.vida - dt * 0.35);
      const c = Math.cos(e.ang);
      const s = Math.sin(e.ang);
      const hx = e.hx * c - e.hy * s;
      const hy = e.hx * s + e.hy * c;
      const col = e.vida > 0.6 ? (e.tono < 0.5 ? [255, 90, 120] : [140, 230, 255]) : [255, 80, 110];
      ctx.strokeStyle = rgba(col, e.vida);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(e.x - hx, e.y - hy);
      ctx.lineTo(e.x + hx, e.y + hy);
      ctx.stroke();
    }
  }

  dibujarEscarcha(ctx, t, dt) {
    if (this.escarcha.length < 46 && Math.random() < dt * 14) {
      const a = azar(0, Math.PI * 2);
      const d = azar(30, 140);
      this.escarcha.push({ x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d, r: azar(2, 5), f: azar(0, 6), nace: t });
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const e of this.escarcha) {
      const a = Math.min(1, (t - e.nace) * 1.5) * (0.5 + 0.5 * Math.sin(t * 2 + e.f));
      ctx.strokeStyle = rgba(COLORES.hielo, 0.8 * a);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(e.x - e.r, e.y);
      ctx.lineTo(e.x + e.r, e.y);
      ctx.moveTo(e.x, e.y - e.r);
      ctx.lineTo(e.x, e.y + e.r);
      ctx.stroke();
    }
    // Anillo de «cargando…» que ya casi no avanza
    ctx.setLineDash([6, 10]);
    ctx.lineDashOffset = -t * 4;
    ctx.strokeStyle = rgba(COLORES.hielo, 0.45);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CX, CY, 140, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  dibujarDuda(ctx, t) {
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 2.5);
    ctx.font = "800 70px 'Exo 2', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(200,215,255,0.9)';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#e8eeff';
    ctx.fillText('?', CX, CY + 2);
    ctx.restore();
  }
}

// ═════════════════════════════ IA NO-MONÓTONA ═════════════════════════════

function fibonacci(n) {
  const r = [];
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = g * i;
    r.push([Math.cos(th) * rad, y, Math.sin(th) * rad]);
  }
  return r;
}

const COLOR_SATELITE = {
  segura: COLORES.nmClaro,
  supuesto: COLORES.oro,
  aceptada: COLORES.verde,
  indecisa: COLORES.ambar,
};

export class CerebroNoMonotono {
  constructor(canvas) {
    this.l = new Lienzo(canvas, 320, 320);
    this.n = 190;
    this.base = fibonacci(this.n);
    this.pares = [];
    const umbral = Math.cos(0.34);
    for (let i = 0; i < this.n; i++) {
      for (let j = i + 1; j < this.n; j++) {
        const [a, b, c] = this.base[i];
        const [d, e, f] = this.base[j];
        if (a * d + b * e + c * f > umbral) this.pares.push(i, j);
      }
    }
    this.p = new Float32Array(this.n * 3);
    this.brillo = new Float32Array(this.n);
    this.yaw = 0;
    this.modo = 'espera';
    this.tModo = 0;
    this.t = 0;
    this.extra = 0;
    this.ondas = [];
    this.satelites = [];
    this.chispas = [];
    this.color1 = [...COLORES.nm];
    this.color2 = [...COLORES.violeta];
    this.destelloRev = 0;
  }

  setModo(modo) {
    if (modo === this.modo) return;
    this.modo = modo;
    this.tModo = 0;
    if (modo === 'revisando') this.reorganizar();
  }

  procesar() {
    this.onda();
  }

  onda() {
    const a = azar(0, Math.PI * 2);
    const b = azar(-1, 1);
    const r = Math.sqrt(1 - b * b);
    this.ondas.push({ eje: [Math.cos(a) * r, b, Math.sin(a) * r], t0: this.t });
  }

  reorganizar() {
    this.extra = 0.42;
    this.destelloRev = 1;
    this.onda();
    this.onda();
  }

  setConclusiones(lista, animar = true) {
    const claves = new Set(lista.map((c) => c.lit));
    for (const s of this.satelites) {
      if (!claves.has(s.lit) && s.cae === null) {
        if (animar) s.cae = this.t;
        else s.muerto = true;
      }
    }
    this.satelites = this.satelites.filter((s) => !s.muerto);
    for (const c of lista) {
      const s = this.satelites.find((x) => x.lit === c.lit && x.cae === null);
      if (s) {
        s.tipo = c.tipo;
        continue;
      }
      const h = hash(c.lit);
      this.satelites.push({
        lit: c.lit, tipo: c.tipo, nace: animar ? this.t : -10, cae: null,
        radio: 122 + h * 26, fase: h * Math.PI * 2, vel: (0.45 + h * 0.5) * (h > 0.5 ? 1 : -1),
        inclX: 0.35 + h * 1.1, inclZ: h * 5, col: [...(COLOR_SATELITE[c.tipo] ?? COLORES.nmClaro)],
      });
    }
    if (animar && this.satelites.some((s) => s.cae !== null && this.t - s.cae < 0.05)) this.reorganizar();
  }

  reiniciar() {
    this.satelites = [];
    this.chispas = [];
    this.ondas = [];
    this.modo = 'espera';
  }

  dibujar(t, dt) {
    this.t = t;
    this.tModo += dt;
    const { ctx } = this.l;
    this.l.limpiar();
    const modo = this.modo;
    const espera = modo === 'espera';
    const vel = espera ? 0.12 : modo === 'procesando' ? 0.6 : 0.26 + 0.08 * Math.sin(t * 0.3);
    this.yaw += dt * vel;
    const pitch = 0.32 + 0.16 * Math.sin(t * 0.21);
    this.extra *= Math.exp(-dt * 1.6);
    this.destelloRev *= Math.exp(-dt * 2.2);
    if (modo === 'procesando' && Math.random() < dt * 2.5) this.onda();

    // Paleta: magenta/violeta; ámbar si está indecisa
    let c1 = COLORES.nm;
    let c2 = COLORES.violeta;
    if (modo === 'indeciso') {
      const o = 0.5 + 0.5 * Math.sin(t * 5);
      c1 = mezclar(COLORES.ambar, COLORES.nm, o * 0.6);
      c2 = mezclar(COLORES.ambar, COLORES.violeta, 0.5);
    } else if (modo === 'contradiccion') {
      c1 = COLORES.rojo;
      c2 = [200, 60, 120];
    }
    const kc = 1 - Math.exp(-dt * 3);
    this.color1 = mezclar(this.color1, c1, kc);
    this.color2 = mezclar(this.color2, c2, kc);
    const alfa = espera ? 0.42 : 1;

    // Posiciones: esfera que respira deformada por ruido
    const R = 92;
    const resp = 1 + 0.04 * Math.sin(t * 1.35) + (modo === 'procesando' ? 0.025 * Math.sin(t * 7) : 0);
    const amp = 0.12 + this.extra;
    this.ondas = this.ondas.filter((o) => t - o.t0 < 1.7);
    const yEsc = modo === 'introspeccion' ? Math.sin(t * 2.4) * R : null;
    for (let i = 0; i < this.n; i++) {
      const [bx, by, bz] = this.base[i];
      const nz = ruido(bx * 1.7 + t * 0.22, by * 1.7 + t * 0.17, bz * 1.7 - t * 0.2);
      const r = R * resp * (1 + amp * nz * 1.6);
      rotar(bx * r, by * r, bz * r, this.yaw, pitch, this.p, i * 3);
      let b = 0;
      for (const o of this.ondas) {
        const d = Math.acos(Math.max(-1, Math.min(1, bx * o.eje[0] + by * o.eje[1] + bz * o.eje[2])));
        const frente = (t - o.t0) * 2.3;
        b += Math.exp(-((d - frente) ** 2) / 0.05) * (1 - (t - o.t0) / 1.7);
      }
      if (yEsc !== null && Math.abs(this.p[i * 3 + 1] - yEsc) < 9) b += 1;
      this.brillo[i] = Math.min(1.5, b + this.destelloRev * 0.6);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Núcleo: nebulosa que late
    const lat = 0.6 + 0.25 * Math.sin(t * 1.35) + this.destelloRev * 0.5;
    ctx.globalAlpha = lat * alfa;
    const rn = 62 + 10 * Math.sin(t * 1.35);
    if (modo === 'indeciso') {
      const d = 13 * Math.sin(t * 6);
      ctx.drawImage(destello(COLORES.ambar, 64), CX - rn + d, CY - rn, rn * 2, rn * 2);
      ctx.drawImage(destello(COLORES.nm, 64), CX - rn - d, CY - rn, rn * 2, rn * 2);
    } else {
      ctx.drawImage(destello(this.color1.map(Math.round), 64), CX - rn, CY - rn, rn * 2, rn * 2);
    }
    ctx.globalAlpha = 1;

    // Filamentos agrupados por profundidad y color
    const p = this.p;
    const grupos = Array.from({ length: 6 }, () => []);
    const brillantes = [];
    for (let k = 0; k < this.pares.length; k += 2) {
      const i = this.pares[k];
      const j = this.pares[k + 1];
      const z = (p[i * 3 + 2] + p[j * 3 + 2]) / 2;
      const capa = z > 20 ? 0 : z > -20 ? 1 : 2;
      const color = this.base[i][1] + this.base[j][1] > 0 ? 0 : 1;
      grupos[capa * 2 + color].push(i, j);
      if (this.brillo[i] + this.brillo[j] > 0.9) brillantes.push(i, j);
    }
    const sx = (i) => CX + p[i * 3] * (FOCAL / (FOCAL + p[i * 3 + 2]));
    const sy = (i) => CY + p[i * 3 + 1] * (FOCAL / (FOCAL + p[i * 3 + 2]));
    const alfas = [0.13, 0.32, 0.62];
    for (let g = 0; g < 6; g++) {
      const lista = grupos[g];
      if (!lista.length) continue;
      ctx.beginPath();
      for (let k = 0; k < lista.length; k += 2) {
        ctx.moveTo(sx(lista[k]), sy(lista[k]));
        ctx.lineTo(sx(lista[k + 1]), sy(lista[k + 1]));
      }
      ctx.strokeStyle = rgba(g % 2 ? this.color2 : this.color1, alfas[g >> 1] * alfa);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (brillantes.length) {
      ctx.beginPath();
      for (let k = 0; k < brillantes.length; k += 2) {
        ctx.moveTo(sx(brillantes[k]), sy(brillantes[k]));
        ctx.lineTo(sx(brillantes[k + 1]), sy(brillantes[k + 1]));
      }
      ctx.strokeStyle = rgba(modo === 'introspeccion' ? COLORES.oro : COLORES.nmClaro, 0.75 * alfa);
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // Nodos como puntos de luz
    const d1 = destello(this.color1.map(Math.round), 16);
    const dB = destello(modo === 'introspeccion' ? COLORES.oro : COLORES.nmClaro, 16);
    for (let i = 0; i < this.n; i++) {
      const z = p[i * 3 + 2];
      const esc = FOCAL / (FOCAL + z);
      const prof = (1 - (z + R) / (2 * R)) * 0.8 + 0.2;
      const b = this.brillo[i];
      const tam = (3 + prof * 5 + b * 7) * esc;
      ctx.globalAlpha = Math.min(1, (prof * 0.75 + b * 0.6) * alfa);
      ctx.drawImage(b > 0.4 ? dB : d1, sx(i) - tam, sy(i) - tam, tam * 2, tam * 2);
    }
    ctx.globalAlpha = 1;

    if (yEsc !== null) {
      const rx = Math.sqrt(Math.max(0, R * R - yEsc * yEsc)) * 1.05;
      ctx.strokeStyle = rgba(COLORES.oro, 0.55);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(CX, CY + yEsc * Math.cos(pitch), rx, rx * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    this.dibujarSatelites(ctx, t, dt, pitch, alfa);
    this.dibujarChispas(ctx, dt);
    ctx.restore();
  }

  dibujarSatelites(ctx, t, dt, pitch, alfa) {
    const tmp = new Float32Array(3);
    const posicion = (s, fase, radio) => {
      const x = Math.cos(fase) * radio;
      const z = Math.sin(fase) * radio;
      const cx = Math.cos(s.inclX);
      const sx = Math.sin(s.inclX);
      const y1 = -z * sx;
      const z1 = z * cx;
      const cz = Math.cos(s.inclZ);
      const sz = Math.sin(s.inclZ);
      rotar(x * cz - y1 * sz, x * sz + y1 * cz, z1, 0, pitch, tmp, 0);
      const e = FOCAL / (FOCAL + tmp[2]);
      return [CX + tmp[0] * e, CY + tmp[1] * e, e];
    };
    for (const s of this.satelites) {
      const edad = t - s.nace;
      const crece = Math.min(1, Math.max(0, edad / 0.8));
      let radio = s.radio * (1 - Math.pow(1 - crece, 3));
      let a = alfa;
      let col = COLOR_SATELITE[s.tipo] ?? COLORES.nmClaro;
      if (s.cae !== null) {
        const k = (t - s.cae) / 1.8;
        if (k >= 1) {
          s.muerto = true;
          continue;
        }
        radio += k * k * 90;
        a *= 1 - k;
        col = mezclar(COLORES.oro, COLORES.gris, Math.min(1, k * 2));
        if (Math.random() < 0.6) {
          const [x, y] = posicion(s, s.fase + s.vel * t, radio);
          this.chispas.push({ x, y, vx: azar(-40, 40), vy: azar(-40, 40), vida: 1, col });
        }
      }
      s.col = mezclar(s.col, col, 1 - Math.exp(-dt * 4));
      const fase = s.fase + s.vel * t;
      // Estela
      let previo = null;
      for (let k = 0; k < 14; k++) {
        const [x, y] = posicion(s, fase - k * 0.07 * Math.sign(s.vel), radio);
        if (previo) {
          ctx.strokeStyle = rgba(s.col, (1 - k / 14) * 0.55 * a);
          ctx.lineWidth = 2.2 * (1 - k / 14);
          ctx.beginPath();
          ctx.moveTo(previo[0], previo[1]);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        previo = [x, y];
      }
      const [x, y, e] = posicion(s, fase, radio);
      const brilloNace = Math.max(0, 1 - edad / 1.1);
      const tam = (9 + brilloNace * 14) * e;
      ctx.globalAlpha = a;
      ctx.drawImage(destello(s.col.map(Math.round), 32), x - tam * 1.6, y - tam * 1.6, tam * 3.2, tam * 3.2);
      ctx.globalAlpha = 1;
      if (s.tipo === 'supuesto' && s.cae === null) {
        // Los supuestos llevan un halo discontinuo: son provisionales
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = rgba(COLORES.oro, 0.8 * a);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y, 9 * e, t * 2, t * 2 + Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    this.satelites = this.satelites.filter((s) => !s.muerto);
  }

  dibujarChispas(ctx, dt) {
    for (const c of this.chispas) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vida -= dt * 1.4;
      ctx.fillStyle = rgba(c.col, Math.max(0, c.vida));
      ctx.fillRect(c.x - 1, c.y - 1, 2, 2);
    }
    this.chispas = this.chispas.filter((c) => c.vida > 0);
  }
}
