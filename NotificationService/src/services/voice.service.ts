import { twilioClient, isTwilioConfigured } from "../config/twilio.js";

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

export async function makeCall(to: string, message: string, language: string = "hi-IN") {
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!isTwilioConfigured() || !twilioClient || !from) {
    console.log(`[NotificationService] Simulated Voice Call to ${to}: "${message}" (${language})`);
    return {
      id: `sim-call-${Date.now()}`,
      status: "initiated",
      simulated: true,
      note: "Twilio credentials pending in .env; voice call queued in simulation mode."
    };
  }

  const langCode = language.startsWith("en") ? "en-IN" : "hi-IN";
  const twiml = `<Response><Pause length="1"/><Say language="${langCode}">${escapeXml(message)}</Say><Pause length="1"/></Response>`;

  const call = await twilioClient.calls.create({
    from,
    to,
    twiml
  });

  return {
    id: call.sid,
    status: call.status,
    simulated: false
  };
}