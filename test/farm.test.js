"use strict"

const test = require("node:test")
const assert = require("node:assert")

const { collectFootprint, withinReach } = require("../farm")

test("la isla es la región sólida conectada bajo los pies", () => {
  // Isla de 5x5 rodeada de aire.
  const solid = (dx, dz) => Math.abs(dx) <= 2 && Math.abs(dz) <= 2

  const columns = collectFootprint(solid)

  assert.strictEqual(columns.length, 25)
  assert.deepStrictEqual(columns[0], [0, 0])
})

test("no salta el hueco: dos plataformas separadas cuentan como una", () => {
  // Dos bloques pegados en una esquina no conectan el resto.
  const solid = (dx, dz) => (dx === 0 && dz === 0) || Math.abs(dx) > 2

  assert.deepStrictEqual(collectFootprint(solid), [[0, 0]])
})

test("respeta el radio máximo", () => {
  const columns = collectFootprint(() => true, { maxRadius: 3 })

  assert.strictEqual(columns.length, 49)
})

test("respeta el tope de columnas", () => {
  assert.strictEqual(collectFootprint(() => true, { maxColumns: 10 }).length, 10)
})

test("alcance de 4 bloques en los tres ejes", () => {
  const origin = { x: 0, y: 64, z: 0 }

  assert.strictEqual(withinReach(origin, { x: 4, y: 64, z: 4 }), true)
  assert.strictEqual(withinReach(origin, { x: 5, y: 64, z: 0 }), false)
  assert.strictEqual(withinReach(origin, { x: 0, y: 69, z: 0 }), false)
})
