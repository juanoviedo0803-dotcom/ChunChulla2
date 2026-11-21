"use strict"

const test = require("node:test")
const assert = require("node:assert")

const { collectFootprint, parseArea, withinReach } = require("../farm")

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

test("un área de coordenadas cubre el rectángulo en el plano del suelo", () => {
  const { columns } = parseArea("10 20 12 22", 64)

  assert.strictEqual(columns.length, 9)
  assert.deepStrictEqual(columns[0], { x: 10, y: 64, z: 20 })
  assert.deepStrictEqual(columns[8], { x: 12, y: 64, z: 22 })
})

test("las esquinas se pueden dar en cualquier orden", () => {
  const a = parseArea("12 22 10 20", 64).columns
  const b = parseArea("10 20 12 22", 64).columns

  assert.deepStrictEqual(a, b)
})

test("rechaza coordenadas inválidas y áreas enormes", () => {
  assert.match(parseArea("10 20", 64).error, /uso/)
  assert.match(parseArea("10 20 x 22", 64).error, /enteras/)
  assert.match(parseArea("0 0 100 100", 64).error, /máximo/)
})

test("alcance de 4 bloques en los tres ejes", () => {
  const origin = { x: 0, y: 64, z: 0 }

  assert.strictEqual(withinReach(origin, { x: 4, y: 64, z: 4 }), true)
  assert.strictEqual(withinReach(origin, { x: 5, y: 64, z: 0 }), false)
  assert.strictEqual(withinReach(origin, { x: 0, y: 69, z: 0 }), false)
})
