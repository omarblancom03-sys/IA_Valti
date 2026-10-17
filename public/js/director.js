// El director: lleva la presentación escena por escena y paso por paso.
// Avanzar un paso lo anima; retroceder o saltar lo muestra al instante.

import { $, esc, esperar, Token, CANCELADO, rectEnEscenario, COLORES } from './util.js';
import { Sonido } from './audio.js';

const cambio = (a, b) => !a || a.activo !== b.activo || a.hechos.map((h) => h.lit).join('|') !== b.hechos.map((h) => h.lit).join('|');

export class Director {
  constructor({ presentacion, lados, fx }) {
    this.escenas = presentacion.escenas;
    this.lados = lados;
    this.fx = fx;
    this.e = -1;
    this.p = -1;
    this.token = null;
    this.animando = false;
    this.auto = false;
    this.bloqueado = false;
    this.temporizador = null;
    this.$ = {
      escenario: $('#escenario'),
      texto: $('#narracion-texto'),
      pasos: $('#narracion-pasos'),
      titulo: $('#escena-titulo'),
      etiqueta: $('#escena-etiqueta'),
      progreso: $('#progreso'),
      tarjeta: $('#tarjeta'),
      final: $('#final'),
      paquete: $('#paquete'),
      barraAuto: $('#auto-barra i'),
    };
  }

  get escena() {
    return this.escenas[this.e];
  }

  get paso() {
    return this.escena.pasos[this.p];
  }

  // ─────────────── Navegación ───────────────

  siguiente() {
    if (this.bloqueado) return;
    if (this.animando) {
      this.completar();
      return;
    }
    if (this.p < this.escena.pasos.length - 1) this.irA(this.e, this.p + 1, true);
    else if (this.e < this.escenas.length - 1) this.irA(this.e + 1, 0, true);
    else this.detenerAuto();
  }

  anterior() {
    if (this.bloqueado) return;
    if (this.p > 0) this.irA(this.e, this.p - 1, false);
    else if (this.e > 0) this.irA(this.e - 1, this.escenas[this.e - 1].pasos.length - 1, false);
  }

  completar() {
    this.cancelar();
    this.animando = false;
    this.fijarPaso();
    this.programarAuto();
  }

  cancelar() {
    this.token?.cancelar();
    this.token = null;
  }

  async irA(e, p, animar) {
    e = Math.max(0, Math.min(this.escenas.length - 1, e));
    p = Math.max(0, Math.min(this.escenas[e].pasos.length - 1, p));
    this.cancelar();
    clearTimeout(this.temporizador);
    const cambiaEscena = e !== this.e;
    const avanzaUno = !cambiaEscena && p === this.p + 1;
    this.e = e;
    this.p = p;
    if (cambiaEscena) this.montar();
    this.hud();
    try {
      history.replaceState(null, '', `#${e + 1}.${p + 1}`);
    } catch {
      /* sin historial */
    }
    const token = (this.token = new Token());
    this.animando = true;
    try {
      if (animar && (avanzaUno || (cambiaEscena && p === 0))) await this.animarPaso(token);
      else this.fijarPaso();
    } catch (err) {
      if (err !== CANCELADO) {
        console.error(err);
        this.fijarPaso();
      }
    } finally {
      if (this.token === token) {
        this.token = null;
        this.animando = false;
        this.programarAuto();
      }
    }
  }

  // El laboratorio toma el control del escenario
  bloquear(si) {
    this.bloqueado = si;
    if (si) {
      this.detenerAuto();
      this.cancelar();
      this.animando = false;
      this.ocultarTarjeta(true);
      this.$.final.hidden = true;
      this.$.paquete.hidden = true;
      for (const lado of Object.values(this.lados)) lado.cola(null);
    } else {
      this.montar();
      this.hud();
      this.fijarPaso();
    }
  }

  // ─────────────── Montaje y estado de cada escena ───────────────

  montar() {
    const esc = this.escena;
    this.ocultarTarjeta(true);
    this.$.final.hidden = true;
    this.$.paquete.hidden = true;
    this.$.escenario.dataset.escena = esc.id;
    for (const [clave, lado] of Object.entries(this.lados)) lado.cargar(this.configLado(esc, clave));
    // Transición entre escenas
    const duelo = $('#duelo');
    duelo.classList.remove('entra');
    void duelo.offsetWidth;
    duelo.classList.add('entra');
  }

