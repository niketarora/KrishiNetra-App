import { Router } from 'express';

import * as phoneAuthController from '../controllers/phoneAuth.controller.js';
import { validate } from '../middleware/validate.js';
import { requestOtpSchema, verifyOtpSchema } from '../schemas/phoneAuth.schema.js';

export const authRouter = Router();

authRouter.post(
  '/phone/request-otp',
  validate('body', requestOtpSchema),
  phoneAuthController.requestOtp,
);

authRouter.post(
  '/phone/verify-otp',
  validate('body', verifyOtpSchema),
  phoneAuthController.verifyOtp,
);
