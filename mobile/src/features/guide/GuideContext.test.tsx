import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { GuideProvider, useGuide, type GuideStep } from './GuideContext';

/**
 * The Navigation Controller is the only thing that moves the farmer on the AI's
 * behalf, so what these tests care about is what it refuses to do: a target it
 * does not recognise changes nothing, and an abandoned run stops where it is
 * rather than finishing a journey nobody asked for any more.
 */

// Jest hoists `jest.mock` above these declarations, and only permits a factory
// to close over names prefixed `mock` — hence the naming.
const mockNavigateToTab = jest.fn((_tab: string) => true);
const mockNavigateToStackRoute = jest.fn((_route: string) => true);
const mockGoBack = jest.fn(() => true);

jest.mock('@/navigation/navigationRef', () => ({
  navigateToTab: (tab: string) => mockNavigateToTab(tab),
  navigateToStackRoute: (route: string) => mockNavigateToStackRoute(route),
  goBack: () => mockGoBack(),
  currentRouteName: () => null,
}));

const mockSelectLand = jest.fn();
const mockLands = [
  { id: 'land-1', name: 'North field' },
  { id: 'land-2', name: 'Canal plot' },
];

jest.mock('@/features/farm/FarmContext', () => ({
  useFarm: () => ({ lands: mockLands, selectLand: mockSelectLand }),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <GuideProvider>{children}</GuideProvider>;
}

async function setup() {
  return renderHook(() => useGuide(), { wrapper });
}

/**
 * A stand-in for a registered card.
 *
 * `measureInWindow` is a native call with no implementation under Jest, so the
 * node has to supply one or every highlight would silently time out.
 *
 * `register` and `unregister` are called bare rather than inside `act`: they
 * only write to a ref. Wrapping a state-free callback in a synchronous `act`
 * leaves the act queue in a state where the async updates that follow are
 * swallowed, and the spotlight then never appears to have been set.
 */
function fakeNode(rect = { x: 10, y: 200, width: 300, height: 90 }) {
  return {
    view: {
      measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
        cb(rect.x, rect.y, rect.width, rect.height),
    },
  } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('navigation', () => {
  it('switches tabs through the tab navigator, not the root stack', async () => {
    // The four tabs are nested under `Tabs`, so navigating to them by name from
    // the root stack would silently do nothing.
    const { result } = await setup();

    await act(async () => result.current.run([{ action: 'NAVIGATE', target: 'Market' }]));

    expect(mockNavigateToTab).toHaveBeenCalledWith('Market');
    expect(mockNavigateToStackRoute).not.toHaveBeenCalled();
  });

  it('pushes a stack route', async () => {
    const { result } = await setup();

    await act(async () => result.current.run([{ action: 'NAVIGATE', target: 'MyLands' }]));

    expect(mockNavigateToStackRoute).toHaveBeenCalledWith('MyLands');
  });

  it('treats OPEN as a navigation, because the app reaches both the same way', async () => {
    const { result } = await setup();

    await act(async () => result.current.run([{ action: 'OPEN', target: 'Calendar' }]));

    expect(mockNavigateToStackRoute).toHaveBeenCalledWith('Calendar');
  });

  it('goes back', async () => {
    const { result } = await setup();

    await act(async () => result.current.run([{ action: 'BACK', target: '' }]));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('drops a route the model invented, without abandoning the rest of the run', async () => {
    const { result } = await setup();

    await act(async () =>
      result.current.run([
        { action: 'NAVIGATE', target: 'IrrigationDashboard' },
        { action: 'NAVIGATE', target: 'Calendar' },
      ]),
    );

    expect(mockNavigateToStackRoute).toHaveBeenCalledTimes(1);
    expect(mockNavigateToStackRoute).toHaveBeenCalledWith('Calendar');
  });

  it('refuses a route that takes required params', async () => {
    // Those name one specific record, and choosing which record the farmer
    // meant is not a decision the AI should be making.
    const { result } = await setup();

    await act(async () =>
      result.current.run([{ action: 'NAVIGATE', target: 'TutorialDetail' }]),
    );

    expect(mockNavigateToStackRoute).not.toHaveBeenCalled();
  });
});

describe('selecting a land', () => {
  it('selects the land the farmer named', async () => {
    const { result } = await setup();

    await act(async () =>
      result.current.run([{ action: 'SELECT', target: 'land' }], { landName: 'canal plot' }),
    );

    expect(mockSelectLand).toHaveBeenCalledWith('land-2');
  });

  it('leaves the selection alone on a near-miss rather than guessing', async () => {
    // Switching the selected land changes the farmer's working state. Doing
    // that on a mishearing is worse than doing nothing.
    const { result } = await setup();

    await act(async () =>
      result.current.run([{ action: 'SELECT', target: 'land' }], { landName: 'north fields' }),
    );

    expect(mockSelectLand).not.toHaveBeenCalled();
  });

  it('does nothing when no land was named', async () => {
    const { result } = await setup();

    await act(async () => result.current.run([{ action: 'SELECT', target: 'land' }]));

    expect(mockSelectLand).not.toHaveBeenCalled();
  });

  it('ignores a SELECT for anything that is not a land', async () => {
    const { result } = await setup();

    await act(async () =>
      result.current.run([{ action: 'SELECT', target: 'crop' }], { landName: 'North field' }),
    );

    expect(mockSelectLand).not.toHaveBeenCalled();
  });
});

describe('highlighting', () => {
  it('spotlights a registered element where it actually is', async () => {
    const { result } = await setup();

    result.current.register('price-card', fakeNode());
    await act(async () => result.current.run([{ action: 'HIGHLIGHT', target: 'price-card' }]));

    await waitFor(() =>
      expect(result.current.highlight).toEqual({
        target: 'price-card',
        rect: { x: 10, y: 200, width: 300, height: 90 },
      }),
    );
  });

  it('highlights nothing when the element is not on screen', async () => {
    const { result } = await setup();

    await act(async () => result.current.run([{ action: 'HIGHLIGHT', target: 'price-card' }]));

    expect(result.current.highlight).toBeNull();
  });

  it('ignores a highlight id outside the target table', async () => {
    const { result } = await setup();

    result.current.register('schedule-card', fakeNode());
    await act(async () => result.current.run([{ action: 'HIGHLIGHT', target: 'schedule-card' }]));

    expect(result.current.highlight).toBeNull();
  });

  it('forgets an element once its screen unmounts', async () => {
    const { result } = await setup();

    result.current.register('weather-card', fakeNode());
    result.current.unregister('weather-card');

    await act(async () => result.current.run([{ action: 'HIGHLIGHT', target: 'weather-card' }]));

    expect(result.current.highlight).toBeNull();
  });
});

describe('a run in flight', () => {
  const journey: GuideStep[] = [
    { action: 'NAVIGATE', target: 'MyLands' },
    { action: 'NAVIGATE', target: 'MyFarm' },
    { action: 'NAVIGATE', target: 'Profile' },
  ];

  it('performs the steps in order', async () => {
    const { result } = await setup();

    await act(async () => result.current.run(journey));

    expect(mockNavigateToStackRoute.mock.calls.map(([route]) => route)).toEqual([
      'MyLands',
      'MyFarm',
      'Profile',
    ]);
  });

  it('stops where it is when the farmer asks something else', async () => {
    // An abandoned run must not keep navigating underneath the new question —
    // the farmer would end up somewhere neither of them chose.
    const { result } = await setup();

    const running = result.current.run(journey);
    result.current.cancel();
    await act(async () => running);

    expect(mockNavigateToStackRoute.mock.calls.length).toBeLessThan(3);
  });

  it('clears the spotlight when cancelled', async () => {
    const { result } = await setup();

    result.current.register('crop-card', fakeNode());
    await act(async () => result.current.run([{ action: 'HIGHLIGHT', target: 'crop-card' }]));
    await waitFor(() => expect(result.current.highlight).not.toBeNull());

    await act(async () => result.current.cancel());

    expect(result.current.highlight).toBeNull();
  });

  it('reports whether it is running', async () => {
    const { result } = await setup();

    expect(result.current.running).toBe(false);

    await act(async () => result.current.run([{ action: 'NAVIGATE', target: 'Calendar' }]));

    await waitFor(() => expect(result.current.running).toBe(false));
  });
});
