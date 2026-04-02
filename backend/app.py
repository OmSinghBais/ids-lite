import asyncio
import json
from contextlib import asynccontextmanager
from typing import List, Dict, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from detector import Detector
from simulator import Simulator

# Global state
detector = Detector()
simulator = Simulator()
active_connections: List[WebSocket] = []

# To keep track of recent history for new connections
recent_events: List[Dict[str, Any]] = []
MAX_HISTORY = 50

async def broadcast_event(packet: Dict[str, Any]):
    event = {
        "type": "packet",
        "data": packet
    }
    
    # Run through the detector
    alert = detector.analyze(packet)
    if alert:
        event["alert"] = alert

    recent_events.append(event)
    if len(recent_events) > MAX_HISTORY:
        recent_events.pop(0)

    # Broadcast to all connected WebSockets
    disconnected = []
    for connection in active_connections:
        try:
            await connection.send_text(json.dumps(event))
        except WebSocketDisconnect:
            disconnected.append(connection)
        except Exception as e:
            print(f"Error sending to websocket: {e}")
            disconnected.append(connection)
            
    for d in disconnected:
        if d in active_connections:
            active_connections.remove(d)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    simulator.add_listener(broadcast_event)
    task = asyncio.create_task(simulator.run())
    yield
    # Shutdown
    simulator.stop()
    task.cancel()

app = FastAPI(lifespan=lifespan)

# Allow CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/rules")
async def get_rules():
    return {"rules": detector.get_rules()}

@app.get("/api/blocked-ips")
async def get_blocked_ips():
    return {"blocked_ips": detector.get_blocked_ips()}

class IPClearRequest(BaseModel):
    ip: str

@app.post("/api/unblock-ip")
async def unblock_ip(req: IPClearRequest):
    success = detector.unblock_ip(req.ip)
    return {"success": success, "ip": req.ip}

@app.websocket("/ws/traffic")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        # Send recent history to bootstrap the UI
        for event in recent_events:
            await websocket.send_text(json.dumps(event))
            
        # Keep connection open
        while True:
            # We don't expect client to send much, but we need to listen to detect disconnects
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in active_connections:
            active_connections.remove(websocket)