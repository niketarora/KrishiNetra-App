import { Router } from "express";
import { sendSms } from "../services/sms.service.js";
import { makeCall } from "../services/voice.service.js";

export const notificationRouter = Router();

notificationRouter.post("/sms", async (req, res, next) => {
  try {
    const { phone, message, alertId } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: "phone and message are required"
      });
    }

    const result = await sendSms(phone, message);

    return res.status(202).json({
      success: true,
      channel: "sms",
      alertId: alertId ?? null,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

notificationRouter.post("/call", async (req, res, next) => {
  try {
    const { phone, message, language, alertId } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: "phone and message are required"
      });
    }

    const result = await makeCall(phone, message, language ?? "hi-IN");

    return res.status(202).json({
      success: true,
      channel: "voice",
      alertId: alertId ?? null,
      ...result
    });
  } catch (error) {
    next(error);
  }
});