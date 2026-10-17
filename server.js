// Servidor de la animación «IA monótona vs. IA no-monótona».
// Sin dependencias: sirve la página (carpeta public/) y expone el motor de razonamiento por HTTP.
//
//   npm start            → inicia y abre el navegador
//   node server.js --no-abrir
//
// API:
//   GET  /api/presentacion   escenas con los estados ya calculados por ambos motores
//   GET  /api/mundos         mundos disponibles para el laboratorio
//   POST /api/razonar        { mundo, hechos[], nombres{} } → { mono, nomono, ms }
//   GET  /api/salud          latido del motor

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { construirPresentacion } from './motor/presentacion.js';
import { MUNDOS } from './motor/mundos.js';
import { razonar, describirHecho } from './motor/motores.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const PUERTO = Number(process.env.PORT) || 3000;
const ABRIR = !process.argv.includes('--no-abrir') && !process.env.NO_ABRIR;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const c = {
  cian: (t) => `\x1b[38;5;45m${t}\x1b[0m`,
  rosa: (t) => `\x1b[38;5;206m${t}\x1b[0m`,
  gris: (t) => `\x1b[38;5;244m${t}\x1b[0m`,
  rojo: (t) => `\x1b[38;5;203m${t}\x1b[0m`,
  negrita: (t) => `\x1b[1m${t}\x1b[0m`,
};

const presentacion = construirPresentacion();

function mundoPublico(m) {
  const hechos = (m.lab?.hechos ?? []).map((h) => {
    const d = describirHecho(m, h.lit);
    return { lit: h.lit, texto: h.texto ?? d.texto, formal: d.formal, incompatibles: h.incompatibles ?? [] };
  });
  return {
    id: m.id,
    metodo: m.metodo,
    titulo: m.titulo,
    entidades: m.entidades,
    entidadesLibres: Boolean(m.lab?.entidadesLibres),
    propiedades: (m.lab?.propiedades ?? []).map((p) => ({ pred: p, plantilla: m.predicados[p].texto })),
    hechos,
  };
}

class ErrorHttp extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo;
  }
}

const LITERAL = /^-?[a-z_][a-z0-9_]*(\([a-z0-9_]+(,[a-z0-9_]+)*\))?$/;
const ID_ENTIDAD = /^[a-z][a-z0-9_]{0,23}$/;

function validar(cuerpo) {
  const mundo = MUNDOS[cuerpo?.mundo];
  if (!mundo) throw new ErrorHttp(400, 'Mundo desconocido');
  const hechos = Array.isArray(cuerpo.hechos) ? cuerpo.hechos : [];
  if (hechos.length > 40) throw new ErrorHttp(400, 'Demasiados hechos');
  for (const h of hechos) {
    if (typeof h !== 'string' || !LITERAL.test(h)) throw new ErrorHttp(400, `Hecho inválido: ${String(h).slice(0, 40)}`);
    const pred = h.replace(/^-/, '').split('(')[0];
    if (!mundo.predicados[pred]) throw new ErrorHttp(400, `Predicado desconocido: ${pred}`);
  }
  const nombres = {};
  for (const [id, nombre] of Object.entries(cuerpo.nombres ?? {}).slice(0, 12)) {
    if (ID_ENTIDAD.test(id) && typeof nombre === 'string') nombres[id] = nombre.slice(0, 24);
  }
  return { mundo, hechos, nombres };
}

