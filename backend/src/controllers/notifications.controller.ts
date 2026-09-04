import type { Request, Response } from 'express';
import type { SendSmsBody, MakeCallBody } from '../schemas/notifications.schema.js';
import { sendOk } from '../utils/apiResponse.js';

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4001';

export async function sendSms(req: Request, res: Response): Promise<void> {
  const { phone, message, alertId } = req.body as SendSmsBody;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/notifications/sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message, alertId }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      sendOk(res, data, 'SMS notification dispatched');
      return;
    }
  } catch {
    // Notification service offline or not started: fall back to graceful simulation
  }

  // Graceful simulation when microservice is offline or Twilio API keys are pending
  sendOk(
    res,
    {
      id: `sim-sms-${Date.now()}`,
      channel: 'sms',
      phone,
      alertId: alertId ?? null,
      status: 'sent',
      simulated: true,
      note: 'Twilio notification service pending or keys queued in simulation mode.',
    },
    'SMS notification simulated',
  );
}

export async function makeCall(req: Request, res: Response): Promise<void> {
  const { phone, message, language, alertId } = req.body as MakeCallBody;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/notifications/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message, language, alertId }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      sendOk(res, data, 'Voice call notification dispatched');
      return;
    }
  } catch {
    // Fall back to graceful simulation
  }

  sendOk(
    res,
    {
      id: `sim-call-${Date.now()}`,
      channel: 'voice',
      phone,
      alertId: alertId ?? null,
      status: 'initiated',
      simulated: true,
      note: 'Twilio notification service pending or keys queued in simulation mode.',
    },
    'Voice call notification simulated',
  );
}
