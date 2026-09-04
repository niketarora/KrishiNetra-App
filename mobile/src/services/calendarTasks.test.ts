import * as SecureStore from 'expo-secure-store';

import {
  customTaskToCalendarEvent,
  deleteCustomTask,
  getCustomTasks,
  saveCustomTask,
  toggleCustomTask,
} from './calendarTasks';

describe('calendarTasks service', () => {
  const farmId = 'farm-123';
  let memoryStore: Record<string, string> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    memoryStore = {};

    jest.spyOn(SecureStore, 'getItemAsync').mockImplementation(async (key: string) => {
      return memoryStore[key] ?? null;
    });

    jest.spyOn(SecureStore, 'setItemAsync').mockImplementation(async (key: string, val: string) => {
      memoryStore[key] = val;
    });
  });

  it('returns empty array when no tasks saved', async () => {
    const tasks = await getCustomTasks(farmId);
    expect(tasks).toEqual([]);
  });

  it('saves and retrieves custom tasks', async () => {
    const created = await saveCustomTask(farmId, {
      title: 'Water the North plot',
      date: '2026-08-20',
      category: 'irrigation',
    });

    expect(created.title).toBe('Water the North plot');
    expect(created.completed).toBe(false);

    const list = await getCustomTasks(farmId);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);
  });

  it('toggles task completion', async () => {
    const created = await saveCustomTask(farmId, {
      title: 'Apply urea',
      date: '2026-08-22',
      category: 'fertilizer',
    });

    const toggled = await toggleCustomTask(farmId, created.id);
    expect(toggled[0].completed).toBe(true);

    const toggledBack = await toggleCustomTask(farmId, created.id);
    expect(toggledBack[0].completed).toBe(false);
  });

  it('deletes a task', async () => {
    const task1 = await saveCustomTask(farmId, {
      title: 'Task 1',
      date: '2026-08-20',
      category: 'irrigation',
    });
    const task2 = await saveCustomTask(farmId, {
      title: 'Task 2',
      date: '2026-08-21',
      category: 'fertilizer',
    });

    let list = await getCustomTasks(farmId);
    expect(list).toHaveLength(2);

    list = await deleteCustomTask(farmId, task1.id);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(task2.id);
  });

  it('converts custom task to calendar event', () => {
    const task = {
      id: 'task-1',
      farmId: 'farm-123',
      title: 'Custom irrigation',
      date: '2026-08-25',
      category: 'irrigation' as const,
      completed: false,
      createdAt: '2026-08-01T00:00:00Z',
    };

    const event = customTaskToCalendarEvent(task);
    expect(event).toMatchObject({
      id: 'task-1',
      farmId: 'farm-123',
      date: '2026-08-25',
      eventType: 'irrigation',
      status: 'upcoming',
      isCustom: true,
      customTitle: 'Custom irrigation',
      customTaskId: 'task-1',
    });
  });
});
