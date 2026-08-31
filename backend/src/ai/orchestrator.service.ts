import type { AssistantResponse, AvatarDirective } from '../types/assistant.js';
import { ApiError } from '../utils/ApiError.js';

import { buildFarmerContext } from './context.service.js';
import { askExpert } from './lyzr.service.js';
import { findDestination, type Destination } from './navigationRegistry.js';
import { classify } from './router.service.js';
import { research } from './tavily.service.js';
import { trimForSpeech } from './tts.service.js';

/**
 * The response orchestrator — §6 of the brief.
 *
 * One transcript in, one `AssistantResponse` out, whichever branch answered.
 * Everything above this (the controller, the route, the app) is branch-blind;
 * everything below it knows only its own provider. This is the single place
 * that decides what the farmer's request becomes.
 *
 * The layering rule the brief insists on lives here too: this file decides
 * WHAT should happen and hands back steps drawn from the registry. It has no
 * idea HOW the app performs them, and never will.
 */

/** Where the avatar stands, and what it is doing with its face. */
const GUIDING: AvatarDirective = { expression: 'pointing', position: 'bottom-right' };
const TALKING: AvatarDirective = { expression: 'helpful', position: 'bottom-right' };
const APOLOGETIC: AvatarDirective = { expression: 'concerned', position: 'bottom-right' };

function guideResponse(destination: Destination): AssistantResponse {
  // A destination with nothing real behind it says so. The registry decides
  // which those are; this only makes sure the caveat is what gets spoken,
  // rather than an upbeat "here it is" over an empty screen.
  const key = destination.caveatKey ?? destination.messageKey;

  return {
    type: 'APP_GUIDE',
    message: key,
    speech: key,
    localised: true,
    navigation: [...destination.steps],
    avatar: GUIDING,
  };
}

function notConnected(messageKey: string): AssistantResponse {
  return {
    type: 'NOT_CONNECTED',
    message: messageKey,
    speech: messageKey,
    localised: true,
    avatar: APOLOGETIC,
  };
}

export async function assist(args: {
  transcript: string;
  language?: string;
  token: string;
  userId: string;
}): Promise<AssistantResponse> {
  const { transcript, language, token, userId } = args;
  let route;
  try {
    route = await classify(transcript, language);
  } catch (error) {
    console.warn('[orchestrator] classifier error, attempting fallback:', error);
    const local = findDestination(transcript);
    if (local) return guideResponse(local);
    route = { intent: 'FARMING_EXPERT' as const, target: null, entities: {} };
  }

  // --- App navigation ------------------------------------------------------
  if (route.intent === 'APP_NAVIGATION') {
    const destination = findDestination(route.target);
    if (destination) return guideResponse(destination);

    // The model named somewhere that does not exist. Falling through to the
    // expert is better than failing: the farmer asked a real question, and the
    // one thing that must not happen is the app trying to navigate nowhere.
    route.intent = 'FARMING_EXPERT';
  }

  // --- Deep research -------------------------------------------------------
  if (route.intent === 'DEEP_RESEARCH') {
    try {
      const result = await research(transcript, route.entities.depth === 'deep' ? 'advanced' : 'basic');

      return {
        type: 'RESEARCH_RESPONSE',
        message: result.answer,
        // The bubble can hold a paragraph; the voice cannot. Same answer, cut
        // at a sentence boundary for the ear only.
        speech: trimForSpeech(result.answer),
        localised: false,
        sources: result.sources,
        avatar: TALKING,
      };
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SERVICE_NOT_CONNECTED') {
        return notConnected('avatar.errors.researchNotConnected');
      }
      throw error;
    }
  }

  // --- Farming expert ------------------------------------------------------
  // Context is read first so the agent answers from this farmer's records
  // rather than from whatever the question implied about them.
  const context = await buildFarmerContext(token, userId);
  if (language) context.language = language;

  try {
    const reply = await askExpert(transcript, context, userId);

    return {
      type: 'EXPERT_RESPONSE',
      message: reply.text,
      speech: trimForSpeech(reply.text),
      localised: false,
      avatar: TALKING,
    };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'SERVICE_NOT_CONNECTED') {
      return notConnected('avatar.errors.expertNotConnected');
    }
    throw error;
  }
}
