/**
 * Email delivery, free options first:
 *  - SMTP_USER + SMTP_PASS  → any SMTP server. Free default: Gmail with an App Password
 *    (smtp.gmail.com, ~500 emails/day, no domain needed).
 *  - RESEND_API_KEY         → Resend (free 3,000/month, but needs a verified domain to email others).
 *  - neither (local dev)    → messages are printed to the server log so every flow stays testable.
 */
export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

type Provider = "smtp" | "resend" | "log";

export function emailProvider(): Provider {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  if (process.env.RESEND_API_KEY) return "resend";
  return "log";
}
export const emailEnabled = () => emailProvider() !== "log";

const from = () => process.env.EMAIL_FROM ?? (process.env.SMTP_USER ? `SourceFirst <${process.env.SMTP_USER}>` : "SourceFirst <onboarding@resend.dev>");

const g = globalThis as unknown as { __sfSmtp?: import("nodemailer").Transporter };

async function smtp() {
  if (!g.__sfSmtp) {
    const nodemailer = await import("nodemailer");
    const port = Number(process.env.SMTP_PORT ?? 465);
    g.__sfSmtp = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      pool: true, // reuse one connection for a batch of alert emails
      maxConnections: 2,
    });
  }
  return g.__sfSmtp;
}

export async function sendEmail(m: Mail): Promise<void> {
  const provider = emailProvider();
  if (provider === "log") {
    console.log(`\n[email:dev] to=${m.to}\n  subject: ${m.subject}\n  ${m.text.replace(/\n/g, "\n  ")}\n`);
    return;
  }
  if (provider === "smtp") {
    await (await smtp()).sendMail({ from: from(), to: m.to, subject: m.subject, html: m.html, text: m.text, headers: m.headers });
    return;
  }
  const { Resend } = await import("resend");
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: from(), to: m.to, subject: m.subject, html: m.html, text: m.text, headers: m.headers });
  if (error) throw new Error(`email failed: ${error.message}`);
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
