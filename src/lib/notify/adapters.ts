import "server-only";

export interface SendResult {
  ok: boolean;
  providerReference?: string;
  error?: string;
}

export interface EmailAdapter {
  name: string;
  configured: boolean;
  send(to: string, subject: string, text: string): Promise<SendResult>;
}
export interface SmsAdapter {
  name: string;
  configured: boolean;
  send(toE164: string, text: string): Promise<SendResult>;
}

const TIMEOUT_MS = 8000;

async function timedFetch(url: string, init: RequestInit) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

/** Resend (https://resend.com) — requires EMAIL_PROVIDER_API_KEY + EMAIL_FROM_ADDRESS */
const resend: EmailAdapter = {
  name: "resend",
  get configured() {
    return Boolean(process.env.EMAIL_PROVIDER_API_KEY && process.env.EMAIL_FROM_ADDRESS);
  },
  async send(to, subject, text) {
    try {
      const res = await timedFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.EMAIL_PROVIDER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: process.env.EMAIL_FROM_ADDRESS, to: [to], subject, text }),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${body.message ?? "error"}`.slice(0, 300) };
      return { ok: true, providerReference: body.id };
    } catch (e) {
      return { ok: false, error: (e as Error).message.slice(0, 300) };
    }
  },
};

/** Development-only adapter: prints to the server console. Never active in production. */
const devConsoleEmail: EmailAdapter = {
  name: "dev-console",
  get configured() {
    return process.env.NODE_ENV !== "production" && process.env.DEV_EMAIL_CONSOLE === "1";
  },
  async send(to, subject, text) {
    console.info(`[dev-email] to=${to} subject=${subject}\n${text}`);
    return { ok: true, providerReference: "dev-console" };
  },
};

/** Twilio Programmable SMS — requires SMS_PROVIDER=twilio, TWILIO_ACCOUNT_SID, SMS_PROVIDER_API_KEY (auth token), SMS_SENDER_ID */
const twilio: SmsAdapter = {
  name: "twilio",
  get configured() {
    return Boolean(
      process.env.SMS_PROVIDER === "twilio" &&
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.SMS_PROVIDER_API_KEY &&
        process.env.SMS_SENDER_ID,
    );
  },
  async send(toE164, text) {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    try {
      const res = await timedFetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${sid}:${process.env.SMS_PROVIDER_API_KEY}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: toE164, From: process.env.SMS_SENDER_ID!, Body: text }),
      });
      const body = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${body.message ?? "error"}`.slice(0, 300) };
      return { ok: true, providerReference: body.sid };
    } catch (e) {
      return { ok: false, error: (e as Error).message.slice(0, 300) };
    }
  },
};

export function emailAdapter(): EmailAdapter | null {
  if (resend.configured) return resend;
  if (devConsoleEmail.configured) return devConsoleEmail;
  return null;
}
export function smsAdapter(): SmsAdapter | null {
  return twilio.configured ? twilio : null;
}

export function channelStatus() {
  return {
    in_app: true,
    email: emailAdapter()?.name ?? null,
    sms: smsAdapter()?.name ?? null,
    push: null as string | null,
  };
}
