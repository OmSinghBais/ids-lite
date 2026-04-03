import asyncio
import json
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from detector import Detector
from simulator import Simulator
from stats_tracker import StatsTracker
from attack_simulator import AttackSimulator
from database import (
    init_db, save_alert, save_packet,
    get_alert_history, get_packet_history, get_db_stats,
)

# ─── Global State ─────────────────────────────────────────────────────────────
detector        = Detector()
simulator       = Simulator()
stats           = StatsTracker()         # ① real-time stats
attack_sim      = AttackSimulator()      # ⑥  attack scenarios
active_ws:      List[WebSocket] = []     # /ws/traffic subscribers
stats_ws:       List[WebSocket] = []     # /ws/stats  subscribers
recent_events:  List[Dict[str, Any]] = []
MAX_HISTORY     = 50


# ─── Core Broadcast ───────────────────────────────────────────────────────────

async def broadcast_event(packet: Dict[str, Any]):
    """Called for every packet. Runs detection, stats, DB persist, WS fan-out."""
    event: Dict[str, Any] = {"type": "packet", "data": packet}

    # ① Record stats for every packet
    stats.record_packet(packet)

    # Detection
    alert = detector.analyze(packet)
    if alert:
        event["alert"] = alert
        stats.record_alert(alert.get("severity", "low"))   # ①
        # ③  Persist alert
        asyncio.create_task(save_alert(alert))

    # ③  Persist packet (non-blocking)
    asyncio.create_task(save_packet(packet, has_alert=bool(alert)))

    # Rolling history
    recent_events.append(event)
    if len(recent_events) > MAX_HISTORY:
        recent_events.pop(0)

    # ④  WebSocket fan-out to traffic subscribers
    dead = []
    for ws in active_ws:
        try:
            await ws.send_text(json.dumps(event))
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in active_ws:
            active_ws.remove(ws)


async def _broadcast_stats():
    """④ Push stats snapshot to all /ws/stats subscribers."""
    snapshot = {"type": "stats", "data": stats.get_summary()}
    payload  = json.dumps(snapshot)
    dead = []
    for ws in stats_ws:
        try:
            await ws.send_text(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in stats_ws:
            stats_ws.remove(ws)


async def _stats_push_loop():
    """① Push stats update every 2 seconds."""
    while True:
        await asyncio.sleep(2)
        await _broadcast_stats()


# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    loop = asyncio.get_running_loop()
    simulator.set_loop(loop)
    simulator.add_listener(broadcast_event)
    print("✅ Simulator listener registered")

    # Start simulator + stats push loop
    sim_task   = asyncio.create_task(simulator.run())
    stats_task = asyncio.create_task(_stats_push_loop())

    yield  # ← app is live here

    simulator.stop()
    attack_sim.stop_all()
    sim_task.cancel()
    stats_task.cancel()
    for t in (sim_task, stats_task):
        try:
            await t
        except asyncio.CancelledError:
            pass


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="IDS Lite", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "IDS Lite Backend Running 🚀", "version": "2.0.0"}


# ─── Rules & Firewall ─────────────────────────────────────────────────────────

@app.get("/api/rules")
async def get_rules():
    return {"rules": detector.get_rules()}


@app.get("/api/blocked-ips")
async def get_blocked_ips():
    return {"blocked_ips": detector.get_blocked_ips()}


class IPRequest(BaseModel):
    ip: str


@app.post("/api/unblock-ip")
async def unblock_ip(req: IPRequest):
    return {"success": detector.unblock_ip(req.ip), "ip": req.ip}


@app.post("/api/block-ip")
async def block_ip(req: IPRequest):
    detector.block_ip(req.ip)
    return {"success": True, "ip": req.ip}


# ─── ① Stats ──────────────────────────────────────────────────────────────────

@app.get("/api/stats")
async def get_stats():
    """Return current real-time stats snapshot."""
    return stats.get_summary()


# ─── ③  History from DB ───────────────────────────────────────────────────────

@app.get("/api/alerts/history")
async def alert_history(
    limit: int = Query(100, ge=1, le=500),
    severity: Optional[str] = Query(None),
):
    return {"alerts": await get_alert_history(limit, severity)}


@app.get("/api/packets/history")
async def packet_history(limit: int = Query(200, ge=1, le=1000)):
    return {"packets": await get_packet_history(limit)}


@app.get("/api/db/stats")
async def db_stats():
    return await get_db_stats()


# ─── ⑥  Attack Simulator ──────────────────────────────────────────────────────

class AttackRequest(BaseModel):
    scenario: str
    packets_per_sec: float = 5.0


@app.get("/api/attack/scenarios")
async def list_scenarios():
    return {"scenarios": AttackSimulator.SCENARIOS}


@app.get("/api/attack/status")
async def attack_status():
    return {"status": attack_sim.status()}


@app.post("/api/attack/start")
async def start_attack(req: AttackRequest):
    result = attack_sim.start(
        req.scenario, broadcast_event, req.packets_per_sec
    )
    return result


@app.post("/api/attack/stop")
async def stop_attack(req: AttackRequest):
    return attack_sim.stop(req.scenario)


@app.post("/api/attack/stop-all")
async def stop_all_attacks():
    return attack_sim.stop_all()


# ─── ⑨  Replay ───────────────────────────────────────────────────────────────

class ReplayRequest(BaseModel):
    filepath: str = "replay.json"
    speed: float = 1.0


@app.post("/api/replay/start")
async def start_replay(req: ReplayRequest):
    asyncio.create_task(simulator.replay_packets(req.filepath, req.speed))
    return {"ok": True, "filepath": req.filepath, "speed": req.speed}


# ─── ④  WebSockets ───────────────────────────────────────────────────────────

@app.websocket("/ws/traffic")
async def ws_traffic(websocket: WebSocket):
    await websocket.accept()
    active_ws.append(websocket)
    try:
        for event in recent_events:
            await websocket.send_text(json.dumps(event))
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in active_ws:
            active_ws.remove(websocket)


@app.websocket("/ws/stats")
async def ws_stats(websocket: WebSocket):
    """① Push live stats every 2 seconds via dedicated WS."""
    await websocket.accept()
    stats_ws.append(websocket)
    try:
        # Send immediately on connect
        await websocket.send_text(
            json.dumps({"type": "stats", "data": stats.get_summary()})
        )
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in stats_ws:
            stats_ws.remove(websocket)