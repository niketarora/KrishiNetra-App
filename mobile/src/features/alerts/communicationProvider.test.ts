import { demoCommunicationProvider } from './communicationProvider';
import { ALERTS } from './demoAlerts';

describe('demoCommunicationProvider', () => {
  it('returns the full demo history, newest first', () => {
    const history = demoCommunicationProvider.getHistory();

    expect(history).toHaveLength(ALERTS.length);
    for (let i = 1; i < history.length; i += 1) {
      expect(history[i - 1].occurredDaysAgo).toBeLessThanOrEqual(history[i].occurredDaysAgo);
    }
  });

  it('finds a known event by id', () => {
    const first = ALERTS[0];
    expect(demoCommunicationProvider.getEvent(first.id)).toEqual(first);
  });

  it('returns null for an unknown id', () => {
    expect(demoCommunicationProvider.getEvent('does-not-exist')).toBeNull();
  });
});
