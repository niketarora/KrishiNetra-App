import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { MonthGrid } from '@/components/calendar/MonthGrid';
import { GuideTarget } from '@/components/guide/GuideTarget';
import { Card, EmptyState, Icon, IconBadge, Screen, ScreenHeader, SampleBanner, Text } from '@/components/ui';
import { isDemoMode } from '@/features/demo/demoMode';
import { buildCropScheduleEvents } from '@/features/calendar/cropSchedule';
import { buildDemoCalendarEvents } from '@/features/calendar/demoEvents';
import { EVENT_TYPE_ICONS } from '@/features/calendar/eventTypeIcon';
import type { FarmCalendarEvent, FarmEventType } from '@/features/calendar/types';
import { useFarm } from '@/features/farm/FarmContext';
import { getCurrentCrop, type CurrentCrop } from '@/services/agronomy';
import {
  customTaskToCalendarEvent,
  deleteCustomTask,
  getCustomTasks,
  saveCustomTask,
  toggleCustomTask,
  type CustomCalendarTask,
} from '@/services/calendarTasks';
import { colors, layout, radius } from '@/theme';
import { addMonths, toIsoDate } from '@/utils/calendar';

type Props = {
  onBack: () => void;
  onRegisterLand: () => void;
  onOpenEvent: (eventId: string) => void;
};

/** Show the crop in the farmer's own language — same rule as Home/My Farm. */
function cropName(current: CurrentCrop, language: string): string {
  if (language.startsWith('hi') && current.crop.name_hi) return current.crop.name_hi;
  return current.crop.name_en;
}

/** "21 Aug" — same short-date convention used on Home/Field. */
function formatShortDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

const QUICK_SUGGESTIONS: Array<{ labelKey: string; titleKey: string; category: FarmEventType }> = [
  { labelKey: 'calendar.quickIrrigation', titleKey: 'calendar.quickIrrigation', category: 'irrigation' },
  { labelKey: 'calendar.quickFertilizer', titleKey: 'calendar.quickFertilizer', category: 'fertilizer' },
  { labelKey: 'calendar.quickPesticide', titleKey: 'calendar.quickPesticide', category: 'cropHealth' },
  { labelKey: 'calendar.quickWeeding', titleKey: 'calendar.quickWeeding', category: 'cropHealth' },
  { labelKey: 'calendar.quickHarvest', titleKey: 'calendar.quickHarvest', category: 'harvest' },
];

const TASK_CATEGORIES: FarmEventType[] = ['irrigation', 'fertilizer', 'cropHealth', 'harvest', 'sowing'];

