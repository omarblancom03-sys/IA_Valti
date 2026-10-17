// Motores de razonamiento.
//  · razonarMonotono: deducción clásica. Nunca retira nada; si se contradice, explota (ex falso quodlibet).
//  · Motores no-monótonos: lógica por defecto, circunscripción, lógica autoepistémica,
//    negación por fallo y argumentación (semántica fundamentada de Dung).
// Todos devuelven el mismo "estado" normalizado que la animación sabe dibujar.

import { analizar, negar, sustituir, unificar, satisfacer, encadenar, contradicciones, condicion } from './logica.js';

// ─────────────────────────────── Textos ───────────────────────────────

const nombreDe = (ctx, id) => ctx.nombres[id] ?? id;

export function textoDe(ctx, lit) {
  const a = analizar(lit);
  const p = ctx.mundo.predicados[a.pred];
  if (!p) return lit;
  const plantilla = a.neg ? (p.neg ?? `No: ${p.texto}`) : p.texto;
  return plantilla.replace(/\{(\d)\}/g, (_, i) => nombreDe(ctx, a.args[+i]));
}

export function formalDe(ctx, lit) {
  const a = analizar(lit);
  const p = ctx.mundo.predicados[a.pred] ?? {};
  if (p.prolog) return `${a.neg ? '-' : ''}${a.pred}(${a.args.join(', ')})`;
  const nombre = p.formal ?? a.pred;
  const args = a.args.map((x) => ctx.mundo.formalEntidad?.[x] ?? nombreDe(ctx, x));
  return `${a.neg ? '¬' : ''}${nombre}${args.length ? `(${args.join(', ')})` : ''}`;
}

const describir = (ctx, lit) => ({ lit, texto: textoDe(ctx, lit), formal: formalDe(ctx, lit) });

// ─────────────────────────────── Contexto ───────────────────────────────

function preparar(mundo, lado, entrada = {}) {
  const modo = entrada.modo === 'lab' ? 'lab' : 'escena';
  const nombres = { ...mundo.entidades, ...(entrada.nombres ?? {}) };
  const base = mundo.base ?? [];
  const usuario = [...new Set(entrada.hechos ?? [])];
  const hechos = [...new Set([...base, ...usuario])];
  return { mundo, lado, modo, nombres, base, usuario, hechos, activo: entrada.activo !== false };
}

function reglasDe(ctx, lado) {
  const { mundo, modo } = ctx;
  if (mundo.argumentos && lado === 'mono') {
    // La monótona trata cada argumento como una regla estricta: premisa → conclusión.
    return mundo.argumentos.map((a) => ({
      id: a.id,
      si: [a.premisa],
      entonces: a.conclusion,
      texto: a.texto,
      formal: `${a.premisa} → ${a.conclusion}`,
    }));
  }
  const mono = [...mundo.reglasMono, ...(modo === 'lab' ? (mundo.lab?.reglasMono ?? []) : [])];
  if (lado === 'mono') return mono;
  const porId = Object.fromEntries(mono.map((r) => [r.id, r]));
  const lista = [...(mundo.reglasNoMono ?? []), ...(modo === 'lab' ? (mundo.lab?.reglasNoMono ?? []) : [])];
  return lista.map((r) => (typeof r === 'string' ? porId[r] : r)).filter(Boolean);
}

function preguntasDe(ctx) {
  const { mundo, modo } = ctx;
  const lista = [...mundo.preguntas, ...(modo === 'lab' ? (mundo.lab?.preguntas ?? []) : [])];
  const r = [];
  for (const q of lista) {
    if (!q.porEntidad) {
      r.push({ id: q.id, lit: q.lit, texto: q.texto });
      continue;
    }
    let entidades = modo === 'escena' ? mundo.escena?.entidades : null;
    if (!entidades) {
      entidades = [];
      for (const h of ctx.usuario) for (const x of analizar(h).args) if (!entidades.includes(x)) entidades.push(x);
    }
    for (const e of entidades) {
      r.push({ id: `${q.id}-${e}`, lit: sustituir(q.patron, { X: e }), texto: q.texto.replace('{0}', nombreDe(ctx, e)) });
    }
  }
  return r;
}

const conocimientoInicial = (ctx) => new Map(ctx.hechos.map((h) => [h, { tipo: 'hecho', origen: [], supuestos: [] }]));
const oculto = (ctx, lit) => (ctx.mundo.ocultos ?? []).includes(analizar(lit).pred);

function textoRegla(reglas, id) {
  const r = reglas.find((x) => x.id === id);
  return r ? r.texto : id;
}

