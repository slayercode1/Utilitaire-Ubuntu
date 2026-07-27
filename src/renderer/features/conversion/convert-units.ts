/**
 * Finder - Conversion d'unités
 *
 * Reconnaît les requêtes de la forme « 100 cm to m » et applique une table de
 * facteurs. Les taux de change sont figés : ils donnent un ordre de grandeur,
 * pas une valeur de marché.
 *
 * Module sans dépendance au DOM, donc vérifiable sans navigateur.
 */

/** Résultat d'une conversion réussie. */
export interface ConversionResult {
  /** Valeur convertie, prête à l'affichage. */
  result: string
  /** Égalité complète, montrant la valeur d'origine. */
  description: string
}

/** Facteur multiplicatif, ou formule pour les conversions non linéaires. */
type ConversionFactor = number | ((value: number) => number)

/** Table des conversions : catégorie → unité source → unité cible. */
type ConversionTable = Record<string, Record<string, Record<string, ConversionFactor>>>

/**
 * Tables de conversion, construites une seule fois au chargement du module :
 * `tryConversion` est appelée à chaque frappe contenant « to ».
 */
const CONVERSIONS: ConversionTable = {
  // ===== DEVISES =====
  currencies: {
    usd: { eur: 0.92, gbp: 0.79, jpy: 149.5, cad: 1.36, chf: 0.88, aud: 1.52, cny: 7.24 },
    $: { eur: 0.92, '€': 0.92, gbp: 0.79, '£': 0.79, jpy: 149.5, '¥': 149.5 },
    eur: { usd: 1.09, gbp: 0.86, jpy: 163, cad: 1.48, chf: 0.96, aud: 1.65, cny: 7.87 },
    '€': { usd: 1.09, $: 1.09, gbp: 0.86, '£': 0.86, jpy: 163, '¥': 163 },
    gbp: { usd: 1.27, eur: 1.16, jpy: 189, cad: 1.72, chf: 1.11, aud: 1.92, cny: 9.15 },
    '£': { usd: 1.27, $: 1.27, eur: 1.16, '€': 1.16, jpy: 189, '¥': 189 },
    jpy: { usd: 0.0067, eur: 0.0061, gbp: 0.0053, cad: 0.0091, chf: 0.0059 },
    '¥': { usd: 0.0067, $: 0.0067, eur: 0.0061, '€': 0.0061, gbp: 0.0053, '£': 0.0053 },
    cad: { usd: 0.74, eur: 0.68, gbp: 0.58, jpy: 110, chf: 0.65 },
    chf: { usd: 1.14, eur: 1.04, gbp: 0.9, jpy: 170, cad: 1.54 },
    aud: { usd: 0.66, eur: 0.61, gbp: 0.52, jpy: 98, cad: 0.89 },
    cny: { usd: 0.14, eur: 0.13, gbp: 0.11, jpy: 20.7, cad: 0.19 }
  },

  // ===== LONGUEURS / DISTANCES =====
  length: {
    // Métriques
    km: {
      m: 1000,
      cm: 100000,
      mm: 1000000,
      µm: 1e9,
      nm: 1e12,
      mi: 0.621371,
      yd: 1093.61,
      ft: 3280.84,
      in: 39370.1
    },
    m: {
      km: 0.001,
      cm: 100,
      mm: 1000,
      µm: 1e6,
      nm: 1e9,
      mi: 0.000621371,
      yd: 1.09361,
      ft: 3.28084,
      in: 39.3701
    },
    cm: {
      km: 0.00001,
      m: 0.01,
      mm: 10,
      µm: 10000,
      nm: 1e7,
      mi: 0.00000621371,
      yd: 0.0109361,
      ft: 0.0328084,
      in: 0.393701
    },
    mm: {
      km: 0.000001,
      m: 0.001,
      cm: 0.1,
      µm: 1000,
      nm: 1e6,
      mi: 0.000000621371,
      yd: 0.00109361,
      ft: 0.00328084,
      in: 0.0393701
    },
    µm: { km: 1e-9, m: 1e-6, cm: 1e-4, mm: 0.001, nm: 1000, in: 0.0000393701 },
    nm: { km: 1e-12, m: 1e-9, cm: 1e-7, mm: 1e-6, µm: 0.001, in: 0.0000000393701 },
    // Impériales
    mi: { km: 1.60934, m: 1609.34, cm: 160934, mm: 1609340, yd: 1760, ft: 5280, in: 63360 },
    yd: { km: 0.0009144, m: 0.9144, cm: 91.44, mm: 914.4, mi: 0.000568182, ft: 3, in: 36 },
    ft: { km: 0.0003048, m: 0.3048, cm: 30.48, mm: 304.8, mi: 0.000189394, yd: 0.333333, in: 12 },
    in: {
      km: 0.0000254,
      m: 0.0254,
      cm: 2.54,
      mm: 25.4,
      µm: 25400,
      nm: 25400000,
      mi: 0.000015783,
      yd: 0.0277778,
      ft: 0.0833333
    }
  },

  // ===== POIDS / MASSES =====
  weight: {
    // Métriques
    kg: { g: 1000, mg: 1e6, µg: 1e9, t: 0.001, lb: 2.20462, oz: 35.274, ton: 0.00110231 },
    g: { kg: 0.001, mg: 1000, µg: 1e6, t: 1e-6, lb: 0.00220462, oz: 0.035274 },
    mg: { kg: 1e-6, g: 0.001, µg: 1000, t: 1e-9, lb: 0.00000220462, oz: 0.000035274 },
    µg: { kg: 1e-9, g: 1e-6, mg: 0.001, t: 1e-12 },
    t: { kg: 1000, g: 1e6, mg: 1e9, lb: 2204.62, oz: 35274, ton: 1.10231 },
    // Impériales
    lb: { kg: 0.453592, g: 453.592, mg: 453592, oz: 16, ton: 0.0005 },
    oz: { kg: 0.0283495, g: 28.3495, mg: 28349.5, lb: 0.0625 },
    ton: { kg: 907.185, g: 907185, t: 0.907185, lb: 2000, oz: 32000 }
  },

  // ===== TEMPÉRATURES =====
  temperature: {
    c: {
      f: (v: number) => (v * 9) / 5 + 32,
      '°f': (v: number) => (v * 9) / 5 + 32,
      k: (v: number) => v + 273.15
    },
    '°c': {
      f: (v: number) => (v * 9) / 5 + 32,
      '°f': (v: number) => (v * 9) / 5 + 32,
      k: (v: number) => v + 273.15
    },
    f: {
      c: (v: number) => ((v - 32) * 5) / 9,
      '°c': (v: number) => ((v - 32) * 5) / 9,
      k: (v: number) => ((v - 32) * 5) / 9 + 273.15
    },
    '°f': {
      c: (v: number) => ((v - 32) * 5) / 9,
      '°c': (v: number) => ((v - 32) * 5) / 9,
      k: (v: number) => ((v - 32) * 5) / 9 + 273.15
    },
    k: {
      c: (v: number) => v - 273.15,
      '°c': (v: number) => v - 273.15,
      f: (v: number) => ((v - 273.15) * 9) / 5 + 32,
      '°f': (v: number) => ((v - 273.15) * 9) / 5 + 32
    }
  },

  // ===== VOLUMES / CAPACITÉS =====
  volume: {
    // Métriques
    l: {
      ml: 1000,
      cl: 100,
      dl: 10,
      'm³': 0.001,
      'cm³': 1000,
      gal: 0.264172,
      qt: 1.05669,
      pt: 2.11338,
      cup: 4.22675,
      floz: 33.814
    },
    ml: {
      l: 0.001,
      cl: 0.1,
      dl: 0.01,
      'm³': 1e-6,
      'cm³': 1,
      gal: 0.000264172,
      qt: 0.00105669,
      pt: 0.00211338,
      cup: 0.00422675,
      floz: 0.033814
    },
    cl: {
      l: 0.01,
      ml: 10,
      dl: 0.1,
      'm³': 0.00001,
      'cm³': 10,
      gal: 0.00264172,
      qt: 0.0105669,
      pt: 0.0211338,
      cup: 0.0422675,
      floz: 0.33814
    },
    dl: {
      l: 0.1,
      ml: 100,
      cl: 10,
      'm³': 0.0001,
      'cm³': 100,
      gal: 0.0264172,
      qt: 0.105669,
      pt: 0.211338,
      cup: 0.422675,
      floz: 3.3814
    },
    'm³': { l: 1000, ml: 1e6, cl: 100000, 'cm³': 1e6, gal: 264.172, qt: 1056.69 },
    'cm³': { l: 0.001, ml: 1, cl: 0.1, 'm³': 1e-6 },
    // Impériales / US
    gal: { l: 3.78541, ml: 3785.41, cl: 378.541, qt: 4, pt: 8, cup: 16, floz: 128 },
    qt: { l: 0.946353, ml: 946.353, cl: 94.6353, gal: 0.25, pt: 2, cup: 4, floz: 32 },
    pt: { l: 0.473176, ml: 473.176, cl: 47.3176, gal: 0.125, qt: 0.5, cup: 2, floz: 16 },
    cup: { l: 0.236588, ml: 236.588, cl: 23.6588, gal: 0.0625, qt: 0.25, pt: 0.5, floz: 8 },
    floz: {
      l: 0.0295735,
      ml: 29.5735,
      cl: 2.95735,
      gal: 0.0078125,
      qt: 0.03125,
      pt: 0.0625,
      cup: 0.125
    }
  },

  // ===== SURFACES / AIRES =====
  area: {
    // Métriques
    'km²': {
      'm²': 1e6,
      'cm²': 1e10,
      ha: 100,
      a: 10000,
      'mi²': 0.386102,
      ac: 247.105,
      'yd²': 1.196e6,
      'ft²': 1.076e7
    },
    'm²': {
      'km²': 1e-6,
      'cm²': 10000,
      'mm²': 1e6,
      ha: 0.0001,
      a: 0.01,
      'mi²': 3.861e-7,
      ac: 0.000247105,
      'yd²': 1.19599,
      'ft²': 10.7639,
      'in²': 1550
    },
    'cm²': { 'km²': 1e-10, 'm²': 0.0001, 'mm²': 100, 'in²': 0.155 },
    'mm²': { 'm²': 1e-6, 'cm²': 0.01, 'in²': 0.00155 },
    ha: { 'km²': 0.01, 'm²': 10000, a: 100, ac: 2.47105 },
    a: { 'km²': 0.0001, 'm²': 100, ha: 0.01 },
    // Impériales
    'mi²': { 'km²': 2.58999, 'm²': 2.59e6, ha: 259, ac: 640, 'yd²': 3.098e6, 'ft²': 2.788e7 },
    ac: {
      'km²': 0.00404686,
      'm²': 4046.86,
      ha: 0.404686,
      'mi²': 0.0015625,
      'yd²': 4840,
      'ft²': 43560
    },
    'yd²': {
      'km²': 8.361e-7,
      'm²': 0.836127,
      'mi²': 3.228e-7,
      ac: 0.000206612,
      'ft²': 9,
      'in²': 1296
    },
    'ft²': {
      'km²': 9.29e-8,
      'm²': 0.092903,
      'cm²': 929.03,
      'mi²': 3.587e-8,
      ac: 0.0000229568,
      'yd²': 0.111111,
      'in²': 144
    },
    'in²': { 'm²': 0.00064516, 'cm²': 6.4516, 'mm²': 645.16, 'ft²': 0.00694444, 'yd²': 0.000771605 }
  },

  // ===== VITESSES =====
  speed: {
    'km/h': { 'm/s': 0.277778, mph: 0.621371, 'ft/s': 0.911344, knot: 0.539957 },
    kmh: { 'm/s': 0.277778, mph: 0.621371, 'ft/s': 0.911344, knot: 0.539957 },
    kph: { 'm/s': 0.277778, mph: 0.621371, 'ft/s': 0.911344, knot: 0.539957 },
    'm/s': { 'km/h': 3.6, kmh: 3.6, kph: 3.6, mph: 2.23694, 'ft/s': 3.28084, knot: 1.94384 },
    mph: {
      'km/h': 1.60934,
      kmh: 1.60934,
      kph: 1.60934,
      'm/s': 0.44704,
      'ft/s': 1.46667,
      knot: 0.868976
    },
    'ft/s': { 'km/h': 1.09728, kmh: 1.09728, 'm/s': 0.3048, mph: 0.681818, knot: 0.592484 },
    knot: { 'km/h': 1.852, kmh: 1.852, 'm/s': 0.514444, mph: 1.15078, 'ft/s': 1.68781 }
  },

  // ===== TEMPS =====
  time: {
    s: {
      ms: 1000,
      µs: 1e6,
      ns: 1e9,
      min: 0.0166667,
      h: 0.000277778,
      d: 0.0000115741,
      week: 0.00000165344,
      month: 3.8052e-7,
      year: 3.171e-8
    },
    ms: { s: 0.001, µs: 1000, ns: 1e6, min: 0.0000166667, h: 2.7778e-7 },
    µs: { s: 1e-6, ms: 0.001, ns: 1000 },
    ns: { s: 1e-9, ms: 1e-6, µs: 0.001 },
    min: {
      s: 60,
      ms: 60000,
      h: 0.0166667,
      d: 0.000694444,
      week: 0.0000992063,
      month: 0.0000228154,
      year: 0.00000190259
    },
    h: {
      s: 3600,
      ms: 3.6e6,
      min: 60,
      d: 0.0416667,
      week: 0.00595238,
      month: 0.00136895,
      year: 0.000114155
    },
    d: {
      s: 86400,
      ms: 8.64e7,
      min: 1440,
      h: 24,
      week: 0.142857,
      month: 0.0328767,
      year: 0.00273973
    },
    day: {
      s: 86400,
      ms: 8.64e7,
      min: 1440,
      h: 24,
      week: 0.142857,
      month: 0.0328767,
      year: 0.00273973
    },
    week: { s: 604800, min: 10080, h: 168, d: 7, day: 7, month: 0.230137, year: 0.0191781 },
    month: {
      s: 2.628e6,
      min: 43800,
      h: 730,
      d: 30.4167,
      day: 30.4167,
      week: 4.34524,
      year: 0.0833333
    },
    year: { s: 3.154e7, min: 525600, h: 8760, d: 365, day: 365, week: 52.1429, month: 12 }
  },

  // ===== DONNÉES INFORMATIQUES =====
  data: {
    // Bytes
    b: {
      kb: 0.001,
      mb: 1e-6,
      gb: 1e-9,
      tb: 1e-12,
      pb: 1e-15,
      kib: 0.0009765625,
      mib: 9.537e-7,
      gib: 9.313e-10,
      tib: 9.095e-13
    },
    kb: {
      b: 1000,
      mb: 0.001,
      gb: 1e-6,
      tb: 1e-9,
      pb: 1e-12,
      kib: 0.9765625,
      mib: 0.000953674,
      gib: 9.313e-7,
      tib: 9.095e-10
    },
    mb: {
      b: 1e6,
      kb: 1000,
      gb: 0.001,
      tb: 1e-6,
      pb: 1e-9,
      kib: 976.5625,
      mib: 0.953674,
      gib: 0.000931323,
      tib: 9.095e-7
    },
    gb: {
      b: 1e9,
      kb: 1e6,
      mb: 1000,
      tb: 0.001,
      pb: 1e-6,
      kib: 976562.5,
      mib: 953.674,
      gib: 0.931323,
      tib: 0.000909495
    },
    tb: {
      b: 1e12,
      kb: 1e9,
      mb: 1e6,
      gb: 1000,
      pb: 0.001,
      mib: 953674,
      gib: 931.323,
      tib: 0.909495
    },
    pb: { b: 1e15, kb: 1e12, mb: 1e9, gb: 1e6, tb: 1000, gib: 931323, tib: 909.495 },
    // Binary (IEC)
    kib: { b: 1024, kb: 1.024, mib: 0.0009765625, gib: 9.537e-7, tib: 9.313e-10 },
    mib: { b: 1048576, kb: 1048.576, mb: 1.048576, kib: 1024, gib: 0.0009765625, tib: 9.537e-7 },
    gib: {
      b: 1073741824,
      kb: 1073741.824,
      mb: 1073.741824,
      gb: 1.073741824,
      kib: 1048576,
      mib: 1024,
      tib: 0.0009765625
    },
    tib: {
      b: 1099511627776,
      kb: 1099511627.776,
      mb: 1099511.627776,
      gb: 1099.511627776,
      tb: 1.099511627776,
      kib: 1073741824,
      mib: 1048576,
      gib: 1024
    }
  },

  // ===== PIXELS / WEB =====
  web: {
    px: {
      rem: (v, base = 16) => v / base,
      em: (v, base = 16) => v / base,
      pt: 0.75,
      cm: 0.0264583,
      mm: 0.264583,
      in: 0.0104167
    },
    rem: {
      px: (v, base = 16) => v * base,
      em: (v: number) => v,
      pt: (v, base = 16) => v * base * 0.75,
      cm: (v, base = 16) => v * base * 0.0264583,
      mm: (v, base = 16) => v * base * 0.264583,
      in: (v, base = 16) => v * base * 0.0104167
    },
    em: {
      px: (v, base = 16) => v * base,
      rem: (v: number) => v,
      pt: (v, base = 16) => v * base * 0.75,
      cm: (v, base = 16) => v * base * 0.0264583,
      mm: (v, base = 16) => v * base * 0.264583,
      in: (v, base = 16) => v * base * 0.0104167
    },
    pt: {
      px: 1.33333,
      rem: (v, base = 16) => (v * 1.33333) / base,
      em: (v, base = 16) => (v * 1.33333) / base,
      cm: 0.0352778,
      mm: 0.352778,
      in: 0.0138889
    },
    '%': { decimal: 0.01 },
    percent: { decimal: 0.01 },
    decimal: { '%': 100, percent: 100 }
  },

  // ===== ANGLES =====
  angle: {
    deg: { rad: 0.0174533, grad: 1.11111, turn: 0.00277778 },
    '°': { rad: 0.0174533, grad: 1.11111, turn: 0.00277778 },
    rad: { deg: 57.2958, '°': 57.2958, grad: 63.662, turn: 0.159155 },
    grad: { deg: 0.9, '°': 0.9, rad: 0.015708, turn: 0.0025 },
    turn: { deg: 360, '°': 360, rad: 6.28319, grad: 400 }
  },

  // ===== PRESSION =====
  pressure: {
    pa: {
      kpa: 0.001,
      mpa: 1e-6,
      bar: 0.00001,
      mbar: 0.01,
      psi: 0.000145038,
      atm: 0.00000986923,
      torr: 0.00750062,
      mmhg: 0.00750062
    },
    kpa: {
      pa: 1000,
      mpa: 0.001,
      bar: 0.01,
      mbar: 10,
      psi: 0.145038,
      atm: 0.00986923,
      torr: 7.50062,
      mmhg: 7.50062
    },
    mpa: { pa: 1e6, kpa: 1000, bar: 10, psi: 145.038, atm: 9.86923 },
    bar: {
      pa: 100000,
      kpa: 100,
      mpa: 0.1,
      mbar: 1000,
      psi: 14.5038,
      atm: 0.986923,
      torr: 750.062,
      mmhg: 750.062
    },
    mbar: { pa: 100, kpa: 0.1, bar: 0.001, psi: 0.0145038, atm: 0.000986923 },
    psi: {
      pa: 6894.76,
      kpa: 6.89476,
      mpa: 0.00689476,
      bar: 0.0689476,
      mbar: 68.9476,
      atm: 0.068046,
      torr: 51.7149,
      mmhg: 51.7149
    },
    atm: {
      pa: 101325,
      kpa: 101.325,
      mpa: 0.101325,
      bar: 1.01325,
      mbar: 1013.25,
      psi: 14.6959,
      torr: 760,
      mmhg: 760
    },
    torr: { pa: 133.322, kpa: 0.133322, bar: 0.00133322, psi: 0.0193368, atm: 0.00131579, mmhg: 1 },
    mmhg: { pa: 133.322, kpa: 0.133322, bar: 0.00133322, psi: 0.0193368, atm: 0.00131579, torr: 1 }
  },

  // ===== ÉNERGIE =====
  energy: {
    j: {
      kj: 0.001,
      cal: 0.239006,
      kcal: 0.000239006,
      wh: 0.000277778,
      kwh: 2.778e-7,
      ev: 6.242e18,
      btu: 0.000947817
    },
    kj: { j: 1000, cal: 239.006, kcal: 0.239006, wh: 0.277778, kwh: 0.000277778, btu: 0.947817 },
    cal: { j: 4.184, kj: 0.004184, kcal: 0.001, wh: 0.00116222, kwh: 1.16222e-6 },
    kcal: { j: 4184, kj: 4.184, cal: 1000, wh: 1.16222, kwh: 0.00116222, btu: 3.96567 },
    wh: { j: 3600, kj: 3.6, cal: 860.421, kcal: 0.860421, kwh: 0.001, btu: 3.41214 },
    kwh: { j: 3.6e6, kj: 3600, cal: 860421, kcal: 860.421, wh: 1000, btu: 3412.14 },
    ev: { j: 1.602e-19, kj: 1.602e-22 },
    btu: { j: 1055.06, kj: 1.05506, cal: 252.164, kcal: 0.252164, wh: 0.293071, kwh: 0.000293071 }
  },

  // ===== PUISSANCE =====
  power: {
    w: { kw: 0.001, mw: 1e-6, hp: 0.00134102, 'btu/h': 3.41214 },
    kw: { w: 1000, mw: 0.001, hp: 1.34102, 'btu/h': 3412.14 },
    mw: { w: 1e6, kw: 1000, hp: 1341.02, 'btu/h': 3412140 },
    hp: { w: 745.7, kw: 0.7457, mw: 0.0007457, 'btu/h': 2544.43 },
    'btu/h': { w: 0.293071, kw: 0.000293071, hp: 0.000392832 }
  }
}

