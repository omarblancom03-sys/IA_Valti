// Guion de la presentación. Cada escena tiene "pasos" (beats) que el presentador avanza.
// En las escenas de método, el servidor ejecuta ambos motores en cada paso y guarda el estado resultante.

import { MUNDOS } from './mundos.js';
import { razonar, describirHecho } from './motores.js';

const ESCENAS = [
  {
    id: 'portada',
    tipo: 'portada',
    etiqueta: 'INICIO',
    titulo: 'Dos formas de pensar',
    perfil: {
      mono: [
        { icono: 'deduccion', titulo: 'Deductiva', texto: 'De premisas verdaderas obtiene conclusiones seguras.' },
        { icono: 'acumula', titulo: 'Solo acumula', texto: 'Las conclusiones derivadas se conservan al añadir premisas.' },
        { icono: 'candado', titulo: 'Sin excepciones', texto: 'Una premisa nueva nunca cancela una conclusión.' },
      ],
      nomono: [
        { icono: 'supuesto', titulo: 'Supuestos razonables', texto: 'Usa reglas por defecto cuando la información es incompleta.' },
        { icono: 'revisa', titulo: 'Revisable', texto: 'Algunas conclusiones pueden retirarse con nuevos datos.' },
        { icono: 'excepcion', titulo: 'Derrotable', texto: 'Las excepciones modifican conclusiones provisionales.' },
      ],
    },
    pasos: [
      { id: 'titulo', narracion: '', duracion: 7000 },
      {
        id: 'duelo',
        narracion: 'Dos inteligencias artificiales van a recibir exactamente la misma información. Lo único que cambia es su forma de razonar.',
      },
      {
        id: 'perfil',
        narracion:
          'La monótona solo acumula conclusiones y nunca retira ninguna. La no-monótona las trata como provisionales: puede retirarlas si aparece evidencia en contra.',
      },
    ],
  },

  {
    id: 'monotonia',
    tipo: 'grafica',
    etiqueta: 'FUNDAMENTO',
    titulo: '¿Por qué «monótona»?',
    series: { mono: [0, 2, 3, 5, 6], nomono: [0, 2, 3, 1, 3] },
    paquetes: ['Dato 1', 'Dato 2', 'Excepción', 'Dato 4'],
    pasos: [
      {
        narracion:
          'Cada dato nuevo le permite deducir más. En la IA monótona las conclusiones solo pueden aumentar, nunca disminuir: por eso se llama «monótona».',
        hasta: 2,
      },
      {
        narracion: 'Llega una excepción. La no-monótona retira las conclusiones que dependían de un supuesto: su conjunto de conclusiones se reduce.',
        hasta: 3,
      },
      {
        narracion:
          'Es el razonamiento derrotable (defeasible reasoning): una conclusión es válida de forma provisional y puede retirarse ante nueva evidencia.',
        hasta: 4,
        formula: true,
      },
    ],
  },

  {
    id: 'defecto',
    tipo: 'metodo',
    mundo: 'aves',
    etiqueta: 'MÉTODO 1',
    titulo: 'Lógica por defecto',
    tarjeta: {
      numero: '01',
      titulo: 'Lógica por defecto',
      ingles: 'Default Logic',
      autor: 'Raymond Reiter, 1980',
      definicion: 'Permite obtener conclusiones razonables cuando no existe información que indique lo contrario.',
      formula: 'Ave(x) : Vuela(x) ⁄ Vuela(x)',
      leyenda: 'Si x es un ave y es consistente suponer que vuela, entonces se concluye que vuela.',
    },
    pasos: [
      { tarjeta: true, narracion: 'Lógica por defecto: obtener conclusiones razonables cuando no existe información que indique lo contrario.' },
      {
        dato: 'ave(tweety)',
        mono: ['ave(tweety)'],
        nomono: ['ave(tweety)'],
        narracion: 'Dato: «Tweety es un ave». Las dos concluyen que Tweety vuela… pero la no-monótona lo guarda como un supuesto, no como una certeza.',
      },
      {
        dato: 'pinguino(tweety)',
        mono: ['ave(tweety)', 'pinguino(tweety)'],
        nomono: ['ave(tweety)'],
        espera: 'nomono',
        narracion:
          'Nuevo dato: «Tweety es un pingüino». La monótona no puede retirar nada: concluye que vuela y que no vuela. Y de una contradicción se deduce cualquier cosa.',
      },
      {
        mono: ['ave(tweety)', 'pinguino(tweety)'],
        nomono: ['ave(tweety)', 'pinguino(tweety)'],
        narracion:
          'La no-monótona revisa la justificación de su regla: ya no es consistente suponer que Tweety vuela. Retira ese supuesto y corrige: Tweety no vuela.',
      },
    ],
  },

  {
    id: 'circunscripcion',
    tipo: 'metodo',
    mundo: 'bote',
    etiqueta: 'MÉTODO 2',
    titulo: 'Circunscripción',
    tarjeta: {
      numero: '02',
      titulo: 'Circunscripción',
      ingles: 'Circumscription',
      autor: 'John McCarthy, 1980',
      definicion: 'El sistema no debe suponer que existen excepciones o situaciones anormales si no tiene razones suficientes para hacerlo.',
      formula: 'Bote(b) ∧ ¬Ab(b) → Cruzar(b)',
      leyenda: 'Se minimiza Ab: lo «anormal» se reduce al conjunto más pequeño posible.',
    },
    pasos: [
      { tarjeta: true, narracion: 'Circunscripción: el sistema no supone excepciones ni situaciones anormales si no tiene razones suficientes para hacerlo.' },
      {
        dato: 'bote(bote)',
        mono: ['bote(bote)'],
        nomono: null,
        espera: 'nomono',
        narracion:
          'Dato: «Hay un bote en la orilla». La monótona exige demostrar cada condición: ¿tiene agujeros?, ¿tiene remos?, ¿y si…? La lista nunca termina: queda paralizada.',
      },
      {
        mono: ['bote(bote)'],
        nomono: ['bote(bote)'],
        narracion:
          'La no-monótona circunscribe lo anormal: lo reduce al mínimo posible. Sin motivos para sospechar, Ab queda vacío y concluye que sí se puede cruzar.',
      },
      {
        dato: 'agujero(bote)',
        mono: ['bote(bote)', 'agujero(bote)'],
        nomono: ['bote(bote)', 'agujero(bote)'],
        narracion:
          'Nuevo dato: «El bote tiene un agujero». Ahora sí hay una anomalía: el bote entra en Ab, la conclusión provisional se retira y las dos responden que no.',
      },
    ],
  },

  {
    id: 'autoepistemica',
    tipo: 'metodo',
    mundo: 'examen',
    etiqueta: 'MÉTODO 3',
    titulo: 'Lógica autoepistémica',
    tarjeta: {
      numero: '03',
      titulo: 'Lógica autoepistémica',
      ingles: 'Autoepistemic Logic',
      autor: 'Robert C. Moore, 1985',
      definicion: 'Estudia cómo un agente razona sobre sus propias creencias y sobre aquello que cree o no cree saber.',
      formula: '¬L Cambio → ¬Cambio',
      leyenda: 'L significa «creo que…». Si no creo que hubo un cambio, asumo que no lo hubo.',
    },
    pasos: [
      { tarjeta: true, narracion: 'Lógica autoepistémica: el agente razona sobre sus propias creencias, sobre lo que cree y lo que no cree saber.' },
      {
        dato: 'programado_hoy',
        mono: ['programado_hoy'],
        nomono: null,
        espera: 'nomono',
        narracion:
          'Dato: «El examen está programado para hoy». Para afirmar que es hoy, la monótona tendría que demostrar que no hubo cambios. No sabe razonar sobre lo que ignora.',
      },
      {
        mono: ['programado_hoy'],
        nomono: ['programado_hoy'],
        narracion:
          'La no-monótona se examina a sí misma: «si la fecha hubiera cambiado, yo lo sabría». No encuentra ningún aviso, así que concluye que el examen es hoy.',
      },
      {
        dato: 'aviso_viernes',
        mono: ['programado_hoy', 'aviso_viernes'],
        nomono: ['programado_hoy', 'aviso_viernes'],
        narracion:
          'Llega un aviso: «el examen se movió al viernes». Ahora sí cree que hubo un cambio; su razonamiento introspectivo deja de aplicar y corrige su creencia.',
      },
    ],
  },

  {
    id: 'negacion',
    tipo: 'metodo',
    mundo: 'vuelos',
    etiqueta: 'MÉTODO 4',
    titulo: 'Negación por fallo',
    tarjeta: {
      numero: '04',
      titulo: 'Negación por fallo',
      ingles: 'Negation as Failure',
      autor: 'Keith Clark, 1978',
      definicion:
        'Se usa en programación lógica y se relaciona con la hipótesis del mundo cerrado: lo que no puede demostrarse puede tratarse como falso.',
      formula: '\\+ vuelo(cdmx, tokio)',
      leyenda: 'Si la búsqueda de una prueba fracasa, se asume que es falso.',
    },
    pasos: [
      { tarjeta: true, narracion: 'Negación por fallo: en programación lógica, lo que no puede demostrarse se trata como falso. Es la hipótesis del mundo cerrado.' },
      {
        dato: { tipo: 'consulta', etiqueta: 'CONSULTA', texto: '¿Hay vuelo directo CDMX → Tokio?', formal: '?- vuelo(cdmx, tokio).' },
        mono: [],
        nomono: null,
        espera: 'nomono',
        narracion:
          'Consulta: ¿hay vuelo directo de CDMX a Tokio? La monótona no encuentra el vuelo ni una prueba de que no exista: «no sé». Ni siquiera puede negar un vuelo a la Luna.',
      },
      {
        mono: [],
        nomono: [],
        narracion:
          'La no-monótona busca en su base de conocimiento, la búsqueda falla y, como supone un mundo cerrado, responde de forma provisional: «no hay vuelo».',
      },
      {
        dato: { lit: 'vuelo(cdmx,tokio)', etiqueta: 'NUEVA RUTA' },
        mono: ['vuelo(cdmx,tokio)'],
        nomono: ['vuelo(cdmx,tokio)'],
        narracion: 'Se registra la ruta CDMX → Tokio. Aquel «no» era provisional: la no-monótona lo retira y ahora responde «sí».',
      },
    ],
  },

  {
    id: 'argumentos',
    tipo: 'metodo',
    mundo: 'correo',
    etiqueta: 'MÉTODO 5',
    titulo: 'Razonamiento basado en argumentos',
    tarjeta: {
      numero: '05',
      titulo: 'Razonamiento basado en argumentos',
      ingles: 'Argumentation',
      autor: 'Phan Minh Dung, 1995',
      definicion: 'Consiste en construir argumentos para justificar conclusiones y analizar las posibles objeciones que puedan surgir.',
      formula: 'A se acepta ⇔ todos sus atacantes están derrotados',
      leyenda: 'Los argumentos se atacan entre sí; solo sobreviven los que pueden defenderse.',
    },
    pasos: [
      { tarjeta: true, narracion: 'Razonamiento basado en argumentos: construir argumentos que justifiquen conclusiones y analizar las objeciones que puedan surgir.' },
      {
        dato: { lit: 'premio', etiqueta: 'ARGUMENTO A' },
        mono: ['premio'],
        nomono: ['premio'],
        narracion: 'Argumento A: el correo dice «¡Ganaste un premio!», entonces es spam. Las dos IAs lo aceptan.',
      },
      {
        dato: { lit: 'contacto', etiqueta: 'ARGUMENTO B' },
        mono: ['premio', 'contacto'],
        nomono: ['premio'],
        espera: 'nomono',
        narracion: 'Argumento B: el remitente es uno de tus contactos, entonces no es spam. La monótona acepta ambos argumentos… y vuelve a contradecirse.',
      },
      {
        mono: ['premio', 'contacto'],
        nomono: ['premio', 'contacto'],
        narracion: 'La no-monótona ve que A y B se atacan entre sí. En lugar de contradecirse, suspende el juicio: necesita más información.',
      },
      {
        dato: { lit: 'hackeo', etiqueta: 'ARGUMENTO C' },
        mono: ['premio', 'contacto', 'hackeo'],
        nomono: ['premio', 'contacto', 'hackeo'],
        narracion: 'Argumento C: la cuenta de ese contacto fue hackeada. C derrota a B, A queda restablecido y la conclusión es clara: es spam.',
      },
    ],
  },

  {
    id: 'conclusion',
    tipo: 'conclusion',
    etiqueta: 'CONCLUSIÓN',
    titulo: 'Saber cambiar de opinión',
    resumen: {
      mono: {
        palabra: 'Certeza',
        detalle: 'ideal para la deducción pura',
        puntos: [
          ['si', 'Sus deducciones son definitivas'],
          ['si', 'Ideal para matemáticas y verificación formal'],
          ['no', 'Ante una excepción, se contradice'],
          ['no', 'Con información incompleta, se paraliza'],
        ],
      },
      nomono: {
        palabra: 'Adaptación',
        detalle: 'ideal para el mundo real',
        puntos: [
          ['si', 'Razona con información incompleta'],
          ['si', 'Revisa sus conclusiones ante nuevos datos'],
          ['si', 'Maneja excepciones sin contradecirse'],
          ['si', 'Por defecto · circunscripción · autoepistémica · negación por fallo · argumentos'],
        ],
      },
    },
    pasos: [
      {
        narracion:
          'El conocimiento no-monótono permite razonar con información incompleta y revisar las conclusiones cuando aparecen nuevos datos o excepciones.',
      },
      {
        final: true,
        narracion: 'La monótona garantiza certeza en la deducción; la no-monótona permite adaptarse a un mundo lleno de excepciones.',
      },
    ],
  },
];

function describirDato(mundo, dato) {
  if (!dato) return null;
  if (typeof dato === 'string') return { tipo: 'hecho', etiqueta: 'NUEVO DATO', ...describirHecho(mundo, dato) };
  if (dato.lit) return { tipo: 'hecho', etiqueta: dato.etiqueta ?? 'NUEVO DATO', ...describirHecho(mundo, dato.lit) };
  return dato;
}

export function construirPresentacion() {
  const escenas = ESCENAS.map((escena) => {
    if (escena.tipo !== 'metodo') return escena;
    const mundo = MUNDOS[escena.mundo];
    return {
      ...escena,
      metodo: mundo.metodo,
      pasos: escena.pasos.map((p) => ({
        ...p,
        dato: describirDato(mundo, p.dato),
        estados: {
          mono: razonar(mundo, 'mono', { hechos: p.mono ?? [], activo: Array.isArray(p.mono) }),
          nomono: razonar(mundo, 'nomono', { hechos: p.nomono ?? [], activo: Array.isArray(p.nomono) }),
        },
      })),
    };
  });
  return { titulo: 'IA monótona vs. IA no-monótona', tema: '2.7 · Conocimiento no-monótono y otras lógicas', escenas };
}
