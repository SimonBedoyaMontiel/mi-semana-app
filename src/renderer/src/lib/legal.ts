import { WEB_APP_URL } from '@shared/constants'

/** Legal pages live in the web app; desktop opens them in the browser. */
export const legalUrl = (page: 'privacidad' | 'terminos'): string =>
  window.api.platform === 'web' ? `./${page}.html` : `${WEB_APP_URL}${page}.html`
