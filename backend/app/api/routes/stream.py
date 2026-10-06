import asyncio
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services import simulator
from app.services.model_registry import registry
from app.services.predictor import label_name, score_frame, stats, to_frame

router = APIRouter()


@router.websocket("/ws/stream")
async def ws_stream(ws: WebSocket, model: str = "random_forest", rate: float = 2.0):
    """Push scored simulated records. Query: ?model=<id>&rate=<records per second, 0.1-20>."""
    await ws.accept()
    if model not in registry.pipes:
        await ws.close(code=1008, reason=f"unknown model '{model}'")
        return
    delay = 1.0 / min(max(rate, 0.1), 20.0)
    try:
        for feats, actual in simulator.stream():
            labels, scores = score_frame(model, to_frame([feats]))
            stats.add(model, labels, scores, feats, source="live")
            await ws.send_json({"ts": time.time(), "model": model, "features": feats,
                                "prediction": label_name(labels[0]), "score": round(float(scores[0]), 4),
                                "actual": actual})
            await asyncio.sleep(delay)
    except (WebSocketDisconnect, RuntimeError):
        pass
