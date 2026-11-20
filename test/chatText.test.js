"use strict"

const test = require("node:test")
const assert = require("node:assert")

const { chatText } = require("../chatText")

test("convierte el JSON de expulsión en una línea legible", () => {
  const reason = JSON.stringify({
    extra: [{ text: "§4✖ §cHey Sephera, your login was denied." }, { text: "\n" }, { text: "§cUsa §e/email§c." }],
    text: ""
  })

  assert.strictEqual(chatText(reason), "✖ Hey Sephera, your login was denied. | Usa /email.")
})

test("acepta el componente ya parseado", () => {
  assert.strictEqual(chatText({ text: "§cKicked", extra: [{ text: " (§7motivo§c)" }] }), "Kicked (motivo)")
})

test("devuelve el texto tal cual si no es JSON", () => {
  assert.strictEqual(chatText("Server closed"), "Server closed")
})

test("sin motivo no rompe", () => {
  assert.strictEqual(chatText(null), "(sin motivo)")
})
