// Punto de entrada: escala el escenario, arranca el bucle de animación y conecta los controles.

import { $, Escala, Lienzo } from './util.js';
import { api } from './api.js';
import { Fondo } from './fondo.js';
import { FX } from './fx.js';
import { Lado } from './lado.js';
import { Director } from './director.js';
import { Laboratorio } from './laboratorio.js';
import { Sonido } from './audio.js';

const escenario = $('#escenario');
Escala.escenario = escenario;

function ajustar() {
  const s = Math.min(innerWidth / 1920, innerHeight / 1080);
  Escala.valor = s;
  escenario.style.transform = `translate(${(innerWidth - 1920 * s) / 2}px, ${(innerHeight - 1080 * s) / 2}px) scale(${s})`;
  Lienzo.reajustar();
}
ajustar();
addEventListener('resize', ajustar);

const fondo = new Fondo($('#fondo'));
const fx = new FX($('#fx'));
const lados = {
  mono: new Lado($('#lado-mono'), 'mono', fx),
  nomono: new Lado($('#lado-nomono'), 'nomono', fx),
};

// Bucle de animación
let anterior = performance.now();
function cuadro(ahora) {
  const dt = Math.min(0.05, Math.max(0, (ahora - anterior) / 1000));
  anterior = ahora;
  const t = ahora / 1000;
  fondo.dibujar(t, dt);
  lados.mono.dibujar(t, dt);
  lados.nomono.dibujar(t, dt);
  fx.dibujar(t, dt);
  requestAnimationFrame(cuadro);
}
requestAnimationFrame(cuadro);

// Indicador del motor de razonamiento (Node.js)
const $motor = $('#motor');
const $ms = $('#motor-ms');
api.alCambiar((e) => {
  $motor.classList.toggle('en-linea', e.enLinea);
  $motor.classList.toggle('caido', !e.enLinea);
  $ms.textContent = e.enLinea ? `${Math.max(1, Math.round(e.ms))} ms` : 'sin conexión';
  $motor.classList.remove('pulso');
  void $motor.offsetWidth;
  $motor.classList.add('pulso');
  setTimeout(() => $motor.classList.remove('pulso'), 350);
});
setInterval(() => api.salud().catch(() => {}), 5000);

escenario.classList.toggle('silencio', !Sonido.activo);

function leerHash() {
  const m = location.hash.match(/^#(\d+)(?:\.(\d+))?$/);
  return m ? [Number(m[1]) - 1, Number(m[2] ?? 1) - 1] : [0, 0];
}

function conectarControles(director, lab) {
  const ayuda = $('#ayuda');
  const controles = $('#controles');

  const accion = (a) => {
    Sonido.desbloquear();
    switch (a) {
      case 'siguiente':
        if (!lab.activo) director.siguiente();
        break;
      case 'anterior':
        if (!lab.activo) director.anterior();
        break;
      case 'auto':
        if (!lab.activo) director.alternarAuto();
        break;
      case 'lab':
        lab.alternar();
        break;
      case 'sonido':
        escenario.classList.toggle('silencio', !Sonido.alternar());
        break;
      case 'pantalla':
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen?.().catch(() => {});
        break;
      case 'ayuda':
        ayuda.hidden = !ayuda.hidden;
        break;
      case 'inicio':
        if (lab.activo) lab.cerrar();
        director.irA(0, 0, false);
        break;
    }
    controles.querySelector('[data-accion="lab"]').classList.toggle('activo', lab.activo);
  };

  document.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(k)) {
      e.preventDefault();
      accion('siguiente');
    } else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(k)) {
      e.preventDefault();
      accion('anterior');
    } else if (k === 'Home') accion('inicio');
    else if (k === 'End' && !lab.activo) director.irA(director.escenas.length - 1, 0, true);
    else if (/^[1-9]$/.test(k) && !lab.activo && Number(k) <= director.escenas.length) director.irA(Number(k) - 1, 0, true);
    else if (k === 'a' || k === 'A') accion('auto');
    else if (k === 'l' || k === 'L') accion('lab');
    else if (k === 'm' || k === 'M') accion('sonido');
    else if (k === 'f' || k === 'F') accion('pantalla');
    else if (k === 'h' || k === 'H' || k === '?') accion('ayuda');
    else if (k === 'Escape') {
      if (!ayuda.hidden) ayuda.hidden = true;
      else if (lab.activo) accion('lab');
    }
  });

  escenario.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-accion]');
    if (boton) {
      accion(boton.dataset.accion);
      return;
    }
    if (e.target.closest('#laboratorio, #controles, button, input')) return;
    if (!ayuda.hidden) {
      ayuda.hidden = true;
      return;
    }
    accion('siguiente');
  });

  // Los controles y el cursor se esconden solos para no estorbar en la proyección
  let reposo;
  const despertar = () => {
    controles.classList.remove('oculto');
    document.body.classList.remove('sin-cursor');
    clearTimeout(reposo);
    reposo = setTimeout(() => {
      if (controles.matches(':hover')) return;
      controles.classList.add('oculto');
      if (!lab.activo) document.body.classList.add('sin-cursor');
    }, 2800);
  };
  addEventListener('mousemove', despertar);
  despertar();
}

async function iniciar() {
  try {
    const presentacion = await api.presentacion();
    await document.fonts?.ready;
    const director = new Director({ presentacion, lados, fx });
    const lab = new Laboratorio({ api, lados, director });
    conectarControles(director, lab);
    const [e, p] = leerHash();
    await director.irA(e, p, false);
    $('#carga').classList.add('lista');
  } catch (err) {
    console.error(err);
    $('#carga-texto').innerHTML =
      'No se pudo conectar con el motor de razonamiento.<br>Inicia el servidor con <code>npm start</code> y abre <code>http://localhost:3000</code>.';
  }
}

iniciar();
