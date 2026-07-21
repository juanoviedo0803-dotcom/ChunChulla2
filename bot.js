const mineflayer = require("mineflayer")
const PrestigeManager = require("./PrestigeManager")

let reconnectDelay = 10000 // empieza en 10s

function createBot() {
  const bot = mineflayer.createBot({
    host: "mc.ultranetwork.net",
    port: 25565,
    username: "lematadorsss",
    version: "1.8.9"
  })
  const prestigeManager = new PrestigeManager(bot)
  let isModeSelected = false

  prestigeManager.start()

  bot.on("login", () => {
    console.log("✅ Bot conectado al servidor")
    reconnectDelay = 10000 // resetear delay cuando conecta bien
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

  bot.on("windowOpen", (window) => {
    if (isModeSelected) return

    console.log("📦 Menú abierto")

    setTimeout(() => {
      const item = window.slots.find(
        (i) => i && i.name.includes("pickaxe")
      )

      if (item) {
        const slot = window.slots.indexOf(item)
        console.log(`⛏️ Pico encontrado en slot ${slot}, seleccionando...`)

        bot.clickWindow(slot, 0, 0)
          .then(() => {
            isModeSelected = true
            console.log("✅ Modo seleccionado")
          })
          .catch((err) => {
            console.log("❌ Error al hacer click:", err.message)
          })

      } else {
        console.log("⚠️ No se encontró ningún pico en el menú")
      }
    }, 1500)
  })

  bot.on("end", () => {
    prestigeManager.stop()
    console.log("❌ Bot desconectado")
    console.log(`🔄 Reconectando en ${reconnectDelay / 1000}s...`)

    setTimeout(() => {
      createBot()
    }, reconnectDelay)

    // aumentar delay progresivamente (máx 60s)
    reconnectDelay = Math.min(reconnectDelay + 5000, 60000)
  })

  bot.on("error", (err) => {
    console.log("⚠️ Error:", err.message)
  })
}

// iniciar bot
createBot()

// mantener proceso vivo (Railway)
setInterval(() => {
  // keep alive sin spam
}, 30000)