function listaConclusiones(ctx, K, reglas, tipoForzado) {
  const r = [];
  for (const [lit, info] of K) {
    if (info.tipo === 'hecho' || oculto(ctx, lit)) continue;
    r.push({ ...describir(ctx, lit), tipo: tipoForzado ?? info.tipo, regla: info.regla, reglaTexto: textoRegla(reglas, info.regla), origen: info.origen ?? [] });
  }
  return r;
}

function hechosVisibles(ctx) {
  return ctx.hechos.map((h) => ({ ...describir(ctx, h), base: ctx.base.includes(h) }));
}

function trazaHechos(ctx) {
  return ctx.usuario.map((h) => ({ tipo: 'hecho', texto: `hecho · ${textoDe(ctx, h)}` }));
}

function reglasVisibles(reglas, disparadas = new Set(), conflicto = new Set()) {
  return reglas
    .filter((r) => r.visible)
    .map((r) => ({
      id: r.id,
      texto: r.texto,
      formal: r.formal,
      estado: conflicto.has(r.id) ? 'conflicto' : disparadas.has(r.id) ? 'disparada' : 'inactiva',
    }));
}

function absurdosDe(ctx, choque) {
  const sujeto = choque ? analizar(choque).args[0] : null;
  const nombre = sujeto ? nombreDe(ctx, sujeto) : Object.values(ctx.nombres)[0] ?? 'Todo';
  return ctx.mundo.absurdos.map((t) => t.replace('{0}', nombre));
}

// Agrega los resultados de varias extensiones (o expansiones): escepticismo.
function agregar(ctx, mundos, reglas) {
  const union = new Map();
  for (const K of mundos) for (const [lit, info] of K) if (!union.has(lit)) union.set(lit, info);
  const conclusiones = [];
  for (const [lit, info] of union) {
    if (info.tipo === 'hecho' || oculto(ctx, lit)) continue;
    const enTodas = mundos.every((K) => K.has(lit));
    const tipo = !enTodas ? 'indecisa' : mundos.every((K) => K.get(lit).tipo === 'segura') ? 'segura' : 'supuesto';
    conclusiones.push({ ...describir(ctx, lit), tipo, regla: info.regla, reglaTexto: textoRegla(reglas, info.regla), origen: info.origen ?? [] });
  }
  return conclusiones;
}

function responder(ctx, preguntas, mundos, reglas, detalleSupuesto) {
  return preguntas.map((q) => {
    const si = mundos.every((K) => K.has(q.lit));
    const no = mundos.every((K) => K.has(negar(q.lit)));
    const algo = mundos.some((K) => K.has(q.lit) || K.has(negar(q.lit)));
    const base = { id: q.id, pregunta: q.texto, lit: q.lit };
    if (si || no) {
      const lit = si ? q.lit : negar(q.lit);
      const provisional = mundos.some((K) => K.get(lit).tipo === 'supuesto');
      const info = mundos[0].get(lit);
      return {
        ...base,
        valor: si ? 'si' : 'no',
        provisional,
        detalle: provisional ? detalleSupuesto : `deducción · ${textoRegla(reglas, info.regla)}`,
      };
    }
    if (algo) return { ...base, valor: 'indeciso', provisional: true, detalle: 'reglas en conflicto · falta información' };
    return { ...base, valor: 'desconocido', provisional: false, detalle: 'no hay información suficiente' };
  });
}

// ─────────────────────────────── IA monótona ───────────────────────────────

const DETALLE_MONO = {
  si: 'deducción · definitiva',
  no: 'deducción · definitiva',
  desconocido: 'no puede demostrarlo ni refutarlo',
  contradiccion: 'deduce las dos cosas a la vez',
};

function pendientesDe(ctx, reglas, K, preguntas) {
  const r = [];
  for (const q of preguntas) {
    for (const regla of reglas) {
      const s = unificar(regla.entonces, q.lit);
      if (!s) continue;
      for (const c of regla.si.map(condicion)) {
        if (c.tipo !== 'si') continue;
        const g = sustituir(c.lit, s);
        if (!K.has(g) && !r.some((x) => x.lit === g)) r.push(describir(ctx, g));
      }
    }
  }
  return r;
}

