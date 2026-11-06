// Draws banknote-style line work from an address, so a recipient always gets the same pattern.

export const GUILLOCHE_WIDTH = 800;
export const GUILLOCHE_HEIGHT = 180;

const seedBytes = (seed: string): number[] => {
  const hex = seed.replace(/^0x/, "").toLowerCase();
  const bytes = hex.match(/[0-9a-f]{2}/g)?.map((pair) => parseInt(pair, 16)) ?? [];
  return bytes.length ? bytes : [0];
};

const scale = (byte: number, min: number, max: number) => min + (byte / 255) * (max - min);

function ribbon(bytes: number[], offset: number, lines: number): string[] {
  const at = (index: number) => bytes[(offset + index) % bytes.length];
  const freqA = scale(at(0), 1.5, 4.5);
  const freqB = scale(at(1), 5, 11);
  const ampA = scale(at(2), 26, 52);
  const ampB = scale(at(3), 8, 20);
  const phase = scale(at(4), 0, Math.PI * 2);
  const twist = scale(at(5), 0.08, 0.2);

  return Array.from({ length: lines }, (_, line) => {
    const shift = line * twist;
    const points: string[] = [];
    for (let x = 0; x <= GUILLOCHE_WIDTH; x += 8) {
      const t = (x / GUILLOCHE_WIDTH) * Math.PI * 2;
      const y =
        GUILLOCHE_HEIGHT / 2 +
        ampA * Math.sin(freqA * t + phase + shift) +
        ampB * Math.sin(freqB * t - shift * 2);
      points.push(`${points.length ? "L" : "M"}${x} ${y.toFixed(1)}`);
    }
    return points.join("");
  });
}

export function guillochePaths(seed: string) {
  const bytes = seedBytes(seed);
  return {
    primary: ribbon(bytes, 0, 24),
    secondary: ribbon(bytes, 6, 16),
  };
}
