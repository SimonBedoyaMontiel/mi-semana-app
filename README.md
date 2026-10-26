# Mi Semana

Agenda de escritorio para Windows: calendario mensual, semana y día con horas de inicio y fin, y seguimiento de hábitos y suplementos con avisos.

## Usar

| Acción | Cómo |
| --- | --- |
| Crear un evento | Arrastra sobre un hueco de la línea de tiempo, pulsa **N**, o escribe en la vista de día: `9-10:30 Gimnasio #salud` |
| Mover / alargar | Arrastra el evento (también a otro día en la semana) o su borde inferior |
| Entrar a un día | Clic en la casilla del mes |
| Navegar | **←** **→**, **T** hoy, **1–4** vistas, **Esc** volver, **Ctrl+,** ajustes |
| Hábitos | Toca el círculo; los de varias veces al día suman de uno en uno |

Los datos se guardan en `%APPDATA%\Mi Semana\data\data.json`, con una copia automática por día (se conservan 14) en `backups\`. Desde **Ajustes → Tus datos** puedes exportar o importar una copia, incluido el archivo que genera la versión web (`web/mi-semana-web.html`, botón «Exportar para la app de escritorio»).

## Desarrollo

```bash
npm install
npm run dev        # app con recarga en caliente
npm run check      # tipos + lint + tests
npm run dist       # instalador en dist/MiSemana-Setup-<versión>.exe
node scripts/snapshot.mjs out-dir light   # capturas + prueba E2E con datos de ejemplo
```

### Arquitectura

```
src/
  shared/     lógica pura y probada, compartida por ambos procesos
    model.ts      esquemas zod (solo proceso principal) y tipos
    constants.ts  valores sin zod (para que la interfaz no cargue la librería)
    commands.ts   comandos validados · reducer.ts  reductor puro
    events.ts     índice por día, solapes, entrada rápida
    habits.ts     progreso, rachas · reminders.ts  avisos pendientes
    backup.ts     exportar / importar / fusionar
  main/       proceso principal de Electron
    repository.ts JSON atómico (tmp + fsync + rename), .bak y copias diarias
    ipc.ts        canales con validación de remitente y de datos
    reminders.ts  notificaciones nativas, tolerante a suspensión
    window.ts     ventana segura (sandbox, aislamiento, CSP, sin navegación)
  preload/    puente mínimo y tipado (contextBridge)
  renderer/   React 19 + Motion + Zustand
```

- **Un solo reductor** (`applyCommand`) se ejecuta en la interfaz (respuesta inmediata) y en el proceso principal (fuente de verdad); si algo falla, la interfaz se resincroniza.
- **Seguridad**: `sandbox`, `contextIsolation`, sin `nodeIntegration`, CSP estricta, permisos denegados, IPC solo desde el propio paquete y con cada comando validado por zod.
- **Rendimiento**: todo empaquetado sin `node_modules` en tiempo de ejecución, vistas y hojas cargadas bajo demanda, solo subconjuntos latinos de las fuentes, efectos de cursor escritos directamente en el DOM con `requestAnimationFrame`.
