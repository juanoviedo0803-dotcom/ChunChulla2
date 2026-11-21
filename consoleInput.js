"use strict"

const readline = require("node:readline")

// Consola local -> chat del bot: cada línea escrita aquí sale como el bot, salvo
// las que empiezan por "!", que se ejecutan en el bot (p. ej. "!scan").
// El lector se registra UNA vez y pide el bot vivo en cada línea, así sobrevive
// a las reconexiones (cada reconexión crea una instancia nueva de mineflayer).
function attachConsoleInput(getBot, input = process.stdin, onLocalCommand = null) {
  const rl = readline.createInterface({ input, terminal: false })

  rl.on("line", (line) => {
    const text = line.trim()

    if (!text) return

    if (onLocalCommand && text.startsWith("!")) {
      onLocalCommand(text.slice(1).trim())

      return
    }

    const bot = getBot()

    if (!bot || !bot.player) {
      console.log("⌨️ Sin conexión: el comando no se envió")

      return
    }

    // Solo el nombre del comando: si lleva contraseña, no se registra.
    console.log(`⌨️ Enviado: ${text.split(/\s+/)[0]}`)

    try {
      bot.chat(text)
    } catch (err) {
      console.log(`⚠️ No se pudo enviar: ${err.message}`)
    }
  })

  return rl
}

module.exports = { attachConsoleInput }