/** Reconnaît « valeur unité_source to unité_destination » et convertit. */
/**
 * Index plat (« source→cible » → facteur), construit une seule fois.
 *
 * La recherche par catégories parcourait jusqu'à treize tables à chaque
 * frappe ; une Map ramène la résolution à un accès. L'ordre d'insertion
 * préserve la priorité des catégories : pour une paire ambiguë (« pt »
 * pinte avant « pt » typographique), la première déclaration l'emporte,
 * exactement comme le faisait le parcours séquentiel.
 */
const FACTOR_INDEX: ReadonlyMap<string, ConversionFactor> = (() => {
  const index = new Map<string, ConversionFactor>()

  for (const table of Object.values(CONVERSIONS)) {
    for (const [fromUnit, targets] of Object.entries(table)) {
      for (const [toUnit, factor] of Object.entries(targets)) {
        const key = `${fromUnit}\u0000${toUnit}`
        if (!index.has(key)) index.set(key, factor)
      }
    }
  }

  return index
})()

/** Reconnaît « valeur unité_source to unité_cible » ; compilée une seule fois. */
const CONVERSION_QUERY = /^([\d.,]+)\s*([a-zA-Z€$£¥°%]+)\s+to\s+([a-zA-Z€$£¥°%]+)$/i

export function tryConversion(query: string): ConversionResult | null {
  const match = query.match(CONVERSION_QUERY)

  if (!match) return null

  const [, rawValue, rawFrom, rawTo] = match
  if (rawValue === undefined || rawFrom === undefined || rawTo === undefined) {
    return null
  }

  const value = parseFloat(rawValue.replace(',', '.'))
  const fromUnit = rawFrom.toLowerCase()
  const toUnit = rawTo.toLowerCase()

  if (Number.isNaN(value)) return null

  const factor = FACTOR_INDEX.get(`${fromUnit}\u0000${toUnit}`)
  if (factor === undefined) return null

  // Une formule couvre les conversions non linéaires (températures) ;
  // un nombre suffit pour les rapports constants.
  const result = typeof factor === 'function' ? factor(value) : value * factor

  // Notation exponentielle hors de la plage lisible en décimal
  const magnitude = Math.abs(result)
  const formattedResult =
    magnitude >= 1_000_000 || (magnitude < 0.01 && result !== 0)
      ? result.toExponential(2)
      : result.toFixed(6).replace(/\.?0+$/, '')

  return {
    result: `${formattedResult} ${toUnit.toUpperCase()}`,
    description: `${value} ${fromUnit.toUpperCase()} = ${formattedResult} ${toUnit.toUpperCase()}`
  }
}
