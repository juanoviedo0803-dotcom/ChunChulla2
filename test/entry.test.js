"use strict"

const test = require("node:test")
const assert = require("node:assert")
const { EventEmitter } = require("node:events")

const EntryManager = require("../EntryManager")

// Superficie de mineflayer que usa EntryManager, sin red.
function fakeBot() {
  const bot = new EventEmitter()

  bot.currentWindow = null
  bot.sent = []
  bot.quickBarSlot = null
  bot.activations = 0
  bot.clickedSlot = null
  bot.clicked = false
  bot.quitCalled = false

  bot.chat = (message) => bot.sent.push(message)
  bot.setQuickBarSlot = (slot) => {
    bot.quickBarSlot = slot
  }
  bot.activateItem = () => {
    bot.activations += 1
  }
  bot.quit = () => {
    bot.quitCalled = true
  }
  bot.clickWindow = async (slot) => {
    bot.clicked = true
    bot.clickedSlot = slot
  }

  return bot
}

function makeConfig(overrides = {}) {
  return {
    entryCommand: "/modo",
    entryHotbarSlot: null,
    entryMenuMatch: null,
    entryItemMatch: null,
    inGameMatch: /has entrado/i,
    entryProgressMatch: /queued to join/i,
    entryTimeoutMs: 5000,
    entryAttempts: 2,
    ...overrides
  }
}

test("la confirmación por chat entra y no reintenta", () => {
  const bot = fakeBot()
  const manager = new EntryManager(bot, makeConfig())

  manager.start()

  assert.deepStrictEqual(bot.sent, ["/modo"])

  assert.strictEqual(manager.onMessage("Bienvenido, has entrado a Prision"), true)
  assert.strictEqual(manager.state, "entered")

  // Una segunda línea de confirmación ya no cambia nada.
  assert.strictEqual(manager.onMessage("has entrado a Prision"), false)
  assert.strictEqual(manager.state, "entered")

  manager.stop()
})

test("una línea que no coincide no confirma la entrada", () => {
  const bot = fakeBot()
  const manager = new EntryManager(bot, makeConfig())

  manager.start()

  assert.strictEqual(manager.onMessage("Te has conectado al lobby"), false)
  assert.strictEqual(manager.state, "entering")

  manager.stop()
})

test("sin confirmación reintenta y al agotar intentos cierra la conexión", async () => {
  const bot = fakeBot()
  const manager = new EntryManager(bot, makeConfig({ entryTimeoutMs: 30, entryAttempts: 2 }))

  manager.start()

  await new Promise((resolve) => setTimeout(resolve, 120))

  assert.deepStrictEqual(bot.sent, ["/modo", "/modo"])
  assert.strictEqual(bot.quitCalled, true)
  assert.strictEqual(manager.state, "gaveup")
})

test("estar en cola reinicia la espera en vez de reintentar", async () => {
  const bot = fakeBot()
  const manager = new EntryManager(bot, makeConfig({ entryTimeoutMs: 80, entryAttempts: 2 }))

  manager.start()

  await new Promise((resolve) => setTimeout(resolve, 50))
  manager.onMessage("Server Queue ▏ You are queued to join Prison")

  // Sin el reinicio, el timeout de 80 ms ya habría lanzado el intento 2.
  await new Promise((resolve) => setTimeout(resolve, 70))
  assert.deepStrictEqual(bot.sent, ["/modo"])
  assert.strictEqual(manager.state, "entering")

  assert.strictEqual(manager.onMessage("You are connected to Prison"), false)
  manager.onMessage("has entrado a Prision")
  assert.strictEqual(manager.state, "entered")
  assert.deepStrictEqual(bot.sent, ["/modo"])

  manager.stop()
})

test("clickea el ítem del modo dentro del menú de entrada", async () => {
  const bot = fakeBot()
  const manager = new EntryManager(
    bot,
    makeConfig({ entryMenuMatch: "Elige", entryItemMatch: "pickaxe" })
  )

  const window = {
    title: "Elige tu modo",
    slots: [{ name: "stone" }, { name: "diamond_pickaxe" }]
  }

  manager.start()

  // Un menú ajeno no debe tocarse.
  bot.currentWindow = { title: "Cofre", slots: [{ name: "diamond_pickaxe" }] }
  bot.emit("windowOpen", bot.currentWindow)

  bot.currentWindow = window
  bot.emit("windowOpen", window)

  await new Promise((resolve) => setTimeout(resolve, 1200))

  assert.strictEqual(bot.clicked, true)
  assert.strictEqual(bot.clickedSlot, 1)

  manager.stop()
})

test("reconoce el modo por la lore del ítem", async () => {
  const bot = fakeBot()
  const manager = new EntryManager(
    bot,
    makeConfig({ entryMenuMatch: "Server Selector", entryItemMatch: "prison" })
  )

  manager.start()

  const lore = (text) => ({ value: { value: [text] } })
  const window = {
    title: "Server Selector",
    slots: [
      { name: "tnt", displayName: "TNT" },
      {
        name: "iron_bars",
        displayName: "Iron Bars",
        nbt: { value: { display: { value: { Lore: lore("§7Season #39 / §aPrison") } } } }
      }
    ]
  }

  bot.currentWindow = window
  bot.emit("windowOpen", window)

  await new Promise((resolve) => setTimeout(resolve, 1200))

  assert.strictEqual(bot.clicked, true)
  assert.strictEqual(bot.clickedSlot, 1)

  manager.stop()
})

test("reconoce el modo por su nombre visible, no por el id del ítem", async () => {
  const bot = fakeBot()
  const manager = new EntryManager(
    bot,
    makeConfig({ entryMenuMatch: "Server Selector", entryItemMatch: "prison" })
  )

  manager.start()

  const window = {
    title: "Server Selector",
    slots: [{ name: "emerald" }, { name: "golden_pickaxe", displayName: "§cPrison §7(new season)" }]
  }

  bot.currentWindow = window
  bot.emit("windowOpen", window)

  await new Promise((resolve) => setTimeout(resolve, 1200))

  assert.strictEqual(bot.clicked, true)
  assert.strictEqual(bot.clickedSlot, 1)

  manager.stop()
})
