// Visual smoke test: launches the built app with a throwaway profile and demo data, drives it
// through the Chrome DevTools Protocol, and saves a screenshot of each view.
// Usage: npm run build && node scripts/snapshot.mjs [outDir] [light|dark]
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import electronPath from 'electron'

const outDir = resolve(process.argv[2] ?? 'snapshots')
const theme = process.argv[3] ?? 'light'
const PORT = 9333
mkdirSync(outDir, { recursive: true })

const pad = n => String(n).padStart(2, '0')
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const today = new Date()
const day = n => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n))
const created = day(-20)

// Demo profile only — never the user's real data.
const profile = mkdtempSync(join(tmpdir(), 'misemana-snap-'))
mkdirSync(join(profile, 'data'), { recursive: true })
let n = 0
const ev = (d, start, end, text, cat, done = false) => ({ id: `e${++n}`, date: day(d), start, end, text, cat, done, createdAt: n })
const habit = (id, name, kind, dose, slot, color, target = 1, unit = '') => ({ id, name, kind, dose, target, unit, slot, days: [0, 1, 2, 3, 4, 5, 6], color, createdAt: created })
const habits = [
  habit('h1', 'Creatina', 'suplemento', '5 g', 'manana', 'cobalt'),
  habit('h2', 'Vitamina D', 'suplemento', '2000 UI', 'manana', 'amber'),
  habit('h3', 'Agua', 'habito', '', 'cualquiera', 'teal', 8, 'vasos'),
  habit('h4', 'Entrenar', 'habito', '45 min', 'tarde', 'magenta'),
  habit('h5', 'Magnesio', 'suplemento', '400 mg', 'noche', 'violet'),
]
const habitLog = {}
for (let i = -20; i <= 0; i++) {
  const d = day(i)
  habitLog[d] = {}
  for (const h of habits) {
    if (i === 0 && (h.slot === 'noche' || h.slot === 'tarde')) continue
    if (Math.random() < 0.8 || i > -4) habitLog[d][h.id] = h.target === 1 ? 1 : i === 0 ? 5 : h.target
  }
}
const data = {
  schema: 1,
  events: [
    ev(0, '08:30', '09:00', 'Revisar correo', 'trabajo', true),
    ev(0, '09:30', '11:00', 'Bloque de trabajo profundo', 'trabajo'),
    ev(0, '10:30', '11:15', 'Llamada con Ana', 'personal'),
    ev(0, '13:00', '14:00', 'Almuerzo', 'personal'),
    ev(0, '16:00', '17:30', 'Clase de inglés', 'estudio'),
    ev(0, '19:00', '20:00', 'Gimnasio', 'salud'),
    ev(0, '', '', 'Pagar la luz', 'otro'),
    ev(1, '07:00', '08:00', 'Correr 5 km', 'salud'),
    ev(1, '10:00', '12:00', 'Presentación del proyecto', 'trabajo'),
    ev(2, '18:00', '19:30', 'Cena con amigos', 'personal'),
    ev(3, '09:00', '10:00', 'Dentista', 'salud'),
    ev(-1, '11:00', '12:30', 'Taller de diseño', 'estudio', true),
    ev(-2, '17:00', '18:00', 'Yoga', 'salud', true),
    ev(5, '', '', 'Comprar regalo', 'personal'),
    ev(8, '15:00', '16:00', 'Revisión trimestral', 'trabajo'),
  ],
  habits,
  habitLog,
  notes: { [day(0)]: 'Buen día. Probar a acostarme antes de las 23:30.' },
  settings: { theme, eventReminders: false, eventLeadMinutes: 10, habitReminders: false, slotTimes: { manana: '08:00', mediodia: '13:00', tarde: '18:00', noche: '21:30' }, launchAtLogin: false, closeToTray: false, sidebar: true },
}
writeFileSync(join(profile, 'data', 'data.json'), JSON.stringify(data))
writeFileSync(join(profile, 'window-state.json'), JSON.stringify({ width: 1440, height: 920, maximized: false }))

const app = spawn(electronPath, ['.', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`], { stdio: 'inherit' })
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
      const page = list.find(t => t.type === 'page' && !t.url.startsWith('devtools'))
      if (page) return page.webSocketDebuggerUrl
    } catch { /* not up yet */ }
    await sleep(250)
  }
  throw new Error('No renderer target')
}

const ws = new WebSocket(await target())
await new Promise(r => ws.addEventListener('open', r, { once: true }))
let id = 0
const pending = new Map()
const errors = []
ws.addEventListener('message', m => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  } else if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
  else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map(a => a.value ?? a.description).join(' '))
})
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async name => {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(outDir, `${theme}-${name}.png`), Buffer.from(r.result.data, 'base64'))
  console.log('saved', `${theme}-${name}.png`)
}
const key = k => send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, text: k.length === 1 ? k : undefined }).then(() => send('Input.dispatchKeyEvent', { type: 'keyUp', key: k }))

await send('Runtime.enable')
await send('Page.enable')
await sleep(2500)
await shot('1-month')
await key('2'); await sleep(1200); await shot('2-week')
await evaluate(`document.querySelector('.cell')?.click?.()`)
await key('1'); await sleep(900)
await evaluate(`(() => { const c = [...document.querySelectorAll('.cell')].find(x => x.classList.contains('is-today')); c?.click(); return !!c })()`)
await sleep(1400); await shot('3-day')
await key('4'); await sleep(1200); await shot('4-habits')
await key('1'); await sleep(600)
await key('n'); await sleep(900)
await send('Input.insertText', { text: 'Prueba automática' })
await evaluate(`document.getElementById('ev-start').focus()`)
await sleep(500); await shot('5-event-sheet')
await evaluate(`document.querySelector('#event-form').requestSubmit()`)
await sleep(800)
const saved = await evaluate(`window.api.load().then(d => d.events.some(e => e.text === 'Prueba automática'))`)
console.log(saved ? 'E2E: event saved through IPC' : 'E2E FAILED: event not persisted')
const before = await evaluate(`window.api.load().then(d => JSON.stringify(d.habitLog))`)
await key('4'); await sleep(900)
await evaluate(`[...document.querySelectorAll('.hc:not([disabled])')].find(b => !b.classList.contains('is-done'))?.click()`)
await sleep(700); await shot('6-habit-tapped')
const after = await evaluate(`window.api.load().then(d => JSON.stringify(d.habitLog))`)
console.log(before !== after ? 'E2E: habit log updated' : 'E2E FAILED: habit tap not persisted')

console.log(errors.length ? `RENDERER ERRORS:\n${errors.join('\n')}` : 'No renderer errors')
ws.close()
app.kill()
await sleep(500)
rmSync(profile, { recursive: true, force: true })
process.exit(0)