  configLado(esc, clave) {
    switch (esc.tipo) {
      case 'portada':
        return { widget: 'vacio' };
      case 'grafica':
        return { widget: 'grafica', opciones: { serie: esc.series[clave], paquetes: esc.paquetes }, etiquetaHechos: 'Datos recibidos' };
      case 'metodo': {
        const conCualif = esc.pasos.find((p) => p.estados.mono.cualificaciones);
        return {
          widget: esc.metodo,
          metodo: esc.metodo,
          opciones: { cualificaciones: conCualif?.estados.mono.cualificaciones },
          etiquetaHechos: esc.metodo === 'argumentos' ? 'Premisas' : 'Hechos',
        };
      }
      case 'conclusion':
        return {
          widget: 'resumen',
          opciones: { puntos: esc.resumen[clave].puntos },
          sinHechos: true,
          etiquetaConclusiones: clave === 'mono' ? 'Rasgos' : 'Métodos que vimos',
        };
      default:
        return { widget: 'vacio' };
    }
  }

  hud() {
    const esc = this.escena;
    this.$.titulo.textContent = esc.titulo;
    this.$.etiqueta.textContent = esc.etiqueta;
    this.$.progreso.textContent = `${this.e + 1} / ${this.escenas.length}`;
    this.$.pasos.innerHTML = esc.pasos.map((_, i) => `<i class="${i < this.p ? 'hecho' : i === this.p ? 'actual' : ''}"></i>`).join('');
  }

  narrar(texto, animar) {
    const el = this.$.texto;
    el.replaceChildren();
    if (!texto) return;
    // Palabra por palabra; lo que va entre «comillas» se resalta.
    let dentro = false;
    texto
      .split(/\s+/)
      .filter(Boolean)
      .forEach((palabra, i) => {
        if (palabra.includes('«')) dentro = true;
        const s = document.createElement('span');
        s.textContent = palabra;
        if (dentro) s.className = 'cita';
        if (palabra.includes('»')) dentro = false;
        if (animar) {
          s.classList.add('palabra');
          s.style.animationDelay = `${i * 0.035}s`;
        }
        el.append(s);
      });
  }

  fijarPaso() {
    const esc = this.escena;
    this.narrar(this.paso.narracion, false);
    this.$.paquete.hidden = true;
    this.$.escenario.classList.toggle('fase-portada', esc.tipo === 'portada' && this.p === 0);
    if (esc.tipo === 'portada') this.fijarPortada();
    else if (esc.tipo === 'grafica') this.fijarGrafica();
    else if (esc.tipo === 'metodo') this.fijarMetodo();
    else if (esc.tipo === 'conclusion') this.fijarConclusion();
  }

  async animarPaso(token) {
    const esc = this.escena;
    this.narrar(this.paso.narracion, true);
    if (esc.tipo === 'portada') return this.animarPortada(token);
    if (esc.tipo === 'grafica') return this.animarGrafica(token);
    if (esc.tipo === 'metodo') return this.animarMetodo(token);
    if (esc.tipo === 'conclusion') return this.animarConclusion(token);
  }

  // ─────────────── Portada ───────────────

  estadoPortada(clave) {
    const mono = clave === 'mono';
    return {
      activo: true,
      estado: 'estable',
      hechos: [],
      conclusiones: [],
      contradicciones: [],
      explosion: false,
      absurdas: [],
      traza: [{ tipo: 'info', texto: mono ? 'sistema deductivo listo · reglas estrictas cargadas' : 'red adaptativa lista · reglas por defecto cargadas' }],
      respuestas: [
        {
          id: 'tipo',
          pregunta: 'Tipo de razonamiento',
          valor: mono ? 'rasgo-mono' : 'rasgo-nm',
          textoValor: mono ? 'DEDUCTIVO' : 'DERROTABLE',
          detalle: mono ? 'sus conclusiones son definitivas' : 'sus conclusiones son provisionales',
        },
      ],
    };
  }

  fijarPortada() {
    for (const [clave, lado] of Object.entries(this.lados)) {
      lado.ponerWidget(this.p >= 2 ? 'perfil' : 'vacio', { items: this.escena.perfil[clave] });
      lado.fijar(this.estadoPortada(clave));
    }
  }

  async animarPortada(token) {
    this.$.escenario.classList.toggle('fase-portada', this.p === 0);
    if (this.p < 2) {
      this.fijarPortada();
      await esperar(this.p === 0 ? 400 : 1600, token);
      return;
    }
    for (const [clave, lado] of Object.entries(this.lados)) lado.ponerWidget('perfil', { items: this.escena.perfil[clave] });
    await esperar(1400, token);
  }

