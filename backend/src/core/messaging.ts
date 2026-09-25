import { env } from "../config/env";
import { prisma } from "./db";
import { logger } from "./logger";
import { sendMail } from "./mail";

import { defineJob } from "./queue";

/**
 * Outbound SMS / WhatsApp / email. Every message is written to
 * `outbound_messages` first and delivered by a job, so a provider outage
 * delays delivery instead of failing the request that caused it.
 *
 * Providers are ports. The `log` adapter is the development default: it logs
 * the message and marks it sent. DLT SMS, a WhatsApp BSP and SES plug in as
 * further adapters with credentials from the environment (MASTER_SPEC A3).
 */

export type Channel = "sms" | "whatsapp" | "email";

const SUBJECTS: Record<string, string> = {
  temp_password: "Your temporary password",
  tenancy_expiry: "Tenancy ending soon",
};
const subjectFor = (template: string) => SUBJECTS[template] ?? "Update from your society";


interface Provider {
  send(msg: { channel: Channel; to: string; body: string; template: string }): Promise<{ providerRef: string }>;
}

/** SMS and WhatsApp have no live provider yet; email goes out through nodemailer. */
const providers: Record<typeof env.MESSAGING_PROVIDER, Provider> = {
  log: {
    async send(msg) {
      logger.info({ channel: msg.channel, to: msg.to, template: msg.template }, `message: ${msg.body}`);
      return { providerRef: `log-${Date.now()}` };
    },
  },
  none: {
    async send() {
      return { providerRef: "none" };
    },
  },
};

const deliver = defineJob<{ messageId: string }>(
  "messaging.deliver",
  async ({ messageId }) => {
    const msg = await prisma.outboundMessage.findUnique({ where: { id: messageId } });
    if (!msg || msg.status === "SENT") return;
    try {
      const { providerRef } =
        msg.channel === "email"
          ? { providerRef: (await sendMail({ to: msg.to, subject: subjectFor(msg.template), text: msg.body })).messageId }
          : await providers[env.MESSAGING_PROVIDER].send({ channel: msg.channel as Channel, to: msg.to, body: msg.body, template: msg.template });
      await prisma.outboundMessage.update({
        where: { id: msg.id },
        data: { status: "SENT", providerRef, sentAt: new Date(), attempts: { increment: 1 }, error: null },
      });
    } catch (err) {
      await prisma.outboundMessage.update({
        where: { id: msg.id },
        data: { status: "FAILED", attempts: { increment: 1 }, error: String((err as Error).message).slice(0, 500) },
      });
      throw err;
    }
  },
  { attempts: 6 },
);

export async function sendMessage(input: {
  channel: Channel;
  to: string;
  template: string;
  body: string;
  societyId?: string | null;
  userId?: string | null;
}): Promise<string> {
  const row = await prisma.outboundMessage.create({
    data: {
      channel: input.channel,
      to: input.to,
      template: input.template,
      body: input.body,
      societyId: input.societyId ?? null,
      userId: input.userId ?? null,
    },
  });
  await deliver.enqueue({ messageId: row.id });
  return row.id;
}
