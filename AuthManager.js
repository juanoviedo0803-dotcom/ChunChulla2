"use strict"

// El servidor puede repetir el aviso varias veces; no se responde en cada línea.
const RESEND_COOLDOWN_MS = 10000

class AuthManager {
  constructor(bot, config) {
    this.bot = bot
    this.config = config

    this.lastSentAt = 0
    this.warned = false
  }

  // Devuelve true si esta línea era una petición de /login y se respondió.
  onMessage(text) {
    if (!this.config.authMatch || !this.config.authMatch.test(String(text))) return false

    if (!this.config.loginCommand) {
      if (!this.warned) {
        this.warned = true
        console.log("⚠️ El servidor pide /login pero falta PASSWORD; no se puede autenticar")
      }

      return false
    }

    const now = Date.now()

    if (now - this.lastSentAt < RESEND_COOLDOWN_MS) return false

    this.lastSentAt = now

    // La contraseña no se registra nunca en el log.
    console.log("🔑 El chat pide autenticación; enviando /login")

    this.bot.chat(this.config.loginCommand)

    return true
  }
}

module.exports = AuthManager
