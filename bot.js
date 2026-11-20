"use strict"

const mineflayer = require("mineflayer")
const { loadConfig } = require("./config")
const { chatText } = require("./chatText")
const { attachConsoleInput } = require("./consoleInput")
const AuthManager = require("./AuthManager")
const EntryManager = require("./EntryManager")

const SPAWN_DELAY_MS = 3000
const RECONNECT_MIN_MS = 10000
const RECONNECT_MAX_MS = 60000

const config = loadConfig()

let reconnectDelay = RECONNECT_MIN_MS
let currentBot = null

function createBot() {
  console.log(`🚀 Conectando a ${config.host}:${config.port} como ${config.username}`)

  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version
  })

  const authManager = new AuthManager(bot, config)
  const entryManager = new EntryManager(bot, config)

  currentBot = bot

  // El chat se procesa pero no se imprime: solo interesa lo que dispara una regla
  // (petición de /login, confirmación de entrada) y los eventos del bot.
  bot.on("messagestr", (message) => {
    if (authManager.onMessage(message)) return

    entryManager.onMessage(String(message))
  })

  bot.on("login", () => {
    console.log("✅ Conectado al servidor")

    reconnectDelay = RECONNECT_MIN_MS
  })

  bot.on("spawn", () => {
    const hotbar = bot.inventory
      ? bot.inventory.slots.slice(36, 45).map((item) => (item ? item.name : "-")).join(" ")
      : "sin inventario"

    console.log(`🎮 Apareció en el mundo | hotbar: ${hotbar}`)

    setTimeout(() => entryManager.start(), SPAWN_DELAY_MS)
  })

  bot.on("kicked", (reason) => {
    console.log("🚫 Expulsado:", chatText(reason))
  })

  bot.on("end", () => {
    entryManager.stop()

    console.log(`❌ Desconectado; reconectando en ${reconnectDelay / 1000}s`)

    setTimeout(createBot, reconnectDelay)

    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS)
  })

  bot.on("error", (err) => {
    console.log("⚠️ Error:", err.message)
  })
}

// Consola: lo que escribas aquí sale como el bot. Registrada una sola vez.
attachConsoleInput(() => currentBot)

createBot()
