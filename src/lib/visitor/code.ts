/** 6-digit visitor id (100000-999999). Uses Web Crypto when available. */
export function generateVisitorCode(): string {
  let n: number;
  const g = (globalThis as { crypto?: Crypto }).crypto;
  if (g && typeof g.getRandomValues === "function") {
    const arr = new Uint32Array(1);
    g.getRandomValues(arr);
    n = 100000 + (arr[0] % 900000);
  } else {
    n = 100000 + Math.floor(Math.random() * 900000);
  }
  return String(n);
}

export function isValidVisitorCode(code: unknown): code is string {
  return typeof code === "string" && /^[1-9]\d{5}$/.test(code);
}
