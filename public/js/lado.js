// Un lado del duelo: la IA monótona o la no-monótona.
// Sabe mostrar un estado del motor al instante (fijar) o animar el cambio entre dos estados (transicion).

import { esc, esperar, rectEnEscenario, Escala, Lienzo, rgba, COLORES, azar } from './util.js';
import { CerebroMonotono, CerebroNoMonotono } from './cerebros.js';
import { crearWidget } from './widgets.js';
import { Sonido } from './audio.js';

const ETIQUETAS_ESTADO = {
  espera: 'EN ESPERA',
  procesando: 'PROCESANDO',
  estable: 'ESTABLE',
  contradiccion: 'CONTRADICCIÓN',
  paralizada: 'PARALIZADA',
  desconocido: 'SIN RESPUESTA',
  indeciso: 'INDECISA',
  revisando: 'REVISANDO',
};

const TEXTO_VALOR = { si: 'SÍ', no: 'NO', desconocido: 'NO SÉ', contradiccion: 'SÍ y NO', indeciso: 'SIN DECIDIR', espera: '…' };

const AVISOS = {
  mono: {
    espera: 'núcleo deductivo · en espera',
    estable: 'núcleo deductivo',
    procesando: 'deduciendo…',
    paralizada: 'verificando condiciones… ∞',
    duda: 'sin prueba · sin respuesta',
    contradiccion: '⚠ contradicción',
    roto: 'núcleo colapsado',
    revisando: 'núcleo deductivo',
  },
  nomono: {
    espera: 'red adaptativa · en espera',
    estable: 'red adaptativa',
    procesando: 'razonando…',
    revisando: 'revisando creencias…',
    indeciso: 'juicio suspendido',
    introspeccion: 'introspección…',
    contradiccion: 'hechos contradictorios',
  },
};

const TAGS = { supuesto: 'SUPUESTO', aceptada: 'ACEPTADA', indecisa: 'EN DUDA', segura: '' };

function plantilla(lado) {
  const mono = lado === 'mono';
  return `
    <div class="lado__marco"></div>
    <header class="lado__cabecera">
      <div class="lado__id">
        <div class="lado__nombre"><span class="lado__glifo"></span><span>${mono ? 'IA MONÓTONA' : 'IA NO-MONÓTONA'}</span></div>
        <div class="lado__lema">${mono ? 'Lo que concluyo, jamás lo retiro.' : 'Concluyo con lo que sé… y corrijo al aprender.'}</div>
      </div>
      <div class="lado__medidores">
        <div class="medidor"><span class="medidor__etq">conclusiones</span><b class="medidor__val" data-m="conteo">0</b></div>
        <div class="medidor"><span class="medidor__etq">retiradas</span><b class="medidor__val" data-m="retiradas"><span>0</span>${
          mono ? '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>' : ''
        }</b></div>
        <canvas class="lado__chispa"></canvas>
      </div>
      <div class="lado__estado" data-estado="espera"><i></i><span>EN ESPERA</span></div>
    </header>
    <div class="lado__nucleo">
      <div class="cerebro"><canvas></canvas><div class="cerebro__aviso"></div></div>
      <div class="lado__info">
        <div class="respuestas"></div>
        <div class="conocimiento">
          <div class="grupo" data-g="hechos"><h4>Hechos</h4><div class="chips"></div></div>
          <div class="grupo" data-g="conclusiones"><h4>Conclusiones</h4><div class="chips"></div></div>
        </div>
      </div>
    </div>
    <div class="lado__widget"></div>
    <div class="lado__traza"></div>
    <div class="lado__capa"></div>`;
}

