import { Router } from 'express';

import * as farmCropsController from '../controllers/farmCrops.controller.js';
import * as farmersController from '../controllers/farmers.controller.js';
import * as farmsController from '../controllers/farms.controller.js';
import * as referenceController from '../controllers/reference.controller.js';
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
import { updateProfileSchema } from '../schemas/profile.schema.js';
import {
  mandisQuerySchema,
  marketPricesQuerySchema,
  mspQuerySchema,
  weatherQuerySchema,
} from '../schemas/query.schema.js';

/**
 * Everything here sits behind requireAuth. `/health` is mounted separately in
 * app.ts because it must answer without a token.
 *
 * The prefixes TRD §14 reserves for later phases (/buyers, /lots, /offers,
 * /predictions, /recommendations, /ai and the rest) are deliberately not
 * mounted. They fall through to notFound rather than being stubbed.
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
