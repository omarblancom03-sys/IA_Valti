// Bases de conocimiento de cada escena (un "mundo" por método no-monótono).
// Cada mundo define lo que sabe la IA monótona (solo reglas estrictas) y lo que sabe
// la no-monótona (reglas del método correspondiente), además de los textos que se muestran.

const ABSURDOS_GENERALES = [
  '2 + 2 = 5',
  'La Luna es de queso',
  'Todo es verdadero',
  'El agua está seca',
  'Los lunes son viernes',
  'Nada es verdadero',
];

export const MUNDOS = {
  // ───────────────────────── Lógica por defecto ─────────────────────────
  aves: {
    id: 'aves',
    metodo: 'defecto',
    titulo: 'Lógica por defecto',
    entidades: { tweety: 'Tweety', pingu: 'Pingu', piolin: 'Piolín' },
    predicados: {
      ave: { texto: '{0} es un ave', formal: 'Ave' },
      pinguino: { texto: '{0} es un pingüino', formal: 'Pingüino' },
      avestruz: { texto: '{0} es un avestruz', formal: 'Avestruz' },
      ala_rota: { texto: '{0} tiene un ala rota', formal: 'AlaRota' },
      vuela: { texto: '{0} vuela', neg: '{0} no vuela', formal: 'Vuela' },
    },
    reglasMono: [
      { id: 'R1', si: ['ave(X)'], entonces: 'vuela(X)', texto: 'Toda ave vuela', formal: '∀x Ave(x) → Vuela(x)', visible: true },
      { id: 'R2', si: ['pinguino(X)'], entonces: 'ave(X)', texto: 'Todo pingüino es un ave', formal: '∀x Pingüino(x) → Ave(x)' },
      { id: 'R3', si: ['pinguino(X)'], entonces: '-vuela(X)', texto: 'Ningún pingüino vuela', formal: '∀x Pingüino(x) → ¬Vuela(x)', visible: true },
      { id: 'R4', si: ['avestruz(X)'], entonces: 'ave(X)', texto: 'Todo avestruz es un ave', formal: '∀x Avestruz(x) → Ave(x)' },
      { id: 'R5', si: ['avestruz(X)'], entonces: '-vuela(X)', texto: 'Ningún avestruz vuela', formal: '∀x Avestruz(x) → ¬Vuela(x)' },
      { id: 'R6', si: ['ala_rota(X)'], entonces: '-vuela(X)', texto: 'Con un ala rota no se vuela', formal: '∀x AlaRota(x) → ¬Vuela(x)' },
    ],
    // La no-monótona comparte las reglas estrictas, pero "las aves vuelan" es solo una regla por defecto.
    reglasNoMono: ['R2', 'R3', 'R4', 'R5', 'R6'],
    defectos: [
      {
        id: 'D1',
        pre: ['ave(X)'],
        just: ['vuela(X)'],
        cons: 'vuela(X)',
        texto: 'Normalmente, las aves vuelan',
        formal: 'Ave(x) : Vuela(x) ⁄ Vuela(x)',
      },
    ],
    preguntas: [{ id: 'vuela', patron: 'vuela(X)', texto: '¿{0} vuela?', porEntidad: true }],
    escena: { entidades: ['tweety'] },
    atasco: 'desconocido',
    absurdos: [
      '{0} es un pez',
      '{0} es un avión',
      '{0} es presidente',
      '2 + 2 = 5',
      'Los pingüinos manejan taxis',
      'La Luna es de queso',
      '{0} vuela y no vuela',
      'Todo es verdadero',
      'El agua está seca',
      'Los lunes son viernes',
    ],
    lab: {
      entidadesLibres: true,
      propiedades: ['ave', 'pinguino', 'avestruz', 'ala_rota'],
    },
  },

  // ───────────────────────── Circunscripción ─────────────────────────
  bote: {
    id: 'bote',
    metodo: 'circunscripcion',
    titulo: 'Circunscripción',
    entidades: { bote: 'el bote' },
    formalEntidad: { bote: 'bote' },
    predicados: {
      bote: { texto: 'Hay un bote en la orilla', formal: 'Bote' },
      agujero: { texto: 'El bote tiene un agujero', neg: 'El bote no tiene agujeros', formal: 'Agujero' },
      sin_remos: { texto: 'El bote no tiene remos', neg: 'El bote sí tiene remos', formal: 'SinRemos' },
      tormenta: { texto: 'Hay tormenta', neg: 'No hay tormenta', formal: 'Tormenta' },
      ab: { texto: 'El bote es «anormal»', neg: 'El bote es normal', formal: 'Ab' },
      cruzar: { texto: 'Se puede cruzar el río', neg: 'No se puede cruzar el río', formal: 'Cruzar' },
    },
    reglasMono: [
      {
        id: 'M1',
        si: ['bote(B)', '-agujero(B)', '-sin_remos(B)', '-tormenta'],
        entonces: 'cruzar(B)',
        texto: 'Solo se cruza si se demuestra que no hay ningún problema',
        formal: 'Bote(b) ∧ ¬Agujero(b) ∧ ¬SinRemos(b) ∧ ¬Tormenta → Cruzar(b)',
        visible: true,
      },
      { id: 'M2', si: ['agujero(B)'], entonces: '-cruzar(B)', texto: 'Con un agujero no se puede cruzar', formal: 'Agujero(b) → ¬Cruzar(b)' },
      { id: 'M3', si: ['sin_remos(B)'], entonces: '-cruzar(B)', texto: 'Sin remos no se puede cruzar', formal: 'SinRemos(b) → ¬Cruzar(b)' },
      { id: 'M4', si: ['tormenta', 'bote(B)'], entonces: '-cruzar(B)', texto: 'Con tormenta no se puede cruzar', formal: 'Tormenta → ¬Cruzar(b)' },
    ],
    reglasNoMono: [
      {
        id: 'C1',
        si: ['bote(B)', 'no ab(B)'],
        entonces: 'cruzar(B)',
        texto: 'Si hay bote y nada es anormal, se puede cruzar',
        formal: 'Bote(b) ∧ ¬Ab(b) → Cruzar(b)',
        visible: true,
      },
      { id: 'A1', si: ['agujero(B)'], entonces: 'ab(B)', motivo: 'agujero(B)', texto: 'Un agujero es una anomalía', formal: 'Agujero(b) → Ab(b)' },
      { id: 'A2', si: ['sin_remos(B)'], entonces: 'ab(B)', motivo: 'sin_remos(B)', texto: 'No tener remos es una anomalía', formal: 'SinRemos(b) → Ab(b)' },
      { id: 'A3', si: ['tormenta', 'bote(B)'], entonces: 'ab(B)', motivo: 'tormenta', texto: 'Una tormenta es una anomalía', formal: 'Tormenta → Ab(b)' },
      'M2',
      'M3',
      'M4',
    ],
    preguntas: [{ id: 'cruzar', lit: 'cruzar(bote)', texto: '¿Se puede cruzar el río en el bote?' }],
    ocultos: ['ab'],
    circ: { tipo: 'bote', predicado: 'ab' },
    atasco: 'paralizada',
    // El problema de la cualificación: la lista de condiciones posibles nunca termina.
    cualificaciones: [
      '¿Y si hay cocodrilos?',
      '¿Y si el bote es de papel?',
      '¿Y si el río se congeló?',
      '¿Y si los remos son de chocolate?',
      '¿Y si hay un remolino?',
      '¿Y si el bote está amarrado?',
      '¿Y si hay un monstruo en el río?',
      '¿Y si el bote no es mío?',
      '¿Y si la otra orilla no existe?',
      '¿Y si el agua es de lava?',
    ],
    absurdos: ABSURDOS_GENERALES,
    lab: {
      hechos: [
        { lit: 'bote(bote)' },
        { lit: 'agujero(bote)' },
        { lit: 'sin_remos(bote)' },
        { lit: 'tormenta' },
        { lit: '-agujero(bote)', texto: 'Verificado: no tiene agujeros' },
        { lit: '-sin_remos(bote)', texto: 'Verificado: sí tiene remos' },
        { lit: '-tormenta', texto: 'Verificado: no hay tormenta' },
      ],
    },
  },

  // ───────────────────────── Lógica autoepistémica ─────────────────────────
  examen: {
    id: 'examen',
    metodo: 'autoepistemica',
    titulo: 'Lógica autoepistémica',
    entidades: {},
    predicados: {
      programado_hoy: { texto: 'El examen está programado para hoy', formal: 'ProgramadoHoy' },
      aviso_viernes: { texto: 'Aviso: el examen se movió al viernes', formal: 'AvisoViernes' },
      cambio: {
        texto: 'Hubo un cambio de fecha',
        neg: 'No hubo cambio de fecha',
        formal: 'Cambio',
        pregunta: '¿Creo que hubo un cambio de fecha?',
        regla: 'Si la fecha hubiera cambiado, yo lo sabría',
      },
      examen_hoy: { texto: 'El examen es hoy', neg: 'El examen no es hoy', formal: 'ExamenHoy' },
      examen_viernes: { texto: 'El examen es el viernes', formal: 'ExamenViernes' },
      aviso_sabado: { texto: 'Aviso: clase de reposición el sábado', formal: 'AvisoSábado' },
      clase_sabado: {
        texto: 'Hay clase el sábado',
        neg: 'No hay clase el sábado',
        formal: 'ClaseSábado',
        pregunta: '¿Creo que hay clase el sábado?',
        regla: 'Si hubiera clase el sábado, yo lo sabría',
      },
    },
    reglasMono: [
      {
        id: 'M1',
        si: ['programado_hoy', '-cambio'],
        entonces: 'examen_hoy',
        texto: 'Si estaba programado y no hubo cambio, es hoy',
        formal: 'ProgramadoHoy ∧ ¬Cambio → ExamenHoy',
        visible: true,
      },
      { id: 'M2', si: ['aviso_viernes'], entonces: 'cambio', texto: 'Un aviso implica un cambio', formal: 'AvisoViernes → Cambio' },
      { id: 'M3', si: ['aviso_viernes'], entonces: 'examen_viernes', texto: 'El aviso dice que es el viernes', formal: 'AvisoViernes → ExamenViernes' },
      { id: 'M4', si: ['examen_viernes'], entonces: '-examen_hoy', texto: 'Si es el viernes, no es hoy', formal: 'ExamenViernes → ¬ExamenHoy' },
    ],
    reglasNoMono: [
      {
        id: 'E1',
        si: ['nocree cambio'],
        entonces: '-cambio',
        texto: 'Si la fecha hubiera cambiado, yo lo sabría',
        formal: '¬L Cambio → ¬Cambio',
        visible: true,
      },
      'M1',
      'M2',
      'M3',
      'M4',
    ],
    preguntas: [{ id: 'hoy', lit: 'examen_hoy', texto: '¿El examen es hoy?' }],
    atasco: 'desconocido',
    absurdos: ABSURDOS_GENERALES,
    lab: {
      reglasMono: [{ id: 'M5', si: ['aviso_sabado'], entonces: 'clase_sabado', texto: 'El aviso confirma clase el sábado', formal: 'AvisoSábado → ClaseSábado' }],
      reglasNoMono: [
        {
          id: 'E2',
          si: ['nocree clase_sabado'],
          entonces: '-clase_sabado',
          texto: 'Si hubiera clase el sábado, yo lo sabría',
          formal: '¬L ClaseSábado → ¬ClaseSábado',
          visible: true,
        },
        'M5',
      ],
      preguntas: [{ id: 'sabado', lit: 'clase_sabado', texto: '¿Hay clase el sábado?' }],
      hechos: [
        { lit: 'programado_hoy' },
        { lit: 'aviso_viernes', incompatibles: ['-cambio'] },
        { lit: '-cambio', texto: 'El profesor confirma: no hubo cambios', incompatibles: ['aviso_viernes'] },
        { lit: 'aviso_sabado' },
      ],
    },
  },

  // ───────────────────────── Negación por fallo ─────────────────────────
  vuelos: {
    id: 'vuelos',
    metodo: 'negacion',
    titulo: 'Negación por fallo',
    entidades: { cdmx: 'CDMX', madrid: 'Madrid', bogota: 'Bogotá', tokio: 'Tokio', lima: 'Lima', luna: 'Luna' },
    predicados: {
      vuelo: { texto: 'Hay vuelo directo {0} → {1}', neg: 'No hay vuelo directo {0} → {1}', prolog: true },
      ruta: { texto: 'Se puede llegar de {0} a {1}', neg: 'No se puede llegar de {0} a {1}', prolog: true },
    },
    base: ['vuelo(cdmx,madrid)', 'vuelo(cdmx,bogota)', 'vuelo(madrid,tokio)', 'vuelo(bogota,lima)'],
    db: 'vuelo',
    reglasMono: [],
    reglasNoMono: [],
    preguntas: [
      { id: 'tokio', lit: 'vuelo(cdmx,tokio)', texto: '¿Hay vuelo directo CDMX → Tokio?' },
      { id: 'luna', lit: 'vuelo(cdmx,luna)', texto: '¿Y de CDMX a la Luna?' },
    ],
    atasco: 'desconocido',
    absurdos: ABSURDOS_GENERALES,
    lab: {
      reglasMono: [
        { id: 'T1', si: ['vuelo(X,Y)'], entonces: 'ruta(X,Y)', texto: 'Un vuelo directo es una ruta', formal: 'vuelo(X,Y) → ruta(X,Y)' },
        { id: 'T2', si: ['vuelo(X,Z)', 'ruta(Z,Y)'], entonces: 'ruta(X,Y)', texto: 'Las escalas forman rutas', formal: 'vuelo(X,Z) ∧ ruta(Z,Y) → ruta(X,Y)' },
      ],
      reglasNoMono: ['T1', 'T2'],
      preguntas: [{ id: 'ruta-luna', lit: 'ruta(cdmx,luna)', texto: '¿Se llega de CDMX a la Luna con escalas?' }],
      hechos: [
        { lit: 'vuelo(cdmx,tokio)', texto: 'Nueva ruta: CDMX → Tokio' },
        { lit: 'vuelo(tokio,luna)', texto: 'Nueva ruta espacial: Tokio → Luna' },
        { lit: 'vuelo(cdmx,luna)', texto: 'Nueva ruta espacial: CDMX → Luna' },
        { lit: '-vuelo(cdmx,luna)', texto: 'Registro oficial: no hay vuelo CDMX → Luna' },
      ],
    },
  },

  // ───────────────────────── Razonamiento basado en argumentos ─────────────────────────
  correo: {
    id: 'correo',
    metodo: 'argumentos',
    titulo: 'Razonamiento basado en argumentos',
    entidades: {},
    predicados: {
      premio: { texto: 'El correo dice «¡Ganaste un premio!»' },
      contacto: { texto: 'El remitente es uno de tus contactos' },
      hackeo: { texto: 'La cuenta de ese contacto fue hackeada' },
      sorteo: { texto: 'Sí participaste en ese sorteo' },
      enlace: { texto: 'El enlace lleva a un sitio falso' },
      spam: { texto: 'El correo es spam', neg: 'El correo no es spam', formal: 'Spam' },
      confiable: { texto: 'El remitente es confiable', neg: 'El remitente no es confiable', formal: 'Confiable' },
      legitimo: { texto: 'El premio podría ser real', formal: 'Legítimo' },
    },
    argumentos: [
      { id: 'A', premisa: 'premio', conclusion: 'spam', texto: '«¡Ganaste un premio!»', pos: [160, 104] },
      { id: 'B', premisa: 'contacto', conclusion: '-spam', texto: 'Remitente conocido', pos: [706, 104] },
      { id: 'C', premisa: 'hackeo', conclusion: '-confiable', socava: ['B'], texto: 'Cuenta hackeada', pos: [706, 200] },
      { id: 'D', premisa: 'sorteo', conclusion: 'legitimo', socava: ['A'], texto: 'Participaste en el sorteo', pos: [160, 200] },
      { id: 'E', premisa: 'enlace', conclusion: 'spam', texto: 'Enlace a sitio falso', pos: [433, 52] },
    ],
    preguntas: [{ id: 'spam', lit: 'spam', texto: '¿Este correo es spam?' }],
    atasco: 'desconocido',
    absurdos: [
      'El correo es una pizza',
      'Tu contacto es un robot',
      'El spam es tu mejor amigo',
      '2 + 2 = 5',
      'Todo correo es spam y ninguno lo es',
      'Ganaste todos los premios del universo',
      'Todo es verdadero',
      'La bandeja de entrada es un océano',
    ],
    lab: {
      hechos: [{ lit: 'premio' }, { lit: 'contacto' }, { lit: 'hackeo' }, { lit: 'sorteo' }, { lit: 'enlace' }],
    },
  },
};
