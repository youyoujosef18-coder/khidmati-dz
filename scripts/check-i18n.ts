/** Verifies FR/AR key parity and that every literal t("key") used in src exists. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import fr from "../src/messages/fr";
import ar from "../src/messages/ar";

type D = { [k: string]: string | D };
function keys(d: D, prefix = ""): string[] {
  return Object.entries(d).flatMap(([k, v]) => (typeof v === "string" ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`)));
}
const frKeys = new Set(keys(fr as unknown as D));
const arKeys = new Set(keys(ar as unknown as D));
const problems: string[] = [];
for (const k of frKeys) if (!arKeys.has(k)) problems.push(`missing in ar: ${k}`);
for (const k of arKeys) if (!frKeys.has(k)) problems.push(`missing in fr: ${k}`);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|ts)$/.test(f) ? [p] : [];
  });
}
const re = /\bt\(\s*["'`]([a-zA-Z0-9_.]+)["'`]/g;
const msgRe = /message:\s*"((?:common|errors|auth|validation|booking|quote|request|support|report|dispute|tech|pages|profile)\.[a-zA-Z0-9_.]+)"/g;
const runActionRe = /},\s*"([a-z]+\.[a-zA-Z0-9_.]+)"\)/g;
for (const file of walk("src")) {
  if (file.includes("/messages/")) continue;
  const src = readFileSync(file, "utf8");
  for (const r of [re, msgRe, runActionRe]) {
    for (const m of src.matchAll(r)) {
      const k = m[1]!;
      if (k.endsWith(".")) continue;
      if (!frKeys.has(k)) problems.push(`${file}: unknown key ${k}`);
    }
  }
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`i18n OK: ${frKeys.size} keys, FR/AR in sync, all literal keys resolved.`);
