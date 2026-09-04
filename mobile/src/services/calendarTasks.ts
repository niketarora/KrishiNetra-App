import * as SecureStore from 'expo-secure-store';

import type { FarmCalendarEvent, FarmEventType } from '@/features/calendar/types';

export type CustomCalendarTask = {
  id: string;
  farmId: string;
  title: string;
  date: string; // ISO yyyy-mm-dd
  category: FarmEventType;
  completed: boolean;
  createdAt: string;
};

const storageKey = (farmId: string) => `krishinetra.calendar.tasks.${farmId}`;

export async function getCustomTasks(farmId: string): Promise<CustomCalendarTask[]> {
  try {
    const raw = await SecureStore.getItemAsync(storageKey(farmId));
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is CustomCalendarTask =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'string' &&
        typeof item.title === 'string' &&
        typeof item.date === 'string' &&
        typeof item.completed === 'boolean',
    );
  } catch {
    return [];
  }
}

export async function saveCustomTask(
  farmId: string,
  input: { title: string; date: string; category?: FarmEventType },
): Promise<CustomCalendarTask> {
  const existing = await getCustomTasks(farmId);
  const newTask: CustomCalendarTask = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    farmId,
    title: input.title.trim(),
    date: input.date,
    category: input.category ?? 'general' as FarmEventType,
    completed: false,
    createdAt: new Date().toISOString(),
  };

  const updated = [newTask, ...existing];
  try {
    await SecureStore.setItemAsync(storageKey(farmId), JSON.stringify(updated));
  } catch {
    // Fail soft: offline/storage issue shouldn't crash caller
  }
  return newTask;
}

export async function toggleCustomTask(farmId: string, taskId: string): Promise<CustomCalendarTask[]> {
  const existing = await getCustomTasks(farmId);
  const updated = existing.map((task) =>
    task.id === taskId ? { ...task, completed: !task.completed } : task,
  );

  try {
    await SecureStore.setItemAsync(storageKey(farmId), JSON.stringify(updated));
  } catch {
    // Fail soft
  }
  return updated;
}

export async function deleteCustomTask(farmId: string, taskId: string): Promise<CustomCalendarTask[]> {
  const existing = await getCustomTasks(farmId);
  const updated = existing.filter((task) => task.id !== taskId);

  try {
    await SecureStore.setItemAsync(storageKey(farmId), JSON.stringify(updated));
  } catch {
    // Fail soft
  }
  return updated;
}

export function customTaskToCalendarEvent(task: CustomCalendarTask): FarmCalendarEvent {
  return {
    id: task.id,
    farmId: task.farmId,
    cropId: null,
    date: task.date,
    eventType: task.category,
    status: task.completed ? 'completed' : 'upcoming',
    titleKey: '',
    reasonKey: 'calendar.customTaskReason',
    isCustom: true,
    customTitle: task.title,
    customTaskId: task.id,
  };
}
