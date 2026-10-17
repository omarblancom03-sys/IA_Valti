// Paneles propios de cada escena. Cada uno sabe «fijar» un estado al instante
// y «animar» el paso de un estado al siguiente.

import { html, esc, esperar, ICONOS } from './util.js';
import { Sonido } from './audio.js';

class Widget {
  constructor(contenedor, lado, opciones = {}) {
    this.lado = lado;
    this.esMono = lado === 'mono';
    this.op = opciones;
    this.el = html(this.plantilla());
    contenedor.replaceChildren(this.el);
  }
  plantilla() {
    return '<div class="widget"></div>';
  }
  fijar() {}
  async animar(previo, estado) {
    this.fijar(estado);
  }
  dibujar() {}
  destruir() {
    this.el.remove();
  }
  $(sel) {
    return this.el.querySelector(sel);
  }
}

// ───────────────────────── Portada ─────────────────────────

class WidgetVacio extends Widget {
  plantilla() {
    return `<div class="widget vacio"><div class="vacio__texto">esperando información<span class="vacio__cursor">▍</span></div></div>`;
  }
}

class WidgetPerfil extends Widget {
  plantilla() {
    const items = this.op.items ?? [];
    return `<div class="widget">
      <div class="widget__titulo">${this.esMono ? 'Perfil · razonamiento monótono' : 'Perfil · razonamiento no-monótono'}</div>
      <div class="perfil">${items
        .map(
          (i) => `<div class="perfil__item">
            <div class="perfil__icono">${ICONOS[i.icono] ?? ''}</div>
            <div class="perfil__titulo">${esc(i.titulo)}</div>
            <div class="perfil__texto">${esc(i.texto)}</div>
          </div>`,
        )
        .join('')}</div>
    </div>`;
  }
}

class WidgetResumen extends Widget {
  plantilla() {
    const puntos = this.op.puntos ?? [];
    return `<div class="widget">
      <div class="widget__titulo">${this.esMono ? 'En resumen · IA monótona' : 'En resumen · IA no-monótona'}</div>
      <div class="resumen">${puntos
        .map(([tipo, texto]) => `<div class="resumen__punto"><span class="resumen__icono ${tipo}">${tipo === 'si' ? '✓' : '✗'}</span>${esc(texto)}</div>`)
        .join('')}</div>
    </div>`;
  }
}

// ───────────────────────── Gráfica de monotonía ─────────────────────────

