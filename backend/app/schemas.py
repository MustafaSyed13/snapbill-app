# Pydantic schemas describe the *shape* of data going in and out of the API.
# FastAPI uses these to: validate incoming requests automatically (reject bad
# data before it ever reaches your code), and to generate the interactive
# API docs at /docs. "Base" = shared fields, "Create" = what's needed to make
# a new one, "Out" = what gets sent back (adds server-generated fields like id).
from datetime import datetime
from typing import Optional, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class BusinessBase(BaseModel):
    business_name: str = ""
    owner_name: str = ""
    type: str = ""
    logo_data_url: str = ""
    email: str = ""
    phone: str = ""
    address: str = ""
    currency: str = "USD"
    tax_label: str = "Sales Tax"
    tax_rate: float = 0
    tax_inclusive: bool = False
    numbering_prefix: str = "INV-"
    next_number: int = 1001
    payment_instructions: str = ""
    payment_terms: int = 14
    default_notes: str = ""
    default_terms: str = ""
    accent: str = "#4F46E5"

class BusinessOut(BusinessBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class CustomerBase(BaseModel):
    name: str
    company: str = ""
    email: str = ""
    phone: str = ""
    address: str = ""
    notes: str = ""

class CustomerOut(CustomerBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class ItemBase(BaseModel):
    name: str
    category: str = ""
    description: str = ""
    price: float = 0
    taxable: bool = True
    unit: str = "each"
    type: str = "service"
    notes: str = ""
    image_data_url: str = ""

class ItemOut(ItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class PackageBase(BaseModel):
    name: str
    description: str = ""
    price: Optional[float] = None
    items: list[dict[str, Any]] = []

class PackageOut(PackageBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class InvoiceBase(BaseModel):
    number: str = ""
    customer_id: Optional[UUID] = None
    customer_snapshot: dict[str, Any] = {}
    issue_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    line_items: list[dict[str, Any]] = []
    tax_rate: float = 0
    tax_inclusive: bool = False
    discount_type: str = "none"
    discount_value: float = 0
    deposit_requested: float = 0
    currency: str = "USD"
    notes: str = ""
    terms: str = ""
    status: str = "draft"

class InvoiceOut(InvoiceBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class PaymentBase(BaseModel):
    invoice_id: UUID
    amount: float
    method: str = "Other"
    date: Optional[datetime] = None
    note: str = ""

class PaymentOut(PaymentBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    created_at: datetime
