import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  getMediaCandidate,
  isIndexedMediaPath,
  isSupportedMediaPath,
  resolveRendererAsset
} from '../../src/main/services/protocol-security.js'
import { APP_ORIGIN, APP_RENDERER_URL } from '../../src/shared/app-protocol.js'
import type { AppEntry, FileEntry } from '../../src/shared/types.js'

const rendererRoot = path.join('/opt', 'finder', 'dist', 'renderer')

const application: AppEntry = {
  name: 'Exemple',
  description: '',
  icon: 'exemple',
  iconPath: '/usr/share/icons/exemple.svg',
  exec: '/usr/bin/exemple',
  path: '/usr/share/applications/exemple.desktop',
  hidden: false
}

const image: FileEntry = {
  path: '/home/alice/Images/photo.png',
  name: 'photo.png',
  type: 'file'
}

describe('protocole applicatif', () => {
  it('utilise une origine dédiée et non file://', () => {
    expect(APP_RENDERER_URL).toBe('finder-app://renderer/index.html')
    expect(APP_RENDERER_URL.startsWith('file:')).toBe(false)
  })

  it('ne sert que les ressources renderer explicitement autorisées', () => {
    expect(resolveRendererAsset(APP_RENDERER_URL, rendererRoot)).toBe(
      path.join(rendererRoot, 'index.html')
    )
    expect(
      resolveRendererAsset(
        'finder-app://renderer/features/conversion/evaluate-math.js',
        rendererRoot
      )
    ).toBe(path.join(rendererRoot, 'features/conversion/evaluate-math.js'))

    expect(resolveRendererAsset('finder-app://renderer/../main/index.js', rendererRoot)).toBeNull()
    expect(resolveRendererAsset('finder-app://renderer/main.js.map', rendererRoot)).toBeNull()
    expect(resolveRendererAsset('finder-app://other/index.html', rendererRoot)).toBeNull()
    expect(
      resolveRendererAsset('finder-app://renderer/index.html?debug=1', rendererRoot)
    ).toBeNull()
  })

  it('encode et extrait un chemin média absolu unique', () => {
    const mediaUrl = `${APP_ORIGIN}/media?path=${encodeURIComponent(image.path)}`
    expect(getMediaCandidate(mediaUrl)).toBe(image.path)
    expect(getMediaCandidate('finder-app://renderer/media?path=relative.png')).toBeNull()
    expect(
      getMediaCandidate('finder-app://renderer/media?path=%2Ftmp%2Fa.png&path=%2Ftmp%2Fb.png')
    ).toBeNull()
    expect(getMediaCandidate('finder-app://renderer/media?path=%2Ftmp%2Fa.png&extra=1')).toBeNull()
  })

  it('refuse les fichiers non indexés et les formats non image', () => {
    expect(isIndexedMediaPath(application.iconPath, [application], [image])).toBe(true)
    expect(isIndexedMediaPath(image.path, [application], [image])).toBe(true)
    expect(isIndexedMediaPath('/home/alice/secret.png', [application], [image])).toBe(false)
    expect(isIndexedMediaPath('/home/alice/Images/notes.txt', [application], [image])).toBe(false)
    expect(isSupportedMediaPath('/tmp/image.SVG')).toBe(true)
    expect(isSupportedMediaPath('/tmp/image.html')).toBe(false)
  })
})