class WidgetGrafica extends Widget {
  constructor(contenedor, lado, opciones) {
    super(contenedor, lado, opciones);
    this.serie = opciones.serie;
    this.paquetes = opciones.paquetes;
    this.hasta = 0;
    this.svg = this.$('svg');
    this.construir();
  }
  plantilla() {
    return `<div class="widget grafica">
      <div class="widget__titulo">${this.esMono ? 'Conclusiones vs. información · solo puede subir' : 'Conclusiones vs. información · también puede bajar'}</div>
      <svg viewBox="0 0 868 284"></svg>
    </div>`;
  }
  x(i) {
    return 92 + i * 178;
  }
  y(v) {
    return 236 - v * 24;
  }
  construir() {
    const c = this.esMono ? 'var(--mono)' : 'var(--nm)';
    const id = `area-${this.lado}`;
    let rejilla = '';
    for (let v = 0; v <= 7; v++) rejilla += `<line x1="${this.x(0) - 12}" x2="${this.x(4) + 20}" y1="${this.y(v)}" y2="${this.y(v)}" class="g-rejilla"/>`;
    const etiquetas = this.paquetes
      .map((p, i) => `<text x="${this.x(i + 1)}" y="${this.y(0) + 24}" text-anchor="middle" class="g-etq ${p === 'Excepción' ? 'g-etq--exc' : ''}">${esc(p)}</text>`)
      .join('');
    this.svg.innerHTML = `
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${this.esMono ? '#5cd2ff' : '#ff4fd8'}" stop-opacity=".32"/>
        <stop offset="1" stop-color="${this.esMono ? '#5cd2ff' : '#ff4fd8'}" stop-opacity="0"/>
      </linearGradient></defs>
      ${rejilla}
      <line x1="${this.x(0) - 12}" x2="${this.x(4) + 30}" y1="${this.y(0)}" y2="${this.y(0)}" class="g-eje"/>
      <line x1="${this.x(0) - 12}" x2="${this.x(0) - 12}" y1="${this.y(0)}" y2="${this.y(7) - 8}" class="g-eje"/>
      <text x="${this.x(0) - 26}" y="${this.y(3.5)}" transform="rotate(-90 ${this.x(0) - 26} ${this.y(3.5)})" text-anchor="middle" class="g-eje-etq">conclusiones</text>
      <text x="${this.x(4) + 30}" y="${this.y(0) - 10}" text-anchor="end" class="g-eje-etq">información →</text>
      ${etiquetas}
      <path class="g-area" fill="url(#${id})" d=""/>
      <g class="g-lineas" style="stroke:${c}"></g>
      <g class="g-puntos" style="fill:${c}"></g>
      <g class="g-marcas"></g>
      <circle class="g-punto" cx="${this.x(0)}" cy="${this.y(this.serie[0])}" r="5" style="fill:${c}"/>`;
  }
  segmento(i, animar) {
    const v0 = this.serie[i - 1];
    const v1 = this.serie[i];
    const x0 = this.x(i - 1);
    const x1 = this.x(i);
    const d = `M${x0} ${this.y(v0)} H${x1} V${this.y(v1)}`;
    const largo = x1 - x0 + Math.abs(this.y(v1) - this.y(v0));
    const linea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    linea.setAttribute('d', d);
    linea.setAttribute('class', 'g-linea');
    this.$('.g-lineas').append(linea);
    const punto = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    punto.setAttribute('cx', x1);
    punto.setAttribute('cy', this.y(v1));
    punto.setAttribute('r', 5);
    punto.setAttribute('class', 'g-punto');
    this.$('.g-puntos').append(punto);
    if (v1 < v0) {
      const m = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      m.setAttribute('class', 'g-caida');
      m.innerHTML = `<path d="M${x1 + 16} ${this.y(v0)} V${this.y(v1) - 6}" /><path d="M${x1 + 10} ${this.y(v1) - 12} L${x1 + 16} ${this.y(v1) - 4} L${x1 + 22} ${this.y(v1) - 12}"/><text x="${x1 + 30}" y="${(this.y(v0) + this.y(v1)) / 2 + 5}">−${v0 - v1} retiradas</text>`;
      this.$('.g-marcas').append(m);
      if (animar) m.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 600, fill: 'both' });
    }
    if (animar) {
      linea.style.strokeDasharray = largo;
      linea.animate([{ strokeDashoffset: largo }, { strokeDashoffset: 0 }], { duration: 750, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
      punto.animate([{ r: 0, opacity: 0 }, { r: 9, opacity: 1, offset: 0.7 }, { r: 5, opacity: 1 }], { duration: 600, delay: 650, fill: 'both' });
    }
    this.hasta = i;
    this.area();
  }
  area() {
    let d = `M${this.x(0)} ${this.y(0)} V${this.y(this.serie[0])}`;
    for (let i = 1; i <= this.hasta; i++) d += ` H${this.x(i)} V${this.y(this.serie[i])}`;
    d += ` V${this.y(0)} Z`;
    this.$('.g-area').setAttribute('d', d);
  }
  fijarHasta(n, formula) {
    this.$('.g-lineas').replaceChildren();
    this.$('.g-puntos').replaceChildren();
    this.$('.g-marcas').replaceChildren();
    this.hasta = 0;
    for (let i = 1; i <= n; i++) this.segmento(i, false);
    this.area();
    this.formula(formula, false);
  }
  formula(mostrar) {
    this.$('.grafica__formula')?.remove();
    if (!mostrar) return;
    this.el.append(
      html(
        this.esMono
          ? '<div class="grafica__formula">Si Γ ⊢ φ, entonces Γ ∪ {ψ} ⊢ φ<small>Agregar premisas nunca invalida una deducción.</small></div>'
          : '<div class="grafica__formula">Γ |∼ φ, pero Γ ∪ {ψ} |≁ φ<small>Una premisa nueva puede invalidar una conclusión.</small></div>',
      ),
    );
  }
  async animar() {}
}

// ───────────────────────── Lógica por defecto ─────────────────────────

const ETQ_REGLA = { inactiva: 'EN ESPERA', disparada: 'APLICADA ✓', conflicto: '⚡ CHOQUE' };

// Condición que la IA monótona necesita demostrar: ✓ demostrada, ✗ refutada, ? pendiente
function filaCondicion(c, retraso = 0) {
  const estado = c.demostrada ? 'ok' : c.refutada ? 'falla' : 'pendiente';
  const icono = { ok: '✓', falla: '✗', pendiente: '?' }[estado];
  return `<div class="condicion condicion--${estado}" style="animation-delay:${retraso}s">
    <div class="condicion__icono">${icono}</div><code>${esc(c.formal)}</code><span>${esc(c.texto)}</span></div>`;
}

class WidgetDefecto extends Widget {
  plantilla() {
    if (this.esMono) {
      return `<div class="widget"><div class="widget__titulo">Reglas estrictas · no admiten excepciones</div><div class="reglas"></div></div>`;
    }
    return `<div class="widget">
      <div class="widget__titulo">Regla por defecto · razonamiento derrotable</div>
      <div class="defecto">
        <div class="defecto__cabeza"><div class="defecto__nombre"></div><div class="defecto__estricta"></div></div>
        <div class="defecto__formula">
          <div class="caja" data-k="pre"><code></code><small>prerrequisito</small><span class="caja__sello"></span></div>
          <div class="defecto__op">:</div>
          <div class="caja" data-k="just"><code></code><small>justificación · ¿es consistente?</small><span class="caja__sello"></span></div>
          <div class="defecto__op">⁄</div>
          <div class="caja" data-k="cons"><code></code><small>conclusión</small><span class="caja__sello"></span></div>
        </div>
        <div class="defecto__instancias"></div>
      </div>
    </div>`;
  }

  fijar(estado) {
    if (this.esMono) this.fijarReglas(estado);
    else this.fijarDefecto(estado, true);
  }

  async animar(previo, estado, token) {
    if (this.esMono) return this.animarReglas(estado, token);
    return this.animarDefecto(previo, estado, token);
  }

