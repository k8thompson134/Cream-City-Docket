import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

# Railway sets DATABASE_URL (internal) in production; locally we use DATABASE_PUBLIC_URL
DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ["DATABASE_PUBLIC_URL"]

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass
