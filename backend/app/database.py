# This file is the ONLY place that knows how to open a connection to the database.
# Everything else in the app asks this file for a session instead of connecting itself.
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

load_dotenv()  # reads the .env file and loads its values as environment variables

DATABASE_URL = os.environ["DATABASE_URL"]

# The "engine" manages a pool of real network connections to Postgres.
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# A "session" is one conversation with the database — you open it, run some
# queries, then close it. SessionLocal is a factory that hands out new sessions.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Every table's Python class (see models.py) inherits from this Base class,
# which is how SQLAlchemy knows they represent database tables.
Base = declarative_base()


def get_db():
    """FastAPI calls this once per incoming request. It hands the route a
    session to use, then guarantees the session is closed afterward — even
    if the route raises an error. This pattern is called 'dependency injection'."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
