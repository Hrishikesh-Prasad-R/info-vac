"""Database connection — async SQLAlchemy engine + session factory."""
import os
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv

load_dotenv()

from urllib.parse import urlparse, parse_qs, urlunparse, urlencode

_raw_db_url = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://infovac:infovac_dev@localhost:5432/infovac",
)
# Neon (and some other hosts) give a plain postgres:// or postgresql:// URL.
# SQLAlchemy async requires the +asyncpg driver dialect to be specified.
if _raw_db_url.startswith("postgres://"):
    _raw_db_url = _raw_db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif _raw_db_url.startswith("postgresql://"):
    _raw_db_url = _raw_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Handle sslmode parameter for asyncpg
parsed = urlparse(_raw_db_url)
queries = parse_qs(parsed.query)

connect_args = {}
if "sslmode" in queries:
    sslmode = queries.pop("sslmode")[0]
    if sslmode in ("require", "prefer", "allow", "verify-ca", "verify-full"):
        connect_args["ssl"] = True

# Re-serialize the URL without the sslmode query parameter to prevent asyncpg TypeError
new_query = urlencode(queries, doseq=True)
DATABASE_URL = urlunparse(
    (
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        new_query,
        parsed.fragment,
    )
)

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True, connect_args=connect_args)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncSession:  # type: ignore[return]
    """FastAPI dependency — yields an async DB session."""
    async with AsyncSessionLocal() as session:
        yield session


@asynccontextmanager
async def make_background_session():
    """NullPool session for background pipeline tasks.

    Creates a brand-new engine per call so there's no cross-loop connection
    reuse. Slightly slower than pooling but safe for long-running background
    tasks that may outlive the request that launched them.
    """
    bg_engine = create_async_engine(DATABASE_URL, echo=False, poolclass=NullPool, connect_args=connect_args)
    factory = async_sessionmaker(bg_engine, expire_on_commit=False, class_=AsyncSession)
    try:
        async with factory() as session:
            yield session
    finally:
        await bg_engine.dispose()


