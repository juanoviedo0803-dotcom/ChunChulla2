"use strict"

const test = require("node:test")
const assert = require("node:assert")

const { loadConfig } = require("../config")

function env(overrides = {}) {
  return { BOT_USERNAME: "lematadoross", ...overrides }
}

test("por defecto apunta a JartexNetwork 1.8.9 con el flujo observado", () => {
  const config = loadConfig(env())

  assert.strictEqual(config.host, "play.jartexnetwork.com")
  assert.strictEqual(config.port, 25565)
  assert.strictEqual(config.version, "1.8.9")
  assert.strictEqual(config.username, "lematadoross")
  assert.strictEqual(config.entryHotbarSlot, 0)
  assert.strictEqual(config.entryMenuMatch, "Server Selector")
  assert.strictEqual(config.entryItemMatch, "iron_bars")
  assert.match("JartexNetwork » You are connected to Prison", config.inGameMatch)
  assert.match("Please login with /login <password>", config.authMatch)
  assert.match("Server Queue ▏ You are queued to join Prison", config.entryProgressMatch)
})

test("sin PASSWORD no hay comando de login", () => {
  const config = loadConfig(env())

  assert.strictEqual(config.loginCommand, null)
})

test("con PASSWORD el login se arma solo", () => {
  const config = loadConfig(env({ PASSWORD: "clave123" }))

  assert.strictEqual(config.loginCommand, "/login clave123")
})

test("faltan variables obligatorias", () => {
  assert.throws(() => loadConfig({}), /BOT_USERNAME/)
})

test("rechaza un slot de hotbar fuera de rango", () => {
  assert.throws(() => loadConfig(env({ ENTRY_HOTBAR_SLOT: "9" })), /entre 0 y 8/)
})

test("rechaza una regex inválida", () => {
  assert.throws(() => loadConfig(env({ IN_GAME_MATCH: "(" })), /IN_GAME_MATCH/)
})