function motorMonotono(ctx) {
  const { mundo } = ctx;
  const reglas = reglasDe(ctx, 'mono');
  const K = conocimientoInicial(ctx);
  const pasos = [];
  const disparadas = new Set();
  encadenar(K, reglas, { pasos, disparadas });

  const choques = contradicciones(K);
  const explosion = choques.length > 0;
  const preguntas = preguntasDe(ctx);
  const respuestas = preguntas.map((q) => {
    let valor = 'desconocido';
    if (explosion) valor = 'contradiccion';
    else if (K.has(q.lit)) valor = 'si';
    else if (K.has(negar(q.lit))) valor = 'no';
    return { id: q.id, pregunta: q.texto, lit: q.lit, valor, provisional: false, detalle: DETALLE_MONO[valor] };
  });

  const sinRespuesta = preguntas.filter((q, i) => respuestas[i].valor === 'desconocido');
  const pendientes = explosion ? [] : pendientesDe(ctx, reglas, K, sinRespuesta);

  let estado = 'estable';
  if (explosion) estado = 'contradiccion';
  else if (sinRespuesta.length) estado = pendientes.length && mundo.atasco === 'paralizada' ? 'paralizada' : 'desconocido';

  // Reglas que participan en la contradicción
  const enConflicto = new Set();
  for (const p of pasos) if (choques.some((c) => c === p.cabeza || negar(c) === p.cabeza)) enConflicto.add(p.regla.id);

  const traza = [
    ...trazaHechos(ctx),
    ...pasos.map((p) => ({ tipo: 'regla', texto: `${p.regla.id} · ${p.regla.texto} ⇒ ${textoDe(ctx, p.cabeza)}` })),
  ];

  const estadoFinal = {
    lado: 'mono',
    metodo: 'monotono',
    mundo: mundo.id,
    activo: true,
    estado,
    hechos: hechosVisibles(ctx),
    conclusiones: listaConclusiones(ctx, K, reglas, 'segura'),
    respuestas,
    explosion,
    contradicciones: choques.map((c) => ({ lit: c, texto: `${textoDe(ctx, c)} ∧ ${textoDe(ctx, negar(c))}` })),
    absurdas: explosion ? absurdosDe(ctx, choques[0]) : [],
    pendientes,
    reglas: reglasVisibles(reglas, disparadas, enConflicto),
    traza,
  };

  // Datos específicos para el panel de cada escena
  if (mundo.metodo === 'circunscripcion') {
    estadoFinal.cualificaciones = mundo.cualificaciones;
    estadoFinal.condiciones = condicionesDe(ctx, reglas, K, preguntas);
  }
  if (mundo.metodo === 'autoepistemica') {
    estadoFinal.condiciones = condicionesDe(ctx, reglas, K, preguntas);
  }
  if (mundo.metodo === 'negacion') {
    estadoFinal.db = baseDeDatos(ctx, K, preguntas, 'mono');
    for (const b of estadoFinal.db.busquedas) {
      traza.push({ tipo: 'info', texto: `${b.consulta}  → ${b.resultado === 'si' ? 'demostrado' : b.resultado === 'no' ? 'refutado' : 'no demostrable'}` });
    }
    if (estadoFinal.db.busquedas.some((b) => b.resultado === 'desconocido')) {
      traza.push({ tipo: 'alerta', texto: 'mundo abierto · lo no demostrado queda desconocido' });
    }
  }
  if (mundo.metodo === 'argumentos') {
    estadoFinal.argumentos = mundo.argumentos
      .filter((a) => ctx.hechos.includes(a.premisa))
      .map((a) => ({ id: a.id, texto: a.texto, conclusion: textoDe(ctx, a.conclusion), etiqueta: 'IN', pos: a.pos }));
    estadoFinal.ataques = [];
  }

  if (pendientes.length) {
    traza.push({ tipo: 'alerta', texto: `no puedo demostrar: ${pendientes.map((p) => p.formal).join(', ')}` });
  }
  if (explosion) {
    traza.push({ tipo: 'alerta', texto: `⚠ contradicción · ${estadoFinal.contradicciones[0].texto}` });
    traza.push({ tipo: 'alerta', texto: 'ex falso quodlibet · de una contradicción se deduce cualquier cosa' });
  }
  return estadoFinal;
}

// Condiciones del cuerpo de la regla principal (para mostrar qué le falta demostrar a la monótona)
function condicionesDe(ctx, reglas, K, preguntas) {
  const principal = reglas.find((r) => r.visible);
  if (!principal) return [];
  const q = preguntas.find((p) => unificar(principal.entonces, p.lit));
  const s = q ? unificar(principal.entonces, q.lit) : {};
  return principal.si
    .map(condicion)
    .filter((c) => c.tipo === 'si')
    .map((c) => {
      const g = sustituir(c.lit, s);
      return { ...describir(ctx, g), demostrada: K.has(g), refutada: K.has(negar(g)) };
    });
}

// ─────────────────────────────── Lógica por defecto (Reiter) ───────────────────────────────