export function CalendarScreen({ onBack, onRegisterLand, onOpenEvent }: Props) {
  const { t, i18n } = useTranslation();
  const { farm } = useFarm();

  const [crop, setCrop] = useState<CurrentCrop | null>(null);
  const [customTasks, setCustomTasks] = useState<CustomCalendarTask[]>([]);
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));

  // Add Task form state
  const [isAddTaskVisible, setIsAddTaskVisible] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState<FarmEventType>('irrigation');
  const [taskDate, setTaskDate] = useState(() => toIsoDate(new Date()));

  useEffect(() => {
    if (!farm) {
      setCrop(null);
      setCustomTasks([]);
      return;
    }

    let cancelled = false;
    getCurrentCrop(farm.id)
      .then((result) => {
        if (!cancelled) setCrop(result);
      })
      .catch(() => {
        if (!cancelled) setCrop(null);
      });

    getCustomTasks(farm.id)
      .then((tasks) => {
        if (!cancelled) setCustomTasks(tasks);
      })
      .catch(() => {
        if (!cancelled) setCustomTasks([]);
      });

    return () => {
      cancelled = true;
    };
  }, [farm]);

  const demo = isDemoMode();

  // 1. Sowing schedule events if farm has an active crop with sown_on date
  const cropScheduleEvents =
    farm && crop?.planting?.sown_on ? buildCropScheduleEvents(farm.id, crop) : [];

  // 2. Demo events only in demo mode when no crop schedule is active
  const demoEvents =
    demo && farm && cropScheduleEvents.length === 0
      ? buildDemoCalendarEvents(farm.id, crop?.crop.id ?? null)
      : [];

  // 3. Farmer custom tasks
  const customEvents = customTasks.map(customTaskToCalendarEvent);

  const events: FarmCalendarEvent[] = [...cropScheduleEvents, ...demoEvents, ...customEvents];

  const markedDates = new Set(events.map((event) => event.date));
  const selectedDayEvents = events.filter((event) => event.date === selectedDate);
  const upcomingEvents = events
    .filter((event) => event.status === 'upcoming')
    .sort((a, b) => a.date.localeCompare(b.date));

  const relativeLabel = (dateIso: string): string => {
    const diffMs =
      new Date(`${dateIso}T00:00:00Z`).getTime() -
      new Date(`${toIsoDate(new Date())}T00:00:00Z`).getTime();
    const diffDays = Math.round(diffMs / 86_400_000);

    if (diffDays === 0) return t('calendar.today');
    if (diffDays === 1) return t('calendar.tomorrow');
    if (diffDays > 1 && diffDays < 7) return t('calendar.inDays', { count: diffDays });
    if (diffDays >= 7 && diffDays < 14) return t('calendar.nextWeek');
    return formatShortDate(dateIso);
  };

  const fieldCropLine = () => {
    const fieldLabel = farm?.name?.trim() || t('home.unnamedField');
    return crop ? `${fieldLabel} · ${cropName(crop, i18n.language)}` : fieldLabel;
  };

  const handleSaveTask = async () => {
    if (!farm || !taskTitle.trim()) return;
    const newTask = await saveCustomTask(farm.id, {
      title: taskTitle.trim(),
      date: taskDate || selectedDate,
      category: taskCategory,
    });
    setCustomTasks((prev) => [newTask, ...prev]);
    setTaskTitle('');
    setIsAddTaskVisible(false);
  };

  const handleToggleTask = async (taskId: string) => {
    if (!farm) return;
    const updated = await toggleCustomTask(farm.id, taskId);
    setCustomTasks(updated);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!farm) return;
    const updated = await deleteCustomTask(farm.id, taskId);
    setCustomTasks(updated);
  };

  const renderEvent = (event: FarmCalendarEvent) => {
    if (event.isCustom && event.customTaskId) {
      const isCompleted = event.status === 'completed';
      return (
        <Card
          key={event.id}
          style={styles.eventCard}
          testID={`calendar-event-${event.id}`}
        >
          <Pressable
            hitSlop={8}
            onPress={() => handleToggleTask(event.customTaskId!)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isCompleted }}
            accessibilityLabel={t(isCompleted ? 'calendar.taskCompleted' : 'calendar.taskPending')}
            testID={`calendar-task-toggle-${event.id}`}
            style={styles.checkboxTouch}
          >
            <IconBadge
              icon={isCompleted ? 'check' : EVENT_TYPE_ICONS[event.eventType]}
              tone={isCompleted ? 'primary' : 'neutral'}
            />
          </Pressable>
          <Pressable
            style={styles.eventBody}
            onPress={() => onOpenEvent(event.id)}
          >
            <Text
              variant="bodyMedium"
              style={isCompleted ? styles.completedText : undefined}
            >
              {event.customTitle}
            </Text>
            <Text variant="caption" color={colors.text.muted}>
              {t('calendar.customTask')} · {t(`calendar.eventTypes.${event.eventType}`)}
            </Text>
          </Pressable>
          <Pressable
            hitSlop={10}
            onPress={() => handleDeleteTask(event.customTaskId!)}
            accessibilityRole="button"
            accessibilityLabel={t('calendar.deleteTask')}
            testID={`calendar-delete-task-${event.id}`}
            style={styles.deleteButton}
          >
            <Icon name="close" size={16} color={colors.text.muted} strokeWidth={2} />
          </Pressable>
        </Card>
      );
    }

    return (
      <Card
        key={event.id}
        onPress={() => onOpenEvent(event.id)}
        style={styles.eventCard}
        testID={`calendar-event-${event.id}`}
      >
        <IconBadge icon={EVENT_TYPE_ICONS[event.eventType]} tone="demo" />
        <View style={styles.eventBody}>
          <Text variant="bodyMedium">{t(event.titleKey)}</Text>
          <Text variant="caption" color={colors.text.muted}>
            {fieldCropLine()}
          </Text>
        </View>
        <Text variant="micro" color={colors.text.muted}>
          {relativeLabel(event.date)}
        </Text>
      </Card>
    );
  };

  return (
    <Screen>
      <ScreenHeader title={t('calendar.title')} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!farm ? (
          <EmptyState
            icon="field"
            title={t('calendar.noFarmTitle')}
            body={t('calendar.noFarmBody')}
            actionLabel={t('myFarm.registerCta')}
            onAction={onRegisterLand}
            testID="calendar-no-farm"
          />
        ) : (
          <>
            {demo && cropScheduleEvents.length === 0 ? <SampleBanner /> : null}

            <View style={styles.monthHeader}>
              <Pressable
                onPress={() => setMonth((current) => addMonths(current, -1))}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('calendar.previousMonth')}
              >
                <Icon name="back" size={20} />
              </Pressable>
              <Text variant="cardTitle">
                {month.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })}
              </Text>
              <Pressable
                onPress={() => setMonth((current) => addMonths(current, 1))}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('calendar.nextMonth')}
              >
                <Icon name="chevron" size={20} />
              </Pressable>
            </View>

            <MonthGrid
              month={month}
              selectedDate={selectedDate}
              markedDates={markedDates}
              onSelectDate={(date) => {
                setSelectedDate(date);
                setTaskDate(date);
              }}
            />

            {/* Quick Add Task Action Bar */}
            {!isAddTaskVisible ? (
              <Pressable
                style={({ pressed }) => [styles.addTaskBar, pressed && styles.addTaskBarPressed]}
                onPress={() => {
                  setTaskDate(selectedDate);
                  setIsAddTaskVisible(true);
                }}
                testID="calendar-add-task-button"
                accessibilityRole="button"
                accessibilityLabel={t('calendar.addTask')}
              >
                <Icon name="plus" size={18} color={colors.primary} strokeWidth={2.5} />
                <Text variant="bodyMedium" color={colors.primary}>
                  {t('calendar.addTask')}
                </Text>
              </Pressable>
            ) : (
              <Card style={styles.addTaskCard} testID="calendar-add-task-modal">
                <View style={styles.addTaskHeader}>
                  <Text variant="cardTitle">{t('calendar.addTask')}</Text>
                  <Pressable
                    onPress={() => setIsAddTaskVisible(false)}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={t('calendar.cancelTask')}
                  >
                    <Icon name="close" size={18} color={colors.text.muted} strokeWidth={2} />
                  </Pressable>
                </View>

                <TextInput
                  style={styles.taskInput}
                  value={taskTitle}
                  onChangeText={setTaskTitle}
                  placeholder={t('calendar.taskPlaceholder')}
                  placeholderTextColor={colors.text.muted}
                  testID="calendar-task-title-input"
                  autoFocus
                />

                <Text variant="caption" color={colors.text.muted}>
                  {t('calendar.quickSuggestions')}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsRow}
                >
                  {QUICK_SUGGESTIONS.map((sug) => (
                    <Pressable
                      key={sug.labelKey}
                      style={styles.suggestionChip}
                      onPress={() => {
                        setTaskTitle(t(sug.titleKey));
                        setTaskCategory(sug.category);
                      }}
                      testID={`quick-suggestion-${sug.category}`}
                    >
                      <Text variant="micro" color={colors.accent}>
                        + {t(sug.labelKey)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text variant="caption" color={colors.text.muted}>
                  {t('calendar.selectCategory')}
                </Text>
                <View style={styles.categoryRow}>
                  {TASK_CATEGORIES.map((cat) => {
                    const selected = taskCategory === cat;
                    return (
                      <Pressable
                        key={cat}
                        style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                        onPress={() => setTaskCategory(cat)}
                        testID={`category-chip-${cat}`}
                      >
                        <Icon
                          name={EVENT_TYPE_ICONS[cat]}
                          size={14}
                          color={selected ? colors.text.onPrimary : colors.text.muted}
                        />
                        <Text
                          variant="micro"
                          color={selected ? colors.text.onPrimary : colors.text.primary}
                        >
                          {t(`calendar.eventTypes.${cat}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.dateSelectorRow}>
                  <Text variant="caption" color={colors.text.muted}>
                    {t('calendar.selectDate')}: {formatShortDate(taskDate || selectedDate)}
                  </Text>
                  <View style={styles.dateButtonsRow}>
                    <Pressable
                      style={styles.dateChip}
                      onPress={() => setTaskDate(toIsoDate(new Date()))}
                    >
                      <Text variant="micro">{t('calendar.today')}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.dateChip}
                      onPress={() => {
                        const tom = new Date();
                        tom.setDate(tom.getDate() + 1);
                        setTaskDate(toIsoDate(tom));
                      }}
                    >
                      <Text variant="micro">{t('calendar.tomorrow')}</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => setIsAddTaskVisible(false)}
                    testID="calendar-cancel-task-button"
                  >
                    <Text variant="bodyMedium" color={colors.text.muted}>
                      {t('calendar.cancelTask')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.saveButton, !taskTitle.trim() && styles.saveButtonDisabled]}
                    disabled={!taskTitle.trim()}
                    onPress={handleSaveTask}
                    testID="calendar-save-task-button"
                  >
                    <Text variant="bodyMedium" color={colors.text.onPrimary}>
                      {t('calendar.saveTask')}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            )}

            {selectedDayEvents.length > 0 ? (
              <View style={styles.section}>
                <Text variant="caption">{formatShortDate(selectedDate)}</Text>
                {selectedDayEvents.map(renderEvent)}
              </View>
            ) : null}

            {/*
              What the guide spotlights when a farmer asks about scheduling —
              including irrigation, which has no schedule of its own anywhere in
              the product yet. The avatar says so; this is the nearest honest
              place to point them at meanwhile.
            */}
            <GuideTarget id="calendar-events">
              <View style={styles.section}>
                <Text variant="cardTitle">{t('calendar.upcoming')}</Text>
                {upcomingEvents.length === 0 ? (
                  <EmptyState
                    icon="clock"
                    title={t('calendar.noEventsTitle')}
                    body={t('calendar.noEventsBody')}
                    testID="calendar-no-events"
                  />
                ) : (
                  upcomingEvents.map(renderEvent)
                )}
              </View>
            </GuideTarget>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
    paddingBottom: 110,
    gap: layout.cardGap,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  section: { gap: layout.cardGap, marginTop: 4 },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
  },
  eventBody: { flex: 1, minWidth: 0, gap: 2 },
  checkboxTouch: { padding: 2 },
  deleteButton: { padding: 4 },
  completedText: {
    textDecorationLine: 'line-through',
    color: colors.text.muted,
  },
  addTaskBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  addTaskBarPressed: {
    backgroundColor: colors.neutralBg,
  },
  addTaskCard: {
    padding: 16,
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addTaskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text.primary,
    backgroundColor: colors.surface,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  suggestionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dateSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  dateButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.neutralBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 8,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.sm,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
});
