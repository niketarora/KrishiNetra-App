import { Router } from "express";
import { sendSms } from "../services/sms.service.js";
import { makeCall } from "../services/voice.service.js";

export const notificationRouter = Router();

notificationRouter.post("/sms", async (req, res, next) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        error: "phone and message are required"
      });
    }

    const result = await sendSms(phone, message);

    return res.status(202).json({
      success: true,
      channel: "sms",
      ...result
    });
  } catch (error) {
    next(error);
  }
});

notificationRouter.post("/call", async (req, res, next) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        error: "phone and message are required"
      });
    }

    const result = await makeCall(phone, message);

    return res.status(202).json({
      success: true,
      channel: "voice",
      ...result
    });
  } catch (error) {
    next(error);
  }
});