function motorDefecto(ctx) {
  const { mundo } = ctx;
  const estrictas = reglasDe(ctx, 'nomono');
  const defectos = mundo.defectos;
  const pasosBase = [];
  const base = encadenar(conocimientoInicial(ctx), estrictas, { pasos: pasosBase });

  // Se construyen todas las extensiones aplicando reglas por defecto mientras su justificación sea consistente.
  const extensiones = [];
  const vistos = new Set();
  const explorar = (E, aplicados) => {
    const clave = [...E.keys()].sort().join('|');
    if (vistos.has(clave)) return;
    vistos.add(clave);
    const candidatos = [];
    for (const d of defectos) {
      for (const { s } of satisfacer(d.pre, E)) {
        const cons = sustituir(d.cons, s);
        const justs = d.just.map((j) => sustituir(j, s));
        if (E.has(cons) || justs.some((j) => E.has(negar(j)))) continue;
        const E2 = new Map(E);
        E2.set(cons, { tipo: 'supuesto', regla: d.id, origen: d.pre.map((p) => sustituir(p, s)), supuestos: justs });
        encadenar(E2, estrictas);
        if (contradicciones(E2).length) continue; // suponerlo llevaría a una contradicción: está bloqueada
        candidatos.push({ E2, aplicado: { d, s, cons, justs } });
      }
    }
    if (!candidatos.length) {
      if (aplicados.every((a) => a.justs.every((j) => !E.has(negar(j))))) extensiones.push(E);
      return;
    }
    for (const c of candidatos) explorar(c.E2, [...aplicados, c.aplicado]);
  };

  const inconsistente = contradicciones(base).length > 0;
  if (!inconsistente) explorar(base, []);
  const mundos = extensiones.length ? extensiones : [base];
  const preguntas = preguntasDe(ctx);
  const respuestas = inconsistente
    ? preguntas.map((q) => ({ id: q.id, pregunta: q.texto, lit: q.lit, valor: 'contradiccion', provisional: false, detalle: 'los hechos se contradicen' }))
    : responder(ctx, preguntas, mundos, [...estrictas, ...defectos], 'supuesto por defecto · puede retirarse');

  // Instancias de cada regla por defecto: aplicada, bloqueada o en conflicto
  const union = new Map();
  for (const K of mundos) for (const [l, i] of K) if (!union.has(l)) union.set(l, i);
  const instancias = [];
  for (const d of defectos) {
    for (const { s } of satisfacer(d.pre, union)) {
      const cons = sustituir(d.cons, s);
      const justs = d.just.map((j) => sustituir(j, s));
      const bloqueo = justs.map(negar).find((nj) => mundos.every((K) => K.has(nj)));
      const aplicada = mundos.every((K) => K.has(cons) && K.get(cons).regla === d.id);
      const entidad = Object.values(s)[0];
      instancias.push({
        id: d.id,
        entidad,
        nombre: nombreDe(ctx, entidad),
        prerrequisito: formalDe(ctx, sustituir(d.pre[0], s)),
        justificacion: formalDe(ctx, justs[0]),
        consecuencia: formalDe(ctx, cons),
        consecuenciaTexto: textoDe(ctx, cons),
        estado: bloqueo ? 'bloqueada' : aplicada ? 'aplicada' : mundos.some((K) => K.has(cons)) ? 'conflicto' : 'bloqueada',
        razon: bloqueo ? textoDe(ctx, bloqueo) : null,
      });
    }
  }

  const traza = [...trazaHechos(ctx), ...pasosBase.map((p) => ({ tipo: 'regla', texto: `${p.regla.id} · ${p.regla.texto} ⇒ ${textoDe(ctx, p.cabeza)}` }))];
  for (const i of instancias) {
    const pregunta = `${i.id} · ¿es consistente suponer que ${i.consecuenciaTexto}?`;
    if (i.estado === 'aplicada') {
      traza.push({ tipo: 'ok', texto: `${pregunta} sí` });
      traza.push({ tipo: 'supuesto', texto: `${i.id} · supongo: ${i.consecuenciaTexto}` });
    } else if (i.estado === 'bloqueada') {
      traza.push({ tipo: 'alerta', texto: `${pregunta} no` });
      traza.push({ tipo: 'bloqueo', texto: i.razon ? `${i.id} · bloqueada: ya se sabe que ${i.razon}` : `${i.id} · bloqueada` });
    } else {
      traza.push({ tipo: 'bloqueo', texto: `${i.id} · en conflicto con otra regla por defecto` });
    }
  }

  const d = defectos[0];
  return {
    lado: 'nomono',
    metodo: 'defecto',
    mundo: mundo.id,
    activo: true,
    estado: inconsistente ? 'contradiccion' : respuestas.some((r) => r.valor === 'indeciso') ? 'indeciso' : 'estable',
    hechos: hechosVisibles(ctx),
    conclusiones: agregar(ctx, mundos, [...estrictas, ...defectos]),
    respuestas,
    explosion: false,
    contradicciones: [],
    absurdas: [],
    pendientes: [],
    reglas: reglasVisibles(estrictas),
    defecto: { id: d.id, texto: d.texto, formal: d.formal },
    instancias,
    extensiones: mundos.length,
    traza,
  };
}

