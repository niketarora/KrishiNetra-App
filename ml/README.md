# ml — Phase 3

Not started. This directory holds **integration contracts and documentation
only**. The models themselves are built separately by the project team, in
Python/FastAPI, and may live in their own repository.

Three models are planned (TRD §18):

| Model | Predicts | Status |
|---|---|---|
| 1 — Price prediction | 1/3/7-day mandi price + confidence | Team-owned, not delivered |
| 2 — Selling recommendation | SELL NOW / WAIT / SELL PARTIALLY + score, reason | Team-owned, not delivered |
| 3 — Buyer matching | Ranked buyers + match score | Team-owned, not delivered |

## Integration rules

- The mobile app **never** calls an ML service directly. Requests go through the
  Node backend (TRD §16).
- Integrate against the contract the ML team supplies. Do not invent input or
  output fields, and do not reshape the model interface to suit the client.
- When inference fails, the app must say the prediction is unavailable. It must
  never fall back to a fabricated or cached-as-fresh number (TRD §23).

Drop the delivered request/response schemas and model version notes in this
directory when they arrive.
