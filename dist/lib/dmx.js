"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_ABSOLUTE =
  exports.MAX_PERCENT =
  exports.LAST_UNIVERSE =
  exports.FIRST_UNIVERSE =
  exports.LAST_CHANNEL =
  exports.FIRST_CHANNEL =
    void 0;
exports.maxValue = maxValue;
exports.fromPercent = fromPercent;
exports.nulledUniverse = nulledUniverse;
exports.FIRST_CHANNEL = 1;
exports.LAST_CHANNEL = 512;
exports.FIRST_UNIVERSE = 1;
exports.LAST_UNIVERSE = 63999;
exports.MAX_PERCENT = 100;
exports.MAX_ABSOLUTE = 255;
function maxValue(scale) {
  return scale === "absolute" ? exports.MAX_ABSOLUTE : exports.MAX_PERCENT;
}
function fromPercent(percent, scale) {
  return scale === "absolute" ? Math.round(percent * 2.55) : percent;
}
function nulledUniverse() {
  const universe = {};
  for (let channel = exports.FIRST_CHANNEL; channel <= exports.LAST_CHANNEL; channel++) {
    universe[channel] = 0;
  }
  return universe;
}
