// Dice. The game uses the browser's cryptographic random numbers (fair dice).
// The simulator and tests use a seeded generator so runs can be repeated.

const bytes = new Uint8Array(256);
let next = bytes.length;

function randomByte() {
  if (next === bytes.length) {
    crypto.getRandomValues(bytes);
    next = 0;
  }
  return bytes[next++];
}

// 252 is the largest multiple of 6 under 256; rejecting 252–255 keeps every face equally likely.
export function cryptoDie() {
  let x;
  do x = randomByte(); while (x >= 252);
  return (x % 6) + 1;
}

export function cryptoRoll() {
  return [cryptoDie(), cryptoDie()];
}

// sfc32 generator seeded through splitmix32. Returns { die(), roll() }.
export function seededDice(seed) {
  let s = seed >>> 0;
  const splitmix = () => {
    s = (s + 0x9e3779b9) | 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
  let a = splitmix(), b = splitmix(), c = splitmix(), d = splitmix();
  const next32 = () => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
  // 4294967292 is the largest multiple of 6 below 2^32.
  const die = () => {
    let x;
    do x = next32(); while (x >= 4294967292);
    return (x % 6) + 1;
  };
  return { die, roll: () => [die(), die()] };
}
