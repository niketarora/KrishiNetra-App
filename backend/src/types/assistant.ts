import type { GuideStep } from '../ai/navigationRegistry.js';
import type { ResearchSource } from '../ai/tavily.service.js';

/**
 * The one shape every branch of the assistant pipeline collapses into.
 *
 * The app receives this and nothing else — it never learns whether an answer
 * came from a registry lookup, a farming agent or a web search, which is what
 * lets any of the three be replaced without touching the device. Mirrored
 * verbatim in `mobile/src/services/assistantService.ts`.
 */

export type AvatarExpression = 'helpful' | 'thinking' | 'pointing' | 'concerned';

export type AvatarDirective = {
  expression: AvatarExpression;
  position: 'bottom-right' | 'bottom-left';
};

/**
 * `message` and `speech` are separate because they are read by different
 * senses. `message` is what appears in the bubble and may carry a caveat or a
 * source list; `speech` is trimmed for the ear.
 *
 * For APP_GUIDE both are i18n *keys*, not prose: navigation guidance has to
 * work in all 26 locales the app ships, and a translation round trip per
 * request would cost more than the guidance is worth.
 */
export type AssistantResponse =
  | {
      type: 'APP_GUIDE';
      message: string;
      speech: string;
      /** True when message/speech are i18n keys rather than literal text. */
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