  // ─────────────── Gráfica de monotonía ───────────────

  estadoSerie(clave, hasta) {
    const esc = this.escena;
    const valores = esc.series[clave];
    let lista = [];
    let n = 0;
    for (let k = 1; k <= hasta; k++) {
      const delta = valores[k] - valores[k - 1];
      if (delta > 0) {
        for (let j = 0; j < delta; j++) {
          n++;
          lista.push({ lit: `c${n}`, texto: `Conclusión ${n}`, tipo: clave === 'mono' ? 'segura' : 'supuesto' });
        }
      } else lista = lista.slice(0, lista.length + delta);
    }
    return {
      activo: hasta > 0,
      estado: 'estable',
      hechos: esc.paquetes.slice(0, hasta).map((t, k) => ({ lit: `d${k}`, texto: t })),
      conclusiones: lista,
      contradicciones: [],
      explosion: false,
      absurdas: [],
      traza: esc.paquetes.slice(0, hasta).map((t, k) => {
        const d = valores[k + 1] - valores[k];
        const n = Math.abs(d);
        return { tipo: d < 0 ? 'retiro' : 'regla', texto: `${t.toLowerCase()} ⇒ ${d < 0 ? '−' : '+'}${n} ${n === 1 ? 'conclusión' : 'conclusiones'}` };
      }),
      respuestas: [
        { id: 'cuenta', pregunta: 'Conclusiones en este momento', valor: 'contador', textoValor: String(lista.length), detalle: clave === 'mono' ? 'nunca disminuye' : 'puede disminuir' },
      ],
    };
  }

  historiaSerie(clave, hasta) {
    const v = this.escena.series[clave];
    let retiradas = 0;
    for (let k = 1; k <= hasta; k++) retiradas += Math.max(0, v[k - 1] - v[k]);
    return { historial: v.slice(1, hasta + 1), retiradas };
  }

  fijarGrafica() {
    const paso = this.paso;
    for (const [clave, lado] of Object.entries(this.lados)) {
      lado.fijar(this.estadoSerie(clave, paso.hasta), this.historiaSerie(clave, paso.hasta));
      lado.widget.fijarHasta(paso.hasta, paso.formula);
    }
  }

  async animarGrafica(token) {
    const esc = this.escena;
    const desde = this.p > 0 ? esc.pasos[this.p - 1].hasta : 0;
    for (const [clave, lado] of Object.entries(this.lados)) {
      lado.fijar(this.estadoSerie(clave, desde), this.historiaSerie(clave, desde));
      lado.widget.fijarHasta(desde, false);
    }
    for (let i = desde + 1; i <= this.paso.hasta; i++) {
      const texto = esc.paquetes[i - 1];
      const dato = { etiqueta: texto === 'Excepción' ? 'EXCEPCIÓN' : 'NUEVO DATO', texto };
      await this.lanzarPaquete(dato, Object.values(this.lados).map((lado) => ({ lado })), token);
      await Promise.all(
        Object.entries(this.lados).map(async ([clave, lado], k) => {
          await esperar(k * 300, token);
          lado.widget.segmento(i, true);
          await lado.transicion(this.estadoSerie(clave, i - 1), this.estadoSerie(clave, i), token);
        }),
      );
    }
    if (this.paso.formula) {
      for (const lado of Object.values(this.lados)) lado.widget.formula(true);
      await esperar(900, token);
    }
  }

  // ─────────────── Escenas de método ───────────────

  historia(clave, hasta) {
    const historial = [];
    let retiradas = 0;
    let previo = null;
    for (let i = 0; i <= hasta; i++) {
      const s = this.escena.pasos[i].estados[clave];
      if (!s.activo || (previo && !cambio(previo, s))) continue;
      if (previo) {
        const quitadas = previo.conclusiones.filter((c) => !s.conclusiones.some((n) => n.lit === c.lit)).length;
        if (quitadas) {
          retiradas += quitadas;
          historial.push(previo.conclusiones.length - quitadas);
        }
      }
      historial.push(s.explosion ? Infinity : s.conclusiones.length);
      previo = s;
    }
    return { historial, retiradas };
  }

  fijarMetodo() {
    const paso = this.paso;
    if (paso.tarjeta) this.mostrarTarjeta(this.escena.tarjeta, false);
    else this.ocultarTarjeta(true);
    for (const [clave, lado] of Object.entries(this.lados)) {
      lado.fijar(paso.estados[clave], this.historia(clave, this.p));
      lado.cola(paso.espera === clave ? paso.dato : null);
    }
  }

