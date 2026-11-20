# ChunChulla

Bot AFK de Minecraft (mineflayer) para **JartexNetwork**, modo **Prison**, versión **1.8.9**.
Su única obligación es **entrar al modo de juego y quedarse ahí**: usa la brújula,
clickea Prison en el menú `Server Selector`, espera la línea del chat que lo confirma
y, si no llega, reintenta; agotados los intentos cierra la conexión para empezar de cero.

No hay visión ni OCR: solo eventos del protocolo (ventana abierta y texto del chat).

Todo lo que dice el servidor se escribe en el log con prefijo `💬`, que es la
evidencia que se usa para confirmar la entrada.

## Configuración

Todo por variables de entorno (Railway → Variables). Ver `.env.example`.
Los valores del servidor ya vienen puestos; solo `BOT_USERNAME` es obligatoria.

| Variable | Obligatoria | Por defecto | Qué es |
|---|---|---|---|
| `BOT_USERNAME` | sí | — | nombre de la cuenta (no `USERNAME`: Windows ya define esa variable) |
| `PASSWORD` | no | — | solo si el servidor pide `/login`; vacío = no se autentica |
| `LOGIN_COMMAND` | no | `/login <PASSWORD>` | comando que se envía cuando el chat pide `/login` |
| `HOST` | no | `play.jartexnetwork.com` | host del servidor |
| `PORT` | no | `25565` | puerto |
| `VERSION` | no | `1.8.9` | versión de Minecraft |
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