function enviarJSON(res, codigo, datos) {
  res.writeHead(codigo, { 'Content-Type': TIPOS['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(datos));
}

function leerCuerpo(req, limite = 32 * 1024) {
  return new Promise((resolver, rechazar) => {
    let datos = '';
    req.setEncoding('utf8');
    req.on('data', (trozo) => {
      datos += trozo;
      if (datos.length > limite) {
        rechazar(new ErrorHttp(413, 'Solicitud demasiado grande'));
        req.destroy();
      }
    });
    req.on('end', () => resolver(datos));
    req.on('error', rechazar);
  });
}

async function servirArchivo(res, ruta) {
  let relativa = decodeURIComponent(ruta);
  if (relativa.endsWith('/')) relativa += 'index.html';
  const archivo = path.normalize(path.join(RAIZ, relativa));
  if (!archivo.startsWith(RAIZ)) throw new ErrorHttp(403, 'Prohibido');
  try {
    const datos = await readFile(archivo);
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(datos);
  } catch {
    throw new ErrorHttp(404, 'No encontrado');
  }
}

const ESTADOS = { contradiccion: c.rojo('contradicción'), paralizada: 'paralizada', desconocido: 'no sabe', indeciso: 'indecisa', estable: 'estable' };

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/salud') return enviarJSON(res, 200, { ok: true, motor: `Node.js ${process.version}` });
    if (url.pathname === '/api/presentacion') return enviarJSON(res, 200, presentacion);
    if (url.pathname === '/api/mundos') return enviarJSON(res, 200, Object.values(MUNDOS).map(mundoPublico));
    if (url.pathname === '/api/razonar') {
      if (req.method !== 'POST') throw new ErrorHttp(405, 'Usa POST');
      let cuerpo;
      try {
        cuerpo = JSON.parse(await leerCuerpo(req));
      } catch (e) {
        throw e instanceof ErrorHttp ? e : new ErrorHttp(400, 'JSON inválido');
      }
      const { mundo, hechos, nombres } = validar(cuerpo);
      const t0 = process.hrtime.bigint();
      const mono = razonar(mundo, 'mono', { hechos, nombres, modo: 'lab' });
      const nomono = razonar(mundo, 'nomono', { hechos, nombres, modo: 'lab' });
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      console.log(
        `${c.gris('[motor]')} ${mundo.id.padEnd(6)} ${String(hechos.length).padStart(2)} hechos → ` +
          `${c.cian('monótona')}: ${ESTADOS[mono.estado] ?? mono.estado} · ${c.rosa('no-monótona')}: ${ESTADOS[nomono.estado] ?? nomono.estado} ${c.gris(`(${ms.toFixed(2)} ms)`)}`,
      );
      return enviarJSON(res, 200, { mono, nomono, ms });
    }
    if (url.pathname.startsWith('/api/')) throw new ErrorHttp(404, 'Ruta no encontrada');
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new ErrorHttp(405, 'Método no permitido');
    await servirArchivo(res, url.pathname);
  } catch (e) {
    if (!(e instanceof ErrorHttp)) console.error(e);
    if (!res.headersSent) enviarJSON(res, e.codigo ?? 500, { error: e.codigo ? e.message : 'Error interno del motor' });
  }
});

function abrirNavegador(direccion) {
  const comando =
    process.platform === 'win32' ? `start "" "${direccion}"` : process.platform === 'darwin' ? `open "${direccion}"` : `xdg-open "${direccion}"`;
  exec(comando, () => {});
}

function escuchar(puerto, intentos = 10) {
  servidor.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && intentos > 0) {
      console.log(c.gris(`  El puerto ${puerto} está ocupado, probando ${puerto + 1}…`));
      escuchar(puerto + 1, intentos - 1);
    } else {
      console.error(e);
      process.exit(1);
    }
  });
  servidor.listen(puerto, () => {
    const direccion = `http://localhost:${puerto}`;
    const pasos = presentacion.escenas.reduce((n, e) => n + e.pasos.length, 0);
    console.log('');
    console.log(`  ${c.cian('◆ IA MONÓTONA')}  ${c.gris('vs')}  ${c.rosa('IA NO-MONÓTONA ●')}`);
    console.log(c.gris('  Tema 2.7 · Conocimiento no-monótono y otras lógicas'));
    console.log('');
    console.log(`  ${c.negrita('➜ Abre:')}  ${c.cian(direccion)}`);
    console.log(c.gris(`  Motor listo: ${Object.keys(MUNDOS).length} mundos, ${presentacion.escenas.length} escenas, ${pasos} pasos.`));
    console.log(c.gris('  Ctrl + C para detener.'));
    console.log('');
    if (ABRIR) abrirNavegador(direccion);
  });
}

escuchar(PUERTO);