  fijarReglas(estado) {
    this.$('.reglas').innerHTML = estado.reglas
      .map(
        (r) => `<div class="regla" data-id="${esc(r.id)}" data-estado="${r.estado}">
          <div class="regla__candado">${ICONOS.candado}</div>
          <div class="regla__cuerpo"><div class="regla__formal">${esc(r.formal)}</div><div class="regla__texto">${esc(r.id)} · ${esc(r.texto)}</div></div>
          <div class="regla__estado">${ETQ_REGLA[r.estado]}</div>
        </div>`,
      )
      .join('');
  }

  async animarReglas(estado, token) {
    const cont = this.$('.reglas');
    if (!cont.children.length) this.fijarReglas({ reglas: estado.reglas.map((r) => ({ ...r, estado: 'inactiva' })) });
    for (const r of estado.reglas) {
      const el = cont.querySelector(`[data-id="${CSS.escape(r.id)}"]`);
      if (!el || el.dataset.estado === r.estado) continue;
      el.dataset.estado = r.estado;
      el.querySelector('.regla__estado').textContent = ETQ_REGLA[r.estado];
      el.classList.remove('destello');
      void el.offsetWidth;
      el.classList.add('destello');
      await esperar(520, token);
    }
  }

  cajas() {
    return ['pre', 'just', 'cons'].map((k) => this.$(`.caja[data-k="${k}"]`));
  }

  partes(estado) {
    const inst = estado.instancias ?? [];
    if (inst.length === 1) return [inst[0].prerrequisito, inst[0].justificacion, inst[0].consecuencia];
    const [pre, resto = ''] = estado.defecto.formal.split(' : ');
    const [just, cons] = resto.split(' ⁄ ');
    return [pre, just, cons];
  }

  fijarDefecto(estado, conResultado) {
    this.$('.defecto__nombre').innerHTML = `<b>${esc(estado.defecto.id)}</b>${esc(estado.defecto.texto)}`;
    const estricta = estado.reglas?.[0];
    this.$('.defecto__estricta').textContent = estricta ? `estricta · ${estricta.formal}` : '';
    const cajas = this.cajas();
    this.partes(estado).forEach((p, i) => {
      cajas[i].querySelector('code').textContent = p;
      cajas[i].className = 'caja';
      cajas[i].querySelector('.caja__sello').textContent = '';
    });
    const inst = estado.instancias ?? [];
    if (conResultado && inst.length) {
      const bloqueada = inst.some((i) => i.estado === 'bloqueada');
      const aplicada = inst.some((i) => i.estado === 'aplicada');
      this.marcar(cajas[0], 'encendida ok', '✓');
      this.marcar(cajas[1], bloqueada && !aplicada ? 'encendida falla' : 'encendida ok', bloqueada && !aplicada ? '✗' : '✓');
      if (aplicada) this.marcar(cajas[2], 'encendida supuesta', '★');
      else cajas[2].classList.add('apagada');
    }
    this.renderInstancias(conResultado ? inst : []);
  }

  marcar(caja, clases, sello) {
    caja.className = `caja ${clases}`;
    caja.querySelector('.caja__sello').textContent = sello;
  }

  renderInstancias(inst) {
    const cont = this.$('.defecto__instancias');
    if (!inst.length) {
      cont.innerHTML = '<div class="defecto__vacio">Esperando un ave a la cual aplicar la regla…</div>';
      return;
    }
    const ETQ = { aplicada: 'APLICADA', bloqueada: 'BLOQUEADA', conflicto: 'EN CONFLICTO' };
    cont.innerHTML = inst
      .slice(0, 3)
      .map((i) => {
        const detalle =
          i.estado === 'aplicada'
            ? `supongo que ${i.consecuenciaTexto}`
            : i.estado === 'bloqueada'
              ? `ya se sabe que ${i.razon ?? 'no aplica'}`
              : 'choca con otra regla por defecto';
        return `<div class="instancia" data-estado="${i.estado}"><b>${ETQ[i.estado]}</b>x = ${esc(i.nombre)} → ${esc(detalle)}</div>`;
      })
      .join('');
  }

  async animarDefecto(previo, estado, token) {
    const clave = (e) => JSON.stringify((e?.instancias ?? []).map((i) => i.entidad + i.estado));
    if (clave(previo) === clave(estado) || !(estado.instancias ?? []).length) {
      this.fijarDefecto(estado, true);
      return;
    }
    this.fijarDefecto(estado, false);
    const [pre, just, cons] = this.cajas();
    this.marcar(pre, 'encendida ok', '✓');
    await esperar(550, token);
    just.className = 'caja encendida escaneando';
    Sonido.escaneo();
    await esperar(1100, token);
    const inst = estado.instancias;
    const bloqueada = inst.some((i) => i.estado === 'bloqueada') && !inst.some((i) => i.estado === 'aplicada');
    this.marcar(just, bloqueada ? 'encendida falla' : 'encendida ok', bloqueada ? '✗' : '✓');
    await esperar(500, token);
    if (bloqueada) cons.classList.add('apagada');
    else this.marcar(cons, 'encendida supuesta', '★');
    this.renderInstancias(inst);
    await esperar(450, token);
  }
}

// ───────────────────────── Circunscripción ─────────────────────────

const BOTE = { x: 150, y: 112 };
const VACIO = { x: 372, y: 64 };

