"use strict"

const test = require("node:test")
const assert = require("node:assert")
const { PassThrough } = require("node:stream")

const { attachConsoleInput } = require("../consoleInput")

function fakeBot(connected = true) {
  const bot = { player: connected ? { username: "Sephera" } : null, sent: [] }

  bot.chat = (message) => bot.sent.push(message)

  return bot
}

function withCapture(fn) {
  const logged = []
  const original = console.log

  console.log = (...args) => logged.push(args.join(" "))

  try {
    fn()
  } finally {
    console.log = original
  }

  return logged
}

test("envía lo escrito como el bot", () => {
  const bot = fakeBot()
  const input = new PassThrough()

  attachConsoleInput(() => bot, input)
  input.write("/help\n")

  assert.deepStrictEqual(bot.sent, ["/help"])
})

test("no envía líneas vacías ni sin conexión", () => {
  const offline = { player: null, sent: [], chat: (m) => offline.sent.push(m) }
  const input = new PassThrough()
  const logged = withCapture(() => {
    attachConsoleInput(() => offline, input)
    input.write("   \n")
    input.write("/help\n")
  })

  assert.deepStrictEqual(offline.sent, [])
  assert.ok(logged.some((line) => line.includes("Sin conexión")))
})

test("la consola no registra la contraseña", () => {
  const bot = { player: {}, sent: [], chat: (m) => bot.sent.push(m) }
  const input = new PassThrough()
  const logged = withCapture(() => {
    attachConsoleInput(() => bot, input)
    input.write("/login secreto123\n")
  })

  assert.deepStrictEqual(bot.sent, ["/login secreto123"])
  assert.ok(!logged.join("\n").includes("secreto123"))
})
