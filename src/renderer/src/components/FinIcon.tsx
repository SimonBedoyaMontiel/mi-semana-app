import type { CSSProperties, ReactNode } from 'react'
import type { FinIconName } from '@shared/model'
import { cx } from '@/components/primitives'

/** Line icons for money: each has a moving part (`.fx`) that plays when its row or button is hovered. */
const PATHS: Record<FinIconName, ReactNode> = {
  cubiertos: <><path d="M7 3v7a2 2 0 0 0 4 0V3M9 10v11" /><path className="fx" d="M16.5 21V3c-2 1.5-3 4-3 7 0 1.6.9 2.5 3 2.5" /></>,
  cafe: <><path d="M4.5 10h12v4.5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zM16.5 11.5h1a2.5 2.5 0 0 1 0 5h-1.3" /><path className="fx fx-steam" d="M8.5 3.5c-.8 1 .8 2-.1 3M12.5 3.5c-.8 1 .8 2-.1 3" /></>,
  pizza: <><path d="M3.5 7.5Q12 2.5 20.5 7.5L12 21z" /><path d="M5.2 10.5Q12 6.8 18.8 10.5" /><circle className="fx" cx="11" cy="13" r="1.3" /><circle className="fx" cx="13.6" cy="10" r="1" /></>,
  carrito: <><path d="M3 4h2.5l2.2 10.5h10.6L20.5 7H7" /><g className="fx"><circle cx="9.5" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></g></>,
  bolsa: <><path d="M5 8h14l-1 12.5H6z" /><path className="fx" d="M9 10V7a3 3 0 0 1 6 0v3" /></>,
  bus: <><rect x="5" y="3.5" width="14" height="14" rx="3" /><path d="M5 11h14M8.5 7h7" /><path className="fx" d="M8 17.5V20M16 17.5V20" /><circle cx="8.5" cy="14.3" r=".6" /><circle cx="15.5" cy="14.3" r=".6" /></>,
  carro: <><path d="M3.5 16v-3.5l2-5h13l2 5V16z" /><path d="M3.5 12.5h17" /><g className="fx"><circle cx="7.5" cy="16.5" r="1.8" /><circle cx="16.5" cy="16.5" r="1.8" /></g></>,
  moto: <><circle cx="5.5" cy="16" r="3" /><circle cx="18.5" cy="16" r="3" /><path className="fx" d="M5.5 16l4-6h5l4 6M13 6h3l1.5 4" /></>,
  gasolina: <><path d="M5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h6A1.5 1.5 0 0 1 14 5v15.5M3.5 20.5h12M5 10h9" /><path className="fx" d="M14 8l3 2.5V17a1.5 1.5 0 0 0 3 0V8.5L17.5 6" /></>,
  avion: <><path className="fx" d="M10.5 20.5l1.5-1 0-5 7.5 2.5v-2l-7.5-5V5a1.5 1.5 0 0 0-3 0v5l-7.5 5v2L9 14.5v5l1.5 1" transform="translate(1.5 0)" /></>,
  casa: <><path d="M4 11l8-7 8 7M6 9.5V20h12V9.5" /><path className="fx" d="M10 20v-5h4v5" /></>,
  rayo: <><path className="fx" d="M13.5 2.5L5.5 13.5h6l-1 8 8-11h-6z" /></>,
  agua: <><path className="fx" d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z" /><path d="M9 14.5a3 3 0 0 0 3 3" /></>,
  wifi: <><path d="M3 9.5a13 13 0 0 1 18 0" /><path className="fx" d="M6 13a8.5 8.5 0 0 1 12 0M9 16.4a4 4 0 0 1 6 0" /><circle cx="12" cy="19.5" r=".8" /></>,
  celular: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path className="fx" d="M10.5 18.5h3" /></>,
  corazon: <><path className="fx" d="M12 20s-7.5-4.5-7.5-10a4.3 4.3 0 0 1 7.5-2.8A4.3 4.3 0 0 1 19.5 10c0 5.5-7.5 10-7.5 10z" /></>,
  pastilla: <><g className="fx"><rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-40 12 12)" /><path d="M9.7 9.2l4.6 5.6" /></g></>,
  pesa: <><path d="M8 12h8" /><g className="fx"><path d="M3 9.5v5M6 7v10M18 7v10M21 9.5v5" /></g></>,
  juego: <><path d="M7 7.5h10a4.5 4.5 0 0 1 4.3 5.9l-.9 3a2.5 2.5 0 0 1-4.3.9L14.5 15h-5l-1.6 2.3a2.5 2.5 0 0 1-4.3-.9l-.9-3A4.5 4.5 0 0 1 7 7.5z" /><path d="M8 10v3.5M6.3 11.7h3.5" /><g className="fx"><circle cx="15.5" cy="10.8" r=".8" /><circle cx="17.5" cy="12.8" r=".8" /></g></>,
  musica: <><path d="M9 18V5.5l11-2V16" /><g className="fx"><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></g></>,
  pelicula: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path className="fx" d="M10 9v6l5-3z" /></>,
  birrete: <><path d="M2.5 9.5L12 5l9.5 4.5L12 14z" /><path d="M6.5 11.5V16c3 2.5 8 2.5 11 0v-4.5" /><path className="fx" d="M21.5 9.5V15" /></>,
  libro: <><path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5v13" /><path className="fx" d="M14.5 9.5c1.3-.6 2.7-.8 4-.7" /></>,
  regalo: <><rect x="4" y="9" width="16" height="11.5" rx="1.5" /><path d="M3 9h18M12 9v11.5" /><path className="fx" d="M12 9C10.5 5 6.5 5 7 7.5 7.4 9 12 9 12 9zM12 9c1.5-4 5.5-4 5-1.5C16.6 9 12 9 12 9z" /></>,
  mascota: <><path d="M12 13c-3 0-5.5 3-5 5.5.4 2 3 1.5 5 1.5s4.6.5 5-1.5c.5-2.5-2-5.5-5-5.5z" /><g className="fx"><circle cx="5.5" cy="10" r="1.8" /><circle cx="9" cy="6" r="1.8" /><circle cx="15" cy="6" r="1.8" /><circle cx="18.5" cy="10" r="1.8" /></g></>,
  ropa: <><path className="fx" d="M9 3.5L4 6l-1.5 5 3 1 1-1.5V20.5h11V10.5l1 1.5 3-1L19.5 6 15 3.5c0 1.5-1.5 2.5-3 2.5S9 5 9 3.5z" /></>,
  herramienta: <><path className="fx" d="M14.5 4a4.5 4.5 0 0 0-4.2 6.1L3.8 16.6a1.9 1.9 0 0 0 2.7 2.7l6.5-6.5a4.5 4.5 0 0 0 6.1-4.2l-2.8 2.8-2.7-.7-.7-2.7z" /></>,
  nube: <><path className="fx" d="M7 18.5a4.5 4.5 0 0 1-.4-9 6 6 0 0 1 11.3 1.5A3.8 3.8 0 0 1 17.5 18.5z" /></>,
  repetir: <><path className="fx" d="M4.5 10a7.5 7.5 0 0 1 12.9-3.5L19.5 8.5M19.5 4v4.5H15M19.5 14a7.5 7.5 0 0 1-12.9 3.5L4.5 15.5M4.5 20v-4.5H9" /></>,
  etiqueta: <><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.6 6.6a1.5 1.5 0 0 1-2.1 0z" /><circle className="fx" cx="8" cy="8" r="1.5" /></>,
  recibo: <><path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z" /><path className="fx" d="M9 8h6M9 11.5h6M9 15h3.5" /></>,
  maletin: <><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18" /><path className="fx" d="M11 12.5v2h2v-2" /></>,
  reloj: <><circle cx="12" cy="12" r="8.5" /><path className="fx fx-hand" d="M12 7.5V12l3 2" /></>,
  tienda: <><path d="M4 9.5V20h16V9.5M3 9.5l2-5.5h14l2 5.5M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /><path className="fx" d="M10 20v-5h4v5" /></>,
  retorno: <><path className="fx" d="M9 14.5L4 9.5l5-5" /><path d="M4 9.5h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  billete: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle className="fx" cx="12" cy="12" r="2.6" /><path d="M6 9.5v5M18 9.5v5" /></>,
  monedas: <><ellipse cx="9" cy="7" rx="5.5" ry="2.5" /><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5M3.5 11v4c0 1.4 2.5 2.5 5.5 2.5" /><g className="fx"><ellipse cx="15.5" cy="13" rx="5" ry="2.3" /><path d="M10.5 13v4c0 1.3 2.2 2.3 5 2.3s5-1 5-2.3v-4" /></g></>,
  tarjeta: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19" /><path className="fx" d="M6.5 15h4" /></>,
  billetera: <><path d="M4 7.5V18a2 2 0 0 0 2 2h13.5v-4M19.5 11V7.5H6A2 2 0 0 1 4 5.5 2 2 0 0 1 6 3.5h11.5v4" /><path className="fx" d="M15 11h6v5h-6a2.5 2.5 0 0 1 0-5z" /></>,
  banco: <><path d="M3 9.5L12 4l9 5.5zM4.5 20.5h15M3 20.5h18" /><path className="fx" d="M6 11.5v6.5M10 11.5v6.5M14 11.5v6.5M18 11.5v6.5" /></>,
  alcancia: <><path d="M5 11.5a6.5 5.5 0 0 1 12.5-2H20v4.5l-2 .8a6.5 6 0 0 1-2 2.7V20h-2.5v-1.6a8 8 0 0 1-3.5 0V20H7.5v-2.8A5.5 5.5 0 0 1 5 13M5 11.5l-2-.5" /><path className="fx" d="M10 5.5h3.5" /><circle cx="15.5" cy="11" r=".7" /></>,
  grafico: <><path d="M3.5 20.5h17" /><path className="fx" d="M4 16l5-5 4 3 7-7M15.5 7H20v4.5" /></>,
  diamante: <><path className="fx" d="M6 3.5h12l3.5 5L12 20.5 2.5 8.5z" /><path d="M2.5 8.5h19M9 3.5L8 8.5l4 12 4-12-1-5" /></>,
  estrella: <><path className="fx" d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" /></>,
  bebe: <><circle cx="12" cy="12" r="8.5" /><g className="fx"><circle cx="9.3" cy="11" r=".7" /><circle cx="14.7" cy="11" r=".7" /></g><path d="M9.5 15a3.5 3.5 0 0 0 5 0M12 3.5c-1.5 1.5-.5 3 1 2.5" /></>,
  planta: <><path d="M7 15h10l-1.5 6h-7z" /><path d="M12 15V9" /><path className="fx" d="M12 10c0-3.5 2.5-5.5 6-5.5 0 3.5-2.5 5.5-6 5.5zM12 12c0-2.8-2-4.5-5-4.5 0 2.8 2 4.5 5 4.5z" /></>,
  hamburguesa: <><path d="M4.5 10a7.5 5.5 0 0 1 15 0z" /><path className="fx" d="M3.5 13.5h17" /><path d="M5 16.5h14v.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 17z" /></>,
  cerveza: <><path d="M5.5 8h9v10.5a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2zM14.5 10.5h2a2 2 0 0 1 2 2v2.5a2 2 0 0 1-2 2h-2M8.5 11.5v6M11.5 11.5v6" /><path className="fx" d="M5.5 8a2.5 2.5 0 0 1 2.8-3 3 3 0 0 1 5.2.5A2 2 0 0 1 14.5 8" /></>,
  copa: <><path className="fx" d="M7 3.5h10l-.5 4.5a4.5 4.5 0 0 1-9 0z" /><path d="M12 12.5v8M8.5 20.5h7M7.4 7h9.2" /></>,
  helado: <><path d="M8 11.5l4 9.5 4-9.5" /><path className="fx" d="M7.5 11.5a4.5 4.5 0 1 1 9 0z" /></>,
  manzana: <><path className="fx" d="M12 8c-2-1.5-7-1-7 4.5 0 4 2.5 8 4.5 8 1 0 1.5-.5 2.5-.5s1.5.5 2.5.5c2 0 4.5-4 4.5-8C19 7 14 6.5 12 8z" /><path d="M12 8c0-2 1-3.5 3-4.5" /></>,
  bici: <><circle cx="5.5" cy="16" r="3.5" /><circle cx="18.5" cy="16" r="3.5" /><path className="fx" d="M5.5 16L9 9h6.5l3 7M12.5 16L9 9M13.5 6h2.5l-.5 3" /></>,
  tren: <><rect x="5.5" y="3" width="13" height="14" rx="3" /><path d="M5.5 10h13" /><circle cx="9" cy="13.5" r=".7" /><circle cx="15" cy="13.5" r=".7" /><path className="fx" d="M8 21l1.5-4M16 21l-1.5-4" /></>,
  maleta: <><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M9 7V4.5h6V7" /><path className="fx" d="M8.5 7v13M15.5 7v13" /></>,
  parqueo: <><rect x="4" y="3.5" width="16" height="17" rx="3" /><path className="fx" d="M10 16.5v-9h3a2.5 2.5 0 0 1 0 5h-3" /></>,
  sofa: <><path d="M5 11V8.5A2.5 2.5 0 0 1 7.5 6h9A2.5 2.5 0 0 1 19 8.5V11M5 17.5v2M19 17.5v2" /><path className="fx" d="M3 13a2 2 0 0 1 4 0v1.5h10V13a2 2 0 0 1 4 0v4.5H3z" /></>,
  cama: <><path d="M3 18.5v-11M3 14h18v4.5M21 14v-2.5A2.5 2.5 0 0 0 18.5 9H11v5" /><circle className="fx" cx="7" cy="11" r="1.8" /></>,
  lavadora: <><rect x="4.5" y="3" width="15" height="18" rx="2.5" /><path d="M4.5 7.5h15M8 5.3h.01" /><circle cx="12" cy="14" r="4" /><path className="fx" d="M9.5 14.5c1-.8 2-.8 3 0s2 .8 3 0" /></>,
  bombilla: <><path className="fx" d="M9 16.5a6 6 0 1 1 6 0V18H9z" /><path d="M9.5 21h5" /></>,
  llama: <><path className="fx" d="M12 3c1 4 5.5 5.5 5.5 11a5.5 5.5 0 0 1-11 0c0-2.8 1.4-4.5 2.8-5.6.2 1.7 1 2.8 2.1 3.2C11 8 10.5 5.5 12 3z" /></>,
  llave: <><circle className="fx" cx="8" cy="15" r="4" /><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2" /></>,
  tv: <><rect x="3" y="6.5" width="18" height="12" rx="2" /><path d="M8 21h8" /><path className="fx" d="M9 3l3 3.5L15 3" /></>,
  camara: <><path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h2.5L9 4.5h6L16.5 7H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" /><circle className="fx" cx="12" cy="13" r="3.5" /></>,
  boleto: <><path d="M3.5 6.5h17V10a2 2 0 0 0 0 4v3.5h-17V14a2 2 0 0 0 0-4z" /><path className="fx" d="M14 8.5v1.5M14 11.3v1.4M14 14v1.5" /></>,
  balon: <><circle cx="12" cy="12" r="8.5" /><g className="fx"><path d="M12 7.5l4 3-1.5 4.5h-5L8 10.5z" /><path d="M12 3.5v4M16 10.5l4-1.5M14.5 15l2.5 3.5M9.5 15L7 18.5M8 10.5L4 9" /></g></>,
  paleta: <><path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 2-1 1.5-2-.6-1.3.2-2.5 1.7-2.5H17a3.5 3.5 0 0 0 3.5-3.5c0-5-3.8-9-8.5-9z" /><g className="fx"><circle cx="8" cy="11" r="1" /><circle cx="11" cy="7.5" r="1" /><circle cx="15.5" cy="8.5" r="1" /></g></>,
  tijeras: <><circle cx="6.5" cy="7" r="2.5" /><circle cx="6.5" cy="17" r="2.5" /><path className="fx" d="M8.5 8.5L20 17M8.5 15.5L20 7" /></>,
  auriculares: <><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><g className="fx"><rect x="3.5" y="14" width="4" height="6" rx="1.5" /><rect x="16.5" y="14" width="4" height="6" rx="1.5" /></g></>,
  cruz: <><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path className="fx" d="M12 8v8M8 12h8" /></>,
  gafas: <><path d="M10 14h4M3 14l1.5-6M21 14l-1.5-6" /><g className="fx"><circle cx="6.5" cy="14" r="3.5" /><circle cx="17.5" cy="14" r="3.5" /></g></>,
  globo: <><path className="fx" d="M12 15c-3.3 0-5.5-3-5.5-6a5.5 5.5 0 0 1 11 0c0 3-2.2 6-5.5 6zM12 15l-1 1.5h2z" /><path d="M12 16.5c0 2-2 2.5-1 5" /></>,
  laptop: <><rect x="5" y="5" width="14" height="10" rx="1.5" /><path d="M2.5 19h19L20 15H4z" /><path className="fx" d="M9.5 10l1.8 1.8L14.5 8.5" /></>,
  documento: <><path d="M6 3h8.5L19 7.5V21H6z" /><path d="M14 3v5h5" /><path className="fx" d="M9 12h7M9 15h7M9 18h4" /></>,
  lapiz: <><path className="fx" d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></>,
  calculadora: <><rect x="5" y="2.5" width="14" height="19" rx="2.5" /><rect x="8" y="5.5" width="8" height="3.5" rx="1" /><g className="fx"><circle cx="9" cy="13" r=".7" /><circle cx="12" cy="13" r=".7" /><circle cx="15" cy="13" r=".7" /><circle cx="9" cy="17" r=".7" /><circle cx="12" cy="17" r=".7" /><circle cx="15" cy="17" r=".7" /></g></>,
  porcentaje: <><path d="M18.5 5.5l-13 13" /><g className="fx"><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /></g></>,
  sobre: <><rect x="3" y="5.5" width="18" height="13" rx="2" /><path className="fx" d="M3.5 7l8.5 6 8.5-6" /></>,
  paquete: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" /><path className="fx" d="M8 5.3l8 4.5" /></>,
  escudo: <><path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z" /><path className="fx" d="M8.5 12l2.5 2.5 4.5-5" /></>,
  personas: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><g className="fx"><circle cx="16.5" cy="9" r="2.5" /><path d="M16 14a4.5 4.5 0 0 1 4.5 4.5" /></g></>,
  donar: <><path d="M2.5 13.5H6v7H2.5M6 15h3.5l3 1.5H15a1.5 1.5 0 0 1 0 3h-4m4.5-1.5l4-2a1.5 1.5 0 0 1 1.5 2.5l-6 3.5H6" /><path className="fx" d="M14 11s-3.5-2-3.5-4.5a1.8 1.8 0 0 1 3.5-.8 1.8 1.8 0 0 1 3.5.8C17.5 9 14 11 14 11z" /></>,
  mundo: <><circle cx="12" cy="12" r="8.5" /><path className="fx" d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z" /></>,
}

export function FinIcon({ name, className, style }: { name: FinIconName; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={cx('ico fin-ico', `fi-${name}`, className)} style={style} aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}

/** Icon in a soft tinted tile; the tint comes from `--c`. */
export function FinBadge({ name, size = 'm', solid }: { name: FinIconName; size?: 's' | 'm' | 'l'; solid?: boolean }) {
  return (
    <span className={cx('fin-badge', `is-${size}`, solid && 'is-solid')}>
      <FinIcon name={name} />
    </span>
  )
}
