"""Modelos Pydantic v2 para request/response."""
from datetime import datetime
from typing import Optional, List, Literal, Dict, Any

from pydantic import BaseModel, EmailStr, Field


# ---------- Auth / Users ----------
Role = Literal["admin", "credit_advisor", "technical", "site_manager"]
UserStatus = Literal["pending", "approved", "rejected"]


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    role: Role


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: Role
    status: UserStatus
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[Role] = None
    status: Optional[UserStatus] = None


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=6)


# ---------- Clients ----------
PaymentMethod = Literal["credito", "efectivo"]
ClientStatus = Literal["activo", "en_progreso", "completado"]


class ClientCreate(BaseModel):
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    payment_method: PaymentMethod = "credito"
    status: ClientStatus = "activo"
    notes: Optional[str] = ""


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    payment_method: Optional[PaymentMethod] = None
    status: Optional[ClientStatus] = None
    notes: Optional[str] = None


# ---------- Stages (crédito / técnico) ----------
StageStatus = Literal["pending", "in_progress", "completed"]


class StageUpdate(BaseModel):
    status: StageStatus
    notes: Optional[str] = ""
    attachment_ids: Optional[List[str]] = None


# ---------- Construction ----------
class ActivityCreate(BaseModel):
    name: str
    status: StageStatus = "pending"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    progress: int = 0
    notes: Optional[str] = ""
    attachment_ids: Optional[List[str]] = None


class ActivityUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[StageStatus] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    progress: Optional[int] = None
    notes: Optional[str] = None
    attachment_ids: Optional[List[str]] = None


class ScheduleFromTemplate(BaseModel):
    template_id: Optional[str] = None


# ---------- Payments ----------
Frequency = Literal["mensual", "quincenal", "semanal"]


class PaymentScheduleCreate(BaseModel):
    subtotal: float
    aplica_iva: bool = True
    iva_rate: float = 0.15
    down_payment: float = 0
    num_installments: int = Field(gt=0)
    frequency: Frequency = "mensual"
    first_due_date: str  # ISO date


class InstallmentUpdate(BaseModel):
    amount: Optional[float] = None
    due_date: Optional[str] = None
    status: Optional[Literal["pending", "paid"]] = None
    paid_date: Optional[str] = None
    receipt_attachment_id: Optional[str] = None
    notes: Optional[str] = None


# ---------- Attachments ----------
OwnerType = Literal["credit", "technical", "construction", "payment_receipt"]


class AttachmentCreate(BaseModel):
    owner_type: OwnerType
    client_id: str
    ref_key: str
    filename: str
    mime_type: str
    data: str  # base64
    description: Optional[str] = ""