  async animarMetodo(token) {
    const esc = this.escena;
    const paso = this.paso;
    const previo = this.p > 0 ? esc.pasos[this.p - 1] : null;
    if (paso.tarjeta) {
      for (const [clave, lado] of Object.entries(this.lados)) lado.fijar(paso.estados[clave], this.historia(clave, this.p));
      this.mostrarTarjeta(esc.tarjeta, true);
      Sonido.tarjeta();
      await esperar(1500, token);
      return;
    }
    if (previo?.tarjeta) {
      this.ocultarTarjeta(false);
      await esperar(750, token);
    }

    // El dato que estaba en cola entra por fin a la IA que esperaba
    for (const [clave, lado] of Object.entries(this.lados)) {
      if (previo?.espera === clave && cambio(previo.estados[clave], paso.estados[clave]) && lado.$.cola) {
        const r = rectEnEscenario(lado.$.cola);
        lado.cola(null);
        this.fx.orbe({ x: r.x + r.w / 2, y: r.y + r.h / 2 }, lado.puntoEntrada(false), lado.esMono ? COLORES.mono : COLORES.nm, 0.6);
      }
    }

    // El paquete de información baja por el haz central y se reparte
    if (paso.dato) {
      const destinos = [];
      for (const [clave, lado] of Object.entries(this.lados)) {
        const recibe = paso.espera === clave || (cambio(previo?.estados[clave], paso.estados[clave]) && previo?.espera !== clave);
        if (recibe) destinos.push({ lado, espera: paso.espera === clave });
      }
      await this.lanzarPaquete(paso.dato, destinos, token);
      for (const [clave, lado] of Object.entries(this.lados)) if (paso.espera === clave) lado.cola(paso.dato);
    }

    // Cada IA razona a su manera (la monótona primero)
    const tareas = [];
    let retraso = 0;
    for (const [clave, lado] of Object.entries(this.lados)) {
      const antes = previo?.estados[clave];
      const ahora = paso.estados[clave];
      if (antes && !cambio(antes, ahora)) continue;
      const d = retraso;
      retraso += 450;
      tareas.push(
        (async () => {
          await esperar(d, token);
          await lado.transicion(antes, ahora, token);
        })(),
      );
    }
    await Promise.all(tareas);
  }

