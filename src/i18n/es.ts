import type { Messages } from './fr'

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many)

export const es: Messages = {
  tag: 'es-ES',
  loading: 'Cargando…',
  wait: 'Un momento…',
  cancel: 'Cancelar',
  loadFailed: 'No se pudo cargar el diccionario. Vuelve a intentarlo.',

  home: {
    tagline: (seconds) => `Una letra · un tema · ${seconds} segundos`,
    play: 'Jugar',
    menu: 'Menú: perfil, amigos, opciones',
    level: (level) => `Nivel ${level}`,
    bestScore: 'mejor puntuación',
    runs: (count) => plural(count, 'partida', 'partidas'),
    wordsFound: 'palabras halladas',
    bestCombo: 'mejor racha',
    myCategories: 'Mis categorías',
    reserve: (perRun) => `Cada partida saca ${perRun}; las demás quedan en reserva para cambiarlas al empezar.`,
    newEachLevel: 'Una categoría nueva para elegir en cada nivel.',
  },

  countdown: {
    lineup: 'En juego',
    swapping: 'Cambiando…',
    swapHint: (reserve) => `Toca un tema para cambiarlo · ${reserve} en reserva`,
  },

  run: {
    meta: (words, skips) =>
      `${words} ${plural(words, 'palabra', 'palabras')} · ${skips} ${plural(skips, 'saltada', 'saltadas')}`,
    placeholder: (letter) => `una palabra con ${letter}…`,
    fieldLabel: (letter, category) => `Palabra con ${letter}, categoría ${category}`,
    skip: (seconds) => `Saltar −${seconds} s`,
    submit: 'Validar',
    approximate: 'ortografía aproximada',
    oneLetterOff: 'a una letra…',
    startsWith: (letter) => `empieza por ${letter}`,
    already: 'ya dada',
    unknown: 'no está en el diccionario',
    proposed: 'propuesta, gracias',
    propose: 'proponerla',
  },

  offer: {
    title: 'Nueva categoría',
    more: (count) => `quedan ${count} por elegir`,
    lead: 'Elige la que se une a tus partidas.',
    adNotice: 'Tras tu elección verás un anuncio breve: así apoyas al creador del juego. ¡Gracias!',
  },

  over: {
    timeUp: 'Se acabó el tiempo',
    points: 'puntos',
    empty: 'Ni una sola palabra. Pasa.',
    next: 'Continuar',
    earned: (count) => plural(count, 'Novedad para tu avatar', 'Novedades para tu avatar'),
    customize: 'Personalizar mi avatar',
    words: (count) => plural(count, 'palabra', 'palabras'),
    bestCombo: 'mejor racha',
    newRecord: 'nuevo récord',
    record: 'récord',
    dayBoard: 'Clasificación del día',
    keepTitle: 'Guarda esta partida',
    keepLead: 'Crea una cuenta o inicia sesión: esta partida y todo tu progreso entran en ella al instante.',
    savedTo: ['Partida guardada en la cuenta ', ''],
    replay: 'Volver a jugar',
    home: 'Inicio',
    level: (level) => `Nivel ${level}`,
    towards: (into, span, next) => `${into} / ${span} XP hacia el nivel ${next}`,
    levelUp: 'Subes de nivel',
    levelReached: (level) => `Nivel ${level} alcanzado`,
  },

  account: {
    register: 'Crear una cuenta',
    logIn: 'Iniciar sesión',
    name: 'Nombre de cuenta',
    email: 'Correo electrónico',
    password: 'Contraseña',
    submitRegister: 'Crear mi cuenta',
    submitLogIn: 'Entrar',
    confirmationSent: (email) => `Hemos enviado un enlace de confirmación a ${email}.`,
    errors: {
      unreachable: 'El servidor no responde. Vuelve a intentarlo en un momento.',
      'email-taken': 'Esta dirección ya tiene una cuenta: inicia sesión.',
      'weak-password': 'Contraseña demasiado débil: seis caracteres como mínimo.',
      'short-password': 'Contraseña demasiado corta: seis caracteres como mínimo.',
      'wrong-credentials': 'Dirección o contraseña incorrecta.',
      'invalid-email': 'Esta dirección no es válida.',
      'rate-limited': 'Demasiados intentos seguidos. Espera un minuto.',
      'name-length': 'El nombre tiene entre 2 y 24 caracteres.',
      'name-reserved': 'Este nombre está reservado.',
      'name-taken': 'Este nombre ya está cogido.',
    },
  },

  boards: {
    title: 'Clasificación',
    day: {
      label: 'Día',
      caption: 'Mejor partida de hoy',
      empty: 'Nadie ha jugado todavía hoy.',
    },
    week: {
      label: 'Semana',
      caption: 'Mejor partida de la semana',
      empty: 'Nadie ha jugado todavía esta semana.',
    },
    discoveries: {
      label: 'Hallazgos',
      caption: 'Palabras que nadie había escrito en una semana',
      empty: 'Ningún hallazgo esta semana: te toca abrir el baile.',
    },
    words: (count) => plural(count, 'palabra', 'palabras'),
    ordinal: (rank) => `${rank}.º`,
    entered: (place) => `Entrada · ${place}`,
    climbed: (places, place) => `+${places} ${plural(places, 'puesto', 'puestos')} · ${place}`,
    held: (place) => `Sigues ${place}`,
  },

  menu: {
    title: 'Menú',
    close: 'Cerrar',
    panes: { profile: 'Perfil', social: 'Amigos', options: 'Opciones' },
    editAvatarLabel: 'Editar mi avatar',
    anonymous: 'Jugador anónimo',
    standing: (level, record) => `Nivel ${level} · récord ${record}`,
    editAvatar: 'Editar el avatar',
    signedInAs: (email) => `Conectado con ${email}`,
    logOut: 'Cerrar sesión',
    accountTitle: 'Tu cuenta',
    accountLead: 'Tus partidas te siguen de un dispositivo a otro, tu nombre entra en la clasificación y tus amigos pueden encontrarte.',
    offline: 'Sin conexión: tu progreso se queda en este dispositivo.',
  },

  social: {
    requests: {
      sent: (name) => `Solicitud enviada a ${name}.`,
      accepted: (name) => `${name} ya te lo había pedido: ahora sois amigos.`,
      already: () => 'Ya sois amigos, o tu solicitud espera respuesta.',
      self: () => 'Es tu propio nombre.',
      unknown: () => 'Ninguna cuenta con ese nombre.',
      anonymous: () => 'Crea una cuenta para añadir amigos.',
      unreachable: () => 'El servidor no responde. Vuelve a intentarlo en un momento.',
    },
    noServer: 'Los amigos necesitan conexión con el servidor del juego, que falta por ahora.',
    needAccount: 'Un amigo te encuentra por tu nombre de cuenta: créala primero, tus partidas jugadas te siguen.',
    createAccount: 'Crear mi cuenta',
    add: 'Añadir un amigo',
    addPlaceholder: 'Su nombre de cuenta',
    send: 'Enviar la solicitud',
    yourName: ['Tu nombre para compartir: ', ''],
    loadFailed: 'No se pueden cargar tus amigos ahora mismo.',
    incoming: 'Solicitudes recibidas',
    accept: 'Aceptar',
    decline: 'Rechazar',
    friends: 'Mis amigos',
    none: 'Aún no tienes amigos. Envía una solicitud con su nombre de cuenta.',
    outgoing: 'Esperando respuesta',
    stats: (level, week, record) => `Niv. ${level} · semana ${week} · récord ${record}`,
    remove: 'Quitar',
    keep: 'Mantener',
  },

  options: {
    theme: 'Tema',
    themes: { system: 'Auto', light: 'Claro', dark: 'Oscuro' },
    themeNote: '«Auto» sigue el ajuste del teléfono.',
    sound: 'Sonido',
    sounds: { effects: 'Efectos', keys: 'Teclado', music: 'Música', pulse: 'Pulso en partida' },
    soundNote: '«Pulso» añade un ritmo bajo la partida que se intensifica cada veinte segundos.',
    soundOff: 'Apagado',
    mute: 'Silenciar',
    unmute: 'Activar el sonido',
    language: 'Idioma',
    privacy: 'Privacidad',
    adPrivacy: 'Opciones de anuncios',
    erase: 'Borrar mis datos',
    eraseWarning: 'Se perderán el nivel, los récords, los amigos y las palabras propuestas.',
    erasing: 'Borrando…',
    eraseAll: 'Borrarlo todo',
    eraseFailed: 'El servidor no respondió, no se ha borrado nada.',
    retry: 'Reintentar',
    erased: 'Datos borrados.',
  },

  avatar: {
    title: 'Tu avatar',
    owned: (designs, allDesigns, colours, allColours) =>
      `${designs} / ${allDesigns} formas · ${colours} / ${allColours} colores`,
    lead: 'Las partidas, las rachas y los niveles desbloquean más.',
    layers: { ground: 'Fondo', shape: 'Forma', accent: 'Acento' },
    lockedColour: (colour) => `${colour}, bloqueado`,
    design: (number) => `Avatar ${number}`,
    lockedDesign: (number) => `Avatar ${number}, bloqueado`,
    unlockHint: (item, how) => `${item}: ${how}`,
    idle: 'Toca una casilla bloqueada para saber cómo conseguirla.',
    save: 'Quedarme este avatar',
    back: 'Volver',
    milestone: (milestone) => {
      switch (milestone.stat) {
        case 'level':
          return `nivel ${milestone.at}`
        case 'runs':
          return `${milestone.at} ${plural(milestone.at, 'partida', 'partidas')}`
        case 'bestScore':
          return `una puntuación de ${milestone.at}`
        case 'wordsFound':
          return `${milestone.at} palabras halladas`
        case 'bestCombo':
          return `una racha de ${milestone.at}`
      }
    },
  },

  tiers: { courant: 'común', 'peu commun': 'poco común', rare: 'rara', 'très rare': 'muy rara' },

  categories: {
    pays: ['Países', 'Estados del mundo, actuales o pasados'],
    animaux: ['Animales', 'Nombres comunes, del gorrión a la morsa'],
    couleurs: ['Colores', 'Tonos y matices'],
    'fruits-legumes': ['Frutas y verduras', 'Lo que se come, crudo o cocinado'],
    metiers: ['Oficios', 'Profesiones de ayer y de hoy'],
    sports: ['Deportes', 'Disciplinas y prácticas'],
    'corps-humain': ['Partes del cuerpo', 'De la cabeza a los pies'],
    matieres: ['Materiales', 'Madera, hierro, acero, arena…'],
    capitales: ['Capitales', 'Capitales del mundo'],
    marques: ['Marcas', 'Marcas conocidas'],
    insectes: ['Insectos', 'Insectos y bichitos'],
  },

  colours: {
    rouge: 'Rojo',
    bleu: 'Azul',
    jaune: 'Amarillo',
    noir: 'Negro',
    creme: 'Crema',
    vert: 'Verde',
    rose: 'Rosa',
    orange: 'Naranja',
    ciel: 'Celeste',
    brique: 'Ladrillo',
    citron: 'Limón',
    marine: 'Marino',
    corail: 'Coral',
    sauge: 'Salvia',
    moutarde: 'Mostaza',
    violet: 'Violeta',
    turquoise: 'Turquesa',
    ocre: 'Ocre',
    lavande: 'Lavanda',
    olive: 'Oliva',
    saumon: 'Salmón',
    canard: 'Petróleo',
    menthe: 'Menta',
    bordeaux: 'Burdeos',
    sable: 'Arena',
    outremer: 'Ultramar',
    emeraude: 'Esmeralda',
    prune: 'Ciruela',
    gris: 'Gris',
    anthracite: 'Antracita',
  },
}
