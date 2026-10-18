// Writes www/app-config.js with the production URL so the local offline page
// knows where to send the user back to. Run automatically by `npm run sync`.
import { writeFileSync } from "node:fs";

const raw = process.env.KHIDMATI_APP_URL ?? "https://khidmati-dz.vercel.app";
const url = new URL(raw);
if (url.protocol !== "https:") throw new Error(`KHIDMATI_APP_URL must use https (got ${raw})`);
writeFileSync(
  new URL("../www/app-config.js", import.meta.url),
  `window.KHIDMATI_APP_URL = ${JSON.stringify(url.origin + "/")};\n`,
);
console.log(`www/app-config.js → ${url.origin}/`);
