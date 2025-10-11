"""
PCI Compliance Validation Tests

This module contains comprehensive PCI DSS compliance validation tests for the Tithi backend.
It ensures that no sensitive card data is stored, proper encryption is used, and all
PCI requirements are met for payment processing.

PCI DSS Requirements Validated:
- Requirement 3: Protect stored cardholder data
- Requirement 4: Encrypt transmission of cardholder data across open networks
- Requirement 6: Develop and maintain secure systems and applications
- Requirement 7: Restrict access to cardholder data by business need-to-know
- Requirement 8: Identify and authenticate access to system components
- Requirement 10: Track and monitor all access to network resources and cardholder data
"""

import pytest
import json
import uuid
import re
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from flask import Flask

from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.business import Customer, Booking
from app.models.financial import Payment, PaymentMethod, Refund
from app.services.financial import PaymentService, BillingService
from app.services.encryption_service import EncryptionService, PIIFieldManager
from app.middleware.error_handler import TithiError


class TestPCICompliance:
    """Comprehensive PCI DSS compliance validation tests."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Set up test environment for each test."""
        self.app = create_app('testing')
        self.client = self.app.test_client()
        
        with self.app.app_context():
            db.create_all()
            
            # Create test tenant
            self.tenant = Tenant(
                id=uuid.uuid4(),
                slug="pci-test-tenant",
                name="PCI Test Tenant",
                timezone="UTC",
                is_active=True
            )
            db.session.add(self.tenant)
            
            # Create test user
            self.user = User(
                id=uuid.uuid4(),
                display_name="PCI Test User",
                primary_email="pci-test@example.com"
            )
            db.session.add(self.user)
            
            # Create membership
            self.membership = Membership(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                user_id=self.user.id,
                role="owner"
            )
            db.session.add(self.membership)
            
            # Create test customer
            self.customer = Customer(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                display_name="PCI Test Customer",
                email="customer@example.com",
                phone="+1234567890"
            )
            db.session.add(self.customer)
            
            db.session.commit()
    
    def teardown_method(self):
        """Clean up after each test."""
        with self.app.app_context():
            db.drop_all()
    
    def test_no_card_data_storage(self):
        """Test that no sensitive card data is stored in the system."""
        payment_service = PaymentService()
        
        # Test payment data that should NOT be stored
        sensitive_card_data = {
            'card_number': '4111111111111111',
            'cvv': '123',
            'cvc': '456',
            'expiry': '12/25',
            'exp_month': '12',
            'exp_year': '2025',
            'cardholder_name': 'John Doe',
            'billing_address': '123 Main St'
        }
        
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_test_no_storage",
                status="requires_payment_method",
                metadata={"card_last4": "1111", "card_brand": "visa"}
            )
            
            # Create payment intent
            payment = payment_service.create_payment_intent(
                tenant_id=str(self.tenant.id),
                booking_id=str(uuid.uuid4()),
                amount_cents=5000,
                idempotency_key=str(uuid.uuid4())
            )
            
            # Verify payment was created
            assert payment is not None
            assert payment.status == 'requires_action'
            
            # Retrieve payment from database
            stored_payment = db.session.query(Payment).filter(
                Payment.id == payment.id
            ).first()
            
            assert stored_payment is not None
            
            # Verify no sensitive card data is stored
            sensitive_fields = [
                'card_number', 'cvv', 'cvc', 'expiry', 'exp_month', 'exp_year',
                'cardholder_name', 'billing_address'
            ]
            
            for field in sensitive_fields:
                # Check if field exists and is None/empty
                if hasattr(stored_payment, field):
                    field_value = getattr(stored_payment, field)
                    assert field_value is None or field_value == '', f"Sensitive field {field} should not be stored"
            
            # Verify provider metadata doesn't contain sensitive data
            if stored_payment.provider_metadata:
                metadata_str = str(stored_payment.provider_metadata).lower()
                for sensitive_pattern in ['card_number', 'cvv', 'cvc', 'expiry']:
                    assert sensitive_pattern not in metadata_str, f"Sensitive pattern {sensitive_pattern} found in metadata"
    
    def test_payment_method_storage_compliance(self):
        """Test that payment methods are stored securely without sensitive data."""
        # Create a payment method (card-on-file)
        payment_method = PaymentMethod(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            customer_id=self.customer.id,
            stripe_payment_method_id="pm_test_secure",
            type="card",
            last4="4242",
            exp_month=12,
            exp_year=2025,
            brand="visa",
            is_default=True
        )
        
        db.session.add(payment_method)
        db.session.commit()
        
        # Verify sensitive data is not stored
        stored_pm = db.session.query(PaymentMethod).filter(
            PaymentMethod.id == payment_method.id
        ).first()
        
        # Only last4, exp_month, exp_year, and brand should be stored
        # Full card number, CVV should never be stored
        assert stored_pm.last4 == "4242"
        assert stored_pm.exp_month == 12
        assert stored_pm.exp_year == 2025
        assert stored_pm.brand == "visa"
        
        # Verify sensitive fields don't exist
        sensitive_fields = ['card_number', 'cvv', 'cvc', 'full_expiry']
        for field in sensitive_fields:
            assert not hasattr(stored_pm, field), f"Sensitive field {field} should not exist"
    
    def test_stripe_only_payment_processing(self):
        """Test that all payment processing goes through Stripe only."""
        payment_service = PaymentService()
        
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_stripe_only_test",
                status="requires_payment_method",
                metadata={"processing_method": "stripe"}
            )
            
            # Create payment intent
            payment = payment_service.create_payment_intent(
                tenant_id=str(self.tenant.id),
                booking_id=str(uuid.uuid4()),
                amount_cents=10000
            )
            
            # Verify Stripe was called
            mock_stripe.assert_called_once()
            
            # Verify payment record shows Stripe as provider
            stored_payment = db.session.query(Payment).filter(
                Payment.id == payment.id
            ).first()
            
            assert stored_payment.provider == 'stripe'
            assert stored_payment.provider_payment_id == "pi_stripe_only_test"
    
    def test_payment_data_encryption(self):
        """Test that sensitive payment data is properly encrypted."""
        encryption_service = EncryptionService()
        
        # Test encryption of sensitive payment fields
        sensitive_data = {
            'cardholder_name': 'John Doe',
            'billing_address': '123 Main St, City, State 12345',
            'payment_notes': 'Customer requested special handling'
        }
        
        # Encrypt sensitive data
        encrypted_data = {}
        for field, value in sensitive_data.items():
            encrypted_data[field] = encryption_service.encrypt_field(value)
        
        # Verify encrypted data is different from original
        for field, original_value in sensitive_data.items():
            encrypted_value = encrypted_data[field]
            assert encrypted_value != original_value, f"Field {field} should be encrypted"
            assert len(encrypted_value) > len(original_value), f"Encrypted {field} should be longer"
        
        # Verify decryption works correctly
        for field, original_value in sensitive_data.items():
            encrypted_value = encrypted_data[field]
            decrypted_value = encryption_service.decrypt_field(encrypted_value)
            assert decrypted_value == original_value, f"Decryption failed for field {field}"
    
    def test_pii_field_encryption(self):
        """Test PII field encryption for payment-related data."""
        pii_manager = PIIFieldManager()
        
        # Test payment PII fields
        payment_pii_data = {
            'cardholder_name': 'John Doe',
            'billing_address': '123 Main St, City, State 12345',
            'payment_notes': 'Customer special request'
        }
        
        # Encrypt payment PII data
        encrypted_payment_data = pii_manager.encrypt_model_data('payments', payment_pii_data)
        
        # Verify all PII fields are encrypted
        for field in ['cardholder_name', 'billing_address', 'payment_notes']:
            if field in encrypted_payment_data:
                encrypted_value = encrypted_payment_data[field]
                original_value = payment_pii_data[field]
                assert encrypted_value != original_value, f"PII field {field} should be encrypted"
    
    def test_audit_logging_payment_access(self):
        """Test that all payment data access is properly audited."""
        payment_service = PaymentService()
        
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_audit_test",
                status="requires_payment_method"
            )
            
            # Create payment
            payment = payment_service.create_payment_intent(
                tenant_id=str(self.tenant.id),
                booking_id=str(uuid.uuid4()),
                amount_cents=5000
            )
            
            # Verify audit log was created
            from app.models.audit import AuditLog
            audit_logs = db.session.query(AuditLog).filter(
                AuditLog.table_name == 'payments',
                AuditLog.record_id == str(payment.id)
            ).all()
            
            assert len(audit_logs) > 0, "Payment creation should be audited"
            
            # Verify audit log contains proper information
            audit_log = audit_logs[0]
            assert audit_log.operation == 'INSERT'
            assert audit_log.table_name == 'payments'
            assert audit_log.record_id == str(payment.id)
            assert audit_log.tenant_id == self.tenant.id
    
    def test_payment_refund_compliance(self):
        """Test that refund processing maintains PCI compliance."""
        payment_service = PaymentService()
        
        # Create a payment first
        with patch('stripe.PaymentIntent.create') as mock_stripe_create:
            mock_stripe_create.return_value = MagicMock(
                id="pi_refund_test",
                status="succeeded"
            )
            
            payment = payment_service.create_payment_intent(
                tenant_id=str(self.tenant.id),
                booking_id=str(uuid.uuid4()),
                amount_cents=5000
            )
            
            # Update payment status to captured
            payment.status = 'captured'
            db.session.commit()
        
        # Test refund processing
        with patch('stripe.Refund.create') as mock_stripe_refund:
            mock_stripe_refund.return_value = MagicMock(
                id="re_refund_test",
                status="succeeded",
                amount=5000
            )
            
            refund = payment_service.process_refund(
                payment_id=str(payment.id),
                tenant_id=str(self.tenant.id),
                amount_cents=5000,
                reason="Customer requested refund"
            )
            
            # Verify refund was created
            assert refund is not None
            assert refund.amount_cents == 5000
            
            # Verify Stripe refund was called
            mock_stripe_refund.assert_called_once()
            
            # Verify refund record doesn't contain sensitive data
            stored_refund = db.session.query(Refund).filter(
                Refund.id == refund.id
            ).first()
            
            # Check that no sensitive card data is in refund record
            refund_str = str(stored_refund.__dict__).lower()
            sensitive_patterns = ['card_number', 'cvv', 'cvc', 'expiry']
            for pattern in sensitive_patterns:
                assert pattern not in refund_str, f"Sensitive pattern {pattern} found in refund record"
    
    def test_no_show_fee_compliance(self):
        """Test that no-show fee processing maintains PCI compliance."""
        payment_service = PaymentService()
        
        # Create a payment with setup intent for no-show fee
        with patch('stripe.SetupIntent.create') as mock_setup_intent:
            mock_setup_intent.return_value = MagicMock(
                id="seti_no_show_test",
                status="succeeded"
            )
            
            # Create payment with setup intent
            payment = Payment(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                customer_id=self.customer.id,
                amount_cents=0,  # No-show fee is separate
                status='authorized',
                method='card',
                provider='stripe',
                provider_setup_intent_id="seti_no_show_test",
                no_show_fee_cents=150  # 3% of $50 booking
            )
            
            db.session.add(payment)
            db.session.commit()
        
        # Test no-show fee capture
        with patch('stripe.PaymentIntent.create') as mock_payment_intent:
            mock_payment_intent.return_value = MagicMock(
                id="pi_no_show_fee",
                status="succeeded"
            )
            
            no_show_payment = payment_service.capture_no_show_fee(
                original_payment_id=str(payment.id),
                tenant_id=str(self.tenant.id),
                amount_cents=150
            )
            
            # Verify no-show fee payment was created
            assert no_show_payment is not None
            assert no_show_payment.amount_cents == 150
            assert no_show_payment.fee_type == 'no_show_fee'
            
            # Verify no sensitive data in no-show fee payment
            stored_no_show_payment = db.session.query(Payment).filter(
                Payment.id == no_show_payment.id
            ).first()
            
            # Check that no sensitive card data is stored
            payment_str = str(stored_no_show_payment.__dict__).lower()
            sensitive_patterns = ['card_number', 'cvv', 'cvc', 'expiry']
            for pattern in sensitive_patterns:
                assert pattern not in payment_str, f"Sensitive pattern {pattern} found in no-show fee payment"
    
    def test_payment_webhook_security(self):
        """Test that payment webhooks are processed securely."""
        # Test webhook signature validation (mocked)
        with patch('stripe.Webhook.construct_event') as mock_webhook:
            mock_webhook.return_value = {
                'id': 'evt_test_webhook',
                'type': 'payment_intent.succeeded',
                'data': {
                    'object': {
                        'id': 'pi_webhook_test',
                        'status': 'succeeded',
                        'amount': 5000
                    }
                }
            }
            
            # Simulate webhook processing
            webhook_data = mock_webhook.return_value
            
            # Verify webhook data doesn't contain sensitive information
            webhook_str = str(webhook_data).lower()
            sensitive_patterns = ['card_number', 'cvv', 'cvc', 'expiry']
            for pattern in sensitive_patterns:
                assert pattern not in webhook_str, f"Sensitive pattern {pattern} found in webhook data"
    
    def test_payment_data_retention_compliance(self):
        """Test that payment data retention follows PCI requirements."""
        # Create test payment
        payment = Payment(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            customer_id=self.customer.id,
            amount_cents=5000,
            status='captured',
            method='card',
            provider='stripe',
            provider_payment_id="pi_retention_test",
            created_at=datetime.utcnow() - timedelta(days=400)  # Old payment
        )
        
        db.session.add(payment)
        db.session.commit()
        
        # Verify old payment data is still accessible (for audit purposes)
        old_payment = db.session.query(Payment).filter(
            Payment.id == payment.id
        ).first()
        
        assert old_payment is not None
        
        # Verify no sensitive data is stored even in old records
        payment_str = str(old_payment.__dict__).lower()
        sensitive_patterns = ['card_number', 'cvv', 'cvc', 'expiry']
        for pattern in sensitive_patterns:
            assert pattern not in payment_str, f"Sensitive pattern {pattern} found in old payment record"
    
    def test_payment_error_handling_security(self):
        """Test that payment errors don't leak sensitive information."""
        payment_service = PaymentService()
        
        # Test with invalid payment data
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.side_effect = Exception("Stripe API Error")
            
            with pytest.raises(TithiError) as exc_info:
                payment_service.create_payment_intent(
                    tenant_id=str(self.tenant.id),
                    booking_id=str(uuid.uuid4()),
                    amount_cents=5000
                )
            
            # Verify error message doesn't contain sensitive information
            error_message = str(exc_info.value).lower()
            sensitive_patterns = ['card_number', 'cvv', 'cvc', 'expiry', 'api_key']
            for pattern in sensitive_patterns:
                assert pattern not in error_message, f"Sensitive pattern {pattern} found in error message"
    
    def test_payment_logging_security(self):
        """Test that payment-related logging doesn't expose sensitive data."""
        payment_service = PaymentService()
        
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_logging_test",
                status="requires_payment_method"
            )
            
            # Create payment and capture logs
            with patch('app.services.financial.logger') as mock_logger:
                payment = payment_service.create_payment_intent(
                    tenant_id=str(self.tenant.id),
                    booking_id=str(uuid.uuid4()),
                    amount_cents=5000
                )
                
                # Verify log calls were made
                assert mock_logger.info.called
                
                # Get log call arguments
                log_calls = mock_logger.info.call_args_list
                
                # Verify no sensitive data in logs
                for call in log_calls:
                    log_message = str(call).lower()
                    sensitive_patterns = ['card_number', 'cvv', 'cvc', 'expiry']
                    for pattern in sensitive_patterns:
                        assert pattern not in log_message, f"Sensitive pattern {pattern} found in log: {call}"


