import twilio, { type Twilio } from "twilio";

import { env } from "@/lib/env";

export type SmsPayload = {
  to: string;
  message: string;
};

let twilioClient: Twilio | null = null;

const getTwilioClient = () => {
  if (!twilioClient) {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
      throw new Error("Twilio credentials are not configured");
    }
    twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
};

export const sendSms = async ({ to, message }: SmsPayload): Promise<void> => {
  if (!to) {
    throw new Error("Missing receiver phone number");
  }

  const fromNumber = env.TWILIO_FROM_NUMBER;

  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !fromNumber) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Twilio configuration missing; SMS not sent. Message preview:", {
        to,
        from: fromNumber || "(unset)",
        message,
      });
      return;
    }
    throw new Error("Twilio configuration missing");
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`SMS preview → ${to}: ${message}`);
  }

  const client = getTwilioClient();
  const twilioMessage = await client.messages.create({ to, from: fromNumber, body: message });

  if (process.env.NODE_ENV !== "production") {
    console.info(`[Twilio] SMS dispatched to ${to} (sid: ${twilioMessage.sid})`);
  }
};
