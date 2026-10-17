// Comunicación con el motor de razonamiento que corre en Node.js.

const estado = { enLinea: false, ms: null, motorMs: null };
const oyentes = new Set();
const avisar = () => oyentes.forEach((f) => f(estado));

async function pedir(ruta, opciones) {
  const t0 = performance.now();
  let respuesta;
  try {
    respuesta = await fetch(ruta, opciones);
  } catch {
    estado.enLinea = false;
    avisar();
    throw new Error('No se pudo conectar con el servidor Node.js.');
  }
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(datos.error || `Error ${respuesta.status}`);
  estado.enLinea = true;
  estado.ms = performance.now() - t0;
  estado.motorMs = typeof datos.ms === 'number' ? datos.ms : estado.motorMs;
  avisar();
  return datos;
}

export const api = {
  estado,
  alCambiar: (f) => oyentes.add(f),
  presentacion: () => pedir('/api/presentacion'),
  mundos: () => pedir('/api/mundos'),
  salud: () => pedir('/api/salud'),
  razonar: (mundo, hechos, nombres = {}) =>
    pedir('/api/razonar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mundo, hechos, nombres }),
    }),
};
