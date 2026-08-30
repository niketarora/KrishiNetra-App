# ml — Phase 3 experimental service

This directory contains a FastAPI inference service and the delivered
experimental XGBoost soil-moisture baseline. It is integrated with the Node
backend, but is deliberately not exposed directly to the mobile app.

Three models are planned (TRD §18):

| Model | Predicts | Status |
|---|---|---|
| Experimental soil moisture | Soil moisture percentage + safety warning | Integrated, not production-ready |
| 1 — Price prediction | 1/3/7-day mandi price + confidence | Not delivered |
| 2 — Selling recommendation | SELL NOW / WAIT / SELL PARTIALLY + score, reason | Team-owned, not delivered |
| 3 — Buyer matching | Ranked buyers + match score | Team-owned, not delivered |

## Integration rules

- The mobile app **never** calls an ML service directly. Requests go through the
  Node backend (TRD §16).
- Integrate against the contract the ML team supplies. Do not invent input or
  output fields, and do not reshape the model interface to suit the client.
- When inference fails, the app must say the prediction is unavailable. It must
  never fall back to a fabricated or cached-as-fresh number (TRD §23).

## Run locally

```bash
python -m venv .venv
# Activate .venv, then:
pip install -r requirements.txt
python main.py
```

The service listens on `http://localhost:8000`. Copy `.env.example` to `.env`
and set `ML_SERVICE_API_KEY` to the same random value used by the backend.

Useful checks:

```bash
python -m unittest discover -s tests
curl http://localhost:8000/health
```

The active inference contract is `POST /predict/soil-moisture` in `main.py`.
The legacy `app/` scaffold contains future satellite/GEE routes and is not
mounted by the current service.