// ─────────────────────────────── Circunscripción (McCarthy) ───────────────────────────────

function motorCircunscripcion(ctx) {
  const { mundo } = ctx;
  const reglas = reglasDe(ctx, 'nomono');
  const pasos = [];
  const disparadas = new Set();
  const motivos = {};
  // Las reglas con "no ab(x)" se evalúan en un estrato superior: primero se deriva el Ab mínimo,
  // después se supone ¬Ab para todo lo demás (eso es minimizar la extensión de Ab).
  const K = encadenar(conocimientoInicial(ctx), reglas, { pasos, disparadas, motivos });
  const { predicado, tipo } = mundo.circ;

  const entidades = [];
  for (const h of ctx.hechos) {
    const a = analizar(h);
    if (a.pred === tipo && !a.neg && !entidades.includes(a.args[0])) entidades.push(a.args[0]);
  }
  const ab = [...K.keys()]
    .filter((l) => {
      const a = analizar(l);
      return a.pred === predicado && !a.neg;
    })
    .map((l) => {
      const e = analizar(l).args[0];
      const m = motivos[l] ?? [];
      return { lit: l, entidad: e, nombre: nombreDe(ctx, e), formal: formalDe(ctx, l), razones: m.map((x) => textoDe(ctx, x)), razonesFormal: m.map((x) => formalDe(ctx, x)) };
    });
  const supuestos = [];
  for (const info of K.values()) for (const s of info.supuestos ?? []) if (!supuestos.includes(s)) supuestos.push(s);
  const supuestosFormales = supuestos.map((s) => `¬${formalDe(ctx, s.replace(/^no /, ''))}`);

  const preguntas = preguntasDe(ctx);
  const respuestas = responder(ctx, preguntas, [K], reglas, 'suponiendo que nada es anormal');
  for (const r of respuestas) {
    if (r.valor === 'no' && ab.length) r.detalle = `anomalía: ${ab.flatMap((x) => x.razones).join(', ').toLowerCase()}`;
    if (r.valor === 'desconocido') r.detalle = 'todavía no hay bote';
  }

  const minimo = ab.length ? `{${ab.map((x) => mundo.formalEntidad?.[x.entidad] ?? x.nombre).join(', ')}}` : '∅';
  const conNaf = (p) => p.regla.si.some((c) => c.startsWith('no '));
  const derivaAb = (p) => analizar(p.cabeza).pred === predicado;
  const traza = [
    ...trazaHechos(ctx),
    ...pasos.filter(derivaAb).map((p) => ({ tipo: 'regla', texto: `${p.regla.id} · ${p.regla.texto} ⇒ ${formalDe(ctx, p.cabeza)}` })),
  ];
  if (entidades.length) traza.push({ tipo: 'info', texto: `circunscripción · minimizo Ab ⇒ Ab = ${minimo}` });
  for (const p of pasos.filter((x) => !derivaAb(x) && !conNaf(x))) {
    traza.push({ tipo: 'regla', texto: `${p.regla.id} · ${p.regla.texto} ⇒ ${textoDe(ctx, p.cabeza)}` });
  }
  for (const p of pasos.filter(conNaf)) {
    traza.push({ tipo: 'supuesto', texto: `${p.regla.id} · supongo ${supuestosFormales.join(', ')} ⇒ ${textoDe(ctx, p.cabeza)}` });
  }

  return {
    lado: 'nomono',
    metodo: 'circunscripcion',
    mundo: mundo.id,
    activo: true,
    estado: 'estable',
    hechos: hechosVisibles(ctx),
    conclusiones: listaConclusiones(ctx, K, reglas),
    respuestas,
    explosion: false,
    contradicciones: [],
    absurdas: [],
    pendientes: [],
    reglas: reglasVisibles(reglas, disparadas),
    circ: {
      predicado: 'Ab',
      entidades: entidades.map((e) => ({ id: e, nombre: nombreDe(ctx, e), formal: mundo.formalEntidad?.[e] ?? nombreDe(ctx, e) })),
      ab,
      minimo: entidades.length ? minimo : null,
      supuestos: supuestosFormales,
    },
    traza,
  };
}

