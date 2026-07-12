"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LAST_UNIVERSE = exports.FIRST_UNIVERSE = exports.LAST_CHANNEL = exports.FIRST_CHANNEL = void 0;
exports.nulledUniverse = nulledUniverse;
exports.FIRST_CHANNEL = 1;
exports.LAST_CHANNEL = 512;
exports.FIRST_UNIVERSE = 1;
exports.LAST_UNIVERSE = 63999;
function nulledUniverse() {
    const universe = {};
    for (let channel = exports.FIRST_CHANNEL; channel <= exports.LAST_CHANNEL; channel++) {
        universe[channel] = 0;
    }
    return universe;
}
