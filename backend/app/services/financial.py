"""
Financial Services

This module contains financial-related business logic services.
"""

from typing import Dict, Any
from ..extensions import db
from ..models.financial import Payment, Invoice


class PaymentService:
    """Service for payment-related business logic."""
    
    def create_payment(self, payment_data: Dict[str, Any]) -> Payment:
        """Create a new payment."""
        payment = Payment(**payment_data)
        db.session.add(payment)
        db.session.commit()
        return payment


class InvoiceService:
    """Service for invoice-related business logic."""
    
    def create_invoice(self, invoice_data: Dict[str, Any]) -> Invoice:
        """Create a new invoice."""
        invoice = Invoice(**invoice_data)
        db.session.add(invoice)
        db.session.commit()
        return invoice