// ─────────────────────────────── Lógica autoepistémica (Moore) ───────────────────────────────

function motorAutoepistemico(ctx) {
  const { mundo } = ctx;
  const reglas = reglasDe(ctx, 'nomono');
  const atomos = [];
  for (const r of reglas) {
    for (const c of r.si.map(condicion)) if ((c.tipo === 'cree' || c.tipo === 'nocree') && !atomos.includes(c.lit)) atomos.push(c.lit);
  }
  // Expansiones estables: se prueban todas las combinaciones de creencias y se conservan
  // las que coinciden con lo que finalmente se deduce (L p es verdadero ⇔ p está en la expansión).
  const expansiones = [];
  for (let m = 0; m < 1 << atomos.length; m++) {
    const creencias = new Set(atomos.filter((_, i) => m & (1 << i)));
    const pasos = [];
    const K = encadenar(conocimientoInicial(ctx), reglas, { creencias, pasos });
    if (atomos.every((p) => K.has(p) === creencias.has(p)) && !contradicciones(K).length) expansiones.push({ K, creencias, pasos });
  }
  const inconsistente = expansiones.length === 0;
  const elegida = expansiones[0] ?? { K: encadenar(conocimientoInicial(ctx), reglas), creencias: new Set(), pasos: [] };
  const mundos = expansiones.length ? expansiones.map((e) => e.K) : [elegida.K];

  const preguntas = preguntasDe(ctx);
  const respuestas = inconsistente
    ? preguntas.map((q) => ({ id: q.id, pregunta: q.texto, lit: q.lit, valor: 'contradiccion', provisional: false, detalle: 'los hechos se contradicen' }))
    : responder(ctx, preguntas, mundos, reglas, 'por introspección · puede retirarse');

  const introspeccion = atomos.map((p) => ({
    lit: p,
    pregunta: mundo.predicados[analizar(p).pred]?.pregunta ?? `¿Creo ${textoDe(ctx, p)}?`,
    regla: mundo.predicados[analizar(p).pred]?.regla ?? '',
    formal: `L ${formalDe(ctx, p)}`,
    creo: expansiones.every((e) => e.creencias.has(p)),
  }));

  const traza = [...trazaHechos(ctx)];
  for (const i of introspeccion) traza.push({ tipo: 'info', texto: `introspección · ${i.pregunta} ${i.creo ? 'sí' : 'no'}` });
  for (const p of elegida.pasos) {
    traza.push({ tipo: p.provisional ? 'supuesto' : 'regla', texto: `${p.regla.id} · ${p.regla.texto} ⇒ ${textoDe(ctx, p.cabeza)}` });
  }

  const disparadas = new Set(elegida.pasos.map((p) => p.regla.id));
  return {
    lado: 'nomono',
    metodo: 'autoepistemica',
    mundo: mundo.id,
    activo: true,
    estado: inconsistente ? 'contradiccion' : respuestas.some((r) => r.valor === 'indeciso') ? 'indeciso' : 'estable',
    hechos: hechosVisibles(ctx),
    conclusiones: agregar(ctx, mundos, reglas),
    respuestas,
    explosion: false,
    contradicciones: [],
    absurdas: [],
    pendientes: [],
    reglas: reglasVisibles(reglas, disparadas),
    introspeccion,
    traza,
  };
}

// ─────────────────────────────── Negación por fallo (Clark) ───────────────────────────────

function baseDeDatos(ctx, K, preguntas, lado) {
  const pred = ctx.mundo.db;
  const filas = [...K.keys()]
    .filter((l) => analizar(l).pred === pred)
    .map((l) => ({ lit: l, formal: `${formalDe(ctx, l)}.`, nueva: !ctx.base.includes(l), negativa: l.startsWith('-') }));
  const busquedas = preguntas.map((q) => {
    let resultado;
    if (K.has(q.lit)) resultado = 'si';
    else if (K.has(negar(q.lit))) resultado = 'no';
    else resultado = lado === 'mono' ? 'desconocido' : 'no';
    return {
      id: q.id,
      consulta: `?- ${formalDe(ctx, q.lit)}.`,
      coincidencias: filas.map((f) => f.lit === q.lit || f.lit === negar(q.lit)),
      derivada: analizar(q.lit).pred !== pred,
      resultado,
      porFallo: lado !== 'mono' && !K.has(q.lit) && !K.has(negar(q.lit)),
    };
  });
  return { archivo: 'base_de_conocimiento.pl', filas, busquedas };
}

