// Laboratorio (modo libre): tú agregas los hechos y las dos IAs razonan en vivo.
// Cada clic envía los hechos al motor en Node.js (POST /api/razonar) y se anima la respuesta.

import { $, esc, esperar, Token, CANCELADO } from './util.js';

const NOMBRES = {
  defecto: 'Lógica por defecto',
  circunscripcion: 'Circunscripción',
  autoepistemica: 'Autoepistémica',
  negacion: 'Negación por fallo',
  argumentos: 'Argumentos',
};
const negar = (l) => (l.startsWith('-') ? l.slice(1) : `-${l}`);

export class Laboratorio {
  constructor({ api, lados, director }) {
    this.api = api;
    this.lados = lados;
    this.director = director;
    this.el = $('#laboratorio');
    this.escenario = $('#escenario');
    this.activo = false;
    this.mundos = null;
    this.mundo = null;
    this.sesiones = {};
    this.ocupado = false;
    this.token = null;
    this.borrador = '';
    this.el.addEventListener('click', (e) => this.clic(e));
    this.el.addEventListener('input', (e) => {
      if (e.target.matches('input')) this.borrador = e.target.value;
    });
    this.el.addEventListener('keydown', (e) => {
      if (!e.target.matches('input')) return;
      e.stopPropagation();
      if (e.key === 'Enter') this.nuevaEntidad(e.target.value);
      if (e.key === 'Escape') e.target.blur();
    });
  }

  async alternar() {
    if (this.activo) this.cerrar();
    else await this.abrir();
  }

  async abrir() {
    if (!this.mundos) {
      try {
        this.mundos = await this.api.mundos();
      } catch (e) {
        console.error(e);
        return;
      }
    }
    this.activo = true;
    this.director.bloquear(true);
    this.escenario.classList.add('modo-lab');
    this.escenario.classList.remove('fase-portada');
    this.el.hidden = false;
    $('#escena-etiqueta').textContent = 'MODO LIBRE';
    $('#progreso').textContent = 'LAB';
    await this.elegir(this.mundo?.id ?? this.mundos[0].id);
  }

  cerrar() {
    this.token?.cancelar();
    this.token = null;
    this.ocupado = false;
    this.activo = false;
    this.el.hidden = true;
    this.escenario.classList.remove('modo-lab');
    this.director.bloquear(false);
  }

  sesion() {
    const id = this.mundo.id;
    this.sesiones[id] ??= {
      hechos: [],
      nombres: {},
      estados: null,
      historial: { mono: [], nomono: [] },
      retiradas: { mono: 0, nomono: 0 },
      sujeto: Object.keys(this.mundo.entidades)[0],
    };
    return this.sesiones[id];
  }

  async elegir(id) {
    this.token?.cancelar();
    this.ocupado = false;
    this.mundo = this.mundos.find((m) => m.id === id);
    $('#escena-titulo').textContent = `Laboratorio · ${this.mundo.titulo}`;
    for (const lado of Object.values(this.lados)) {
      lado.cargar({
        widget: this.mundo.metodo,
        metodo: this.mundo.metodo,
        opciones: { cualificaciones: this.sesion().estados?.mono?.cualificaciones },
        etiquetaHechos: this.mundo.metodo === 'argumentos' ? 'Premisas' : 'Hechos',
        preguntaVacia: 'Agrega información para empezar',
      });
    }
    this.render();
    await this.razonar(false);
  }

  async razonar(animar, dato) {
    const s = this.sesion();
    const token = (this.token = new Token());
    this.ocupado = animar;
    this.render();
    try {
      const r = await this.api.razonar(this.mundo.id, s.hechos, s.nombres);
      if (token.cancelado) return;
      // La cinta de «¿Y si…?» necesita la lista del motor
      for (const lado of Object.values(this.lados)) if (lado.widget?.op && r.mono.cualificaciones) lado.widget.op.cualificaciones = r.mono.cualificaciones;
      const previos = s.estados;
      if (animar && previos) {
        if (dato) await this.director.lanzarPaquete(dato, Object.values(this.lados).map((lado) => ({ lado })), token);
        await Promise.all(
          Object.entries(this.lados).map(async ([clave, lado], k) => {
            await esperar(k * 450, token);
            await lado.transicion(previos[clave], r[clave], token);
          }),
        );
      } else {
        for (const [clave, lado] of Object.entries(this.lados)) lado.fijar(r[clave], { historial: s.historial[clave], retiradas: s.retiradas[clave] });
      }
      s.estados = r;
      for (const [clave, lado] of Object.entries(this.lados)) {
        s.historial[clave] = [...lado.historial];
        s.retiradas[clave] = lado.retiradas;
      }
      this.aviso(`${s.hechos.length} hecho${s.hechos.length === 1 ? '' : 's'} · razonado en Node.js en ${(r.ms ?? 0).toFixed(2)} ms`);
    } catch (e) {
      if (e !== CANCELADO) {
        console.error(e);
        this.aviso(e.message, true);
      }
    } finally {
      if (this.token === token) {
        this.token = null;
        this.ocupado = false;
        this.render();
      }
    }
  }

