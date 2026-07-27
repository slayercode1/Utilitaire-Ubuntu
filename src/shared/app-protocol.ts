/** Origine interne utilisée pour servir le renderer sans privilèges file://. */
export const APP_SCHEME = 'finder-app'
export const APP_HOST = 'renderer'
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`
export const APP_RENDERER_URL = `${APP_ORIGIN}/index.html`