function motorNegacionPorFallo(ctx) {
  const { mundo } = ctx;
  const reglas = reglasDe(ctx, 'nomono');
  const pasos = [];
  const disparadas = new Set();
  const K = encadenar(conocimientoInicial(ctx), reglas, { pasos, disparadas });
  const preguntas = preguntasDe(ctx);
  const db = baseDeDatos(ctx, K, preguntas, 'nomono');

  const respuestas = preguntas.map((q, i) => {
    const b = db.busquedas[i];
    const base = { id: q.id, pregunta: q.texto, lit: q.lit };
    if (b.resultado === 'si') return { ...base, valor: 'si', provisional: false, detalle: b.derivada ? 'demostrado con las reglas' : 'está en la base de conocimiento' };
    if (!b.porFallo) return { ...base, valor: 'no', provisional: false, detalle: 'negación explícita en la base' };
    return { ...base, valor: 'no', provisional: true, detalle: 'la búsqueda falla · mundo cerrado' };
  });

  // Las respuestas negativas por fallo también son conclusiones (provisionales).
  const conclusiones = listaConclusiones(ctx, K, reglas);
  preguntas.forEach((q, i) => {
    if (db.busquedas[i].porFallo) {
      conclusiones.push({ ...describir(ctx, negar(q.lit)), tipo: 'supuesto', regla: 'NAF', reglaTexto: 'negación por fallo' });
    }
  });

  const traza = [...trazaHechos(ctx)];
  for (const p of pasos) traza.push({ tipo: 'regla', texto: `${p.regla.id} · ${p.regla.texto} ⇒ ${textoDe(ctx, p.cabeza)}` });
  db.busquedas.forEach((b, i) => {
    const n = db.filas.length;
    if (b.resultado === 'si') traza.push({ tipo: 'ok', texto: `${b.consulta}  → éxito` });
    else if (!b.porFallo) traza.push({ tipo: 'regla', texto: `${b.consulta}  → negación explícita` });
    else {
      traza.push({ tipo: 'info', texto: `${b.consulta}  → ${n} hechos revisados, ninguno coincide` });
      traza.push({ tipo: 'supuesto', texto: `fallo finito ⇒ \\+ ${formalDe(ctx, preguntas[i].lit)} ⇒ ${textoDe(ctx, negar(preguntas[i].lit))}` });
    }
  });

  return {
    lado: 'nomono',
    metodo: 'negacion',
    mundo: mundo.id,
    activo: true,
    estado: 'estable',
    hechos: hechosVisibles(ctx),
    conclusiones,
    respuestas,
    explosion: false,
    contradicciones: [],
    absurdas: [],
    pendientes: [],
    reglas: reglasVisibles(reglas, disparadas),
    db,
    traza,
  };
}

// ─────────────────────────────── Argumentación (Dung) ───────────────────────────────

