"""Category prediction service.

    uvicorn ml.service.app:app --port 8000

POST /predict  {"names": ["Amul Masala Buttermilk", "Basmati Rice 5kg"]}
GET  /health   liveness + which model version is loaded

The model file is a versioned artefact (ml/artifacts/<version>.joblib) loaded
once at start-up. A service that cannot load it refuses to start rather than
answering with a guess.
"""
from __future__ import annotations

import os
import re
from contextlib import asynccontextmanager
from pathlib import Path

import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

DEFAULT_MODEL = Path(__file__).resolve().parent.parent / "artifacts" / "category-v1.joblib"
MAX_NAMES = 50
MAX_NAME_LENGTH = 200


class PredictRequest(BaseModel):
    names: list[str] = Field(min_length=1, max_length=MAX_NAMES)


class Prediction(BaseModel):
    name: str
    category: str
    confidence: float
    # The two next-best classes, so a client can show "or snack?" if it wants.
    alternatives: list[dict]


class PredictResponse(BaseModel):
    model_version: str
    predictions: list[Prediction]


def _normalise(name: str) -> str:
    return re.sub(r"\s+", " ", name.lower().strip())[:MAX_NAME_LENGTH]


@asynccontextmanager
async def lifespan(app: FastAPI):
    path = Path(os.environ.get("MODEL_PATH", DEFAULT_MODEL))
    bundle = joblib.load(path)  # raises, and the process exits, if it is missing
    app.state.pipeline = bundle["pipeline"]
    app.state.labels = list(bundle["pipeline"].classes_)
    app.state.version = bundle["version"]
    yield


app = FastAPI(title="Nutri-Trust category service", version="1", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok", "model_version": app.state.version, "classes": app.state.labels}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    texts = [_normalise(n) for n in req.names]
    if any(not t for t in texts):
        raise HTTPException(status_code=422, detail="names must not be blank")

    proba = app.state.pipeline.predict_proba(texts)
    labels = app.state.labels
    out: list[Prediction] = []
    for name, row in zip(req.names, proba):
        order = row.argsort()[::-1]
        top = order[0]
        out.append(
            Prediction(
                name=name,
                category=labels[top],
                confidence=round(float(row[top]), 4),
                alternatives=[{"category": labels[i], "confidence": round(float(row[i]), 4)} for i in order[1:3]],
            )
        )
    return PredictResponse(model_version=app.state.version, predictions=out)