class WidgetCirc extends Widget {
  constructor(contenedor, lado, opciones) {
    super(contenedor, lado, opciones);
    this.ticker = { acum: 0, n: 0, items: 0 };
    this.circ = { x: 235, y: 116, r: 96 };
    this.objetivo = { ...this.circ };
  }

  plantilla() {
    if (this.esMono) {
      return `<div class="widget">
        <div class="widget__titulo">Para concluir «se puede cruzar» debe demostrarlo todo</div>
        <div class="condiciones">
          <div class="condiciones__lista"></div>
          <div class="ysi"><div class="ysi__cinta"></div><div class="ysi__contador"></div></div>
        </div>
        <div class="escarcha"></div>
      </div>`;
    }
    let puntos = '';
    for (let x = 20; x < 470; x += 30) for (let y = 16; y < 232; y += 30) puntos += `<circle cx="${x}" cy="${y}" r="1" class="c-rejilla"/>`;
    return `<div class="widget">
      <div class="widget__titulo">Circunscripción · minimizar lo anormal</div>
      <div class="circ">
        <div class="circ__mapa"><svg viewBox="0 0 470 232">
          ${puntos}
          <path class="c-agua" d="M60 160 q12 -7 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0"/>
          <g class="c-bote" transform="translate(${BOTE.x} ${BOTE.y})">
            <path d="M-44 14 L44 14 L30 34 L-30 34 Z"/>
            <path d="M0 14 V-34"/>
            <path d="M3 -32 L30 8 L3 8 Z" class="c-vela"/>
            <text y="56" text-anchor="middle">bote</text>
          </g>
          <g class="c-motivos"></g>
          <circle class="c-ab" cx="235" cy="116" r="96"/>
          <text class="c-ab-etq" x="235" y="16" text-anchor="middle">Ab = ?</text>
        </svg></div>
        <div class="circ__info">
          <div class="circ__circ">Circ[ T ; Ab ]<small>hace «lo anormal» lo más pequeño posible</small></div>
          <div class="circ__lineas"></div>
        </div>
      </div>
    </div>`;
  }

  fijar(estado) {
    if (this.esMono) this.fijarMono(estado, false);
    else this.fijarNm(estado, true);
  }

  async animar(previo, estado, token) {
    if (this.esMono) {
      this.fijarMono(estado, true);
      if (estado.estado === 'paralizada' && previo?.estado !== 'paralizada') Sonido.congelar();
      await esperar(900, token);
      return;
    }
    await this.animarNm(previo, estado, token);
  }

  fijarMono(estado, animar) {
    const lista = this.$('.condiciones__lista');
    lista.innerHTML = (estado.condiciones ?? []).map((c, i) => filaCondicion(c, animar ? i * 0.18 : 0)).join('');
    this.paralizada = estado.activo && estado.estado === 'paralizada';
    this.$('.ysi').classList.toggle('detenida', !this.paralizada);
    this.$('.escarcha').classList.toggle('activa', this.paralizada);
    const cinta = this.$('.ysi__cinta');
    if (!this.paralizada) {
      cinta.replaceChildren();
      this.ticker = { acum: 0, n: 0, items: 0 };
      const r = estado.respuestas?.[0]?.valor;
      this.$('.ysi__contador').textContent = !estado.activo
        ? 'esperando datos…'
        : r === 'no'
          ? 'ya no importa: se deduce que no se puede'
          : r === 'si'
            ? 'todas las condiciones demostradas ✓'
            : 'sin verificar';
    } else if (!this.ticker.n) {
      this.ticker.n = (estado.condiciones ?? []).length;
      for (let i = 0; i < 2; i++) this.siguienteYSi();
    }
    this.contador();
  }

  siguienteYSi() {
    const lista = this.op.cualificaciones ?? ['¿Y si…?'];
    const cinta = this.$('.ysi__cinta');
    const item = document.createElement('div');
    item.className = 'ysi__item';
    item.textContent = lista[this.ticker.items % lista.length];
    cinta.prepend(item);
    while (cinta.children.length > 6) cinta.lastChild.remove();
    this.ticker.items++;
    this.ticker.n++;
    this.contador();
  }

  contador() {
    if (this.paralizada) this.$('.ysi__contador').innerHTML = `verificando condición <b>${this.ticker.n}</b> de <b>∞</b>`;
  }

  dibujar(t, dt) {
    if (this.esMono) {
      if (!this.paralizada) return;
      this.ticker.acum += dt;
      if (this.ticker.acum > 0.8) {
        this.ticker.acum = 0;
        this.siguienteYSi();
      }
      return;
    }
    // Interpolación suave del círculo de Ab
    const k = 1 - Math.exp(-dt * 3);
    for (const p of ['x', 'y', 'r']) this.circ[p] += (this.objetivo[p] - this.circ[p]) * k;
    const c = this.$('.c-ab');
    c.setAttribute('cx', this.circ.x.toFixed(1));
    c.setAttribute('cy', this.circ.y.toFixed(1));
    c.setAttribute('r', Math.max(0, this.circ.r).toFixed(1));
  }

