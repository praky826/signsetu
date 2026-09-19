// Per-word avatar overrides for a pilot batch of 50 words, curated by
// watching each word's real CISLR reference clip (frame-by-frame, via
// ffmpeg) and choosing the closest available combination of SignEngine's
// existing hand shape / palm orientation / body location primitives -
// explicitly NOT claimed to be accurate ISL, just a closer visual
// approximation than the dictionary's generic hamnosys mapping produces on
// its own. isl_dictionary.json itself is untouched; avatarRenderer.js
// consults this table first (keyed by gloss word) and only falls back to
// the generic hamnosys-token path for words with no entry here.
//
// bimanual: true means the sign visually uses both hands together (e.g.
// LOVE's crossed arms, SCHOOL's clapping motion, HELP's one-hand-supporting
// -the-other) - the left side mirrors the same hand shape/palm/location via
// avatarRenderer.js's existing mirroring helpers.
export const SIGN_OVERRIDES = {
  NOT: { hand: "index", location: "chest" },
  FEAR: { hand: "flat", palm: "down", location: "chest", bimanual: true },
  GET: { hand: "cee", location: "chin" },
  VILLAGE: { hand: "flat", location: "chest", bimanual: true },
  YOU: { hand: "index", palm: "down", location: "forward" },
  ME: { hand: "index", location: "chest" },
  HE: { hand: "index", location: "head" },
  AFTER: { hand: "flat", location: "forward" },
  ALL: { hand: "flat", palm: "up", location: "chest", bimanual: true },
  COME: { hand: "index", location: "chest" },
  FOOD: { hand: "pinch", location: "chin" },
  WHY: { hand: "flat", palm: "up", location: "chest", bimanual: true },
  MAN: { hand: "flat", location: "head" },
  THEY: { hand: "index", location: "forward" },
  FEW: { hand: "pinch", location: "chest" },
  MAKE: { hand: "fist", location: "chest", bimanual: true },
  SLEEP: { hand: "flat", location: "chin" },
  WE: { hand: "flat", location: "chest" },
  BEFORE: { hand: "flat", location: "chest" },
  RIGHT: { hand: "flat", palm: "up", location: "chin" },
  MY: { hand: "flat", location: "chest" },
  LITTLE: { hand: "pinch", location: "chest" },
  TIME: { hand: "index", location: "chest" },
  PLEASE: { hand: "flat", palm: "up", location: "chest" },
  YOUR: { hand: "index", location: "forward" },
  HAVE: { hand: "flat", location: "chest", bimanual: true },
  GO: { hand: "index", location: "forward" },
  HELP: { hand: "fist", palm: "up", location: "chest", bimanual: true },
  NO: { hand: "flat", location: "forward" },
  MORE: { hand: "pinch", location: "chest", bimanual: true },
  BIG: { hand: "flat", palm: "up", location: "chest", bimanual: true },
  WHAT: { hand: "flat", palm: "up", location: "chest" },
  LOVE: { hand: "fist", location: "chest", bimanual: true },
  NEXT: { hand: "flat", location: "forward" },
  SEE: { hand: "vee", palm: "down", location: "chin" },
  WHEN: { hand: "index", location: "chin" },
  BEAUTIFUL: { hand: "flat", palm: "up", location: "chin" },
  ONE: { hand: "index", palm: "up", location: "chin" },
  WHO: { hand: "index", location: "chin" },
  SHE: { hand: "index", location: "forward" },
  DO: { hand: "fist", location: "chin" },
  NEED: { hand: "index", location: "stomach" },
  ANGRY: { hand: "fist", location: "chest" },
  DAY: { hand: "flat", palm: "up", location: "chin" },
  EAT: { hand: "pinch", location: "chin" },
  SCHOOL: { hand: "flat", palm: "down", location: "chest", bimanual: true },
  SOME: { hand: "flat", location: "chest" },
  RUN: { hand: "vee", location: "forward" },
  FREE: { hand: "flat", palm: "up", location: "forward", bimanual: true },
  GIVE: { hand: "flat", palm: "up", location: "forward", bimanual: true },
};
