"use strict"

// Los motivos de expulsión llegan como componente de chat (JSON con `extra[]` y
// códigos §). En el log tienen que leerse, no ocupar seis líneas de JSON.
function flatten(component) {
  if (typeof component === "string") return component
  if (!component || typeof component !== "object") return ""

  const parts = []

  if (typeof component.text === "string") parts.push(component.text)
  if (Array.isArray(component.extra)) parts.push(...component.extra.map(flatten))

  return parts.join("")
}

function stripFormatting(text) {
  return text.replace(/§[0-9a-fk-or]/gi, "")
}

function chatText(reason) {
  if (reason === null || reason === undefined) return "(sin motivo)"

  const raw = typeof reason === "string" ? reason : JSON.stringify(reason)

  let text = raw

  if (raw.trim().startsWith("{")) {
    try {
      text = flatten(JSON.parse(raw))
    } catch {
      text = raw
    }
  } else if (typeof reason === "object") {
    text = flatten(reason)
  }

  const clean = stripFormatting(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" | ")

  return clean || raw
}

module.exports = { chatText }
