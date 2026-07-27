/**
 * Finder - Position du curseur
 *
 * Sur cette configuration Linux/X11, `screen.getCursorScreenPoint()` d'Electron
 * renvoie une position figée : elle n'est pas rafraîchie tant que l'application
 * ne reçoit pas d'événement de souris. Comme Finder s'ouvre au clavier
 * (Alt+Space) sans que la souris ne survole sa fenêtre, la valeur retournée est
 * celle du dernier survol — souvent sur un autre écran.
 *
 * Ce module interroge donc le serveur X directement, via un interpréteur Python
 * maintenu en vie. Relancer un processus à chaque ouverture coûtait 24 ms
 * bloquantes sur le thread principal ; le dialogue avec un processus déjà
 * démarré prend moins d'une milliseconde.
 *
 * Sur les plateformes où l'interrogation directe est impossible (Wayland,
 * macOS, Windows), on retombe sur l'API d'Electron.
 */

import type { ChildProcessByStdio } from 'node:child_process'
import { execFileSync, spawn } from 'node:child_process'
import type { Readable, Writable } from 'node:stream'

/** Coordonnées écran, en pixels. */
export interface CursorPoint {
  x: number
  y: number
}

/**
 * Source de repli : seule la méthode utilisée est déclarée, pour que ce module
 * ne dépende pas du type Electron complet.
 */
export interface CursorPointSource {
  getCursorScreenPoint(): CursorPoint
}

/** Méthode retenue pour interroger le serveur X. */
type QueryStrategy = 'python' | 'xdotool' | null

/** Délai maximal accordé à la détection initiale, en millisecondes. */
const DETECTION_TIMEOUT = 2000

/**
 * Délai maximal d'attente d'une réponse du processus persistant.
 *
 * Volontairement court : au-delà, mieux vaut la position approximative
 * d'Electron qu'une fenêtre qui tarde à s'ouvrir.
 */
const RESPONSE_TIMEOUT = 60

/**
 * Indique si l'interrogation directe de X11 est envisageable.
 *
 * `XDG_SESSION_TYPE` décrit la session, pas le backend effectif : sous
 * XWayland elle vaut `wayland` alors que le serveur X répond. Seule la présence
 * de `DISPLAY` est déterminante, et l'échec de la détection initiale suffit à
 * écarter les sessions Wayland pures.
 */
const isX11 = process.platform === 'linux' && Boolean(process.env['DISPLAY'])

/**
 * Boucle Python : ouvre la connexion X une fois, puis répond à chaque ligne
 * reçue sur son entrée standard. C'est l'ouverture du display et le démarrage
 * de l'interpréteur qui coûtaient cher, pas la requête elle-même.
 */
const PYTHON_DAEMON = [
  'import ctypes,ctypes.util,sys',
  'X=ctypes.CDLL(ctypes.util.find_library("X11"))',
  'X.XOpenDisplay.restype=ctypes.c_void_p',
  'd=X.XOpenDisplay(None)',
  'r=X.XDefaultRootWindow(ctypes.c_void_p(d))',
  'a=ctypes.c_ulong();b=ctypes.c_ulong();x=ctypes.c_int();y=ctypes.c_int()',
  'wx=ctypes.c_int();wy=ctypes.c_int();m=ctypes.c_uint()',
  'for line in sys.stdin:',
  '    X.XQueryPointer(ctypes.c_void_p(d),r,ctypes.byref(a),ctypes.byref(b),' +
    'ctypes.byref(x),ctypes.byref(y),ctypes.byref(wx),ctypes.byref(wy),ctypes.byref(m))',
  '    sys.stdout.write("%d %d\\n" % (x.value, y.value))',
  '    sys.stdout.flush()'
].join('\n')

/** Version à usage unique, employée pour vérifier que Python et libX11 répondent. */
const PYTHON_PROBE =
  'import ctypes,ctypes.util;' +
  'X=ctypes.CDLL(ctypes.util.find_library("X11"));' +
  'X.XOpenDisplay.restype=ctypes.c_void_p;' +
  'assert X.XOpenDisplay(None)'

/** Stratégie détectée, calculée une seule fois. */
let strategy: QueryStrategy | undefined

/** Processus d'interrogation maintenu en vie. */
type CursorDaemon = ChildProcessByStdio<Writable, Readable, null>

let daemon: CursorDaemon | null = null

/**
 * Vérifie qu'une commande s'exécute sans erreur.
 */
function commandWorks(command: string, args: string[]): boolean {
  try {
    execFileSync(command, args, { stdio: 'ignore', timeout: DETECTION_TIMEOUT })
    return true
  } catch {
    return false
  }
}

/**
 * Détermine, une fois pour toutes, comment interroger le serveur X.
 */
