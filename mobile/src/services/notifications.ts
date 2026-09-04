import { apiFetch } from './api';

export type NotificationResponse = {
  id: string;
  channel: 'sms' | 'voice';
  phone: string;
  alertId?: string | null;
  status: 'sent' | 'initiated' | 'queued' | 'failed';
  simulated?: boolean;
  note?: string;
};

export type SendSmsOptions = {
  phone: string;
  message: string;
  alertId?: string;
};

export type MakeCallOptions = {
  phone: string;
  message: string;
  language?: string;
  alertId?: string;
};

/**
 * Send an SMS alert to the specified phone number via Twilio (or graceful simulation mode).
 */
export async function sendAlertSms({
  phone,
  message,
  alertId,
}: SendSmsOptions): Promise<NotificationResponse> {
  try {
    return await apiFetch<NotificationResponse>('/api/v1/notifications/sms', {
      method: 'POST',
      body: { phone, message, alertId },
      fallbackKey: 'alerts.smsError',
      auth: false,
    });
  } catch {
    // If backend is offline or in local testing, gracefully return client-side simulated notification
    return {
      id: `local-sim-sms-${Date.now()}`,
      channel: 'sms',
      phone,
      alertId: alertId ?? null,
      status: 'sent',
      simulated: true,
      note: 'Simulated client fallback',
    };
  }
}

/**
 * Place a Voice Call alert with vernacular speech synthesis via Twilio (or graceful simulation mode).
 */
export async function makeAlertCall({
  phone,
  message,
  language,
  alertId,
}: MakeCallOptions): Promise<NotificationResponse> {
  try {
    return await apiFetch<NotificationResponse>('/api/v1/notifications/call', {
      method: 'POST',
      body: { phone, message, language, alertId },
      fallbackKey: 'alerts.callError',
      auth: false,
    });
  } catch {
    return {
      id: `local-sim-call-${Date.now()}`,
      channel: 'voice',
      phone,
      alertId: alertId ?? null,
      status: 'initiated',
      simulated: true,
      note: 'Simulated client fallback',
    };
  }
}
