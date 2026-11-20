"use strict"

const mineflayer = require("mineflayer")
const { loadConfig } = require("./config")
const AuthManager = require("./AuthManager")
const EntryManager = require("./EntryManager")

const SPAWN_DELAY_MS = 3000
const RECONNECT_MIN_MS = 10000
const RECONNECT_MAX_MS = 60000

const config = loadConfig()

let reconnectDelay = RECONNECT_MIN_MS

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

  // Todo lo que dice el servidor va al log: es la única evidencia de entrada.
  // El login se responde solo cuando el chat lo pide.
  bot.on("messagestr", (message) => {
    console.log(`💬 ${message}`)

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
    console.log("🚫 Expulsado:", reason)
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

createBot()