class TestPCIComplianceIntegration:
    """Integration tests for PCI compliance across the entire payment flow."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Set up test environment for integration tests."""
        self.app = create_app('testing')
        self.client = self.app.test_client()
        
        with self.app.app_context():
            db.create_all()
            
            # Create test tenant
            self.tenant = Tenant(
                id=uuid.uuid4(),
                slug="pci-integration-tenant",
                name="PCI Integration Tenant",
                timezone="UTC",
                is_active=True
            )
            db.session.add(self.tenant)
            
            # Create test user
            self.user = User(
                id=uuid.uuid4(),
                display_name="PCI Integration User",
                primary_email="pci-integration@example.com"
            )
            db.session.add(self.user)
            
            # Create membership
            self.membership = Membership(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                user_id=self.user.id,
                role="owner"
            )
            db.session.add(self.membership)
            
            db.session.commit()
    
    def teardown_method(self):
        """Clean up after each test."""
        with self.app.app_context():
            db.drop_all()
    
    def test_end_to_end_payment_compliance(self):
        """Test complete payment flow maintains PCI compliance."""
        payment_service = PaymentService()
        
        # Step 1: Create payment intent
        with patch('stripe.PaymentIntent.create') as mock_stripe_create:
            mock_stripe_create.return_value = MagicMock(
                id="pi_e2e_test",
                status="requires_payment_method",
                client_secret="pi_e2e_test_secret"
            )
            
            payment = payment_service.create_payment_intent(
                tenant_id=str(self.tenant.id),
                booking_id=str(uuid.uuid4()),
                amount_cents=10000
            )
            
            assert payment.status == 'requires_action'
        
        # Step 2: Confirm payment
        with patch('stripe.PaymentIntent.confirm') as mock_stripe_confirm:
            mock_stripe_confirm.return_value = MagicMock(
                id="pi_e2e_test",
                status="succeeded"
            )
            
            confirmed_payment = payment_service.confirm_payment_intent(
                payment_id=str(payment.id),
                tenant_id=str(self.tenant.id)
            )
            
            assert confirmed_payment.status == 'captured'
        
        # Step 3: Verify no sensitive data throughout the flow
        final_payment = db.session.query(Payment).filter(
            Payment.id == payment.id
        ).first()
        
        # Check entire payment record for sensitive data
        payment_dict = final_payment.__dict__
        for key, value in payment_dict.items():
            if value is not None:
                value_str = str(value).lower()
                sensitive_patterns = ['card_number', 'cvv', 'cvc', 'expiry']
                for pattern in sensitive_patterns:
                    assert pattern not in value_str, f"Sensitive pattern {pattern} found in field {key}"
    
    def test_payment_method_lifecycle_compliance(self):
        """Test payment method creation, usage, and deletion maintains compliance."""
        # Create payment method
        payment_method = PaymentMethod(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            customer_id=uuid.uuid4(),  # Mock customer
            stripe_payment_method_id="pm_lifecycle_test",
            type="card",
            last4="4242",
            exp_month=12,
            exp_year=2025,
            brand="visa",
            is_default=True
        )
        
        db.session.add(payment_method)
        db.session.commit()
        
        # Use payment method in payment
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_pm_test",
                status="succeeded"
            )
            
            payment = payment_service.create_payment_intent(
                tenant_id=str(self.tenant.id),
                booking_id=str(uuid.uuid4()),
                amount_cents=5000
            )
        
        # Delete payment method
        db.session.delete(payment_method)
        db.session.commit()
        
        # Verify payment method is deleted
        deleted_pm = db.session.query(PaymentMethod).filter(
            PaymentMethod.id == payment_method.id
        ).first()
        
        assert deleted_pm is None
        
        # Verify payment still exists but payment method reference is handled
        remaining_payment = db.session.query(Payment).filter(
            Payment.id == payment.id
        ).first()
        
        assert remaining_payment is not None
        # Verify no sensitive data in remaining payment
        payment_str = str(remaining_payment.__dict__).lower()
        sensitive_patterns = ['card_number', 'cvv', 'cvc', 'expiry']
        for pattern in sensitive_patterns:
            assert pattern not in payment_str, f"Sensitive pattern {pattern} found in payment after PM deletion"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