function centro(el) {
  const r = rectEnEscenario(el);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

// ───────────────────────── Fichas de conocimiento ─────────────────────────

class Fichas {
  constructor(contenedor, vacio = '') {
    this.c = contenedor;
    this.mapa = new Map();
    this.vacio = vacio;
    this.mas = null;
  }

  crear(item) {
    const el = document.createElement('div');
    el.dataset.id = item.id;
    el.innerHTML = '<span class="chip__tag"></span><span></span>';
    this.pintar(el, item);
    return el;
  }

  pintar(el, item) {
    el.className = `chip chip--${item.tipo}${el.classList.contains('entra') ? ' entra' : ''}`;
    const tag = el.firstChild;
    tag.textContent = item.tag ?? '';
    tag.hidden = !item.tag;
    el.lastChild.textContent = item.texto;
    el.title = item.titulo ?? '';
    if (item.fijo) el.dataset.fijo = '1';
  }

  posiciones() {
    const m = new Map();
    for (const [id, el] of this.mapa) if (!el.hidden) m.set(id, el.getBoundingClientRect());
    return m;
  }

  flip(antes) {
    const s = Escala.valor;
    for (const [id, el] of this.mapa) {
      const a = antes.get(id);
      if (!a || el.hidden) continue;
      const b = el.getBoundingClientRect();
      const dx = (a.left - b.left) / s;
      const dy = (a.top - b.top) / s;
      if (Math.abs(dx) + Math.abs(dy) > 1) {
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    }
  }

  actualizar(items, { animar = false } = {}) {
    const antes = animar ? this.posiciones() : null;
    const ids = new Set(items.map((i) => i.id));
    for (const [id, el] of this.mapa) {
      if (!ids.has(id)) {
        el.remove();
        this.mapa.delete(id);
      }
    }
    let anterior = null;
    let retraso = 0;
    for (const item of items) {
      let el = this.mapa.get(item.id);
      if (!el) {
        el = this.crear(item);
        this.mapa.set(item.id, el);
        if (animar) {
          el.classList.add('entra');
          el.style.animationDelay = `${retraso}s`;
          retraso += 0.12;
        }
      } else {
        el.classList.remove('retirando');
        this.pintar(el, item);
      }
      const siguiente = anterior ? anterior.nextSibling : this.c.firstChild;
      if (siguiente !== el) this.c.insertBefore(el, siguiente);
      anterior = el;
    }
    this.desborde();
    if (antes) this.flip(antes);
  }

  async retirar(ids, token, fx) {
    const els = ids.map((id) => this.mapa.get(id)).filter((el) => el && !el.hidden);
    if (!els.length) return;
    for (const el of els) {
      el.classList.add('retirando');
      const tag = el.firstChild;
      tag.hidden = false;
      tag.textContent = 'RETIRADA';
    }
    await esperar(1100, token);
    for (const el of els) fx?.disolver(rectEnEscenario(el), COLORES.oro);
    const antes = this.posiciones();
    for (const el of els) {
      el.remove();
      this.mapa.delete(el.dataset.id);
    }
    this.desborde();
    this.flip(antes);
  }

  // Si no caben en dos renglones, se ocultan las últimas y se muestra «+N».
  desborde() {
    this.mas?.remove();
    this.mas = null;
    this.c.querySelector('.chips__vacio')?.remove();
    const els = [...this.mapa.values()];
    els.forEach((e) => (e.hidden = false));
    if (!els.length) {
      if (this.vacio) this.c.insertAdjacentHTML('beforeend', `<span class="chips__vacio">${esc(this.vacio)}</span>`);
      return;
    }
    const limite = parseFloat(getComputedStyle(this.c).maxHeight) || Infinity;
    const sale = (e) => e.offsetTop + e.offsetHeight > limite + 1;
    const fuera = () => els.some((e) => !e.hidden && sale(e)) || (this.mas && sale(this.mas));
    if (!fuera()) return;
    this.mas = document.createElement('div');
    this.mas.className = 'chip chip--mas';
    const fijo = els.find((e) => e.dataset.fijo);
    this.c.insertBefore(this.mas, fijo ?? null);
    let ocultos = 0;
    for (const e of els.filter((x) => !x.dataset.fijo).reverse()) {
      if (!fuera()) break;
      e.hidden = true;
      ocultos++;
      this.mas.textContent = `+${ocultos}`;
    }
    if (!ocultos) {
      this.mas.remove();
      this.mas = null;
    }
  }
}

// ───────────────────────── Mini gráfica de la cabecera ─────────────────────────

class Chispa {
  constructor(canvas, color) {
    this.l = new Lienzo(canvas, 120, 38);
    this.color = color;
    this.valores = [];
    this.sucio = true;
  }
  fijar(valores) {
    this.valores = [...valores];
    this.sucio = true;
  }
  agregar(v) {
    this.valores.push(v);
    this.sucio = true;
  }
  dibujar() {
    if (!this.sucio && this.factor === this.l.factor) return;
    this.factor = this.l.factor;
    this.sucio = false;
    const { ctx } = this.l;
    this.l.limpiar();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(2, 34.5);
    ctx.lineTo(118, 34.5);
    ctx.stroke();
    if (!this.valores.length) return;
    const vals = [0, ...this.valores].slice(-9);
    const max = Math.max(3, ...vals.filter(Number.isFinite));
    const paso = 108 / Math.max(3, vals.length - 1);
    const x = (i) => 6 + i * paso;
    const y = (v) => (Number.isFinite(v) ? 33 - (v / max) * 25 : 2);
    const infinito = !Number.isFinite(vals[vals.length - 1]);
    const col = infinito ? COLORES.rojo : this.color;
    ctx.lineJoin = 'round';
    // Área bajo la curva
    ctx.beginPath();
    vals.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
    ctx.lineTo(x(vals.length - 1), 34);
    ctx.lineTo(x(0), 34);
    ctx.fillStyle = rgba(col, 0.12);
    ctx.fill();
    for (const [ancho, alfa] of [[5, 0.2], [1.8, 1]]) {
      ctx.beginPath();
      vals.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
      ctx.strokeStyle = rgba(col, alfa);
      ctx.lineWidth = ancho;
      ctx.stroke();
    }
    vals.forEach((v, i) => {
      ctx.fillStyle = i === vals.length - 1 ? '#fff' : rgba(col, 0.9);
      ctx.beginPath();
      ctx.arc(x(i), y(v), i === vals.length - 1 ? 2.8 : 1.8, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

// ───────────────────────── Lado ─────────────────────────

function modoCerebro(lado, estado) {
  if (!estado || !estado.activo) return 'espera';
  if (lado === 'mono') {
    if (estado.explosion) return 'roto';
    if (estado.estado === 'paralizada') return 'paralizada';
    if (estado.estado === 'desconocido') return 'duda';
    return 'estable';
  }
  if (estado.estado === 'indeciso') return 'indeciso';
  if (estado.estado === 'contradiccion') return 'contradiccion';
  return 'estable';
}

const estadoVisible = (estado) => (!estado || !estado.activo ? 'espera' : estado.estado);

export class Lado {
  constructor(el, lado, fx) {
    this.el = el;
    this.lado = lado;
    this.esMono = lado === 'mono';
    this.fx = fx;
    el.innerHTML = plantilla(lado);
    const q = (s) => el.querySelector(s);
    this.$ = {
      estado: q('.lado__estado'),
      conteo: q('[data-m="conteo"]'),
      retiradas: q('[data-m="retiradas"]'),
      cerebro: q('.cerebro'),
      aviso: q('.cerebro__aviso'),
      respuestas: q('.respuestas'),
      grupoHechos: q('[data-g="hechos"]'),
      grupoConclusiones: q('[data-g="conclusiones"]'),
      widget: q('.lado__widget'),
      traza: q('.lado__traza'),
      capa: q('.lado__capa'),
    };
    const canvas = this.$.cerebro.querySelector('canvas');
    this.cerebro = this.esMono ? new CerebroMonotono(canvas) : new CerebroNoMonotono(canvas);
    this.chispa = new Chispa(q('.lado__chispa'), this.esMono ? COLORES.mono : COLORES.nm);
    this.fichasHechos = new Fichas(this.$.grupoHechos.querySelector('.chips'), '(sin datos todavía)');
    this.fichasConclusiones = new Fichas(this.$.grupoConclusiones.querySelector('.chips'), '(ninguna todavía)');
    this.widget = null;
    this.estado = null;
    this.metodo = null;
    this.trazaPrevia = new Set();
    this.trazaExtra = [];
    this.retiradas = 0;
    this.historial = [];
    this.cola(null);
  }

  // Prepara el lado para una escena nueva.
  cargar(config) {
    this.limpiarEfectos();
    this.el.classList.remove('roto');
    this.cola(null);
    this.config = config;
    this.metodo = config.metodo ?? null;
    this.cerebro.reiniciar();
    this.widgetTipo = null;
    this.ponerWidget(config.widget, config.opciones);
    this.estado = null;
    this.trazaPrevia = new Set();
    this.trazaExtra = [];
    this.retiradas = 0;
    this.historial = [];
    this.$.grupoHechos.querySelector('h4').textContent = config.etiquetaHechos ?? 'Hechos';
    this.$.grupoConclusiones.querySelector('h4').textContent = config.etiquetaConclusiones ?? 'Conclusiones';
    this.$.grupoHechos.hidden = Boolean(config.sinHechos);
    this.fichasHechos.actualizar([]);
    this.fichasConclusiones.actualizar([]);
    this.$.respuestas.replaceChildren();
    this.$.traza.replaceChildren();
    this.medidores(0, 0);
    this.chispa.fijar([]);
    this.setEstado('espera');
    this.aviso('espera');
    this.cerebro.setModo('espera');
  }

  ponerWidget(tipo, opciones = {}) {
    if (this.widgetTipo === tipo) return;
    this.widget?.destruir();
    this.widgetTipo = tipo;
    this.widget = crearWidget(tipo, this.$.widget, this.lado, { ...opciones, cerebro: this.cerebro });
  }

  // ─── Mostrar un estado al instante ───
  fijar(estado, extra = {}) {
    this.limpiarEfectos();
    this.estado = estado;
    this.el.classList.toggle('roto', Boolean(estado.explosion));
    this.renderHechos(estado, false);
    this.renderConclusiones(estado, false);
    this.renderRespuestas(estado.respuestas, false);
    this.widget?.fijar(estado);
    this.trazaExtra = extra.trazaExtra ?? [];
    this.trazaPrevia = new Set();
    this.renderTraza(estado, false);
    this.retiradas = extra.retiradas ?? 0;
    this.historial = [...(extra.historial ?? [])];
    this.medidores(this.conteoDe(estado), this.retiradas);
    this.chispa.fijar(this.historial);
    this.cerebro.setConclusiones(this.paraCerebro(estado), false);
    const modo = modoCerebro(this.lado, estado);
    this.cerebro.setModo(modo);
    this.setEstado(estadoVisible(estado));
    this.aviso(modo);
  }

  // ─── Animar el paso de un estado a otro ───
  async transicion(previo, estado, token) {
    this.estado = estado;
    const prev = previo && previo.activo ? previo : null;

    // 1. Procesa la información nueva
    this.setEstado('procesando');
    this.cerebro.setModo('procesando');
    this.cerebro.procesar();
    this.aviso('procesando');
    this.renderHechos(estado, true);
    this.trazaExtra = [];
    this.renderTraza({ traza: (estado.traza ?? []).filter((l) => l.tipo === 'hecho') }, true);
    await esperar(700, token);

    // 2. Razonamiento propio de cada método (panel inferior); después se escribe la traza
    if (this.widget) await this.widget.animar(prev, estado, token);
    this.renderTraza(this.esMono ? { traza: (estado.traza ?? []).filter((l) => l.tipo !== 'alerta') } : estado, true);

    // 3. Retira conclusiones (esto solo le puede pasar a la no-monótona)
    const retiradas = (prev?.conclusiones ?? []).filter((c) => !estado.conclusiones.some((n) => n.lit === c.lit));
    if (retiradas.length) {
      this.setEstado('revisando');
      this.cerebro.setModo('revisando');
      this.aviso('revisando');
      Sonido.retirar();
      this.trazaExtra = retiradas.map((c) => ({ tipo: 'retiro', texto: `↺ retiro: ${c.texto}` }));
      this.renderTraza(estado, true);
      const quedan = prev.conclusiones.filter((c) => !retiradas.includes(c));
      await this.fichasConclusiones.retirar(
        retiradas.map((c) => c.lit),
        token,
        this.fx,
      );
      this.cerebro.setConclusiones(this.paraCerebro({ conclusiones: quedan }), true);
      this.retiradas += retiradas.length;
      this.historial.push(quedan.length);
      this.chispa.agregar(quedan.length);
      this.medidores(quedan.length, this.retiradas, true);
      await esperar(600, token);
    }

    // 4. Contradicción y explosión (solo la monótona) o conclusiones nuevas
    if (estado.explosion && !prev?.explosion) {
      await this.explosion(estado, token);
    } else {
      const nuevas = estado.conclusiones.filter((c) => !(prev?.conclusiones ?? []).some((p) => p.lit === c.lit));
      this.renderConclusiones(estado, true);
      this.cerebro.setConclusiones(this.paraCerebro(estado), true);
      if (nuevas.length) Sonido.conclusion(nuevas.some((c) => c.tipo !== 'segura'));
    }

    // 5. Respuesta final
    this.renderRespuestas(estado.respuestas, true);
    this.renderTraza(estado, true);
    const conteo = this.conteoDe(estado);
    this.historial.push(conteo);
    this.chispa.agregar(conteo);
    this.medidores(conteo, this.retiradas, true);
    const modo = modoCerebro(this.lado, estado);
    this.cerebro.setModo(modo);
    this.setEstado(estadoVisible(estado));
    this.aviso(modo);
    if (estado.estado === 'indeciso') Sonido.indeciso();
    await esperar(500, token);
  }

  async explosion(estado, token) {
    // Primero se ven las dos conclusiones opuestas…
    this.renderConclusiones(estado, true, { sinAbsurdas: true });
    this.cerebro.setConclusiones(this.paraCerebro(estado), true);
    await esperar(800, token);
    // …chocan…
    const choque = estado.contradicciones[0];
    const a = this.fichasConclusiones.mapa.get(choque.lit);
    const b = this.fichasConclusiones.mapa.get(`-${choque.lit}`);
    if (a && b) this.fx.rayo(centro(a), centro(b), COLORES.rojo, 1.8);
    Sonido.alarma();
    this.setEstado('contradiccion');
    this.cerebro.setModo('contradiccion');
    this.aviso('contradiccion');
    this.el.classList.add('glitch');
    this.renderRespuestas(estado.respuestas, true);
    this.renderTraza(estado, true);
    await esperar(1500, token);
    // …y como de una contradicción se deduce cualquier cosa, todo estalla.
    this.mostrarBanner(`⚠ ${choque.texto}`, 'de una contradicción se deduce cualquier cosa');
    Sonido.glitch();
    await esperar(1000, token);
    Sonido.explosion();
    const c = centro(this.$.cerebro);
    this.cerebro.explotar();
    this.fx.estallido(c.x, c.y, COLORES.rojo, 130, 440);
    this.fx.estallido(c.x, c.y, COLORES.mono, 70, 320);
    this.fx.onda(c.x, c.y, COLORES.rojo, 340, 1.2);
    this.el.classList.remove('glitch');
    this.el.classList.add('sacudir', 'roto');
    this.aviso('roto');
    this.medidores(Infinity, this.retiradas, true);
    this.lanzarAbsurdos(estado.absurdas);
    await esperar(2600, token);
    this.el.classList.remove('sacudir');
    this.quitarBanner();
    this.renderConclusiones(estado, true);
  }

  lanzarAbsurdos(lista) {
    const cx = this.$.cerebro.offsetLeft + this.$.cerebro.parentElement.offsetLeft + 160;
    const cy = this.$.cerebro.offsetTop + this.$.cerebro.parentElement.offsetTop + 160;
    const haciaDerecha = this.esMono;
    lista.slice(0, 10).forEach((texto, i) => {
      const s = document.createElement('div');
      s.className = 'absurdo';
      s.textContent = texto;
      this.$.capa.append(s);
      const ang = (i / 9 - 0.5) * 2.3 + azar(-0.12, 0.12);
      const dist = azar(260, 560);
      const dx = Math.cos(ang) * dist * (haciaDerecha ? 1 : -1);
      const dy = Math.sin(ang) * dist * 0.62;
      const giro = azar(-14, 14);
      const anim = s.animate(
        [
          { transform: `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(.3)`, opacity: 0 },
          { transform: `translate(${cx + dx * 0.4}px, ${cy + dy * 0.4}px) translate(-50%, -50%) scale(1.15)`, opacity: 1, offset: 0.28 },
          { transform: `translate(${cx + dx}px, ${cy + dy}px) translate(-50%, -50%) scale(.9) rotate(${giro}deg)`, opacity: 0 },
        ],
        { duration: 2800, delay: i * 150, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' },
      );
      anim.onfinish = () => s.remove();
    });
  }

  mostrarBanner(titulo, sub) {
    this.quitarBanner();
    const b = document.createElement('div');
    b.className = 'banner';
    b.innerHTML = `${esc(titulo)}<small>${esc(sub)}</small>`;
    this.$.capa.append(b);
    this.banner = b;
    b.animate(
      [
        { opacity: 0, transform: 'translate(-50%, -50%) rotate(-3deg) scale(1.7)', filter: 'blur(10px)' },
        { opacity: 1, transform: 'translate(-50%, -50%) rotate(-3deg) scale(1)', filter: 'blur(0)' },
      ],
      { duration: 450, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'forwards' },
    );
  }

  quitarBanner() {
    if (!this.banner) return;
    const b = this.banner;
    this.banner = null;
    b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).onfinish = () => b.remove();
  }

  limpiarEfectos() {
    this.el.classList.remove('glitch', 'sacudir');
    this.$.capa.replaceChildren();
    this.banner = null;
  }

  // ─── Piezas de la interfaz ───

  setEstado(clave) {
    this.$.estado.dataset.estado = clave;
    this.$.estado.lastChild.textContent = ETIQUETAS_ESTADO[clave] ?? clave.toUpperCase();
  }

  aviso(modo) {
    const t = AVISOS[this.lado][modo] ?? AVISOS[this.lado].estable;
    this.$.aviso.textContent = t;
    this.$.aviso.classList.toggle('alerta', modo === 'contradiccion' || modo === 'roto');
  }

  medidores(conteo, retiradas, animar = false) {
    const c = this.$.conteo;
    const texto = Number.isFinite(conteo) ? String(conteo) : '∞';
    if (c.textContent !== texto) {
      c.textContent = texto;
      if (animar) {
        c.classList.remove('salto');
        void c.offsetWidth;
        c.classList.add('salto');
      }
    }
    c.classList.toggle('infinito', !Number.isFinite(conteo));
    const r = this.$.retiradas.firstChild;
    if (r.textContent !== String(retiradas)) {
      r.textContent = String(retiradas);
      if (animar) {
        this.$.retiradas.classList.remove('salto');
        void this.$.retiradas.offsetWidth;
        this.$.retiradas.classList.add('salto');
      }
    }
  }

  conteoDe(estado) {
    if (!estado || !estado.activo) return 0;
    return estado.explosion ? Infinity : estado.conclusiones.length;
  }

  paraCerebro(estado) {
    return (estado.conclusiones ?? []).map((c) => ({ lit: c.lit, tipo: c.tipo }));
  }

  renderHechos(estado, animar) {
    const items = (estado.hechos ?? []).filter((h) => !h.base).map((h) => ({ id: h.lit, texto: h.texto, tipo: 'hecho', titulo: h.formal }));
    this.fichasHechos.actualizar(items, { animar });
  }

  renderConclusiones(estado, animar, { sinAbsurdas = false } = {}) {
    const choque = new Set();
    for (const c of estado.contradicciones ?? []) {
      choque.add(c.lit);
      choque.add(`-${c.lit}`);
    }
    const items = (estado.conclusiones ?? []).map((c) => ({
      id: c.lit,
      texto: c.texto,
      tipo: choque.has(c.lit) ? 'conflicto' : c.tipo,
      tag: choque.has(c.lit) ? '⚡' : (TAGS[c.tipo] ?? ''),
      titulo: c.reglaTexto ? `${c.regla}: ${c.reglaTexto}` : '',
    }));
    items.sort((a, b) => (b.tipo === 'conflicto') - (a.tipo === 'conflicto'));
    if (estado.explosion && !sinAbsurdas) {
      estado.absurdas.slice(0, 3).forEach((t, i) => items.push({ id: `absurda-${i}`, texto: t, tipo: 'absurda', tag: '⚠' }));
      items.push({ id: 'infinito', texto: '+ ∞', tipo: 'infinito', fijo: true });
    }
    this.fichasConclusiones.actualizar(items, { animar });
  }

  marca(r) {
    if (r.textoValor || r.valor === 'espera' || r.valor === 'desconocido' || r.valor === 'indeciso') return null;
    if (r.valor === 'contradiccion') return { texto: 'P ∧ ¬P', tipo: 'choque' };
    if (this.esMono) return { texto: 'DEFINITIVA', tipo: 'definitiva' };
    if (!r.provisional) return { texto: 'SEGURA', tipo: 'definitiva' };
    const texto = { negacion: 'MUNDO CERRADO', argumentos: 'DERROTABLE' }[this.metodo] ?? 'SUPUESTO';
    return { texto, tipo: 'supuesto' };
  }

  renderRespuestas(respuestas, animar) {
    const cont = this.$.respuestas;
    const lista = respuestas?.length ? respuestas.slice(0, 4) : [{ id: '__vacio', pregunta: this.config?.preguntaVacia ?? 'Agrega información para empezar', valor: 'espera', detalle: '' }];
    const compactas = lista.length > 1;
    const densas = lista.length > 2;
    if (cont.classList.contains('respuestas--compactas') !== compactas || cont.classList.contains('respuestas--densas') !== densas) {
      cont.classList.toggle('respuestas--compactas', compactas);
      cont.classList.toggle('respuestas--densas', densas);
      // Cambia el espacio disponible para las fichas: se recalcula cuántas caben
      this.fichasHechos.desborde();
      this.fichasConclusiones.desborde();
    }
    const vistos = new Set();
    for (const r of lista) {
      let el = cont.querySelector(`[data-id="${CSS.escape(r.id)}"]`);
      if (!el) {
        el = document.createElement('div');
        el.className = 'respuesta';
        el.dataset.id = r.id;
        el.innerHTML = '<div class="respuesta__pregunta"></div><div class="respuesta__fila"><div class="respuesta__valor"></div><div class="respuesta__marca"></div></div><div class="respuesta__detalle"></div>';
        cont.append(el);
      }
      vistos.add(r.id);
      el.querySelector('.respuesta__pregunta').textContent = r.pregunta;
      const texto = r.textoValor ?? TEXTO_VALOR[r.valor] ?? r.valor;
      const v = el.querySelector('.respuesta__valor');
      const cambio = v.textContent !== texto;
      v.textContent = texto;
      v.dataset.texto = texto;
      el.dataset.valor = r.valor;
      el.dataset.provisional = String(Boolean(r.provisional) && (r.valor === 'si' || r.valor === 'no'));
      const m = this.marca(r);
      const marca = el.querySelector('.respuesta__marca');
      marca.textContent = m?.texto ?? '';
      marca.dataset.tipo = m?.tipo ?? '';
      el.querySelector('.respuesta__detalle').textContent = r.detalle ?? '';
      if (animar && cambio) {
        v.classList.remove('cambia');
        void v.offsetWidth;
        v.classList.add('cambia');
      }
    }
    for (const el of [...cont.children]) if (!vistos.has(el.dataset.id)) el.remove();
  }

  renderTraza(estado, animar) {
    const lineas = [...(estado.traza ?? []), ...this.trazaExtra].slice(-6);
    const frag = document.createDocumentFragment();
    let retraso = 0;
    for (const l of lineas) {
      const d = document.createElement('div');
      d.className = `traza__linea traza__linea--${l.tipo}`;
      d.textContent = l.texto;
      if (animar && !this.trazaPrevia.has(l.texto)) {
        d.classList.add('nueva');
        d.style.animationDelay = `${retraso}s`;
        retraso += 0.22;
      }
      frag.append(d);
    }
    this.$.traza.replaceChildren(frag);
    for (const l of lineas) this.trazaPrevia.add(l.texto);
  }

  // Dato que llegó pero esta IA todavía no procesa
  cola(dato) {
    this.$.cola?.remove();
    this.$.cola = null;
    if (!dato) return;
    const c = document.createElement('div');
    c.className = 'cola';
    c.innerHTML = `<b>EN COLA · AÚN NO LO PROCESA</b>${esc(dato.texto)}`;
    this.el.append(c);
    this.$.cola = c;
  }

  puntoEntrada(espera) {
    if (espera) {
      const r = rectEnEscenario(this.el);
      return { x: this.esMono ? r.x + 200 : r.x + r.w - 200, y: r.y + 126 };
    }
    const r = rectEnEscenario(this.$.grupoHechos.hidden ? this.$.grupoConclusiones : this.$.grupoHechos);
    return { x: this.esMono ? r.x + r.w - 80 : r.x + 80, y: r.y + 28 };
  }

  centroCerebro() {
    return centro(this.$.cerebro);
  }

  dibujar(t, dt) {
    this.cerebro.dibujar(t, dt);
    this.widget?.dibujar(t, dt);
    this.chispa.dibujar();
  }
}
