# ChunChulla

Bot AFK de Minecraft (mineflayer) para **JartexNetwork**, modo **Prison**, versión **1.8.9**.
La cuenta del bot es **`Sephera`**; la del dueño es **`lematadorsss`**.
Su única obligación es **entrar al modo de juego y quedarse ahí**: usa la brújula,
clickea Prison en el menú `Server Selector`, espera la línea del chat que lo confirma
y, si no llega, reintenta; agotados los intentos cierra la conexión para empezar de cero.

No hay visión ni OCR: solo eventos del protocolo (ventana abierta y texto del chat).
El chat se procesa en silencio; al log solo van los eventos del bot y lo que dispara
una regla: petición de `/login`, menú de entrada, clic del modo, confirmación y expulsión.

## Configuración

Todo por variables de entorno (Railway → Variables). Ver `.env.example`.
Los valores del servidor ya vienen puestos; solo `BOT_USERNAME` es obligatoria.

| Variable | Obligatoria | Por defecto | Qué es |
|---|---|---|---|
| `BOT_USERNAME` | sí | — | nombre de la cuenta (no `USERNAME`: Windows ya define esa variable) |
| `PASSWORD` | no | — | solo si el servidor pide `/login`; vacío = no se autentica |
| `LOGIN_COMMAND` | no | `/login <PASSWORD>` | comando que se envía cuando el chat pide `/login` |
| `MC_HOST` | no | `play.jartexnetwork.com` | host del servidor |
| `MC_PORT` | no | `25565` | puerto |
| `MC_VERSION` | no | `1.8.9` | versión de Minecraft |
| `ENTRY_COMMAND` | no | — | comando de chat que abre el modo (alternativa al hotbar) |
| `ENTRY_HOTBAR_SLOT` | no | `0` | slot del hotbar con la brújula (0-8) |
| `ENTRY_MENU_MATCH` | no | `Server Selector` | subcadena del título de la ventana a clickear |
| `ENTRY_ITEM_MATCH` | no | `iron_bars` | subcadena del nombre visible, del id o de la lore del ítem del modo |
| `IN_GAME_MATCH` | no | `You are connected to Prison` | regex de la línea que confirma la entrada |
| `AUTH_MATCH` | no | `\/login\b` | regex que detecta que el chat pide autenticación |
| `ENTRY_PROGRESS_MATCH` | no | `queued to join` | regex de "va en camino": reinicia la espera en vez de reintentar |
| `ENTRY_TIMEOUT_MS` | no | `20000` | espera máxima por intento |
| `ENTRY_ATTEMPTS` | no | `3` | intentos antes de reconectar |

Una variable `*_MATCH` vacía desactiva esa comprobación. Sin `IN_GAME_MATCH` no hay
confirmación posible: el bot avisa al arrancar y reconecta en vez de dar la entrada por hecha.

## Ejecutar

```bash
npm install
npm test        # 17 pruebas del ciclo de entrada y del login bajo demanda, sin red
npm run dev     # local: carga .env si existe
npm start       # despliegue: las variables llegan por entorno, sin .env
```

## Consola: mandar comandos como el bot

Mientras corre, cada línea que escribas en esa consola **se envía como el bot** a Jartex:

```
/help          ->  ⌨️ Enviado: /help
```

- Se envía tal cual: si quieres un comando, empieza por `/`; si no, sale como mensaje de chat.
- Sin conexión no se envía (`⌨️ Sin conexión`).
- En el log solo queda el nombre del comando, nunca los argumentos: una contraseña no se registra.
- `Ctrl+C` cierra el bot.

## Granja (`!scan` y `!farm`)

Comandos locales en la consola (empiezan por `!`, no se envían al servidor):

- `!scan` — detecta la isla bajo los pies del bot (región sólida conectada) e informa cuántas columnas hay y cuántas son arables (`dirt`/`grass_block`).
- `!scan x1 z1 x2 z2` — lo mismo pero sobre ese rectángulo exacto (útil cuando la granja no está donde está el bot).
- `!farm` / `!farm x1 z1 x2 z2` — ara con la azada la tierra de la isla o del rectángulo: se coloca a ≤4 bloques, camina hacia lo que queda lejos (agachado, para no caer al vacío), rompe la hierba alta que estorbe y cuenta lo que no pudo alcanzar.

Necesita una azada en el inventario; sin ella avisa y no hace nada. La arena no se ara: solo `dirt`/`grass_block` se convierten en farmland. Tope de área: 400 columnas.

## Verificado contra el servidor real

Corrida del 2026-11-20 con un cliente 1.8.9: el chat pidió `/login`, se respondió y el
servidor contestó `Successful login!`; la brújula abrió `§r §nServer Selector`; el ítem
**Iron Bars (slot 14)** encoló `You are queued to join Prison` y terminó en
`You are connected to Prison`; el bot quedó AFK sin desconexiones.

Ese menú sólo identifica los modos por el icono (los nombres visibles son genéricos:
`TNT`, `Grass Block`, `Iron Bars`...), y `Iron Pickaxe` es **Survival**, no Prison.

## Seguridad

La contraseña vive solo en variables de entorno y nunca se escribe en el log.
Si estuvo escrita en el código alguna vez, hay que cambiarla en el servidor:
el historial de git es público.
