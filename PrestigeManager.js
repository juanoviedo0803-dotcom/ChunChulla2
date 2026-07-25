class PrestigeManager {
  constructor(bot) {
    this.bot = bot
    this.state = "idle"
    this.lastLevel = null
    this.activeWindow = null
    this.stateTimeout = null
    this.stateTimeouts = {
      waiting_for_menu: 10000,
      waiting_for_prestige_confirmation: 10000,
      waiting_for_rebirth_confirmation: 10000
    }

    this.onMessage = this.onMessage.bind(this)
    this.onJsonMessage = this.onJsonMessage.bind(this)
    this.onWindowOpen = this.onWindowOpen.bind(this)
  }

  start() {
    this.bot.on("messagestr", this.onMessage)
    this.bot.on("message", this.onJsonMessage)
    this.bot.on("windowOpen", this.onWindowOpen)
  }

  stop() {
    this.bot.removeListener("messagestr", this.onMessage)
    this.bot.removeListener("message", this.onJsonMessage)
    this.bot.removeListener("windowOpen", this.onWindowOpen)
    this.setState("idle")
    this.activeWindow = null
  }

  onMessage(message) {
    const text = this.cleanText(message)

    if (this.isRelevantMessage(text)) {
      console.log("💬 PrestigeManager:", text)
    }

    const level = this.getPickaxeLevel(text)

    if (level !== null) {
      this.lastLevel = level
      this.tryPrestigeAtLevel(level)
      return
    }

    if (this.state === "waiting_for_prestige_confirmation" && this.isPrestigeConfirmation(text)) {
      this.finish("Prestige completado")
      return
    }

    if (this.state === "waiting_for_rebirth_confirmation" && this.isRebirthConfirmation(text)) {
      this.finish("Rebirth completado")
    }
  }

  onJsonMessage(message) {
    this.onMessage(message.toString())
  }

  tryPrestigeAtLevel(level) {
    if (level < 200 || this.state !== "idle") return

    this.openPrestigeMenu()
  }

  getPickaxeLevel(text) {
    const match = text.match(/your\s+pickaxe\s+has\s+levelled\s+up\s+to\s+(\d+)/i)

    return match ? Number(match[1]) : null
  }

  isRelevantMessage(text) {
    return /pickaxe|prestige|rebirth/i.test(text)
  }

  openPrestigeMenu() {
    this.requestPrestigeMenu(`🔎 Comprobando Prestige${this.lastLevel ? ` en nivel ${this.lastLevel}` : ""}`)
  }

  requestPrestigeMenu(message) {
  if (this.state !== "idle") return

  this.setState("waiting_for_menu")

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("➡ Voy a enviar /pp")
  console.log("Estado:", this.state)
  console.log("currentWindow:", this.bot.currentWindow)

  this.bot.chat("/pp")

  console.log("✅ Comando enviado")
  console.log(message)
}


  async onWindowOpen(window) {
    if (this.state !== "waiting_for_menu") return

    try {
      this.activeWindow = window
      const prestigeOptions = this.findAvailablePrestiges(window)

      if (prestigeOptions.length > 1) {
        this.recover("⚠️ Se encontraron varios Prestiges amarillos; cerrando el menú", window)
        return
      }

      const target = prestigeOptions[0] || this.findAvailableRebirth(window)

      if (!target) {
        this.recover("⚠️ No se encontró un Prestige amarillo ni un Rebirth disponible", window)
        return
      }

      this.setState(target.kind === "prestige"
        ? "waiting_for_prestige_confirmation"
        : "waiting_for_rebirth_confirmation")

      await this.bot.clickWindow(target.slot, 0, 0)
      console.log(target.kind === "prestige"
        ? `⛏️ Seleccionando ${target.label}`
        : `🌟 Seleccionando ${target.label}`)
    } catch (err) {
      this.recover(`⚠️ Error al seleccionar Prestige/Rebirth: ${err.message}`, window)
    }
  }

  getWindowItems(window) {
    return window.slots
      .map((item, slot) => ({ item, slot }))
      .filter(({ item }) => item)
  }

  findAvailablePrestiges(window) {
    return this.getWindowItems(window)
      .filter(({ item }) => this.isAvailablePrestige(item))
      .map(({ item, slot }) => ({
        kind: "prestige",
        slot,
        label: this.getItemText(item)
      }))
  }

  findAvailableRebirth(window) {
    const rebirth = this.getWindowItems(window)
      .find(({ item }) => this.isAvailableRebirth(item))

    return rebirth
      ? { kind: "rebirth", slot: rebirth.slot, label: this.getItemText(rebirth.item) }
      : null
  }

  isAvailablePrestige(item) {
    return this.getItemId(item) === "yellow_stained_glass_pane"
  }

  isAvailableRebirth(item) {
    const text = this.getItemText(item)

    return !this.isAvailablePrestige(item) &&
      /rebirth\s+\d+/i.test(text) &&
      !/prestige/i.test(text) &&
      /click\s+to\s+rebirth/i.test(text)
  }

  getItemId(item) {
    const name = item.name || item.registryName || ""

    return name.includes(":") ? name : `minecraft:${name}`
  }

  getItemText(item) {
    return this.cleanText(this.getRawItemText(item))
  }

  getRawItemText(item) {
    return [item.displayName, this.getNbtText(item.nbt)]
      .filter(Boolean)
      .join(" ")
  }

  getNbtText(value) {
    if (!value) return ""
    if (typeof value === "string") return value
    if (Array.isArray(value)) return value.map((entry) => this.getNbtText(entry)).join(" ")
    if (typeof value !== "object") return ""
    if (Object.prototype.hasOwnProperty.call(value, "value")) return this.getNbtText(value.value)

    return Object.values(value).map((entry) => this.getNbtText(entry)).join(" ")
  }

  cleanText(text) {
    return String(text)
      .replace(new RegExp(`${String.fromCharCode(167)}[0-9A-FK-OR]`, "gi"), "")
      .replace(/\\u00a7[0-9A-FK-OR]/gi, "")
      .replace(/\\"/g, "\"")
      .replace(/\s+/g, " ")
      .trim()
  }

  isPrestigeConfirmation(text) {
    return /(?:prestige|prestiged).*(?:completed|complete|successful|success|purchased|unlocked)/i.test(text) ||
      /(?:completed|complete|successful|success|purchased|unlocked).*prestige/i.test(text)
  }

  isRebirthConfirmation(text) {
    return /(?:rebirth|rebirthed).*(?:completed|complete|successful|success|purchased|unlocked)/i.test(text) ||
      /(?:completed|complete|successful|success|purchased|unlocked).*rebirth/i.test(text)
  }

  closeMenu(window) {
    if (!window) return

    try {
      this.bot.closeWindow(window)
    } catch (err) {
      console.log("⚠️ Error al cerrar el menú:", err.message)
    } finally {
      if (this.activeWindow === window) this.activeWindow = null
    }
  }

  setState(state) {
    this.clearStateTimeout()
    this.state = state

    const timeout = this.stateTimeouts[state]

    if (!timeout) return

    this.stateTimeout = setTimeout(() => {
      if (this.state !== state) return

      this.recover(`⚠️ Tiempo de espera agotado: ${state}`)
    }, timeout)
  }

  clearStateTimeout() {
    if (!this.stateTimeout) return

    clearTimeout(this.stateTimeout)
    this.stateTimeout = null
  }

  recover(message, window = this.activeWindow) {
    console.log(message)
    this.setState("idle")
    this.closeMenu(window)
  }

  finish(message) {
    if (this.state === "idle") return

    this.lastLevel = null
    this.recover(`✅ ${message}`)
  }
}

module.exports = PrestigeManager
