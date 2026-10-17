// Núcleo lógico compartido por todos los motores.
// Los literales son texto: 'ave(tweety)', '-vuela(tweety)' (negación clásica) o 'tormenta'.
// Las variables empiezan con mayúscula: X, Y, B...

const cacheAnalisis = new Map();

export function analizar(lit) {
  let r = cacheAnalisis.get(lit);
  if (r) return r;
  let s = lit.trim();
  let neg = false;
  if (s.startsWith('-')) {
    neg = true;
    s = s.slice(1);
  }
  const i = s.indexOf('(');
  const pred = i < 0 ? s : s.slice(0, i);
  const args = i < 0 ? [] : s.slice(i + 1, s.lastIndexOf(')')).split(',').map((a) => a.trim()).filter(Boolean);
  r = { neg, pred, args, clave: (neg ? '-' : '') + pred };
  if (cacheAnalisis.size > 5000) cacheAnalisis.clear();
  cacheAnalisis.set(lit, r);
  return r;
}

export const negar = (lit) => (lit.startsWith('-') ? lit.slice(1) : '-' + lit);
export const esVariable = (t) => /^[A-Z]/.test(t);
export const esFijo = (lit) => !analizar(lit).args.some(esVariable);

export function formar(neg, pred, args) {
  return (neg ? '-' : '') + pred + (args.length ? `(${args.join(',')})` : '');
}

export function sustituir(lit, s) {
  const a = analizar(lit);
  if (!a.args.some(esVariable)) return lit;
  return formar(a.neg, a.pred, a.args.map((t) => (esVariable(t) && s[t] !== undefined ? s[t] : t)));
}

// Empareja un patrón (con variables) contra un literal fijo. Devuelve la sustitución ampliada o null.
export function unificar(patron, hecho, s = {}) {
  const p = analizar(patron);
  const h = analizar(hecho);
  if (p.clave !== h.clave || p.args.length !== h.args.length) return null;
  let r = s;
  for (let k = 0; k < p.args.length; k++) {
    const t = p.args[k];
    const v = h.args[k];
    if (esVariable(t)) {
      const ya = r[t];
      if (ya === undefined) {
        if (r === s) r = { ...s };
        r[t] = v;
      } else if (ya !== v) return null;
    } else if (t !== v) return null;
  }
  return r;
}

// Condiciones del cuerpo de una regla:
//   'ave(X)'      el literal debe conocerse
//   'no ab(X)'    negación por fallo: no debe poder demostrarse
//   'nocree p'    autoepistémica: el agente NO cree p   (¬L p)
//   'cree p'      autoepistémica: el agente cree p      (L p)
export function condicion(c) {
  if (c.startsWith('no ')) return { tipo: 'no', lit: c.slice(3).trim() };
  if (c.startsWith('nocree ')) return { tipo: 'nocree', lit: c.slice(7).trim() };
  if (c.startsWith('cree ')) return { tipo: 'cree', lit: c.slice(5).trim() };
  return { tipo: 'si', lit: c };
}

const claves = (c) => (c instanceof Map ? c.keys() : c);

function existe(lit, conjunto) {
  if (esFijo(lit)) return conjunto.has(lit);
  for (const h of claves(conjunto)) if (unificar(lit, h)) return true;
  return false;
}

// Sustituciones que satisfacen un cuerpo, junto con los supuestos (negaciones por fallo) que se usaron.
export function satisfacer(cuerpo, conocido, creencias = new Set()) {
  let opciones = [{ s: {}, supuestos: [] }];
  for (const c of cuerpo) {
    const { tipo, lit } = condicion(c);
    const siguientes = [];
    for (const o of opciones) {
      if (tipo === 'si') {
        for (const h of claves(conocido)) {
          const r = unificar(lit, h, o.s);
          if (r) siguientes.push({ s: r, supuestos: o.supuestos });
        }
      } else {
        const g = sustituir(lit, o.s);
        const hay = existe(g, tipo === 'no' ? conocido : creencias);
        if (tipo === 'cree' ? hay : !hay) {
          siguientes.push({ s: o.s, supuestos: tipo === 'cree' ? o.supuestos : [...o.supuestos, `${tipo} ${g}`] });
        }
      }
    }
    opciones = siguientes;
    if (!opciones.length) break;
  }
  return opciones;
}

// Asigna a cada regla un estrato: una regla que niega por fallo un predicado
// se evalúa después de todas las reglas que lo producen (negación estratificada).
export function estratificar(reglas) {
  const est = {};
  const clave = (lit) => analizar(lit).clave;
  for (const r of reglas) est[clave(r.entonces)] ??= 0;
  let cambio = true;
  let vueltas = 0;
  while (cambio && vueltas++ < 60) {
    cambio = false;
    for (const r of reglas) {
      const h = clave(r.entonces);
      for (const c of r.si) {
        const { tipo, lit } = condicion(c);
        if (tipo === 'nocree' || tipo === 'cree') continue; // las creencias se fijan aparte
        const base = est[clave(lit)] ?? 0;
        const requerido = tipo === 'no' ? base + 1 : base;
        if (est[h] < requerido) {
          est[h] = requerido;
          cambio = true;
        }
      }
    }
  }
  return reglas.map((r) => est[clave(r.entonces)]);
}

// Encadenamiento hacia adelante hasta el punto fijo, estrato por estrato.
// conocimiento: Map literal -> { tipo: 'hecho' | 'segura' | 'supuesto', regla, origen, supuestos }
export function encadenar(conocimiento, reglas, opciones = {}) {
  const { creencias = new Set(), pasos = null, disparadas = null, motivos = null } = opciones;
  const estratos = estratificar(reglas);
  const niveles = [...new Set(estratos)].sort((a, b) => a - b);
  for (const nivel of niveles) {
    const grupo = reglas.filter((_, i) => estratos[i] === nivel);
    let cambio = true;
    while (cambio) {
      cambio = false;
      for (const r of grupo) {
        for (const { s, supuestos } of satisfacer(r.si, conocimiento, creencias)) {
          const cabeza = sustituir(r.entonces, s);
          const origen = r.si
            .map(condicion)
            .filter((c) => c.tipo === 'si')
            .map((c) => sustituir(c.lit, s));
          const provisional = supuestos.length > 0 || origen.some((o) => conocimiento.get(o)?.tipo === 'supuesto');
          disparadas?.add(r.id);
          if (motivos && r.motivo) {
            const m = sustituir(r.motivo, s);
            motivos[cabeza] ??= [];
            if (!motivos[cabeza].includes(m)) motivos[cabeza].push(m);
          }
          const previo = conocimiento.get(cabeza);
          if (!previo || (previo.tipo === 'supuesto' && !provisional)) {
            conocimiento.set(cabeza, { tipo: provisional ? 'supuesto' : 'segura', regla: r.id, origen, supuestos });
            pasos?.push({ regla: r, cabeza, supuestos, provisional });
            cambio = true;
          }
        }
      }
    }
  }
  return conocimiento;
}

// Literales p tales que se conocen p y ¬p a la vez.
export function contradicciones(conocimiento) {
  const r = [];
  for (const lit of claves(conocimiento)) {
    if (!lit.startsWith('-') && conocimiento.has('-' + lit)) r.push(lit);
  }
  return r;
}
