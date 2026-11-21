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

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
]

// En el vacío un bloque sólo se puede poner contra un vecino sólido: de ahí sale
// la cara sobre la que hay que hacer clic. Sin vecino alcanzable, no hay plan.
function planFills(columns, isSolid, isReachable) {
  const planned = []

  for (const position of columns) {
    if (isSolid(position)) continue

    const reference = NEIGHBORS.map(([dx, dz]) => ({
      x: position.x + dx,
      y: position.y,
      z: position.z + dz
    })).find(isSolid)

    if (!reference || !isReachable(reference)) continue

    planned.push({
      target: position,
      reference,
      face: { x: position.x - reference.x, y: 0, z: position.z - reference.z }
    })
  }

  return planned
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
    const base = this.bot.entity.position.floored()
    const solid = columns.filter((position) => this.isSolid(position))

    console.log(`🗺️ ${columns.length} columnas | aranbles: ${arable} | bot en ${base.x},${base.y},${base.z}`)
    console.log(`   ${JSON.stringify(counts)}`)

    if (solid.length > 0) {
      const xs = solid.map((position) => position.x)
      const zs = solid.map((position) => position.z)

      console.log(
        `   isla: x ${Math.min(...xs)}..${Math.max(...xs)} | z ${Math.min(...zs)}..${Math.max(...zs)}`
      )
    }
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

  async fill(arg) {
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
      await this.runFill(columns)
    } finally {
      this.sneak(false)
      this.busy = false
    }
  }

  isSolid(position) {
    const block = this.bot.blockAt(this.toVec(position))

    return Boolean(block) && !NOT_FLOOR.has(block.name)
  }

  dirtItem() {
    return this.bot.inventory.items().find((item) => item.name === "dirt" || item.name === "grass_block")
  }

  // El click de inventario puede quedarse sin confirmación del servidor; se
  // reintenta y, si ya está en la mano, no se toca nada.
  async holdItem(name, attempts = 3) {
    const matches = (item) => (name.endsWith("_hoe") ? Boolean(item) && item.name.endsWith("_hoe") : item && item.name === name)

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      if (matches(this.bot.heldItem)) return true

      const item = this.bot.inventory.items().find((candidate) => matches(candidate))

      if (!item) return false

      try {
        await this.bot.equip(item, "hand")

        return true
      } catch (err) {
        console.log(`⚠️ No se pudo equipar ${name} (${err.message}); reintento ${attempt}/${attempts}`)
        await new Promise((resolve) => setTimeout(resolve, 600))
      }
    }

    return matches(this.bot.heldItem)
  }

  async runFill(columns) {
    if (!this.dirtItem()) {
      console.log("⚠️ No hay tierra en el inventario: no se puede rellenar")

      return
    }

    let placed = 0

    // Cada pasada rellena lo que da a un bloque ya sólido, así el borde avanza.
    // Se corta cuando una pasada no puede colocar nada.
    for (let pass = 0; pass < 20; pass += 1) {
      // Solo se rellena lo que se ve vacío de verdad: una columna sin cargar
      // (`blockAt` null) no es un hueco, es información que falta.
      const missing = columns.filter((position) => {
        const block = this.bot.blockAt(this.toVec(position))

        return Boolean(block) && NOT_FLOOR.has(block.name)
      })

      if (missing.length === 0) {
        console.log(`🧱 Relleno completo: ${placed} bloques colocados`)

        return
      }

      const plan = planFills(
        missing,
        (position) => this.isSolid(position),
        (position) => withinReach(this.bot.entity.position, position)
      )

      if (plan.length === 0) {
        const nearest = missing.reduce((best, position) =>
          Math.hypot(position.x - this.bot.entity.position.x, position.z - this.bot.entity.position.z) <
          Math.hypot(best.x - this.bot.entity.position.x, best.z - this.bot.entity.position.z)
            ? position
            : best
        )

        const arrived = await this.safeWalkTo(nearest)

        if (arrived) continue

        console.log(`🧱 Colocados ${placed}; quedan ${missing.length} huecos y no se puede avanzar sin caer. Acerca el bot.`)

        return
      }

      if (!(await this.holdItem("dirt"))) {
        console.log("⚠️ No se pudo poner la tierra en la mano; se detiene el relleno")

        return
      }

      for (const step of plan) {
        if (!this.dirtItem()) break

        const referenceBlock = this.bot.blockAt(this.toVec(step.reference))

        if (!referenceBlock || NOT_FLOOR.has(referenceBlock.name)) continue

        try {
          await this.bot.placeBlock(referenceBlock, new Vec3(step.face.x, 0, step.face.z))
          placed += 1
        } catch (err) {
          console.log(`⚠️ No se pudo colocar en ${step.target.x},${step.target.z}: ${err.message}`)
        }

        await new Promise((resolve) => setTimeout(resolve, USE_DELAY_MS))
      }
    }

    console.log(`🧱 Colocados ${placed} (límite de pasadas)`)
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

    await this.holdItem(hoe.name)

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

  // Avanzar hacia el borde sólo si la columna de delante es sólida: en una isla
  // flotante un paso de más es caer al vacío. Devuelve false si no hay suelo.
  async safeWalkTo(target) {
    const started = Date.now()

    while (Date.now() - started < WALK_TIMEOUT_MS) {
      const pos = this.bot.entity.position

      if (Math.hypot(target.x + 0.5 - pos.x, target.z + 0.5 - pos.z) < 2) return true

      const feet = pos.floored()
      const dx = Math.sign(target.x - feet.x)
      const dz = Math.sign(target.z - feet.z)
      const ahead =
        dx === 0 && dz === 0 ? null : this.bot.blockAt(new Vec3(feet.x + dx, feet.y - 1, feet.z + dz))

      if (!ahead || NOT_FLOOR.has(ahead.name)) return false

      await this.bot.lookAt(new Vec3(target.x + 0.5, pos.y, target.z + 0.5), true)
      this.bot.setControlState("forward", true)
      await new Promise((resolve) => setTimeout(resolve, WALK_STEP_MS))
      this.bot.setControlState("forward", false)
    }

    return false
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

module.exports = { FarmManager, collectFootprint, parseArea, planFills, withinReach }
