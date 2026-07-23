# Each class below is a Python "mirror" of one database table. SQLAlchemy
# translates between these objects and real SQL rows automatically — this is
# called an ORM (Object-Relational Mapper). The table structure here must
# match supabase/schema.sql exactly, since that SQL is what actually created
# these tables.
import uuid
from sqlalchemy import Column, String, Numeric, Boolean, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from .database import Base


class Business(Base):
    __tablename__ = "business"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, unique=True)
    business_name = Column(String, default="")
    owner_name = Column(String, default="")
    type = Column(String, default="")
    logo_data_url = Column(String, default="")
    email = Column(String, default="")
    phone = Column(String, default="")
    address = Column(String, default="")
    currency = Column(String, default="USD")
    tax_label = Column(String, default="Sales Tax")
    tax_rate = Column(Numeric, default=0)
    tax_inclusive = Column(Boolean, default=False)
    numbering_prefix = Column(String, default="INV-")
    next_number = Column(Integer, default=1001)
    payment_instructions = Column(String, default="")
    payment_terms = Column(Integer, default=14)
    default_notes = Column(String, default="")
    default_terms = Column(String, default="")
    accent = Column(String, default="#4F46E5")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Customer(Base):
    __tablename__ = "customers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String, nullable=False)
    company = Column(String, default="")
    email = Column(String, default="")
    phone = Column(String, default="")
    address = Column(String, default="")
    notes = Column(String, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Item(Base):
    __tablename__ = "items"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, default="")
    description = Column(String, default="")
    price = Column(Numeric, default=0)
    taxable = Column(Boolean, default=True)
    unit = Column(String, default="each")
    type = Column(String, default="service")
    notes = Column(String, default="")
    image_data_url = Column(String, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Package(Base):
    __tablename__ = "packages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, default="")
    price = Column(Numeric, nullable=True)
    items = Column(JSONB, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    number = Column(String, default="")
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    customer_snapshot = Column(JSONB, default=dict)
    issue_date = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    line_items = Column(JSONB, default=list)
    tax_rate = Column(Numeric, default=0)
    tax_inclusive = Column(Boolean, default=False)
    discount_type = Column(String, default="none")
    discount_value = Column(Numeric, default=0)
    deposit_requested = Column(Numeric, default=0)
    currency = Column(String, default="USD")
    notes = Column(String, default="")
    terms = Column(String, default="")
    status = Column(String, default="draft")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Payment(Base):
    __tablename__ = "payments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Numeric, nullable=False)
    method = Column(String, default="Other")
    date = Column(DateTime(timezone=True), server_default=func.now())
    note = Column(String, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
