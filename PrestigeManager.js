class PrestigeManager {
  constructor(bot) {
    this.bot = bot
    this.state = "idle"
    this.lastLevel = null
    this.lastAttemptedLevel = null

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
    this.state = "idle"
  }

  onMessage(message) {
    const text = this.cleanText(message)

    if (this.isRelevantMessage(text)) {
      console.log("💬 PrestigeManager:", text)
    }

    const level = this.getPickaxeLevel(text)

    if (level !== null) {
      if (this.lastLevel !== null && level < this.lastLevel) {
        this.lastAttemptedLevel = null
      }

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
    if (!this.isPrestigeLevel(level) || this.lastAttemptedLevel === level) return

    this.lastAttemptedLevel = level
    this.openPrestigeMenu()
  }

  getPickaxeLevel(text) {
    const match = text.match(/your\s+pickaxe\s+has\s+levelled\s+up\s+to\s+(\d+)/i)

    return match ? Number(match[1]) : null
  }

  isPrestigeLevel(level) {
    return level >= 201 && (level - 201) % 50 === 0
  }

  isRelevantMessage(text) {
    return /pickaxe|prestige|rebirth/i.test(text)
  }

  openPrestigeMenu() {
    this.requestPrestigeMenu(`✨ Prestige disponible${this.lastLevel ? ` en nivel ${this.lastLevel}` : ""}`)
  }

  requestPrestigeMenu(message) {
    if (this.state !== "idle") return

    this.state = "waiting_for_menu"
    this.bot.chat("/pp")
    console.log(message)
  }

  async onWindowOpen(window) {
    if (this.state !== "waiting_for_menu") return

    const target = this.findNextAction(window)

    if (!target) {
      this.state = "idle"
      console.log("⚠️ No se encontró un Prestige o Rebirth disponible")
      this.closeMenu(window)
      return
    }

    this.state = target.kind === "prestige"
      ? "waiting_for_prestige_confirmation"
      : "waiting_for_rebirth_confirmation"

    try {
      await this.bot.clickWindow(target.slot, 0, 0)
      console.log(target.kind === "prestige"
        ? `⛏️ Seleccionando ${target.label}`
        : `🌟 Seleccionando ${target.label}`)
    } catch (err) {
      this.state = "idle"
      console.log("⚠️ Error al seleccionar Prestige/Rebirth:", err.message)
      this.closeMenu(window)
    }
  }

  findNextAction(window) {
    const items = window.slots
      .map((item, slot) => ({ item, slot }))
      .filter(({ item }) => item)

    const prestige = items
      .filter(({ item }) => this.isAvailablePrestige(item))
      .map(({ item, slot }) => ({
        kind: "prestige",
        slot,
        label: this.getItemText(item),
        number: this.getPrestigeNumber(item)
      }))
      .sort((a, b) => a.number - b.number)[0]

    if (prestige) return prestige

    const rebirth = items.find(({ item }) => this.isAvailableRebirth(item))

    return rebirth
      ? { kind: "rebirth", slot: rebirth.slot, label: this.getItemText(rebirth.item) }
      : null
  }

  isAvailablePrestige(item) {
    return this.getPrestigeNumber(item) !== null &&
      this.getItemId(item) === "minecraft:yellow_stained_glass_pane"
  }

  isAvailableRebirth(item) {
    const text = this.getItemText(item)

    return this.getPrestigeNumber(item) === null &&
      /rebirth\s+\d+/i.test(text) &&
      /click\s+to\s+rebirth/i.test(text)
  }

  getPrestigeNumber(item) {
    const match = this.getItemText(item).match(/rebirth\s+\d+\s+prestige\s+(\d+)/i)

    return match ? Number(match[1]) : null
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
    try {
      this.bot.closeWindow(window)
    } catch (err) {
      console.log("⚠️ Error al cerrar el menú:", err.message)
    }
  }

  finish(message) {
    if (this.state === "idle") return

    this.state = "idle"
    this.lastLevel = null
    console.log(`✅ ${message}`)
  }
}

module.exports = PrestigeManager
