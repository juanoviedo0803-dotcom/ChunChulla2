"use strict"

// Valores observados en el servidor de destino (JartexNetwork, modo Prison).
// Cualquiera se puede sobrescribir por variable de entorno.
const DEFAULTS = Object.freeze({
  host: "play.jartexnetwork.com",
  port: 25565,
  version: "1.8.9",
  entryHotbarSlot: 0,
  entryMenuMatch: "Server Selector",
  entryItemMatch: "iron_bars",
  inGameMatch: "You are connected to Prison",
  // El servidor pide autenticación escribiendo el comando en el chat.
  authMatch: "\\/login\\b",
  // "en cola" no es un fallo: la transferencia al modo tarda más que el timeout.
  entryProgressMatch: "queued to join",
  entryTimeoutMs: 20000,
  entryAttempts: 3
})

const REQUIRED = ["BOT_USERNAME"]

function readPositiveInt(value, fallback, name) {
  if (value === undefined || value === "") return fallback

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} debe ser un entero positivo (recibido: "${value}")`)
  }

  return parsed
}

function readHotbarSlot(value, fallback) {
  const raw = value === undefined || value === "" ? fallback : value

  if (raw === null || raw === "none") return null

  const parsed = Number(raw)

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 8) {
    throw new Error(`ENTRY_HOTBAR_SLOT debe ser un entero entre 0 y 8 (recibido: "${raw}")`)
  }

  return parsed
}

function readRegex(value, fallback, name) {
  const raw = value === undefined || value === "" ? fallback : value

  if (raw === null || raw === "none") return null

  try {
    return new RegExp(raw, "i")
  } catch (err) {
    throw new Error(`${name} no es una expresión regular válida: ${err.message}`)
  }
}

function loadConfig(env = process.env) {
  const missing = REQUIRED.filter((key) => !env[key])

  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno obligatorias: ${missing.join(", ")}`)
  }

  // Sin PASSWORD no se autentica: el servidor no lo pide.
  const password = env.PASSWORD || null

  return Object.freeze({
    // Nombres con prefijo MC_: Railway (y otros hosts) definen PORT/HOST por su
    // cuenta y el bot terminaba conectando a su puerto web en vez del del juego.
    host: env.MC_HOST || DEFAULTS.host,
    port: readPositiveInt(env.MC_PORT, DEFAULTS.port, "MC_PORT"),
    version: env.MC_VERSION || DEFAULTS.version,
    username: env.BOT_USERNAME,

    // Autenticación bajo demanda: el chat pide "/login" y ahí se responde.
    authMatch: readRegex(env.AUTH_MATCH, DEFAULTS.authMatch, "AUTH_MATCH"),
    loginCommand: password ? env.LOGIN_COMMAND || `/login ${password}` : null,

    // Cómo se pide el modo de juego: comando de chat o ítem del hotbar (la brújula).
    entryCommand: env.ENTRY_COMMAND || null,
    entryHotbarSlot: readHotbarSlot(env.ENTRY_HOTBAR_SLOT, DEFAULTS.entryHotbarSlot),

    // Qué ventana (subcadena del título) y qué ítem (subcadena del nombre o del
    // nombre visible) hay que clickear. Vacío = esa comprobación no se aplica.
    entryMenuMatch: env.ENTRY_MENU_MATCH === undefined ? DEFAULTS.entryMenuMatch : env.ENTRY_MENU_MATCH || null,
    entryItemMatch: env.ENTRY_ITEM_MATCH === undefined ? DEFAULTS.entryItemMatch : env.ENTRY_ITEM_MATCH || null,

    // Línea del chat que prueba que ya estamos dentro del modo de juego.
    // Sin esto no hay confirmación posible y el bot reconecta en vez de fingir que entró.
    inGameMatch: readRegex(env.IN_GAME_MATCH, DEFAULTS.inGameMatch, "IN_GAME_MATCH"),

    // "En cola" reinicia la espera en vez de contar como intento fallido.
    entryProgressMatch: readRegex(env.ENTRY_PROGRESS_MATCH, DEFAULTS.entryProgressMatch, "ENTRY_PROGRESS_MATCH"),

    entryTimeoutMs: readPositiveInt(env.ENTRY_TIMEOUT_MS, DEFAULTS.entryTimeoutMs, "ENTRY_TIMEOUT_MS"),
    entryAttempts: readPositiveInt(env.ENTRY_ATTEMPTS, DEFAULTS.entryAttempts, "ENTRY_ATTEMPTS")
  })
}

module.exports = { loadConfig }