  objetivoDe(estado) {
    const c = estado.circ;
    if (!estado.activo || !c || c.minimo === null) return { x: 235, y: 116, r: 96, etq: 'Ab = ?', ex: 235, ey: 16 };
    if (!c.ab.length) return { x: VACIO.x, y: VACIO.y, r: 3, etq: 'Ab = ∅', ex: VACIO.x, ey: VACIO.y + 32 };
    return { x: BOTE.x, y: BOTE.y + 20, r: 84, etq: `Ab = ${c.minimo}`, ex: BOTE.x + 120, ey: 30 };
  }

  fijarNm(estado, inmediato) {
    const o = this.objetivoDe(estado);
    this.objetivo = { x: o.x, y: o.y, r: o.r };
    if (inmediato) this.circ = { ...this.objetivo };
    const etq = this.$('.c-ab-etq');
    etq.textContent = o.etq;
    etq.setAttribute('x', o.ex);
    etq.setAttribute('y', o.ey);
    const hayBote = (estado.circ?.entidades ?? []).length > 0;
    this.$('.c-bote').classList.toggle('c-bote--fantasma', !hayBote);
    this.$('.c-ab').classList.toggle('c-ab--lleno', (estado.circ?.ab ?? []).length > 0);
    this.renderMotivos(estado);
    this.renderLineas(estado);
  }

  renderMotivos(estado) {
    const razones = (estado.circ?.ab ?? []).flatMap((a) => a.razonesFormal ?? a.razones);
    this.$('.c-motivos').innerHTML = razones
      .slice(0, 3)
      .map((r, i) => `<g transform="translate(${BOTE.x} ${BOTE.y + 74 + i * 0})"><text y="${i * 18}" text-anchor="middle" class="c-motivo">⚠ ${esc(r)}</text></g>`)
      .join('');
  }

  renderLineas(estado) {
    const c = estado.circ;
    const cont = this.$('.circ__lineas');
    if (!estado.activo || !c || c.minimo === null) {
      cont.innerHTML = '<div class="circ__linea">Esperando datos…</div>';
      return;
    }
    const regla = 'Bote ∧ ¬Ab → Cruzar';
    if (!c.ab.length) {
      cont.innerHTML = `<div class="circ__linea circ__linea--supuesto">Supuesto: <code>${esc(c.supuestos.join(', ') || '¬Ab(bote)')}</code><br>no hay ningún motivo para sospechar</div>
        <div class="circ__linea"><code>${regla}</code> &nbsp;✓ se aplica</div>`;
    } else {
      cont.innerHTML = `<div class="circ__linea circ__linea--anomalia"><code>${esc(c.ab.map((a) => a.formal).join(', '))}</code> por: ${esc(c.ab.flatMap((a) => a.razones).join(', ').toLowerCase())}</div>
        <div class="circ__linea"><code>${regla}</code> &nbsp;✗ ya no se aplica</div>`;
    }
  }

  async animarNm(previo, estado, token) {
    const antes = this.objetivoDe(previo ?? { activo: false });
    const despues = this.objetivoDe(estado);
    if (antes.etq === despues.etq && antes.r === despues.r) {
      this.fijarNm(estado, false);
      return;
    }
    // Primero aparecen los hechos (el bote, la anomalía), después el círculo se ajusta.
    this.$('.c-bote').classList.toggle('c-bote--fantasma', !(estado.circ?.entidades ?? []).length);
    this.renderMotivos(estado);
    this.$('.circ__lineas').innerHTML = '<div class="circ__linea">Circunscribiendo Ab…</div>';
    await esperar(500, token);
    Sonido.escaneo();
    this.fijarNm(estado, false);
    this.$('.circ__lineas').innerHTML = '<div class="circ__linea">Circunscribiendo Ab…</div>';
    await esperar(1500, token);
    this.renderLineas(estado);
    await esperar(400, token);
  }
}

// ───────────────────────── Lógica autoepistémica ─────────────────────────

class WidgetIntro extends Widget {
  plantilla() {
    if (this.esMono) {
      return `<div class="widget">
        <div class="widget__titulo">Introspección · no disponible</div>
        <div class="bloqueo">
          <div class="bloqueo__espejo">${ICONOS.ojoTachado}<p><b>SIN ACCESO</b>La lógica clásica no puede razonar sobre lo que ella misma sabe o ignora.</p></div>
          <div class="condiciones__lista"><div class="condiciones__meta">Para concluir <b>«el examen es hoy»</b> necesita demostrar:</div><div class="condiciones__filas"></div></div>
        </div>
      </div>`;
    }
    return `<div class="widget">
      <div class="widget__titulo">Introspección · ¿qué creo?</div>
      <div class="intro">
        <div class="intro__memoria"><h5>Mis creencias</h5><div class="intro__lista"></div><div class="intro__escaner"></div></div>
        <div class="intro__consulta"></div>
      </div>
    </div>`;
  }

  fijar(estado) {
    if (this.esMono) {
      this.$('.condiciones__filas').innerHTML = (estado.condiciones ?? []).map((c) => filaCondicion(c)).join('');
      return;
    }
    this.renderMemoria(estado, true);
    this.renderConsulta(estado, true);
  }

