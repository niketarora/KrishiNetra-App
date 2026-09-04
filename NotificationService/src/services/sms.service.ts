import { twilioClient, isTwilioConfigured } from "../config/twilio.js";

export async function sendSms(to: string, message: string) {
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!isTwilioConfigured() || !twilioClient || !from) {
    console.log(`[NotificationService] Simulated SMS to ${to}: "${message}"`);
    return {
      id: `sim-sms-${Date.now()}`,
      status: "sent",
      simulated: true,
      note: "Twilio credentials pending in .env; SMS queued in simulation mode."
    };
  }

  const result = await twilioClient.messages.create({
    from,
    to,
    body: message
  });

  return {
    id: result.sid,
    status: result.status,
    simulated: false
  };
}