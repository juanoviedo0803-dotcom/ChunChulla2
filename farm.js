"use strict"

const MAX_RADIUS = 24
const MAX_COLUMNS = 1200
const REACH = 4
const WALK_STEP_MS = 100
const WALK_TIMEOUT_MS = 6000
const USE_DELAY_MS = 250

const ARABLE = new Set(["dirt", "grass_block"])
const PLANT = new Set(["grass", "fern", "tall_grass", "large_fern"])
const NOT_FLOOR = new Set(["air", "cave_air", "void_air", "water", "flowing_water", "lava", "flowing_lava"])

// BFS 4-conexo sobre el plano del suelo: la isla es la región sólida conectada
// bajo los pies del bot. `isSolid(dx, dz)` evita acoplar esto a mineflayer.
function collectFootprint(isSolid, { maxRadius = MAX_RADIUS, maxColumns = MAX_COLUMNS } = {}) {
  const seen = new Set(["0,0"])
  const columns = []
  const queue = [[0, 0]]

  while (queue.length > 0 && columns.length < maxColumns) {
    const [dx, dz] = queue.shift()

    columns.push([dx, dz])

    for (const [nx, nz] of [
      [dx + 1, dz],
      [dx - 1, dz],
      [dx, dz + 1],
      [dx, dz - 1]
    ]) {
      const key = `${nx},${nz}`

      if (seen.has(key)) continue
      if (Math.abs(nx) > maxRadius || Math.abs(nz) > maxRadius) continue

      seen.add(key)

      if (isSolid(nx, nz)) queue.push([nx, nz])
    }
  }

  return columns
}

function withinReach(from, to) {
  return Math.abs(to.x - from.x) <= REACH && Math.abs(to.z - from.z) <= REACH && Math.abs(to.y - from.y) <= REACH
}

class FarmManager {
  constructor(bot) {
    this.bot = bot
    this.busy = false
  }

  floorBlock(dx, dz) {
    const pos = this.bot.entity.position.floored()

    return this.bot.blockAt(pos.offset(dx, -1, dz))
  }

  footprint() {
    const columns = collectFootprint((dx, dz) => {
      const block = this.floorBlock(dx, dz)

      return Boolean(block) && !NOT_FLOOR.has(block.name)
    })

    if (columns.length >= MAX_COLUMNS) {
      console.log(`⚠️ Isla cortada en ${MAX_COLUMNS} columnas (es más grande)`)
    }

    return columns
  }

  // Qué hay en la isla: cuántas columnas son aranbles y cuántas no.
  scan() {
    const counts = {}

    for (const [dx, dz] of this.footprint()) {
      const name = this.floorBlock(dx, dz).name

      counts[name] = (counts[name] || 0) + 1
    }

    const columns = Object.values(counts).reduce((sum, n) => sum + n, 0)
    const arable = [...ARABLE].reduce((sum, name) => sum + (counts[name] || 0), 0)

    console.log(`🗺️ Isla: ${columns} columnas | aranbles: ${arable}`)
    console.log(`   ${JSON.stringify(counts)}`)

    return { columns, arable, counts }
  }

  async till() {
    if (this.busy) {
      console.log("⏳ Ya hay una tarea de granja en curso")

      return
    }

    this.busy = true

    try {
      await this.runTill()
    } finally {
      this.busy = false
    }
  }

  async runTill() {
    const hoe = this.bot.inventory.items().find((item) => item.name.endsWith("_hoe"))

    if (!hoe) {
      console.log("⚠️ No hay azada en el inventario: no se puede arar")

      return
    }

    const targets = this.footprint().filter(([dx, dz]) => {
      const block = this.floorBlock(dx, dz)

      return block && ARABLE.has(block.name)
    })

    if (targets.length === 0) {
      console.log("⚠️ No hay tierra ni hierba que arar en la isla")

      return
    }

    await this.bot.equip(hoe, "hand")

    let tilled = 0
    let unreachable = 0

    for (const [dx, dz] of targets) {
      const base = this.bot.entity.position.floored()
      const block = this.bot.blockAt(base.offset(dx, -1, dz))

      if (!block || !ARABLE.has(block.name)) continue

      if (!withinReach(this.bot.entity.position, block.position)) {
        const arrived = await this.walkTo(block.position)

        if (!arrived) {
          unreachable += 1
          continue
        }
      }

      await this.bot.lookAt(block.position.offset(0.5, 0.5, 0.5), true)

      // La hierba alta encima impide arar: se rompe primero.
      const above = this.bot.blockAt(block.position.offset(0, 1, 0))

      if (above && PLANT.has(above.name)) {
        await this.bot.lookAt(above.position.offset(0.5, 0.5, 0.5), true)
        await this.bot.dig(above)
      }

      this.bot.activateItem()
      await new Promise((resolve) => setTimeout(resolve, USE_DELAY_MS))
      tilled += 1
    }

    console.log(`🌱 Arado: ${tilled} | fuera de alcance: ${unreachable}`)
  }

  // Caminar en línea recta hacia un bloque: basta en una plataforma plana y
  // evita meter un pathfinder como dependencia.
  async walkTo(target) {
    const started = Date.now()

    while (Date.now() - started < WALK_TIMEOUT_MS) {
      const pos = this.bot.entity.position

      if (Math.hypot(target.x + 0.5 - pos.x, target.z + 0.5 - pos.z) < 1.5) {
        this.bot.setControlState("forward", false)

        return true
      }

      await this.bot.lookAt(target.offset(0.5, 0, 0.5), true)
      this.bot.setControlState("forward", true)
      await new Promise((resolve) => setTimeout(resolve, WALK_STEP_MS))
    }

    this.bot.setControlState("forward", false)

    return false
  }
}

module.exports = { FarmManager, collectFootprint, withinReach }