  async animar(previo, estado, token) {
    if (this.esMono) {
      this.fijar(estado);
      await esperar(600, token);
      return;
    }
    const antes = JSON.stringify((previo?.introspeccion ?? []).map((i) => i.creo));
    const ahora = JSON.stringify((estado.introspeccion ?? []).map((i) => i.creo));
    if (antes === ahora) {
      this.fijar(estado);
      return;
    }
    // La IA se examina a sí misma: recorre sus creencias buscando un cambio
    this.renderMemoria(estado, false);
    this.renderConsulta(estado, false);
    this.op.cerebro?.setModo('introspeccion');
    this.$('.intro__escaner').classList.add('activo');
    Sonido.escaneo();
    const items = [...this.el.querySelectorAll('.intro__creencia')];
    const porItem = Math.max(450, 1500 / Math.max(1, items.length));
    for (const it of items) {
      it.classList.add('vista');
      await esperar(porItem, token);
      if (!it.dataset.hallazgo) it.classList.remove('vista');
      else it.classList.add('encontrada');
    }
    await esperar(items.length ? 500 : 1600, token);
    this.$('.intro__escaner').classList.remove('activo');
    this.op.cerebro?.setModo('procesando');
    this.renderConsulta(estado, true);
    await esperar(800, token);
  }

  renderMemoria(estado, conHallazgos) {
    const atomos = (estado.introspeccion ?? []).filter((i) => i.creo).map((i) => i.lit);
    const hechos = (estado.hechos ?? []).filter((h) => !h.base);
    const relevantes = new Set();
    for (const c of estado.conclusiones ?? []) {
      if (atomos.includes(c.lit)) {
        relevantes.add(c.lit);
        for (const o of c.origen ?? []) relevantes.add(o);
      }
    }
    const lista = this.$('.intro__lista');
    if (!hechos.length) {
      lista.innerHTML = '<div class="intro__vacia">(todavía no sé nada)</div>';
      return;
    }
    lista.innerHTML = hechos
      .map((h) => {
        const hallazgo = relevantes.has(h.lit);
        return `<div class="intro__creencia ${hallazgo && conHallazgos ? 'encontrada' : ''}" ${hallazgo ? 'data-hallazgo="1"' : ''}>${esc(h.texto)}</div>`;
      })
      .join('');
  }

  renderConsulta(estado, conRespuesta) {
    const lista = estado.introspeccion ?? [];
    const compacta = lista.length > 1;
    const negado = (i) => {
      const c = (estado.conclusiones ?? []).find((x) => x.lit === `-${i.lit}`);
      return c ? c.texto : `no ${i.lit}`;
    };
    this.$('.intro__consulta').innerHTML = lista
      .map((i) => {
        const creo = conRespuesta ? i.creo : null;
        const resp = creo === null ? '…' : creo ? 'SÍ' : 'NO';
        const clase = creo === null ? '' : creo ? 'si' : 'no';
        const formal = `¬${i.formal} → ¬${i.formal.replace(/^L /, '')}`;
        const pregunta = `<div class="intro__pregunta"><div class="intro__ojo">${ICONOS.ojo}</div>
          <div class="intro__pregunta-texto">${esc(i.pregunta)}<code>${esc(compacta ? formal : i.formal)}</code></div>
          <div class="intro__resp ${clase}">${resp}</div></div>`;
        if (compacta) return pregunta;
        const texto =
          creo === false ? `${esc(i.regla)} ⇒ supongo: <b>${esc(negado(i))}</b>` : creo === true ? 'Sí lo creo: esta regla ya no se aplica.' : esc(i.regla);
        return `${pregunta}<div class="intro__regla ${creo === true ? 'inactiva' : ''}"><code>${esc(formal)}</code><p>${texto}</p></div>`;
      })
      .join('');
  }
}

// ───────────────────────── Negación por fallo ─────────────────────────

class WidgetProlog extends Widget {
  plantilla() {
    return `<div class="widget">
      <div class="widget__titulo">${this.esMono ? 'Lógica clásica · mundo abierto' : 'Negación por fallo · mundo cerrado'}</div>
      <div class="prolog">
        <div class="prolog__archivo"><div class="prolog__barra"><i></i><i></i><i></i><span>base_de_conocimiento.pl</span></div><div class="prolog__filas"></div></div>
        <div class="prolog__consola"><div class="prolog__barra"><i></i><i></i><i></i><span>consultas</span></div><div class="prolog__consultas"></div>
          <div class="prolog__mundo">${this.esMono ? 'lo no demostrado queda como desconocido' : 'lo que no se puede demostrar se asume falso'}</div></div>
      </div>
    </div>`;
  }

  textoFila(f) {
    const m = f.formal.match(/^(-?)(\w+)(.*)$/);
    return m ? `${esc(m[1])}<b>${esc(m[2])}</b>${esc(m[3])}` : esc(f.formal);
  }

  resultado(b) {
    if (b.resultado === null || b.resultado === undefined) return ['', ''];
    if (b.resultado === 'si') return [this.esMono ? 'demostrado ⇒ SÍ' : 'true ⇒ SÍ', 'si'];
    if (b.resultado === 'no') {
      if (b.porFallo) return ['la búsqueda falla ⇒ se asume falso ⇒ NO', 'no'];
      return [this.esMono ? 'refutado ⇒ NO' : 'negación explícita ⇒ NO', 'no'];
    }
    return ['no se demuestra ni se refuta ⇒ NO SÉ', 'duda'];
  }

