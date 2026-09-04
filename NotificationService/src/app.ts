import "dotenv/config";
import cors from "cors";
import express from "express";
import { notificationRouter } from "./routes/notification.routes.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    service: "Krishi Netra Notification Service",
    status: "healthy"
  });
});

app.use("/api/notifications", notificationRouter);

app.use((
  error: unknown,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction
) => {
  console.error(error);

  const message =
    error instanceof Error ? error.message : "Notification failed";

  res.status(500).json({
    success: false,
    error: message
  });
});