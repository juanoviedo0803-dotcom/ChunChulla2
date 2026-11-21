"use strict"

const { Vec3 } = require("vec3")

const MAX_RADIUS = 24
const MAX_COLUMNS = 1200
const MAX_AREA = 400
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

// "x1 z1 x2 z2" -> columnas absolutas en el plano del suelo (`y` = pies - 1).
function parseArea(arg, y, { maxArea = MAX_AREA } = {}) {
  const nums = String(arg || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (nums.length !== 4) return { error: "uso: <x1> <z1> <x2> <z2>" }

  const [x1, z1, x2, z2] = nums.map(Number)

  if ([x1, z1, x2, z2].some((n) => !Number.isInteger(n))) {
    return { error: "las coordenadas deben ser enteras" }
  }

  const width = Math.abs(x2 - x1) + 1
  const depth = Math.abs(z2 - z1) + 1

  if (width * depth > maxArea) {
    return { error: `el área es ${width}x${depth} (${width * depth} columnas); máximo ${maxArea}` }
  }

  const columns = []

  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x += 1) {
    for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z += 1) {
      columns.push({ x, y, z })
    }
  }

  return { columns }
}

function withinReach(from, to) {
  return Math.abs(to.x - from.x) <= REACH && Math.abs(to.z - from.z) <= REACH && Math.abs(to.y - from.y) <= REACH
}

class FarmManager {
  constructor(bot) {
    this.bot = bot
    this.busy = false
  }

  floorY() {
    return this.bot.entity.position.floored().y - 1
  }

  // blockAt/offset exigen Vec3; las columnas se manejan como objetos planos.
  toVec(position) {
    return new Vec3(position.x, position.y, position.z)
  }

  footprint() {
    const base = this.bot.entity.position.floored()

    const columns = collectFootprint((dx, dz) => {
      const block = this.bot.blockAt(base.offset(dx, -1, dz))

      return Boolean(block) && !NOT_FLOOR.has(block.name)
    })

    if (columns.length >= MAX_COLUMNS) {
      console.log(`⚠️ Isla cortada en ${MAX_COLUMNS} columnas (es más grande)`)
    }

    return columns.map(([dx, dz]) => ({ x: base.x + dx, y: base.y - 1, z: base.z + dz }))
  }

  // Sin argumentos: la isla bajo los pies. Con "x1 z1 x2 z2": ese rectángulo.
  // El bot y la granja pueden estar en sitios distintos: ahí mandan las coordenadas.
  resolveColumns(arg) {
    if (!String(arg || "").trim()) return { columns: this.footprint() }

    return parseArea(arg, this.floorY())
  }

  scan(arg) {
    const { columns, error } = this.resolveColumns(arg)

    if (error) {
      console.log(`⚠️ ${error}`)

      return
    }

    const counts = {}

    for (const position of columns) {
      const block = this.bot.blockAt(this.toVec(position))
      const name = block ? block.name : "?"

      counts[name] = (counts[name] || 0) + 1
    }

    const arable = [...ARABLE].reduce((sum, name) => sum + (counts[name] || 0), 0)

    console.log(`🗺️ ${columns.length} columnas | aranbles: ${arable}`)
    console.log(`   ${JSON.stringify(counts)}`)
  }

  async till(arg) {
    if (this.busy) {
      console.log("⏳ Ya hay una tarea de granja en curso")

      return
    }

    const { columns, error } = this.resolveColumns(arg)

    if (error) {
      console.log(`⚠️ ${error}`)

      return
    }

    this.busy = true
    this.sneak(true)

    try {
      await this.runTill(columns)
    } finally {
      this.sneak(false)
      this.busy = false
    }
  }

  // En una isla flotante un paso de más es caer al vacío: se trabaja agachado.
  sneak(on) {
    try {
      this.bot.setControlState("sneak", on)
    } catch (err) {
      console.log(`⚠️ No se pudo cambiar el agachado: ${err.message}`)
    }
  }

  async runTill(columns) {
    const hoe = this.bot.inventory.items().find((item) => item.name.endsWith("_hoe"))

    if (!hoe) {
      console.log("⚠️ No hay azada en el inventario: no se puede arar")

      return
    }

    const targets = columns.filter((position) => {
      const block = this.bot.blockAt(this.toVec(position))

      return block && ARABLE.has(block.name)
    })

    if (targets.length === 0) {
      console.log("⚠️ No hay tierra ni hierba que arar en esa área")

      return
    }

    await this.bot.equip(hoe, "hand")

    let tilled = 0
    let unreachable = 0

    for (const position of targets) {
      const vec = this.toVec(position)
      const block = this.bot.blockAt(vec)

      if (!block || !ARABLE.has(block.name)) continue

      if (!withinReach(this.bot.entity.position, position)) {
        const arrived = await this.walkTo(vec)

        if (!arrived) {
          unreachable += 1
          continue
        }
      }

      await this.bot.lookAt(vec.offset(0.5, 0.5, 0.5), true)

      // La hierba alta encima impide arar: se rompe primero.
      const above = this.bot.blockAt(vec.offset(0, 1, 0))

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

module.exports = { FarmManager, collectFootprint, parseArea, withinReach }