  fijar(estado) {
    const db = estado.db;
    this.$('.prolog__filas').innerHTML = db.filas
      .slice(0, 7)
      .map((f, i) => `<div class="fila" data-lit="${esc(f.lit)}"><em>${i + 1}</em><code>${this.textoFila(f)}</code></div>`)
      .join('');
    this.$('.prolog__consultas').innerHTML = db.busquedas
      .slice(0, 3)
      .map((b) => {
        const [texto, clase] = this.resultado(b);
        return `<div class="prolog__consulta" data-id="${esc(b.id)}"><div class="prolog__q">${esc(b.consulta)}</div><div class="prolog__res ${clase}">${esc(texto)}</div></div>`;
      })
      .join('');
  }

  async animar(previo, estado, token) {
    const db = estado.db;
    const filasCont = this.$('.prolog__filas');
    // Filas nuevas en la base de conocimiento
    const previas = new Set((previo?.db?.filas ?? []).map((f) => f.lit));
    let hubo = false;
    if (!filasCont.children.length) this.fijar({ db: { ...db, filas: previo?.db?.filas ?? db.filas, busquedas: [] } });
    db.filas.slice(0, 7).forEach((f, i) => {
      if (previas.has(f.lit) || filasCont.querySelector(`[data-lit="${CSS.escape(f.lit)}"]`)) return;
      filasCont.insertAdjacentHTML('beforeend', `<div class="fila nueva" data-lit="${esc(f.lit)}"><em>${i + 1}</em><code>${this.textoFila(f)}</code></div>`);
      hubo = true;
    });
    if (hubo) await esperar(700, token);

    // Consultas: la sonda recorre la base fila por fila
    const consultas = this.$('.prolog__consultas');
    consultas.innerHTML = db.busquedas
      .slice(0, 3)
      .map((b) => `<div class="prolog__consulta" data-id="${esc(b.id)}"><div class="prolog__q">${esc(b.consulta)}</div><div class="prolog__res"></div></div>`)
      .join('');
    const filas = [...filasCont.children];
    for (const b of db.busquedas.slice(0, 3)) {
      const res = consultas.querySelector(`[data-id="${CSS.escape(b.id)}"] .prolog__res`);
      res.className = 'prolog__res ocupada';
      if (b.derivada) {
        res.textContent = 'aplicando reglas de ruta ';
        await esperar(700, token);
      } else {
        for (let j = 0; j < filas.length; j++) {
          filas[j].classList.add(b.coincidencias[j] ? 'acierto' : 'sonda');
          await esperar(150, token);
        }
        await esperar(250, token);
      }
      const [texto, clase] = this.resultado(b);
      res.className = `prolog__res ${clase}`;
      res.textContent = texto;
      filas.forEach((f) => f.classList.remove('sonda', 'acierto'));
      await esperar(300, token);
    }
  }
}

// ───────────────────────── Argumentación ─────────────────────────

const NS = 'http://www.w3.org/2000/svg';
const ETQ_ARG = { IN: 'ACEPTADO', OUT: 'DERROTADO', UNDEC: 'INDECISO' };
const MEDIO = { w: 125, h: 36 };

function borde(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.min(MEDIO.w / Math.max(1e-6, Math.abs(dx)), MEDIO.h / Math.max(1e-6, Math.abs(dy)));
  return { x: a.x + dx * t, y: a.y + dy * t };
}

class WidgetArgs extends Widget {
  plantilla() {
    return `<div class="widget args">
      <div class="widget__titulo">${this.esMono ? 'Acepta todo argumento' : 'Grafo de argumentos'}</div>
      <svg viewBox="0 0 868 284">
        <defs><marker id="flecha-${this.lado}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="a-punta"/></marker></defs>
        <g class="g-ataques"></g><g class="g-nodos"></g>
      </svg>
      <div class="args__nota"></div>
    </div>`;
  }

  pos(a) {
    return { x: a.pos[0], y: a.pos[1] };
  }

