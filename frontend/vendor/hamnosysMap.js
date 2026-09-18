/**
 * HamNoSys → SignEngine action map.
 * Each symbol calls simple methods: armTo, palm, hand.
 */
export const HAMNOSYS_ACTIONS = {

  // Hand shapes
  hamflathand: (e) => e.hand("flat"),
  hamfist: (e) => e.hand("fist"),
  hamindex: (e) => e.hand("index"),
  hamfinger2: (e) => e.hand("vee"),
  hampinch: (e) => e.hand("pinch"),
  hamthumbup: (e) => e.hand("thumbup"),
  hamcee: (e) => e.hand("cee"),

  // Palm orientation
  hampalmd: (e) => e.palm("down"),
  hampalmu: (e) => e.palm("up"),
  hampalml: (e) => e.palm("left"),
  hampalmr: (e) => e.palm("right"),
  hampalmf: (e) => e.palm("forward"),

  // Body locations
  hamchest: (e) => e.armTo("chest"),
  hamchin: (e) => e.armTo("chin"),
  hamhead: (e) => e.armTo("head"),
  hamstomach: (e) => e.armTo("stomach"),

  // Movements
  hammoveforward: (e) => e.armTo("forward"),
  hammoveback: (e) => e.armTo("chest"),
  hammoveup: (e) => e.armTo("chin"),
  hammovedown: (e) => e.armTo("stomach"),

  // Reset
  hamrest: (e) => e.resetAll(),
};