function motorArgumentos(ctx) {
  const { mundo } = ctx;
  const activos = mundo.argumentos.filter((a) => ctx.hechos.includes(a.premisa));
  const ataques = [];
  for (const x of activos) {
    for (const y of activos) {
      if (x === y) continue;
      if (x.conclusion === negar(y.conclusion)) ataques.push({ de: x.id, a: y.id, tipo: 'refuta' });
      if (x.socava?.includes(y.id)) ataques.push({ de: x.id, a: y.id, tipo: 'socava' });
    }
  }
  // Semántica fundamentada: se acepta lo que no tiene atacantes vivos; se derrota lo atacado por algo aceptado.
  const etiqueta = {};
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const a of activos) {
      if (etiqueta[a.id]) continue;
      const atacantes = ataques.filter((t) => t.a === a.id).map((t) => t.de);
      if (atacantes.every((b) => etiqueta[b] === 'OUT')) {
        etiqueta[a.id] = 'IN';
        cambio = true;
      } else if (atacantes.some((b) => etiqueta[b] === 'IN')) {
        etiqueta[a.id] = 'OUT';
        cambio = true;
      }
    }
  }
  for (const a of activos) etiqueta[a.id] ??= 'UNDEC';

  const conclusiones = [];
  for (const a of activos) {
    if (etiqueta[a.id] === 'OUT') continue;
    const tipo = etiqueta[a.id] === 'IN' ? 'aceptada' : 'indecisa';
    const previa = conclusiones.find((c) => c.lit === a.conclusion);
    if (previa) {
      if (tipo === 'aceptada') previa.tipo = 'aceptada';
      continue;
    }
    conclusiones.push({ ...describir(ctx, a.conclusion), tipo, regla: a.id, reglaTexto: `argumento ${a.id}` });
  }

  const preguntas = preguntasDe(ctx);
  const respuestas = preguntas.map((q) => {
    const base = { id: q.id, pregunta: q.texto, lit: q.lit };
    const con = (lit, et) => activos.filter((a) => a.conclusion === lit && etiqueta[a.id] === et);
    const si = con(q.lit, 'IN');
    const no = con(negar(q.lit), 'IN');
    if (si.length) return { ...base, valor: 'si', provisional: true, detalle: `argumento ${si.map((a) => a.id).join(', ')} aceptado` };
    if (no.length) return { ...base, valor: 'no', provisional: true, detalle: `argumento ${no.map((a) => a.id).join(', ')} aceptado` };
    if (con(q.lit, 'UNDEC').length || con(negar(q.lit), 'UNDEC').length) {
      return { ...base, valor: 'indeciso', provisional: true, detalle: 'argumentos en conflicto · falta información' };
    }
    return { ...base, valor: 'desconocido', provisional: false, detalle: activos.length ? 'ningún argumento aceptado lo decide' : 'sin argumentos todavía' };
  });

  const NOMBRE_ETIQUETA = { IN: 'aceptado', OUT: 'derrotado', UNDEC: 'indeciso' };
  const traza = activos.map((a) => ({ tipo: 'hecho', texto: `argumento ${a.id} · ${a.texto} ⇒ ${textoDe(ctx, a.conclusion)}` }));
  const vistos = new Set();
  for (const t of ataques) {
    const mutuo = ataques.some((u) => u.de === t.a && u.a === t.de);
    const clave = mutuo ? [t.de, t.a].sort().join('') : t.de + t.a;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    traza.push({ tipo: 'alerta', texto: mutuo ? `ataque · ${t.de} ⟷ ${t.a} (conclusiones opuestas)` : `ataque · ${t.de} → ${t.a} (${t.tipo === 'socava' ? 'socava su premisa' : 'lo refuta'})` });
  }
  if (activos.length) {
    traza.push({ tipo: 'info', texto: `semántica fundamentada · ${activos.map((a) => `${a.id}: ${NOMBRE_ETIQUETA[etiqueta[a.id]]}`).join(' · ')}` });
  }

  return {
    lado: 'nomono',
    metodo: 'argumentos',
    mundo: mundo.id,
    activo: true,
    estado: respuestas.some((r) => r.valor === 'indeciso') ? 'indeciso' : 'estable',
    hechos: hechosVisibles(ctx),
    conclusiones,
    respuestas,
    explosion: false,
    contradicciones: [],
    absurdas: [],
    pendientes: [],
    reglas: [],
    argumentos: activos.map((a) => ({
      id: a.id,
      texto: a.texto,
      conclusion: textoDe(ctx, a.conclusion),
      etiqueta: etiqueta[a.id],
      pos: a.pos,
      atacantes: ataques.filter((t) => t.a === a.id).map((t) => t.de),
    })),
    ataques,
    traza,
  };
}

// ─────────────────────────────── Entrada pública ───────────────────────────────

const MOTORES = {
  defecto: motorDefecto,
  circunscripcion: motorCircunscripcion,
  autoepistemica: motorAutoepistemico,
  negacion: motorNegacionPorFallo,
  argumentos: motorArgumentos,
};

function enEspera(estado) {
  // Un lado que todavía no procesa la información: se muestra la pregunta, pero sin respuesta.
  const r = {
    ...estado,
    activo: false,
    estado: 'espera',
    conclusiones: [],
    respuestas: estado.respuestas.map((q) => ({ ...q, valor: 'espera', provisional: false, detalle: 'esperando información' })),
    explosion: false,
    contradicciones: [],
    absurdas: [],
    pendientes: [],
    traza: [],
  };
  if (r.instancias) r.instancias = [];
  if (r.circ) r.circ = { ...r.circ, ab: [], minimo: null, supuestos: [] };
  if (r.introspeccion) r.introspeccion = r.introspeccion.map((i) => ({ ...i, creo: null }));
  if (r.db) r.db = { ...r.db, busquedas: r.db.busquedas.map((b) => ({ ...b, resultado: null, porFallo: false })) };
  if (r.condiciones) r.condiciones = r.condiciones.map((c) => ({ ...c, demostrada: false }));
  if (r.reglas) r.reglas = r.reglas.map((x) => ({ ...x, estado: 'inactiva' }));
  return r;
}

export function razonar(mundo, lado, entrada = {}) {
  const ctx = preparar(mundo, lado, entrada);
  const estado = lado === 'mono' ? motorMonotono(ctx) : MOTORES[mundo.metodo](ctx);
  return ctx.activo ? estado : enEspera(estado);
}

export function describirHecho(mundo, lit, nombres = {}) {
  const ctx = preparar(mundo, 'mono', { nombres });
  return describir(ctx, lit);
}
