import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import zlib from "node:zlib";

/**
 * End-to-end journeys against a running server (see playwright.config.ts).
 * Uses only the UI, except the administrator account which is provisioned
 * with `npm run admin:create` (password passed via E2E_ADMIN_PASSWORD).
 */

const run = Date.now().toString(36);
const TECH = { name: "Karim Testeur", email: `tech-${run}@e2e.khidmati.test`, phone: `0661${String(Date.now()).slice(-6)}`, password: "Plombier2026" };
const CLIENT = { name: "Samia Cliente", email: `client-${run}@e2e.khidmati.test`, phone: `0771${String(Date.now()).slice(-6)}`, password: "Cliente2026" };
const ADMIN = { email: process.env.E2E_ADMIN_EMAIL ?? "admin@e2e.khidmati.test", password: process.env.E2E_ADMIN_PASSWORD ?? "" };
const publicName = `Karim Plomberie ${run}`;

// Tiny valid PNG generated at runtime
function pngFile(name: string) {
  const file = path.join(test.info().outputDir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const w = 24, h = 24;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([20, 107, 82], y * (w * 3 + 1) + 1 + x * 3);
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
  fs.writeFileSync(file, png);
  return file;
}

async function register(page: Page, u: typeof TECH, next?: string) {
  await page.goto(`/inscription${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.getByLabel("Nom complet").fill(u.name);
  await page.getByLabel("Téléphone mobile").fill(u.phone);
  await page.getByLabel("E-mail", { exact: true }).fill(u.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(u.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL(/bienvenue/);
}

async function login(page: Page, identifier: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/connexion");
  await page.getByLabel("E-mail ou téléphone mobile").fill(identifier);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/connexion"));
}


test.describe.serial("Khidmati core journeys", () => {
  test("security: anonymous users are redirected and admin routes are protected", async ({ page }) => {
    await page.goto("/client/reservations");
    await expect(page).toHaveURL(/\/connexion\?next=%2Fclient%2Freservations/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/connexion/);
    const res = await page.request.get("/api/notifications/count");
    expect(res.status()).toBe(401);
    const up = await page.request.post("/api/uploads", { multipart: { bucket: "public-avatars" } });
    expect(up.status()).toBe(401);
  });

  test("technician registers, completes onboarding and submits for verification", async ({ page }) => {
    await register(page, TECH, "/technicien/inscription");
    await page.getByRole("link", { name: "Suivant" }).click();
    await expect(page).toHaveURL(/technicien\/inscription/);
    await page.getByRole("button", { name: "Commencer mon inscription" }).click();
    await page.waitForURL(/etape=1/);

    // Step 1 — profile
    const avatar = pngFile("avatar.png");
    await page.locator('input[type="file"]').first().setInputFiles(avatar);
    await page.waitForResponse((r) => r.url().includes("/api/uploads") && r.ok());
    await page.getByLabel("Nom légal complet").fill("Karim Benali");
    await page.getByLabel("Nom public").fill(publicName);
    await page.getByLabel("Présentation professionnelle").fill("Plombier depuis 10 ans à Alger : fuites, sanitaires, chauffe-eau. Travail propre et ponctuel.");
    await page.getByLabel("Années d'expérience").fill("10");
    await page.getByLabel("Arabe").check();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/etape=2/);

    // Step 2 — categories and zones
    await page.getByLabel("Métier principal").selectOption({ label: "Plomberie" });
    const base = page.getByRole("group", { name: /Wilaya principale/ });
    await base.locator("select").first().selectOption("16");
    await expect(base.locator("select").nth(1)).toBeEnabled();
    await base.locator("select").nth(1).selectOption({ label: "Bab Ezzouar" });
    await page.locator('select[name="zoneWilaya"]').selectOption("16");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/etape=3/);

    // Step 3 — a fixed-price service
    await page.getByRole("button", { name: "Ajouter un service" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Intitulé du service").fill("Réparation de fuite d'eau");
    await dlg.getByLabel("Type de tarif").selectOption("fixed");
    await dlg.getByLabel("Prix (DA)").fill("2500");
    await dlg.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Réparation de fuite d'eau")).toBeVisible();
    await page.getByRole("link", { name: "Suivant" }).click();
    await page.waitForURL(/etape=4/);

    // Step 4 — availability (keep defaults, add Saturday)
    await page.getByRole("button", { name: "Ajouter une plage" }).click();
    await page.locator('select[name="slotWeekday"]').last().selectOption("6");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/etape=5/);

    // Step 5 — identity document
    const doc = pngFile("id-card.png");
    await page.locator('input[type="file"]').first().setInputFiles(doc);
    await page.waitForResponse((r) => r.url().includes("/api/uploads") && r.ok());
    await page.getByRole("button", { name: "Téléverser le document" }).click();
    await expect(page.getByText("Carte d'identité nationale").first()).toBeVisible();
    await page.getByRole("link", { name: "Suivant" }).click();
    await page.waitForURL(/etape=6/);

    // Step 6 — submit
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Envoyer pour vérification" }).click();
    await page.waitForURL(/technicien\/verification\?envoye=1/);
    await expect(page.getByText("Dossier envoyé").first()).toBeVisible();

    // Not public before approval
    await page.goto(`/techniciens?q=${encodeURIComponent(publicName)}`);
    await expect(page.getByText("0 résultat(s)")).toBeVisible();
    await expect(page.getByRole("link", { name: publicName })).toHaveCount(0);
  });

  test("administrator reviews the application and approves it", async ({ page }) => {
    test.skip(!ADMIN.password, "E2E_ADMIN_PASSWORD not provided");
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL(/\/admin/);
    await page.goto("/admin/verification");
    await page.getByRole("link", { name: publicName }).click();
    await expect(page.getByText("Karim Benali")).toBeVisible();
    // document access is possible for admins (and audited)
    const docLink = page.getByRole("link", { name: "Consulter" }).first();
    const href = await docLink.getAttribute("href");
    expect((await page.request.get(href!)).status()).toBe(200);
    await page.getByLabel("La pièce d'identité correspond au nom légal").check();
    await page.getByLabel("Approuver").check();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Confirmer" }).click();
    await expect(page.getByText("Décision enregistrée et notifiée.")).toBeVisible();
    await page.goto("/admin/audit?action=verification");
    await expect(page.getByText("verification.approved").first()).toBeVisible();
    await page.goto("/admin/audit?action=file.sensitive_access");
    await expect(page.getByText("file.sensitive_access").first()).toBeVisible();
  });

  test("client finds the technician, requests a quote; technician quotes; client accepts", async ({ page, browser }) => {
    test.skip(!ADMIN.password, "requires approved technician");
    await register(page, CLIENT);
    await page.goto(`/techniciens?q=${encodeURIComponent("Karim Plomberie")}&wilaya=16`);
    await page.getByRole("link", { name: publicName }).first().click();
    await expect(page.getByText("Profil vérifié").first()).toBeVisible();
    await page.getByRole("link", { name: "Demander un devis" }).first().click();
    await page.waitForURL(/demandes\/nouvelle/);

    // Step 1 (category preselected) → step 2
    await page.getByRole("button", { name: "Suivant" }).click();
    await page.getByLabel("Titre de la demande").fill("Fuite sous l'évier");
    await page.getByLabel("Décrivez le problème").fill("De l'eau coule sous l'évier de la cuisine depuis hier soir, le placard est mouillé.");
    await page.getByRole("button", { name: "Suivant" }).click();
    // Step 3 — add an address inline
    await page.getByRole("button", { name: "Ajouter une adresse" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Nom de l'adresse").fill("Maison");
    await dlg.locator("select").first().selectOption("16");
    await expect(dlg.locator("select").nth(1)).toBeEnabled();
    await dlg.locator("select").nth(1).selectOption({ label: "Bab Ezzouar" });
    await dlg.getByLabel("Adresse (rue, bâtiment, étage)").fill("Cité 5 Juillet, Bât 12, 3e étage");
    await dlg.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Cité 5 Juillet")).toBeVisible();
    await page.getByRole("button", { name: "Suivant" }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Envoyer ma demande" }).click();
    await page.waitForURL(/client\/demandes\/.+\?cree=1/);
    await expect(page.getByText("1 professionnel(s) notifié(s).")).toBeVisible();
    const requestUrl = page.url().split("?")[0]!;

    // Technician sends a quote in a separate session
    const techCtx = await browser.newContext();
    const tech = await techCtx.newPage();
    await login(tech, TECH.email, TECH.password);
    await tech.goto("/technicien/demandes");
    await tech.getByRole("link", { name: /Fuite sous l'évier/ }).click();
    await expect(tech.getByText("Cité 5 Juillet")).toHaveCount(0); // exact address hidden before acceptance
    await tech.getByLabel("Main-d'œuvre").fill("3000");
    await tech.getByLabel("Déplacement").fill("500");
    const d = new Date(Date.now() + 3 * 86400_000);
    await tech.getByLabel("Date proposée").fill(d.toISOString().slice(0, 10));
    await tech.getByLabel("Heure proposée").fill("10:00");
    await tech.getByRole("button", { name: "Envoyer le devis" }).click();
    await expect(tech.getByText("Devis envoyé au client.")).toBeVisible();

    // Client accepts
    await page.goto(requestUrl);
    await expect(page.getByText("3 500 DA").first()).toBeVisible();
    await page.getByRole("button", { name: "Accepter ce devis" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
    await page.waitForURL(/client\/reservations\/.+confirmee=1/);
    await expect(page.getByText("Confirmée").first()).toBeVisible();
    const bookingUrl = page.url().split("?")[0]!;
    const bookingId = bookingUrl.split("/").pop()!;

    // Messaging
    await page.getByRole("link", { name: "Ouvrir la conversation" }).click();
    await page.getByLabel("Écrire un message…").fill("Bonjour, le code de l'immeuble est 1234.");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByText("le code de l'immeuble est 1234")).toBeVisible();

    // Technician performs the job
    await tech.goto(`/technicien/reservations/${bookingId}`);
    await expect(tech.getByText("Cité 5 Juillet")).toBeVisible(); // revealed after confirmation
    await tech.getByRole("button", { name: "Je suis en route" }).click();
    await expect(tech.getByText("Technicien en route").first()).toBeVisible();
    await tech.getByRole("button", { name: "Démarrer l'intervention" }).click();
    await expect(tech.getByText("En cours").first()).toBeVisible();
    await tech.getByRole("button", { name: "Marquer comme terminée" }).click();
    await tech.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
    await expect(tech.getByText("À confirmer").first()).toBeVisible();
    // Technician dashboard renders with live counters
    await tech.goto("/technicien");
    await expect(tech.getByRole("heading", { level: 1, name: /Bonjour/ })).toBeVisible();
    await expect(tech.getByText("Une erreur est survenue")).toHaveCount(0);
    await techCtx.close();

    // Client confirms completion and reviews
    await page.goto(bookingUrl);
    await page.getByRole("button", { name: "Confirmer la fin de l'intervention" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
    await expect(page.getByText("Terminée").first()).toBeVisible();
    await page.getByRole("radio", { name: "5/5" }).click();
    await page.getByLabel("Commentaire").fill("Intervention rapide et propre, merci !");
    await page.getByRole("button", { name: "Laisser un avis" }).click();
    await expect(page.getByText("Merci pour votre avis !").first()).toBeVisible();

    // Another client cannot open this booking
    const otherCtx = await browser.newContext();
    const other = await otherCtx.newPage();
    await register(other, { ...CLIENT, email: `other-${run}@e2e.khidmati.test`, phone: `0662${String(Date.now()).slice(-6)}` });
    // Private dashboards stream behind a loading boundary, so the not-found page is served
    // with a robots noindex tag rather than a 404 status: assert content, not status.
    await other.goto(bookingUrl);
    await expect(other.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
    await expect(other.getByText("Fuite sous l'évier")).toHaveCount(0);
    await expect(other.getByText("Cité 5 Juillet")).toHaveCount(0);
    expect(await other.locator('meta[name="robots"][content*="noindex"]').count()).toBeGreaterThan(0);
    const forbidden = await other.goto("/admin");
    expect(other.url()).toContain("/non-autorise");
    expect(forbidden?.ok()).toBeTruthy();
    await otherCtx.close();
  });

  test("Arabic interface renders right-to-left and keeps form input on language switch", async ({ page }) => {
    await page.goto("/contact");
    await page.getByLabel("Votre nom").fill("Yacine");
    await page.getByRole("button", { name: /العربية/ }).first().click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar-DZ");
    await expect(page.getByLabel("اسمك")).toHaveValue("Yacine");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("اتصل بنا");
  });

  test("mobile layouts have no horizontal overflow", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
    const page = await ctx.newPage();
    for (const p of ["/", "/services", "/techniciens", "/devenir-technicien", "/connexion", "/inscription", "/faq", "/contact"]) {
      await page.goto(p);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, `overflow on ${p}`).toBe(false);
    }
    await ctx.close();
  });
});
