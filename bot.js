const mineflayer = require("mineflayer")
const PrestigeManager = require("./PrestigeManager")

let reconnectDelay = 10000

function createBot() {
  console.log("🚀 Creando bot...")

  const bot = mineflayer.createBot({
    host: "mc.ultranetwork.net",
    port: 25565,
    username: "ChunChulla",
    version: "1.8.9"
  })

  const prestigeManager = new PrestigeManager(bot)
  prestigeManager.start()

  bot.on("login", () => {
    console.log("✅ Bot conectado al servidor")

    reconnectDelay = 10000
  })

  bot.on("spawn", () => {
    console.log("🎮 Bot apareció en el mundo")

    setTimeout(() => {
      bot.chat("/login juan123")
      console.log("🔑 Enviando /login")
    }, 3000)

    setTimeout(() => {
      try {
        bot.activateItem()
        console.log("🧭 Usando brújula")
      } catch (e) {
        console.log("⚠️ No se pudo usar la brújula")
      }
    }, 7000)
  })

  // Menú inicial para seleccionar Prisión
  bot.on("windowOpen", (window) => {
  const title = String(window.title)

  // Este menú pertenece exclusivamente al PrestigeManager
  if (title.includes("Pickaxe Prestiges")) {
    return
  }

  console.log("📦 Menú abierto")

  setTimeout(() => {
    
      const item = window.slots.find(
        (i) => i && i.name.includes("pickaxe")
      )

      if (item) {
        const slot = window.slots.indexOf(item)

        console.log(
          `⛏️ Pico encontrado en slot ${slot}, seleccionando...`
        )

        bot.clickWindow(slot, 0, 0)
          .then(() => {
            console.log("✅ Modo seleccionado")
          })
          .catch((err) => {
            console.log(
              "❌ Error al hacer click:",
              err.message
            )
          })

      } else {
        console.log("⚠️ No se encontró ningún pico en el menú")
      }
    }, 1500)
  })

  bot.on("end", () => {
    prestigeManager.stop()

    console.log("❌ Bot desconectado")
    console.log(
      `🔄 Reconectando en ${reconnectDelay / 1000}s...`
    )

    setTimeout(() => {
      createBot()
    }, reconnectDelay)

    reconnectDelay = Math.min(
      reconnectDelay + 5000,
      60000
    )
  })

  bot.on("error", (err) => {
    console.log("⚠️ Error:", err.message)
  })
}

// Iniciar bot
createBot()

// Mantener proceso vivo en Railway
setInterval(() => {
  // keep alive
}, 30000)
