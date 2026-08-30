import { Router } from 'express';
import multer from 'multer';

import * as aiController from '../controllers/ai.controller.js';
import * as farmCropsController from '../controllers/farmCrops.controller.js';
import * as farmersController from '../controllers/farmers.controller.js';
import * as farmsController from '../controllers/farms.controller.js';
import * as predictionsController from '../controllers/predictions.controller.js';
import * as referenceController from '../controllers/reference.controller.js';
import * as updatesController from '../controllers/updates.controller.js';
import * as schemesController from '../controllers/schemes.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import {
  createFarmSchema,
  farmIdParamSchema,
  listFarmsQuerySchema,
  updateFarmSchema,
} from '../schemas/farm.schema.js';
import {
  createFarmCropSchema,
  farmCropParamsSchema,
  updateFarmCropSchema,
} from '../schemas/farmCrop.schema.js';
import { chatSchema, speakSchema } from '../schemas/ai.schema.js';
import { updateProfileSchema } from '../schemas/profile.schema.js';
import { experimentalSoilMoistureSchema } from '../schemas/prediction.schema.js';
import {
  mandisQuerySchema,
  marketPricesQuerySchema,
  mspQuerySchema,
  weatherQuerySchema,
} from '../schemas/query.schema.js';
import { updatesQuerySchema } from '../schemas/updates.schema.js';
import {
  schemeRowIdParamSchema,
  schemesQuerySchema,
} from '../schemas/scheme.schema.js';

/**
 * Everything here sits behind requireAuth. `/health` is mounted separately in
 * app.ts because it must answer without a token.
 *
 * Later-phase routes are mounted only when they have a real implementation.
 * Unimplemented prefixes such as /buyers, /lots, /offers and /recommendations
 * still fall through to notFound rather than returning fabricated stubs.
 */
export const apiRouter = Router();

apiRouter.use(requireAuth);

// --- Farmer -----------------------------------------------------------------
apiRouter.get('/farmers/me', farmersController.getMe);
apiRouter.patch('/farmers/me', validate('body', updateProfileSchema), farmersController.updateMe);

// --- Farms ------------------------------------------------------------------
apiRouter.get('/farms', validate('query', listFarmsQuerySchema), farmsController.list);
apiRouter.post('/farms', validate('body', createFarmSchema), farmsController.create);
apiRouter.get('/farms/:id', validate('params', farmIdParamSchema), farmsController.getOne);
apiRouter.patch(
  '/farms/:id',
  validate('params', farmIdParamSchema),
  validate('body', updateFarmSchema),
  farmsController.update,
);
apiRouter.delete(
  '/farms/:id',
  validate('params', farmIdParamSchema),
  farmsController.remove,
);

// --- Crops on a farm --------------------------------------------------------
apiRouter.get(
  '/farms/:farmId/crops',
  validate('params', farmCropParamsSchema),
  farmCropsController.list,
);
apiRouter.post(
  '/farms/:farmId/crops',
  validate('params', farmCropParamsSchema),
  validate('body', createFarmCropSchema),
  farmCropsController.create,
);
apiRouter.patch(
  '/farms/:farmId/crops/:cropId',
  validate('params', farmCropParamsSchema),
  validate('body', updateFarmCropSchema),
  farmCropsController.update,
);

// --- Reference data ---------------------------------------------------------
apiRouter.get('/crops', referenceController.crops);
apiRouter.get('/mandis', validate('query', mandisQuerySchema), referenceController.mandis);
apiRouter.get('/msp', validate('query', mspQuerySchema), referenceController.msp);
apiRouter.get(
  '/market-prices',
  validate('query', marketPricesQuerySchema),
  referenceController.marketPrices,
);
apiRouter.get('/weather', validate('query', weatherQuerySchema), referenceController.weather);

// --- Experimental ML predictions -------------------------------------------
// The delivered artifact is explicitly not production-ready. Its response
// preserves that label and never includes an irrigation recommendation.
apiRouter.post(
  '/predictions/soil-moisture',
  validate('body', experimentalSoilMoistureSchema),
  predictionsController.predictSoilMoisture,
);

// --- Krishi Updates -----------------------------------------------------------
// Farm-location-and-crop-aware information feed (GDELT regional/agriculture
// news, NDMA SACHET disaster alerts, PIB government announcements). See
// backend/src/updates/updates.service.ts.
apiRouter.get('/updates', validate('query', updatesQuerySchema), updatesController.list);

// --- Government schemes -----------------------------------------------------
apiRouter.get('/schemes/states', schemesController.getStates);
apiRouter.get('/schemes', validate('query', schemesQuerySchema), schemesController.list);
apiRouter.get(
  '/schemes/:rowId',
  validate('params', schemeRowIdParamSchema),
  schemesController.getDetail,
);

// --- AI avatar --------------------------------------------------------------
// Audio arrives as multipart, so this route parses its own body. Everything
// else on the API is JSON and stays under the tight app-wide size cap.
const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: aiController.MAX_AUDIO_BYTES, files: 1 },
});

apiRouter.post('/ai/transcribe', uploadAudio.single('audio'), aiController.transcribe);
apiRouter.post('/ai/chat', validate('body', chatSchema), aiController.chat);
apiRouter.post('/ai/speak', validate('body', speakSchema), aiController.speak);
