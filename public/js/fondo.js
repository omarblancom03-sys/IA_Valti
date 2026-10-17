// Fondo vivo. Hasta las partículas reflejan la personalidad de cada IA:
// a la izquierda viajan en línea recta por la cuadrícula; a la derecha fluyen como un líquido.

import { Lienzo, ruido, destello, rgba, COLORES, azar } from './util.js';

export class Fondo {
  constructor(canvas) {
    this.l = new Lienzo(canvas, 1920, 1080);
    this.estrellas = Array.from({ length: 150 }, () => ({
      x: azar(0, 1920), y: azar(0, 1080), r: Math.random() < 0.85 ? 1 : 1.7, f: azar(0, 6.28), v: azar(0.3, 1.3),
    }));
    this.rigidas = Array.from({ length: 34 }, () => this.rigida(true));
    this.fluidas = Array.from({ length: 64 }, () => this.fluida(true));
  }

  rigida(inicio = false) {
    const horizontal = Math.random() < 0.5;
    const sentido = Math.random() < 0.5 ? 1 : -1;
    return {
      x: 24 + 32 * Math.floor(azar(1, 28)),
      y: 64 + 32 * Math.floor(azar(1, 26)),
      dx: horizontal ? sentido : 0,
      dy: horizontal ? 0 : sentido,
      v: azar(25, 75),
      vida: azar(2, 6),
      edad: inicio ? azar(0, 2) : 0,
      largo: azar(18, 64),
    };
  }

  fluida(inicio = false) {
    return {
      x: azar(984, 1896),
      y: azar(64, 896),
      vida: azar(4, 9),
      edad: inicio ? azar(0, 4) : 0,
      tam: azar(5, 13),
      col: Math.random() < 0.6 ? COLORES.nm : COLORES.violeta,
    };
  }

  dibujar(t, dt) {
    const { ctx } = this.l;
    this.l.limpiar();
    for (const e of this.estrellas) {
      ctx.fillStyle = `rgba(210,220,255,${0.16 + 0.2 * Math.sin(t * e.v + e.f)})`;
      ctx.fillRect(e.x, e.y, e.r, e.r);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Paquetes de datos rígidos sobre la cuadrícula de la IA monótona
    ctx.lineWidth = 1.5;
    for (let i = 0; i < this.rigidas.length; i++) {
      const p = this.rigidas[i];
      p.edad += dt;
      p.x += p.dx * p.v * dt;
      p.y += p.dy * p.v * dt;
      if (p.edad > p.vida || p.x < 30 || p.x > 930 || p.y < 70 || p.y > 890) {
        this.rigidas[i] = this.rigida();
        continue;
      }
      const a = Math.min(1, p.edad * 2, (p.vida - p.edad) * 2) * 0.5;
      ctx.strokeStyle = rgba(COLORES.mono, a * 0.4);
      ctx.beginPath();
      ctx.moveTo(p.x - p.dx * p.largo, p.y - p.dy * p.largo);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.fillStyle = rgba(COLORES.monoClaro, a);
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }

    // Partículas orgánicas que siguen un campo de flujo
    for (let i = 0; i < this.fluidas.length; i++) {
      const p = this.fluidas[i];
      p.edad += dt;
      const ang = ruido(p.x * 0.0024, p.y * 0.0024, t * 0.07) * Math.PI * 3;
      p.x += Math.cos(ang) * 26 * dt;
      p.y += Math.sin(ang) * 26 * dt;
      if (p.edad > p.vida || p.x < 990 || p.x > 1890 || p.y < 70 || p.y > 890) {
        this.fluidas[i] = this.fluida();
        continue;
      }
      ctx.globalAlpha = Math.min(1, p.edad, (p.vida - p.edad) * 0.8) * 0.4;
      ctx.drawImage(destello(p.col, 16), p.x - p.tam, p.y - p.tam, p.tam * 2, p.tam * 2);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
