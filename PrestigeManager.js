class PrestigeManager {
  constructor(bot) {
    this.bot = bot
    this.triggered = false

    this.onMessage = this.onMessage.bind(this)
    this.onWindowOpen = this.onWindowOpen.bind(this)
  }

  start() {
    this.bot.on("messagestr", this.onMessage)
    this.bot.on("windowOpen", this.onWindowOpen)

    console.log("⛏️ PrestigeManager iniciado")
  }

  stop() {
    this.bot.removeListener("messagestr", this.onMessage)
    this.bot.removeListener("windowOpen", this.onWindowOpen)

    console.log("⛏️ PrestigeManager detenido")
  }

  onMessage(message) {
    const text = String(message)

    const match = text.match(
      /your\s+pickaxe\s+has\s+levelled\s+up\s+to\s+(\d+)/i
    )

    if (!match) return

    const level = Number(match[1])

    console.log(`⛏️ Pico nivel ${level}`)

    if (level >= 300 && !this.triggered) {
      this.triggered = true

      console.log("🚀 Nivel 300 alcanzado. Enviando /pp...")

      this.bot.chat("/pp")
    }
  }

  onWindowOpen(window) {
    console.log("📦 ¡MENÚ ABIERTO!")
    console.log("Título:", window.title)

    setTimeout(() => {
      console.log("🔎 Inspeccionando items del menú...")

      window.slots.forEach((item, slot) => {
        if (!item) return

        console.log(
          `Slot ${slot} | name=${item.name} | displayName=${item.displayName} | metadata=${item.metadata}`
        )
      })
    }, 1500)
  }
}

module.exports = PrestigeManager
