// Capa de efectos sobre todo el escenario: orbes de información, estallidos, rayos y ondas.

import { Lienzo, destello, rgba, COLORES, azar, salida } from './util.js';

export class FX {
  constructor(canvas) {
    this.l = new Lienzo(canvas, 1920, 1080);
    this.particulas = [];
    this.orbes = [];
    this.ondas = [];
    this.rayos = [];
    this.t = 0;
  }

  // Un orbe de luz que viaja por una curva hasta su destino. La promesa se cumple al llegar.
  orbe(desde, hasta, color, duracion = 0.85) {
    return new Promise((resolver) => {
      const cx = (desde.x + hasta.x) / 2 + (hasta.x > desde.x ? 1 : -1) * 40;
      const cy = Math.min(desde.y, hasta.y) - 90;
      this.orbes.push({ desde, hasta, c: { x: cx, y: cy }, color, t0: this.t, duracion, resolver, estela: [] });
    });
  }

  estallido(x, y, color, n = 60, fuerza = 260) {
    for (let i = 0; i < n; i++) {
      const a = azar(0, Math.PI * 2);
      const v = azar(0.2, 1) * fuerza;
      this.particulas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 1, decae: azar(0.5, 1.1), tam: azar(1.5, 4), color, g: 0 });
    }
  }

  // Una conclusión que se retira se deshace en polvo que sube.
  disolver(r, color, n = 46) {
    for (let i = 0; i < n; i++) {
      this.particulas.push({
        x: r.x + azar(0, r.w), y: r.y + azar(0, r.h), vx: azar(-30, 30), vy: azar(-70, -15),
        vida: 1, decae: azar(0.6, 1.2), tam: azar(1, 3), color, g: -10,
      });
    }
  }

  onda(x, y, color, radio = 180, duracion = 0.9) {
    this.ondas.push({ x, y, color, radio, duracion, t0: this.t });
  }

  rayo(a, b, color, duracion = 1.2) {
    this.rayos.push({ a, b, color, duracion, t0: this.t });
  }

  dibujar(t, dt) {
    this.t = t;
    const { ctx } = this.l;
    this.l.limpiar();
    if (!this.particulas.length && !this.orbes.length && !this.ondas.length && !this.rayos.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const o of this.ondas) {
      const k = (t - o.t0) / o.duracion;
      if (k >= 1) continue;
      ctx.strokeStyle = rgba(o.color, (1 - k) * 0.8);
      ctx.lineWidth = 3 * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.arc(o.x, o.y, salida(k) * o.radio, 0, Math.PI * 2);
      ctx.stroke();
    }
    this.ondas = this.ondas.filter((o) => t - o.t0 < o.duracion);

    for (const r of this.rayos) {
      const k = (t - r.t0) / r.duracion;
      if (k >= 1) continue;
      const pasos = 14;
      ctx.beginPath();
      ctx.moveTo(r.a.x, r.a.y);
      for (let i = 1; i < pasos; i++) {
        const u = i / pasos;
        ctx.lineTo(r.a.x + (r.b.x - r.a.x) * u + azar(-12, 12), r.a.y + (r.b.y - r.a.y) * u + azar(-12, 12));
      }
      ctx.lineTo(r.b.x, r.b.y);
      const parpadeo = Math.random() < 0.3 ? 0.3 : 1;
      ctx.strokeStyle = rgba(r.color, 0.35 * (1 - k) * parpadeo);
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = rgba(COLORES.blanco, 0.95 * (1 - k) * parpadeo);
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    this.rayos = this.rayos.filter((r) => t - r.t0 < r.duracion);

    for (const o of this.orbes) {
      const k = Math.min(1, (t - o.t0) / o.duracion);
      const u = salida(k);
      const x = (1 - u) * (1 - u) * o.desde.x + 2 * (1 - u) * u * o.c.x + u * u * o.hasta.x;
      const y = (1 - u) * (1 - u) * o.desde.y + 2 * (1 - u) * u * o.c.y + u * u * o.hasta.y;
      o.estela.unshift({ x, y });
      if (o.estela.length > 18) o.estela.pop();
      o.estela.forEach((p, i) => {
        const tam = 18 * (1 - i / 18);
        ctx.globalAlpha = (1 - i / 18) * 0.6;
        ctx.drawImage(destello(o.color, 32), p.x - tam, p.y - tam, tam * 2, tam * 2);
      });
      ctx.globalAlpha = 1;
      ctx.drawImage(destello(o.color, 32), x - 24, y - 24, 48, 48);
      if (k >= 1 && !o.listo) {
        o.listo = true;
        this.onda(o.hasta.x, o.hasta.y, o.color, 70, 0.6);
        this.estallido(o.hasta.x, o.hasta.y, o.color, 18, 120);
        o.resolver();
      }
    }
    this.orbes = this.orbes.filter((o) => !o.listo);

    for (const p of this.particulas) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const freno = Math.exp(-dt * 2.2);
      p.vx *= freno;
      p.vy = p.vy * freno + p.g * dt;
      p.vida -= dt * p.decae;
      if (p.vida <= 0) continue;
      ctx.globalAlpha = p.vida;
      const tam = p.tam * 3;
      ctx.drawImage(destello(p.color, 16), p.x - tam, p.y - tam, tam * 2, tam * 2);
    }
    ctx.globalAlpha = 1;
    this.particulas = this.particulas.filter((p) => p.vida > 0);
    ctx.restore();
  }
}
