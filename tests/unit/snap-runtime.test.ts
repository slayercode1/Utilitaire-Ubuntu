/**
 * Comportements propres au paquet snap : commande d'autostart stable et
 * environnement transmis aux applications lancées.
 */

import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { isPackaged: true, getPath: () => '/tmp' }
}))

import { resolveAutostartCommand } from '../../src/main/lifecycle.js'
import { hostEnvironment } from '../../src/main/services/launcher.js'

const SNAP_ENV = {
  SNAP: '/snap/finder/27',
  SNAP_NAME: 'finder',
  SNAP_INSTANCE_NAME: 'finder',
  SNAP_REVISION: '27',
  SNAP_USER_DATA: '/home/alice/snap/finder/27',
  SNAP_REAL_HOME: '/home/alice'
}

describe('resolveAutostartCommand', () => {
  it('snap : désigne /snap/bin, jamais le chemin de révision', () => {
    expect(resolveAutostartCommand(SNAP_ENV, '/snap/finder/27/finder')).toBe('/snap/bin/finder')
  })

  it('snap installé en instance parallèle : utilise le nom d’instance', () => {
    const env = { ...SNAP_ENV, SNAP_INSTANCE_NAME: 'finder_beta' }
    expect(resolveAutostartCommand(env, '/snap/finder/27/finder')).toBe('/snap/bin/finder_beta')
  })

  it('snap : refuse un nom qui ne respecte pas la grammaire snapd', () => {
    const env = { ...SNAP_ENV, SNAP_INSTANCE_NAME: '../../bin/sh', SNAP_NAME: '' }
    expect(resolveAutostartCommand(env, '/snap/finder/27/finder')).toBe('/snap/finder/27/finder')
  })

  it('AppImage : désigne le fichier AppImage, pas le point de montage', () => {
    expect(
      resolveAutostartCommand(
        { APPIMAGE: '/home/alice/Finder.AppImage' },
        '/tmp/.mount_Finder/finder'
      )
    ).toBe('/home/alice/Finder.AppImage')
  })

  it('.deb : conserve l’exécutable installé', () => {
    expect(resolveAutostartCommand({}, '/opt/Finder/finder')).toBe('/opt/Finder/finder')
  })
})

describe('hostEnvironment', () => {
  it('retire les variables du snap de Finder et garde le reste', () => {
    const env = hostEnvironment({
      ...SNAP_ENV,
      HOME: '/home/alice',
      PATH: '/usr/bin',
      SNAPSHOT: 'x'
    })
    expect(env).toEqual({ HOME: '/home/alice', PATH: '/usr/bin', SNAPSHOT: 'x' })
  })

  it('hors snap, transmet l’environnement tel quel', () => {
    const env = { HOME: '/home/alice', SNAP_NAME: 'autre' }
    expect(hostEnvironment(env)).toBe(env)
  })
})
