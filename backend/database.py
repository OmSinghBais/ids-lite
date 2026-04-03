"""
③  Persistent Storage — SQLite via SQLAlchemy async.
Tables: alerts, packets (new).
"""
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Float, Text, Integer, Boolean, select, func
from typing import Any, Dict, List, Optional
import uuid
from sqlalchemy import create_engine

# ─── Engine & Session ─────────────────────────────────────────────────────────

DATABASE_URL = "sqlite+aiosqlite:///./ids.db"

engine = create_async_engine(DATABASE_URL, echo=False)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ─── ORM Models ───────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


class AlertRecord(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    timestamp: Mapped[float] = mapped_column(Float, nullable=False)
    source_ip: Mapped[str] = mapped_column(String(45), nullable=False)
    destination_ip: Mapped[str] = mapped_column(String(45), nullable=False)
    port: Mapped[int] = mapped_column(Integer, default=0)
    rule_id: Mapped[str] = mapped_column(String(20), nullable=False)
    rule_name: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    payload: Mapped[str] = mapped_column(Text, default="")


class PacketRecord(Base):
    """③  Stores every packet for later analysis / replay."""
    __tablename__ = "packets"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    timestamp: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    source_ip: Mapped[str] = mapped_column(String(45), nullable=False, index=True)
    destination_ip: Mapped[str] = mapped_column(String(45), nullable=False)
    port: Mapped[int] = mapped_column(Integer, default=0)
    protocol: Mapped[str] = mapped_column(String(10), default="TCP")
    payload: Mapped[str] = mapped_column(Text, default="")
    size: Mapped[int] = mapped_column(Integer, default=0)
    has_alert: Mapped[bool] = mapped_column(Boolean, default=False)


# ─── DB Init ──────────────────────────────────────────────────────────────────

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database initialized (ids.db)")


# ─── Dependency ───────────────────────────────────────────────────────────────

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


# ─── Save Helpers ─────────────────────────────────────────────────────────────

async def save_alert(alert: Dict[str, Any]):
    """③  Persist an alert record."""
    async with AsyncSessionLocal() as session:
        record = AlertRecord(
            id=alert.get("id", str(uuid.uuid4())),
            timestamp=alert.get("timestamp", 0.0),
            source_ip=alert.get("source_ip", ""),
            destination_ip=alert.get("destination_ip", ""),
            port=alert.get("port", 0),
            rule_id=alert.get("rule_id", ""),
            rule_name=alert.get("rule_name", ""),
            severity=alert.get("severity", "low"),
            action=alert.get("action", ""),
            payload=alert.get("payload", "")[:2048],
        )
        session.add(record)
        await session.commit()


async def save_packet(packet: Dict[str, Any], has_alert: bool = False):
    """③  Persist a packet record (batching recommended at high volume)."""
    async with AsyncSessionLocal() as session:
        record = PacketRecord(
            id=packet.get("id", str(uuid.uuid4())),
            timestamp=packet.get("timestamp", 0.0),
            source_ip=packet.get("source_ip", ""),
            destination_ip=packet.get("destination_ip", ""),
            port=packet.get("port", 0),
            protocol=packet.get("protocol", "TCP"),
            payload=packet.get("payload", "")[:1024],
            size=packet.get("size", 0),
            has_alert=has_alert,
        )
        session.add(record)
        await session.commit()


# ─── Query Helpers ────────────────────────────────────────────────────────────

async def get_alert_history(limit: int = 100, severity: Optional[str] = None) -> List[Dict]:
    async with AsyncSessionLocal() as session:
        q = select(AlertRecord).order_by(AlertRecord.timestamp.desc()).limit(limit)
        if severity:
            q = q.where(AlertRecord.severity == severity)
        result = await session.execute(q)
        rows = result.scalars().all()
        return [
            {c.key: getattr(r, c.key) for c in AlertRecord.__table__.columns}
            for r in rows
        ]


async def get_packet_history(limit: int = 200) -> List[Dict]:
    async with AsyncSessionLocal() as session:
        q = select(PacketRecord).order_by(PacketRecord.timestamp.desc()).limit(limit)
        result = await session.execute(q)
        rows = result.scalars().all()
        return [
            {c.key: getattr(r, c.key) for c in PacketRecord.__table__.columns}
            for r in rows
        ]


async def get_db_stats() -> Dict[str, Any]:
    async with AsyncSessionLocal() as session:
        total_packets = (await session.execute(func.count(PacketRecord.id))).scalar()
        total_alerts = (await session.execute(func.count(AlertRecord.id))).scalar()
        return {
            "total_packets_stored": total_packets or 0,
            "total_alerts_stored": total_alerts or 0,
        }
