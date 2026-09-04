import { twilioClient } from "../config/twilio.js";

export async function makeCall(to: string, _message: string) {
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!from) {
    throw new Error("TWILIO_PHONE_NUMBER is missing");
  }

  const call = await twilioClient.calls.create({
    from,
    to,
    url: "https://webhooks.twilio.com/v1/Voice/Template/voice_text_to_speech"
  });

  return {
    id: call.sid,
    status: call.status
  };
}