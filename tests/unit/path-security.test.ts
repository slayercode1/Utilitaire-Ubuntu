import { describe, expect, it } from 'vitest'

import { isPathInside } from '../../src/main/services/path-security.js'

describe('isPathInside', () => {
  it('accepte la racine et ses descendants', () => {
    expect(isPathInside('/home/alice', '/home/alice')).toBe(true)
    expect(isPathInside('/home/alice/Documents/a.txt', '/home/alice')).toBe(true)
  })

  it('respecte les frontières de segments', () => {
    expect(isPathInside('/home/alice-malware/a.txt', '/home/alice')).toBe(false)
    expect(isPathInside('/home/alice/../bob/a.txt', '/home/alice')).toBe(false)
  })
})
