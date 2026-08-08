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

      console.log(
        "🚀 Nivel 300 alcanzado. Enviando /pp..."
      )

      this.bot.chat("/pp")
    }
  }

  onWindowOpen(window) {
    const title = String(window.title)

    if (!title.includes("Pickaxe Prestiges")) {
      return
    }

    console.log("🟨 Menú de Prestige detectado")

    setTimeout(() => {
      const item = window.slots.find(
        (i) =>
          i &&
          i.name === "stained_glass_pane" &&
          i.metadata === 4
      )

      if (!item) {
        console.log(
          "❌ No se encontró ningún Prestige amarillo"
        )

        this.triggered = false
        return
      }

      const slot = window.slots.indexOf(item)

      console.log(
        `🟨 Prestige disponible encontrado en slot ${slot}`
      )

     this.bot.clickWindow(slot, 0, 0)
  .then(() => {
    console.log("✅ Prestige seleccionado")

    // Prestige realizado: permitir un nuevo ciclo
    this.triggered = false

    console.log("🔄 Nuevo ciclo de Prestige habilitado")
  })
        .catch((err) => {
          console.log(
            "❌ Error al seleccionar Prestige:",
            err.message
          )

          this.triggered = false
        })
    }, 1500)
  }
}

module.exports = PrestigeManager
