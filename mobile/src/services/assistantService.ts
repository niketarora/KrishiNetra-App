import { apiFetch } from './api';

/**
 * The in-app guide's one call.
 *
 * The app sends what the farmer said and gets back what should happen. It does
 * not know — and must not need to know — whether the answer came from a route
 * lookup, a farming agent or a web search: that is the backend orchestrator's
 * decision, and keeping it there is what lets the pipeline change without an
 * app release.
 *
 * Mirrors `backend/src/types/assistant.ts`.
 */

/** Exactly the actions the Navigation Controller knows how to perform. */
export type GuideAction =
  | 'NAVIGATE'
  | 'SELECT'
  | 'SCROLL'
  | 'HIGHLIGHT'
  | 'OPEN'
  | 'BACK'
  | 'POINT';

export type GuideStep = {
  action: GuideAction;
  target: string;
  params?: Record<string, string | number>;
};

export type AvatarExpression = 'helpful' | 'thinking' | 'pointing' | 'concerned';

export type AvatarDirective = {
  expression: AvatarExpression;
  position: 'bottom-right' | 'bottom-left';
};

export type ResearchSource = {
  title: string;
  url: string;
};

/**
 * `localised: true` means `message` and `speech` are i18n keys rather than
 * text. App guidance is phrased on this side so it works in every locale the
 * app ships without a translation round trip on the request path; an expert or
 * research answer is prose the model wrote, and is shown as it came.
 */
export type AssistantResponse =
  | {
      type: 'APP_GUIDE';
      message: string;
      speech: string;
      localised: true;
      navigation: GuideStep[];
      avatar: AvatarDirective;
    }
  | {
      type: 'EXPERT_RESPONSE';
      message: string;
      speech: string;
      localised: false;
      avatar: AvatarDirective;
    }
  | {
      type: 'RESEARCH_RESPONSE';
      message: string;
      speech: string;
      localised: false;
      sources: ResearchSource[];
      avatar: AvatarDirective;
    }
  | {
      type: 'NOT_CONNECTED';
      message: string;
      speech: string;
      localised: true;
      avatar: AvatarDirective;
    };

/**
 * Route one spoken request.
 *
 * The timeout is generous because deep research genuinely takes that long, and
 * a farmer who asked about a subsidy would rather wait than be told to try
 * again. The router and the navigation path are far quicker; this ceiling only
 * ever applies to the slowest branch.
 */
export function assist(transcript: string, language?: string): Promise<AssistantResponse> {
  return apiFetch<AssistantResponse>('/api/v1/ai/assist', {
    method: 'POST',
    body: language ? { transcript, language } : { transcript },
    fallbackKey: 'avatar.errors.reply',
    timeoutMs: 30_000,
  });
}