  async lanzarPaquete(dato, destinos, token) {
    const el = this.$.paquete;
    el.innerHTML = `<div class="paquete__etiqueta">${esc(dato.etiqueta ?? 'NUEVO DATO')}</div><div class="paquete__texto">${esc(dato.texto)}</div>${
      dato.formal ? `<div class="paquete__formal">${esc(dato.formal)}</div>` : ''
    }`;
    el.getAnimations().forEach((a) => a.cancel());
    el.hidden = false;
    Sonido.dato();
    el.animate(
      [
        { opacity: 0, transform: 'translate(-50%, -26px) scale(.86)', filter: 'blur(8px)' },
        { opacity: 1, transform: 'translate(-50%, 0) scale(1)', filter: 'blur(0px)' },
      ],
      { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' },
    );
    try {
      await esperar(1600, token);
      const r = rectEnEscenario(el);
      const desde = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
      el.animate(
        [
          { opacity: 1, transform: 'translate(-50%, 0) scale(1)' },
          { opacity: 0, transform: 'translate(-50%, 10px) scale(.3)', filter: 'blur(6px)' },
        ],
        { duration: 380, easing: 'ease-in', fill: 'forwards' },
      );
      Sonido.paquete();
      this.fx.onda(desde.x, desde.y, COLORES.blanco, 140, 0.7);
      const viajes = destinos.map(({ lado, espera }) => this.fx.orbe(desde, lado.puntoEntrada(espera), lado.esMono ? COLORES.mono : COLORES.nm, 0.85));
      await Promise.race([Promise.all(viajes), new Promise((r) => setTimeout(r, 1300))]);
      if (token.cancelado) throw CANCELADO;
    } finally {
      el.hidden = true;
    }
  }

  mostrarTarjeta(t, animar) {
    const el = this.$.tarjeta;
    el.classList.remove('sale');
    el.classList.toggle('quieta', !animar);
    if (el.hidden || el.dataset.id !== t.numero) {
      el.dataset.id = t.numero;
      el.innerHTML = `<div class="tarjeta__panel">
        <div class="tarjeta__numero">${esc(t.numero)}</div>
        <div class="tarjeta__etiqueta">MÉTODO ${esc(t.numero)} · RAZONAMIENTO NO-MONÓTONO</div>
        <div class="tarjeta__titulo">${esc(t.titulo)}</div>
        <div class="tarjeta__ingles">${esc(t.ingles)} · ${esc(t.autor)}</div>
        <p class="tarjeta__definicion">${esc(t.definicion)}</p>
        <div class="tarjeta__formula"><code>${esc(t.formula)}</code><span>${esc(t.leyenda)}</span></div>
      </div>`;
    }
    el.hidden = false;
  }

  ocultarTarjeta(inmediato) {
    const el = this.$.tarjeta;
    if (el.hidden) return;
    if (inmediato) {
      el.hidden = true;
      el.classList.remove('sale');
      return;
    }
    el.classList.remove('quieta');
    el.classList.add('sale');
    setTimeout(() => {
      if (el.classList.contains('sale')) {
        el.hidden = true;
        el.classList.remove('sale');
      }
    }, 760);
  }

  // ─────────────── Conclusión ───────────────

  estadoConclusion(clave) {
    const r = this.escena.resumen[clave];
    const mono = clave === 'mono';
    const rasgos = mono ? ['Deductiva', 'Acumulativa', 'Rígida'] : ['Por defecto', 'Circunscripción', 'Autoepistémica', 'Negación por fallo', 'Argumentos'];
    return {
      activo: true,
      estado: 'estable',
      hechos: [],
      conclusiones: rasgos.map((t, i) => ({ lit: `r${i}`, texto: t, tipo: 'segura' })),
      contradicciones: [],
      explosion: false,
      absurdas: [],
      traza: [{ tipo: 'info', texto: mono ? 'monotonía: Γ ⊢ φ ⇒ Γ ∪ {ψ} ⊢ φ' : 'no-monotonía: Γ |∼ φ no garantiza Γ ∪ {ψ} |∼ φ' }],
      respuestas: [{ id: 'fuerte', pregunta: 'Su gran fortaleza', valor: mono ? 'rasgo-mono' : 'rasgo-nm', textoValor: r.palabra.toUpperCase(), detalle: r.detalle }],
    };
  }

  fijarConclusion() {
    for (const [clave, lado] of Object.entries(this.lados)) lado.fijar(this.estadoConclusion(clave));
    if (this.paso.final) this.mostrarFinal();
    else this.$.final.hidden = true;
  }

  async animarConclusion(token) {
    this.fijarConclusion();
    if (this.paso.final) Sonido.tarjeta();
    await esperar(1200, token);
  }

  mostrarFinal() {
    const el = this.$.final;
    el.innerHTML = `
      <div class="final__tema">Tema 2.7 · Conocimiento no-monótono y otras lógicas</div>
      <div class="final__frase">Razonar también es saber cambiar de opinión.</div>
      <p class="final__sub">La IA monótona garantiza certeza en la deducción; la no-monótona permite adaptarse a un mundo lleno de excepciones.</p>
      <div class="final__botones">
        <button class="boton boton--brillo" data-accion="lab">Abrir el laboratorio <kbd>L</kbd></button>
        <button class="boton" data-accion="inicio">Volver al inicio <kbd>Inicio</kbd></button>
      </div>`;
    el.hidden = false;
  }

  // ─────────────── Reproducción automática ───────────────

  alternarAuto() {
    if (this.auto) this.detenerAuto();
    else {
      this.auto = true;
      this.$.escenario.classList.add('auto-activo');
      if (!this.animando) this.programarAuto();
    }
  }

  detenerAuto() {
    this.auto = false;
    clearTimeout(this.temporizador);
    this.$.escenario.classList.remove('auto-activo');
    this.$.barraAuto.getAnimations().forEach((a) => a.cancel());
  }

  programarAuto() {
    clearTimeout(this.temporizador);
    this.$.barraAuto.getAnimations().forEach((a) => a.cancel());
    if (!this.auto || this.bloqueado) return;
    const ultimo = this.e === this.escenas.length - 1 && this.p === this.escena.pasos.length - 1;
    if (ultimo) {
      this.detenerAuto();
      return;
    }
    const paso = this.paso;
    const ms = paso.duracion ?? Math.max(4200, 1500 + (paso.narracion?.length ?? 0) * 40);
    this.$.barraAuto.animate([{ width: '0%' }, { width: '100%' }], { duration: ms, fill: 'forwards' });
    this.temporizador = setTimeout(() => this.siguiente(), ms);
  }
}
