export interface DMXValues {
  [key: number]: number;
}

/** lowest and highest DMX channel within a universe */
export const FIRST_CHANNEL = 1;
export const LAST_CHANNEL = 512;

/** usable sACN (E1.31) universe range */
export const FIRST_UNIVERSE = 1;
export const LAST_UNIVERSE = 63999;

/** whether channel values are expressed as a percentage (0–100) or as raw DMX bytes (0–255) */
export type ValueScale = "percent" | "absolute";

export const MAX_PERCENT = 100;
export const MAX_ABSOLUTE = 255;

/** highest valid channel value for the given scale */
export function maxValue(scale: ValueScale): number {
  return scale === "absolute" ? MAX_ABSOLUTE : MAX_PERCENT;
}

/** the underlying library always works in percent; convert to the configured scale */
export function fromPercent(percent: number, scale: ValueScale): number {
  return scale === "absolute" ? Math.round(percent * 2.55) : percent;
}

/** a full universe with every channel set to 0 */
export function nulledUniverse(): DMXValues {
  const universe: DMXValues = {};
  for (let channel = FIRST_CHANNEL; channel <= LAST_CHANNEL; channel++) {
    universe[channel] = 0;
  }

  return universe;
}
