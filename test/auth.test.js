"use strict"

const test = require("node:test")
const assert = require("node:assert")
const { EventEmitter } = require("node:events")

const AuthManager = require("../AuthManager")

function fakeBot() {
  const bot = new EventEmitter()

  bot.sent = []
  bot.chat = (message) => bot.sent.push(message)

  return bot
}

function makeConfig(overrides = {}) {
  return {
    authMatch: /\/login\b/i,
    loginCommand: "/login secreto",
    ...overrides
  }
}

test("responde /login cuando el chat lo pide", () => {
  const bot = fakeBot()
  const auth = new AuthManager(bot, makeConfig())

  assert.strictEqual(auth.onMessage("Please login with /login <password>"), true)
  assert.deepStrictEqual(bot.sent, ["/login secreto"])
})

test("no responde dos veces seguidas al mismo aviso", () => {
  const bot = fakeBot()
  const auth = new AuthManager(bot, makeConfig())

  auth.onMessage("/login <password>")
  assert.strictEqual(auth.onMessage("/login <password>"), false)
  assert.deepStrictEqual(bot.sent, ["/login secreto"])
})

test("ignora el chat que no pide autenticación", () => {
  const bot = fakeBot()
  const auth = new AuthManager(bot, makeConfig())

  assert.strictEqual(auth.onMessage("Welcome to Prison"), false)
  assert.strictEqual(auth.onMessage("Get started by using /mine"), false)
  assert.deepStrictEqual(bot.sent, [])
})

test("sin contraseña no envía nada", () => {
  const bot = fakeBot()
  const auth = new AuthManager(bot, makeConfig({ loginCommand: null }))

  assert.strictEqual(auth.onMessage("Please /login"), false)
  assert.deepStrictEqual(bot.sent, [])
  assert.strictEqual(auth.warned, true)
})
