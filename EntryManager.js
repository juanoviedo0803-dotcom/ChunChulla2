"use strict"

// El menú tarda en tener los slots sincronizados cuando llega windowOpen.
const MENU_CLICK_DELAY_MS = 1000

function itemLabel(slot) {
  return String(slot.displayName || slot.name || "")
}

// La lore es donde el servidor pone el nombre real del modo ("Prison", "Survival"...).
function itemLore(slot) {
  const lore = slot && slot.nbt && slot.nbt.value && slot.nbt.value.display && slot.nbt.value.display.value
    ? slot.nbt.value.display.value.Lore
    : null

  if (!lore || !Array.isArray(lore.value ? lore.value.value : null)) return ""

  return lore.value.value
    .map((line) => String(line).replace(/§[0-9a-fk-or]/gi, "").trim())
    .filter(Boolean)
    .join(" / ")
}

function matchesEntryItem(slot, needle) {
  const target = needle.toLowerCase()

  return [itemLabel(slot), String(slot.name || ""), itemLore(slot)].some((value) =>
    value.toLowerCase().includes(target)
  )
}

class EntryManager {
  constructor(bot, config) {
    this.bot = bot
    this.config = config

    this.state = "idle"
    this.attempts = 0
    this.timer = null

    this.onWindowOpen = this.onWindowOpen.bind(this)
  }

  start() {
    if (this.state !== "idle") return

    this.bot.on("windowOpen", this.onWindowOpen)

    if (!this.config.entryCommand && this.config.entryHotbarSlot === null) {
      console.log(
        "⚠️ Sin ENTRY_COMMAND ni ENTRY_HOTBAR_SLOT no se puede pedir el modo de juego; solo se registra el chat"
      )

      return
    }

    if (!this.config.inGameMatch) {
      console.log(
        "⚠️ Sin IN_GAME_MATCH no se puede confirmar la entrada; el bot reintentará y reconectará"
      )
    }

    this.state = "entering"
    this.attempt()
  }

  stop() {
    this.bot.removeListener("windowOpen", this.onWindowOpen)
    this.clearTimer()
    this.state = "stopped"
  }

  clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  // Un intento = pedir el menú y esperar la línea de confirmación.
  attempt() {
    this.attempts += 1
    this.clearTimer()

    console.log(`➡️ Intento de entrada ${this.attempts}/${this.config.entryAttempts}`)

    this.requestEntry()

    this.timer = setTimeout(() => this.timeout(), this.config.entryTimeoutMs)
  }

  requestEntry() {
    if (this.config.entryCommand) {
      console.log(`🧭 Enviando "${this.config.entryCommand}"`)
      this.bot.chat(this.config.entryCommand)

      return
    }

    console.log(`🧭 Usando el ítem del hotbar ${this.config.entryHotbarSlot}`)

    this.bot.setQuickBarSlot(this.config.entryHotbarSlot)

    try {
      this.bot.activateItem()
    } catch (err) {
      console.log(`⚠️ No se pudo usar el ítem del hotbar: ${err.message}`)
    }
  }

  timeout() {
    this.timer = null

    if (this.state === "entered") return

    console.log("⏱️ Sin confirmación de entrada")

    if (this.attempts < this.config.entryAttempts) {
      this.attempt()

      return
    }

    console.log("🔁 Se agotaron los intentos; reconectando para empezar de cero")

    this.state = "gaveup"

    try {
      this.bot.quit()
    } catch (err) {
      console.log(`⚠️ No se pudo cerrar la conexión: ${err.message}`)
    }
  }

  onWindowOpen(window) {
    if (this.state !== "entering") return

    const title = String(window.title)

    if (this.config.entryMenuMatch && !title.includes(this.config.entryMenuMatch)) return

    if (!this.config.entryItemMatch) {
      console.log(`📦 Menú "${title}" abierto, pero falta ENTRY_ITEM_MATCH para elegir el modo`)

      return
    }

    console.log(`📦 Menú de entrada: "${title}"`)

    setTimeout(() => this.clickMode(window), MENU_CLICK_DELAY_MS)
  }

  clickMode(window) {
    if (this.state !== "entering") return

    // La ventana pudo cerrarse mientras esperábamos: solo vale la actual.
    if (this.bot.currentWindow !== window) return

    const item = window.slots.find((slot) => slot && matchesEntryItem(slot, this.config.entryItemMatch))

    if (!item) {
      const visible = window.slots
        .map((slot, index) => slot && `${index}:${itemLabel(slot) || slot.name}${itemLore(slot) ? ` [${itemLore(slot)}]` : ""}`)
        .filter(Boolean)
        .join(" | ")

      console.log(`⚠️ Ningún ítem coincide con "${this.config.entryItemMatch}". Menú: ${visible}`)

      return
    }

    const slot = window.slots.indexOf(item)

    console.log(`⛏️ "${item.name}" en el slot ${slot}; seleccionando`)

    this.bot
      .clickWindow(slot, 0, 0)
      .then(() => console.log("✅ Modo seleccionado; esperando confirmación por chat"))
      .catch((err) => console.log(`❌ Error al seleccionar el modo: ${err.message}`))
  }

  // Devuelve true si la línea confirma que ya estamos dentro.
  onMessage(text) {
    const message = String(text)

    // "En cola": la transferencia avanza. Reiniciar la espera evita reintentar
    // la entrada en mitad del traslado, que es lo que rompía la conexión.
    if (this.state === "entering" && this.config.entryProgressMatch && this.config.entryProgressMatch.test(message)) {
      this.clearTimer()
      this.timer = setTimeout(() => this.timeout(), this.config.entryTimeoutMs)
    }

    if (this.state !== "entering" || !this.config.inGameMatch) return false

    if (!this.config.inGameMatch.test(message)) return false

    this.clearTimer()
    this.state = "entered"

    console.log("🎮 Entrada confirmada por chat; modo AFK")

    return true
  }
}

module.exports = EntryManager
