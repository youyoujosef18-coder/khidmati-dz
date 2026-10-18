import { createHash, randomBytes, randomInt } from "node:crypto";

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}
export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function numericCode(digits = 6) {
  return Array.from({ length: digits }, () => randomInt(0, 10)).join("");
}
/** Human-friendly reference: KH-R-7F3K9Q */
export function makeReference(prefix: string) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 7; i++) s += alphabet[randomInt(0, alphabet.length)];
  return `${prefix}-${s}`;
}
