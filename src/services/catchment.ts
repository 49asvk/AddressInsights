// Shared across geoenrichment, poi, and app -- a "ring" is a simple radius
// buffer in km; a "polygon" is an arbitrary shape (e.g. a service area)
// given as plain rings, not a live Graphic, so it stays cache-safe.
export type Catchment =
  | { kind: "ring"; km: number }
  | { kind: "polygon"; rings: number[][][] };