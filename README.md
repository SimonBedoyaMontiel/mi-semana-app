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
| Color y prioridad | En cada evento: un color propio (o el de su categoría) y prioridad alta, media o baja |
| Repetir ciertos días | Repetir → **Días concretos**, con atajos «Entre semana» y «Fin de semana» |
| Festivos | Ajustes → General → **Días festivos**: Colombia, España, México, Argentina, Chile, Perú o Estados Unidos |
| Prioridades del día | En «Hoy» o en el día: hasta tres cosas importantes; cumplirlas todas se celebra |
| Pendientes | Las tareas sin hora que no hiciste pasan solas a hoy (se puede desactivar en Ajustes) |
| Bandeja | Apunta tareas sin fecha y arrástralas a un día del mes o de la semana |
| Modo enfoque | Bloques de 15 a 90 min con cuenta atrás; en el PC se ve en la barra de tareas |
| Diario | En cada día: ánimo, energía, tres cosas buenas, la pregunta del día y notas. Vista **Diario** (tecla 5) con el año en cuadraditos y buscador |
| Resumen | Vista **Resumen** (tecla 6): estadísticas de la semana, relación entre hábitos y ánimo, y revisión semanal |
| Diseño | Icono de paleta o Ajustes → **Diseño**: modo claro u oscuro, seis temas, color de acento y fondos difuminados (o una imagen propia) |

Los datos se guardan en `%APPDATA%\Mi Semana\data\data.json`, con una copia automática por día (se conservan 14) en `backups\`. Desde **Ajustes → Tus datos** puedes exportar o importar una copia, incluido el archivo que genera la versión web (`web/mi-semana-web.html`, botón «Exportar para la app de escritorio»).

## Sincronización y móvil

- **Cuenta**: Ajustes → Sincronización. Con la misma cuenta en el PC y en el móvil, eventos, hábitos, notas, el diseño elegido y el país de los festivos quedan iguales en ambos (el resto de ajustes y la imagen de fondo propia son de cada equipo). Si se edita lo mismo en dos sitios, gana el cambio más reciente.
- **Móvil**: la versión web (`src/web`) se publica sola en GitHub Pages al cambiar `main`. En el teléfono, ábrela y elige «Añadir a pantalla de inicio»; funciona sin conexión.
- **Cuentas**: con Google o con correo y contraseña (con recuperación por correo). En la web la cuenta es opcional; al cerrar sesión se puede borrar la copia del navegador. Si en un equipo entra otra cuenta, los datos de la anterior no se mezclan.
- **Configurar Supabase** (una vez): crea un proyecto, ejecuta `supabase/schema.sql` en el SQL Editor y copia la URL y la clave pública en `.env` (ver `.env.example`) y en los secretos `SUPABASE_URL` / `SUPABASE_KEY` del repositorio.

## Publicar una versión

1. Sube `version` en `package.json`.
2. `npm run dist` (con `.env` presente, para que el instalador lleve la sincronización).
3. En GitHub → Releases → nueva release con la etiqueta `v<versión>` y adjunta **los tres** archivos de `dist/`: `MiSemana-Setup-<versión>.exe`, su `.blockmap` y `latest.yml`. Las apps instaladas se actualizan solas a partir de ahí.

## Desarrollo

```bash
npm install
npm run dev        # app con recarga en caliente
npm run check      # tipos + lint + tests
npm run dist       # instalador en dist/MiSemana-Setup-<versión>.exe + latest.yml
npm run dev:web    # versión móvil en el navegador (http://localhost:5180)
npm run build:web  # versión móvil compilada en dist-web/
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
    sync.ts       sincronización por registro (último cambio gana) · cloud.ts  Supabase
  main/       proceso principal de Electron
    repository.ts JSON atómico (tmp + fsync + rename), .bak y copias diarias
    ipc.ts        canales con validación de remitente y de datos
    reminders.ts  notificaciones nativas, tolerante a suspensión
    window.ts     ventana segura (sandbox, aislamiento, CSP, sin navegación)
  preload/    puente mínimo y tipado (contextBridge)
  renderer/   React 19 + Motion + Zustand (la misma interfaz para escritorio y móvil)
  web/        adaptador del navegador (PWA): datos locales, sincronización, service worker
supabase/     esquema SQL con seguridad por fila (cada usuario solo ve sus datos)
```

- **Un solo reductor** (`applyCommand`) se ejecuta en la interfaz (respuesta inmediata) y en el proceso principal (fuente de verdad); si algo falla, la interfaz se resincroniza.
- **Seguridad**: `sandbox`, `contextIsolation`, sin `nodeIntegration`, CSP estricta, permisos denegados, IPC solo desde el propio paquete y con cada comando validado por zod.
- **Rendimiento**: todo empaquetado sin `node_modules` en tiempo de ejecución, vistas y hojas cargadas bajo demanda, solo subconjuntos latinos de las fuentes, efectos de cursor escritos directamente en el DOM con `requestAnimationFrame`.