function detectStrategy(): QueryStrategy {
  if (strategy !== undefined) return strategy

  strategy = null

  if (isX11) {
    // Python est préféré à xdotool : il permet un processus persistant, là où
    // xdotool doit être relancé à chaque interrogation.
    if (commandWorks('python3', ['-c', PYTHON_PROBE])) {
      strategy = 'python'
    } else if (commandWorks('xdotool', ['getmouselocation'])) {
      strategy = 'xdotool'
    } else {
      console.warn(
        'Position du curseur : ni python3+libX11 ni xdotool disponibles, ' +
          "repli sur Electron (l'ouverture multi-écrans peut être imprécise)"
      )
    }
  }

  return strategy
}

/**
 * Démarre le processus d'interrogation, ou le récupère s'il tourne déjà.
 *
 * @returns Le processus, ou `null` s'il n'a pas pu démarrer
 */
function ensureDaemon(): CursorDaemon | null {
  if (daemon && !daemon.killed && daemon.exitCode === null) {
    return daemon
  }

  if (detectStrategy() !== 'python') return null

  try {
    // -u : sortie non tamponnée, sans quoi les réponses resteraient bloquées
    const child = spawn('python3', ['-u', '-c', PYTHON_DAEMON], {
      stdio: ['pipe', 'pipe', 'ignore']
    })

    child.stdout.setEncoding('utf8')

    // Un processus mort ne doit pas rester référencé : la prochaine
    // interrogation en démarrera un neuf.
    const oublier = (): void => {
      if (daemon === child) daemon = null
    }
    child.on('exit', oublier)
    child.on('error', oublier)

    // Ne retient pas Electron en vie au moment de quitter
    child.unref()

    daemon = child
    return child
  } catch {
    return null
  }
}

/**
 * Démarre le processus d'interrogation par anticipation.
 *
 * Sans cela, la toute première ouverture de la fenêtre paierait les ~50 ms de
 * lancement de l'interpréteur. L'application restant résidente, ce coût est
 * mieux placé au démarrage.
 */
export function warmUpCursorDaemon(): void {
  ensureDaemon()
}

/**
 * Arrête le processus d'interrogation.
 *
 * Appelé à la fermeture de l'application : un processus Python orphelin
 * survivrait autrement à Finder.
 */
export function stopCursorDaemon(): void {
  if (!daemon) return

  daemon.removeAllListeners()
  daemon.stdout.removeAllListeners()
  daemon.kill()
  daemon = null
}

/**
 * Analyse une réponse « x y » du processus.
 */
function parseResponse(raw: string): CursorPoint | null {
  const [x, y] = raw.trim().split(/\s+/).map(Number)

  if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) {
    return { x, y }
  }

  return null
}

/**
 * Interroge le processus persistant.
 *
 * La réponse arrive typiquement en moins d'une milliseconde ; au-delà du délai
 * imparti, on rend la main pour ne pas retarder l'ouverture de la fenêtre.
 */
function queryDaemon(): Promise<CursorPoint | null> {
  const child = ensureDaemon()
  if (!child) return Promise.resolve(null)

  return new Promise((resolve) => {
    let termine = false

    const finir = (position: CursorPoint | null): void => {
      if (termine) return
      termine = true

      clearTimeout(minuteur)
      child.stdout.off('data', surReponse)
      resolve(position)
    }

    const surReponse = (chunk: string): void => {
      finir(parseResponse(chunk))
    }

    const minuteur = setTimeout(() => finir(null), RESPONSE_TIMEOUT)

    child.stdout.on('data', surReponse)

    try {
      child.stdin.write('\n')
    } catch {
      stopCursorDaemon()
      finir(null)
    }
  })
}

/**
 * Interroge xdotool, sans processus persistant.
 */
function queryXdotool(): CursorPoint | null {
  try {
    // Format : "x:1234 y:567 screen:0 window:12345"
    const output = execFileSync('xdotool', ['getmouselocation'], {
      encoding: 'utf8',
      timeout: DETECTION_TIMEOUT
    })

    const match = output.match(/x:(-?\d+)\s+y:(-?\d+)/)

    if (match?.[1] !== undefined && match[2] !== undefined) {
      return { x: parseInt(match[1], 10), y: parseInt(match[2], 10) }
    }
  } catch {
    // Serveur X indisponible : Electron répondra
  }

  return null
}

/**
 * Retourne la position réelle du curseur.
 *
 * @param screen - Module `screen` d'Electron, utilisé en repli
 */
export async function getCursorPosition(screen: CursorPointSource): Promise<CursorPoint> {
  const mode = detectStrategy()

  if (mode === 'python') {
    const position = await queryDaemon()
    if (position) return position
  } else if (mode === 'xdotool') {
    const position = queryXdotool()
    if (position) return position
  }

  return screen.getCursorScreenPoint()
}
