export interface DMXValues {
  [key: number]: number;
}

/** lowest and highest DMX channel within a universe */
export const FIRST_CHANNEL = 1;
export const LAST_CHANNEL = 512;

/** usable sACN (E1.31) universe range */
export const FIRST_UNIVERSE = 1;
export const LAST_UNIVERSE = 63999;

/** a full universe with every channel set to 0 */
export function nulledUniverse(): DMXValues {
  const universe: DMXValues = {};
  for (let channel = FIRST_CHANNEL; channel <= LAST_CHANNEL; channel++) {
    universe[channel] = 0;
  }

  return universe;
}
