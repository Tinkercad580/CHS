import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";
import { logger } from "./logger";

/**
 * Email over SMTP with nodemailer — reports, bills, receipts, notices.
 *
 * Any SMTP server works: Gmail or Google Workspace with an app password,
 * Zoho, Brevo's free tier, or the society's own domain mail. With
 * MAIL_PROVIDER=log (the default) messages are rendered and logged, not sent,
 * so a dev machine never emails real residents.
 */

let transport: Transporter | null = null;

function transporter(): Transporter {
  if (transport) return transport;
  transport =
    env.MAIL_PROVIDER === "smtp"
      ? nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
          pool: true,
          maxConnections: 3,
        })
      : nodemailer.createTransport({ jsonTransport: true });
  return transport;
}

export interface MailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
}

export async function sendMail(mail: Mail): Promise<{ messageId: string }> {
  const info = await transporter().sendMail({
    from: env.MAIL_FROM,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html ?? renderHtml(mail.subject, mail.text),
    attachments: mail.attachments,
  });
  if (env.MAIL_PROVIDER === "log") {
    logger.info({ to: mail.to, subject: mail.subject, attachments: mail.attachments?.map((a) => a.filename) }, "email (log provider, not sent)");
  }
  return { messageId: String(info.messageId ?? "log") };
}

export function mailStatus(): "ok" | "log" | "misconfigured" {
  if (env.MAIL_PROVIDER === "log") return "log";
  return env.SMTP_HOST ? "ok" : "misconfigured";
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * One plain, table-based layout that survives Gmail, Outlook and phone mail
 * apps. Paragraphs come from blank lines in the text version, so the two
 * versions can't say different things.
 */
export function renderHtml(title: string, text: string, opts: { society?: string; actionLabel?: string; actionUrl?: string } = {}): string {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1B2B26">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const action =
    opts.actionUrl && opts.actionLabel
      ? `<p style="margin:22px 0 6px"><a href="${esc(opts.actionUrl)}" style="display:inline-block;background:#0E6B5C;color:#fff;text-decoration:none;font:600 14px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:13px 20px;border-radius:10px">${esc(opts.actionLabel)}</a></p>`
      : "";
  return `<!doctype html><html><body style="margin:0;background:#F4F6F5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F5;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #E3E9E6;border-radius:14px">
<tr><td style="padding:22px 26px 6px;font:700 13px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;letter-spacing:.4px;color:#0E6B5C;text-transform:uppercase">${esc(opts.society ?? "Sahaj")}</td></tr>
<tr><td style="padding:8px 26px 4px;font:700 20px/1.3 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#10201B">${esc(title)}</td></tr>
<tr><td style="padding:12px 26px 22px">${paras}${action}</td></tr>
</table>
<p style="font:12px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#6B7C76;margin:14px 0 0">You're receiving this because of your account with ${esc(opts.society ?? "your society")}. Manage email in the app under Notifications.</p>
</td></tr></table></body></html>`;
}
