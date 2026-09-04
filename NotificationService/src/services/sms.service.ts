import { twilioClient } from "../config/twilio.js";

export async function sendSms(to: string, message: string) {
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!from) {
    throw new Error("TWILIO_PHONE_NUMBER is missing");
  }

  const result = await twilioClient.messages.create({
    from,
    to,
    body: message
  });

  return {
    id: result.sid,
    status: result.status
  };
}