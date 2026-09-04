import * as api from './api';
import { makeAlertCall, sendAlertSms } from './notifications';

describe('notifications service', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sendAlertSms', () => {
    it('dispatches SMS through apiFetch', async () => {
      const apiSpy = jest.spyOn(api, 'apiFetch').mockResolvedValueOnce({
        id: 'sms-resp-1',
        channel: 'sms',
        phone: '+91 98765 43210',
        alertId: 'alert-1',
        status: 'sent',
      });

      const res = await sendAlertSms({
        phone: '+91 98765 43210',
        message: 'Severe storm incoming',
        alertId: 'alert-1',
      });

      expect(apiSpy).toHaveBeenCalledWith('/api/v1/notifications/sms', {
        method: 'POST',
        body: {
          phone: '+91 98765 43210',
          message: 'Severe storm incoming',
          alertId: 'alert-1',
        },
        fallbackKey: 'alerts.smsError',
        auth: false,
      });
      expect(res.status).toBe('sent');
      expect(res.phone).toBe('+91 98765 43210');
    });

    it('falls back gracefully to client simulation when apiFetch throws', async () => {
      jest.spyOn(api, 'apiFetch').mockRejectedValueOnce(new Error('Network error'));

      const res = await sendAlertSms({
        phone: '+91 98765 43210',
        message: 'Severe storm incoming',
        alertId: 'alert-1',
      });

      expect(res.simulated).toBe(true);
      expect(res.channel).toBe('sms');
      expect(res.status).toBe('sent');
    });
  });

  describe('makeAlertCall', () => {
    it('initiates voice call through apiFetch', async () => {
      const apiSpy = jest.spyOn(api, 'apiFetch').mockResolvedValueOnce({
        id: 'call-resp-1',
        channel: 'voice',
        phone: '+91 98765 43210',
        alertId: 'alert-1',
        status: 'initiated',
      });

      const res = await makeAlertCall({
        phone: '+91 98765 43210',
        message: 'Heavy rain warning',
        language: 'hi',
        alertId: 'alert-1',
      });

      expect(apiSpy).toHaveBeenCalledWith('/api/v1/notifications/call', {
        method: 'POST',
        body: {
          phone: '+91 98765 43210',
          message: 'Heavy rain warning',
          language: 'hi',
          alertId: 'alert-1',
        },
        fallbackKey: 'alerts.callError',
        auth: false,
      });
      expect(res.status).toBe('initiated');
    });

    it('falls back gracefully to client simulation when apiFetch throws', async () => {
      jest.spyOn(api, 'apiFetch').mockRejectedValueOnce(new Error('Offline'));

      const res = await makeAlertCall({
        phone: '+91 98765 43210',
        message: 'Heavy rain warning',
        language: 'hi',
        alertId: 'alert-1',
      });

      expect(res.simulated).toBe(true);
      expect(res.channel).toBe('voice');
      expect(res.status).toBe('initiated');
    });
  });
});