  nodo(a) {
    const { x, y } = this.pos(a);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${x} ${y})`);
    g.innerHTML = `<g class="arg" data-id="${esc(a.id)}">
      <rect class="arg__caja" x="-125" y="-36" width="250" height="72" rx="14"/>
      <circle class="arg__circulo" cx="-96" cy="0" r="17"/>
      <text class="arg__id" x="-96" y="6" text-anchor="middle">${esc(a.id)}</text>
      <text class="arg__texto" x="-68" y="-11">${esc(a.texto)}</text>
      <text class="arg__concl" x="-68" y="8">⇒ ${esc(a.conclusion)}</text>
      <text class="arg__etq" x="-68" y="27"></text>
      <line class="arg__tachado" x1="-72" x2="114" y1="-16" y2="-16"/>
    </g>`;
    return g;
  }

  etiquetar(el, etiqueta) {
    const e = this.esMono ? 'IN' : etiqueta;
    el.dataset.etiqueta = e;
    el.querySelector('.arg__etq').textContent = `● ${ETQ_ARG[e]}`;
  }

  rutaAtaque(t, args) {
    const a = args.find((x) => x.id === t.de);
    const b = args.find((x) => x.id === t.a);
    if (!a || !b) return null;
    const pa = this.pos(a);
    const pb = this.pos(b);
    const mutuo = args.length && this.ataques.some((u) => u.de === t.a && u.a === t.de);
    const ini = borde(pa, pb);
    const fin = borde(pb, pa);
    const mx = (ini.x + fin.x) / 2;
    const my = (ini.y + fin.y) / 2;
    const dx = fin.x - ini.x;
    const dy = fin.y - ini.y;
    const l = Math.hypot(dx, dy) || 1;
    const curva = mutuo ? 28 : 10;
    const cx = mx + (-dy / l) * curva;
    const cy = my + (dx / l) * curva;
    return `M${ini.x.toFixed(1)} ${ini.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${fin.x.toFixed(1)} ${fin.y.toFixed(1)}`;
  }

  dibujarAtaques(args, ataques, animar) {
    this.ataques = ataques;
    const g = this.$('.g-ataques');
    const previos = new Set([...g.children].map((p) => p.dataset.id));
    g.replaceChildren();
    for (const t of ataques) {
      const d = this.rutaAtaque(t, args);
      if (!d) continue;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('class', `a-ataque a-ataque--${t.tipo}`);
      p.setAttribute('marker-end', `url(#flecha-${this.lado})`);
      p.dataset.id = t.de + t.a;
      g.append(p);
      if (animar && !previos.has(p.dataset.id)) {
        const largo = p.getTotalLength();
        p.animate([{ strokeDasharray: `${largo} ${largo}`, strokeDashoffset: largo }, { strokeDasharray: `${largo} ${largo}`, strokeDashoffset: 0 }], {
          duration: 800,
          easing: 'cubic-bezier(.2,.8,.2,1)',
        });
      }
    }
  }

  nota(estado) {
    const args = estado.argumentos ?? [];
    if (!args.length) return 'Esperando argumentos…';
    if (this.esMono) {
      return estado.explosion ? '<b>Spam ∧ ¬Spam</b> · acepta conclusiones opuestas sin compararlas' : 'Cada argumento se acepta tal cual, sin buscar objeciones';
    }
    const ids = (et) => args.filter((a) => a.etiqueta === et).map((a) => a.id);
    if (ids('UNDEC').length) return `${ids('UNDEC').join(' y ')} se atacan y ninguno se impone ⇒ <b class="ambar">juicio suspendido</b>`;
    if (ids('OUT').length) return `${ids('OUT').join(', ')} queda${ids('OUT').length > 1 ? 'n' : ''} derrotado${ids('OUT').length > 1 ? 's' : ''} · se acepta${ids('IN').length > 1 ? 'n' : ''} ${ids('IN').join(', ')}`;
    return 'Sin objeciones: el argumento se acepta';
  }

  fijar(estado) {
    const args = estado.argumentos ?? [];
    const nodos = this.$('.g-nodos');
    nodos.replaceChildren(...args.map((a) => this.nodo(a)));
    for (const a of args) this.etiquetar(nodos.querySelector(`[data-id="${CSS.escape(a.id)}"]`), a.etiqueta);
    this.dibujarAtaques(args, this.esMono ? [] : (estado.ataques ?? []), false);
    this.$('.args__nota').innerHTML = this.nota(estado);
  }

  async animar(previo, estado, token) {
    const args = estado.argumentos ?? [];
    const nodos = this.$('.g-nodos');
    const existentes = new Set([...nodos.querySelectorAll('.arg')].map((n) => n.dataset.id));
    // 1. aparecen los argumentos nuevos
    let nuevos = 0;
    for (const a of args) {
      if (existentes.has(a.id)) continue;
      const g = this.nodo(a);
      nodos.append(g);
      const el = g.querySelector('.arg');
      this.etiquetar(el, 'UNDEC');
      el.dataset.etiqueta = 'nuevo';
      el.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 600, easing: 'cubic-bezier(.2,1.4,.4,1)' });
      nuevos++;
    }
    if (nuevos) await esperar(800, token);
    // 2. se trazan los ataques
    if (!this.esMono) {
      const antes = (previo?.ataques ?? []).length;
      this.dibujarAtaques(args, estado.ataques ?? [], true);
      if ((estado.ataques ?? []).length !== antes) await esperar(1000, token);
    }
    // 3. se calcula quién sobrevive
    for (const a of args) {
      const el = nodos.querySelector(`.arg[data-id="${CSS.escape(a.id)}"]`);
      if (el && el.dataset.etiqueta !== (this.esMono ? 'IN' : a.etiqueta)) {
        this.etiquetar(el, a.etiqueta);
        el.animate([{ filter: 'brightness(2.2)' }, { filter: 'brightness(1)' }], { duration: 700 });
        await esperar(380, token);
      }
    }
    this.$('.args__nota').innerHTML = this.nota(estado);
    await esperar(400, token);
  }
}

// ───────────────────────── Fábrica ─────────────────────────

const TIPOS = {
  vacio: WidgetVacio,
  perfil: WidgetPerfil,
  resumen: WidgetResumen,
  grafica: WidgetGrafica,
  defecto: WidgetDefecto,
  circunscripcion: WidgetCirc,
  autoepistemica: WidgetIntro,
  negacion: WidgetProlog,
  argumentos: WidgetArgs,
};

export function crearWidget(tipo, contenedor, lado, opciones) {
  const Clase = TIPOS[tipo];
  if (!Clase) {
    contenedor.replaceChildren();
    return null;
  }
  return new Clase(contenedor, lado, opciones);
}