  async agregar(lit, texto) {
    const s = this.sesion();
    if (this.ocupado || s.hechos.includes(lit)) return;
    s.hechos.push(lit);
    await this.razonar(true, { etiqueta: 'NUEVO DATO', texto });
  }

  reiniciar() {
    delete this.sesiones[this.mundo.id];
    this.elegir(this.mundo.id);
  }

  nuevaEntidad(nombre) {
    nombre = (nombre ?? '').trim().slice(0, 16);
    if (!nombre) return;
    const s = this.sesion();
    if (Object.keys(s.nombres).length >= 3) {
      this.aviso('Máximo 3 animales nuevos por sesión', true);
      return;
    }
    const base =
      nombre
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 14) || 'animal';
    let id = `e_${base}`;
    let k = 2;
    while (this.mundo.entidades[id] || s.nombres[id]) id = `e_${base}${k++}`;
    s.nombres[id] = nombre;
    s.sujeto = id;
    this.borrador = '';
    this.render();
  }

  clic(e) {
    const b = e.target.closest('button');
    e.stopPropagation();
    if (!b || b.disabled) return;
    if (b.dataset.mundo) this.elegir(b.dataset.mundo);
    else if (b.dataset.sujeto) {
      this.sesion().sujeto = b.dataset.sujeto;
      this.render();
    } else if (b.dataset.lit) this.agregar(b.dataset.lit, b.dataset.texto);
    else if (b.dataset.accion === 'reiniciar') this.reiniciar();
    else if (b.dataset.accion === 'salir') this.cerrar();
    else if (b.dataset.accion === 'nuevo') this.nuevaEntidad(this.el.querySelector('input')?.value);
  }

  aviso(texto, error = false) {
    const el = this.el.querySelector('.lab__aviso');
    if (!el) return;
    el.textContent = texto;
    el.classList.toggle('error', error);
  }

  render() {
    if (!this.mundo) return;
    const m = this.mundo;
    const s = this.sesion();
    const enfocado = document.activeElement?.matches?.('#laboratorio input');
    const aviso = this.el.querySelector('.lab__aviso');
    const avisoPrevio = aviso ? [aviso.textContent, aviso.classList.contains('error')] : ['', false];
    const pestanas = this.mundos
      .map((x) => `<button class="lab__pestana ${x.id === m.id ? 'activa' : ''}" data-mundo="${x.id}">${esc(NOMBRES[x.metodo] ?? x.titulo)}</button>`)
      .join('');
    let fila;
    if (m.entidadesLibres) {
      const nombres = { ...m.entidades, ...s.nombres };
      const sujetos = Object.entries(nombres)
        .map(([id, n]) => `<button class="lab__sujeto ${id === s.sujeto ? 'activo' : ''}" data-sujeto="${esc(id)}">${esc(n)}</button>`)
        .join('');
      const props = m.propiedades
        .map((p) => {
          const lit = `${p.pred}(${s.sujeto})`;
          const texto = p.plantilla.replace('{0}', nombres[s.sujeto]);
          const hecho = s.hechos.includes(lit);
          return `<button class="lab__hecho ${hecho ? 'agregado' : ''}" data-lit="${esc(lit)}" data-texto="${esc(texto)}" ${hecho || this.ocupado ? 'disabled' : ''}>${esc(texto)}</button>`;
        })
        .join('');
      fila = `<span class="lab__etiqueta">Sujeto</span><div class="lab__segmento">${sujetos}</div>
        <div class="lab__nuevo"><input maxlength="16" placeholder="Otro animal…" value="${esc(this.borrador)}" /><button data-accion="nuevo" title="Agregar animal">+</button></div>
        <span class="lab__etiqueta">Agregar</span><div class="lab__hechos">${props}</div>`;
    } else {
      const chips = m.hechos
        .map((h) => {
          const agregado = s.hechos.includes(h.lit);
          const choca = !agregado && (s.hechos.includes(negar(h.lit)) || h.incompatibles.some((i) => s.hechos.includes(i)));
          const titulo = choca ? 'Contradice un hecho que ya agregaste' : h.formal;
          return `<button class="lab__hecho ${agregado ? 'agregado' : ''}" data-lit="${esc(h.lit)}" data-texto="${esc(h.texto)}" title="${esc(titulo)}" ${
            agregado || choca || this.ocupado ? 'disabled' : ''
          }>${esc(h.texto)}</button>`;
        })
        .join('');
      fila = `<span class="lab__etiqueta">Agregar información</span><div class="lab__hechos">${chips}</div>`;
    }
    this.el.innerHTML = `
      <div class="lab__fila">
        <span class="lab__marca">LAB</span>
        <div class="lab__pestanas">${pestanas}</div>
        <span class="lab__aviso"></span>
        <div class="lab__acciones">
          <button class="lab__accion" data-accion="reiniciar">↺ Reiniciar</button>
          <button class="lab__accion" data-accion="salir">✕ Salir <kbd>Esc</kbd></button>
        </div>
      </div>
      <div class="lab__fila">${fila}</div>`;
    this.aviso(...avisoPrevio);
    if (enfocado) {
      const input = this.el.querySelector('input');
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    }
  }
}
