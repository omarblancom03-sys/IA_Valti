// Efectos de sonido sintetizados con WebAudio (no usa archivos). Apagado por defecto: tecla M.

let ctx = null;
let maestro = null;
let bufferRuido = null;
let activo = false;
try {
  activo = localStorage.getItem('ia-sonido') === '1';
} catch {
  /* sin almacenamiento: se queda apagado */
}

function asegurar() {
  if (!activo) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const compresor = ctx.createDynamicsCompressor();
    maestro = ctx.createGain();
    maestro.gain.value = 0.32;
    // Eco corto para dar «espacio»
    const eco = ctx.createDelay();
    eco.delayTime.value = 0.18;
    const retro = ctx.createGain();
    retro.gain.value = 0.22;
    maestro.connect(compresor);
    maestro.connect(eco);
    eco.connect(retro).connect(eco);
    retro.connect(compresor);
    compresor.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tono({ f = 440, f2 = null, dur = 0.3, tipo = 'sine', vol = 0.2, ataque = 0.008, retardo = 0, filtro = null }) {
  const c = asegurar();
  if (!c) return;
  const t = c.currentTime + retardo;
  const o = c.createOscillator();
  o.type = tipo;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let salida = o;
  if (filtro) {
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = filtro;
    o.connect(fl);
    salida = fl;
  }
  salida.connect(g).connect(maestro);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function ruido({ dur = 0.4, tipo = 'bandpass', f = 1000, f2 = null, q = 1, vol = 0.2, retardo = 0 }) {
  const c = asegurar();
  if (!c) return;
  if (!bufferRuido) {
    bufferRuido = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = bufferRuido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime + retardo;
  const s = c.createBufferSource();
  s.buffer = bufferRuido;
  const fl = c.createBiquadFilter();
  fl.type = tipo;
  fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl).connect(g).connect(maestro);
  s.start(t);
  s.stop(t + dur + 0.05);
}

export const Sonido = {
  get activo() {
    return activo;
  },
  alternar() {
    activo = !activo;
    try {
      localStorage.setItem('ia-sonido', activo ? '1' : '0');
    } catch {
      /* ignorar */
    }
    if (activo) this.dato();
    else ctx?.suspend();
    return activo;
  },
  desbloquear() {
    if (activo) asegurar();
  },
  dato() {
    tono({ f: 880, f2: 1320, dur: 0.22, vol: 0.12 });
    tono({ f: 1760, dur: 0.18, tipo: 'triangle', vol: 0.05, retardo: 0.06 });
  },
  paquete() {
    ruido({ dur: 0.6, f: 500, f2: 3200, q: 2, vol: 0.08 });
  },
  conclusion(provisional) {
    tono({ f: provisional ? 784 : 659, dur: 0.4, tipo: 'triangle', vol: 0.09 });
    tono({ f: provisional ? 1175 : 988, dur: 0.5, vol: 0.05, retardo: 0.08 });
  },
  retirar() {
    tono({ f: 900, f2: 180, dur: 0.75, vol: 0.1 });
    ruido({ dur: 0.5, tipo: 'highpass', f: 3000, vol: 0.03 });
  },
  alarma() {
    for (let i = 0; i < 3; i++) tono({ f: 230, f2: 180, dur: 0.12, tipo: 'square', vol: 0.06, retardo: i * 0.16, filtro: 1500 });
  },
  glitch() {
    for (let i = 0; i < 8; i++) tono({ f: 80 + Math.random() * 1500, dur: 0.05, tipo: 'square', vol: 0.05, retardo: i * 0.045, filtro: 3000 });
  },
  explosion() {
    ruido({ dur: 1.9, tipo: 'lowpass', f: 3200, f2: 60, q: 0.7, vol: 0.4 });
    tono({ f: 120, f2: 28, dur: 1.6, tipo: 'sawtooth', vol: 0.18, filtro: 600 });
  },
  escaneo() {
    tono({ f: 300, f2: 1400, dur: 0.9, tipo: 'sawtooth', vol: 0.03, filtro: 1800 });
  },
  indeciso() {
    tono({ f: 440, dur: 0.8, vol: 0.06 });
    tono({ f: 466, dur: 0.8, vol: 0.06 });
  },
  congelar() {
    ruido({ dur: 1.4, tipo: 'highpass', f: 6000, f2: 2000, vol: 0.05 });
    tono({ f: 1400, f2: 700, dur: 1.2, vol: 0.03 });
  },
  tarjeta() {
    [261.6, 329.6, 392, 523.3].forEach((f, i) => tono({ f, dur: 1.8, vol: 0.035, ataque: 0.35, retardo: i * 0.06 }));
  },
};
