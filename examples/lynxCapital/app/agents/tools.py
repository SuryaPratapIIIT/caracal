"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Tool wrappers for every agent-callable service action; each emits full event pairs.
"""
from __future__ import annotations

from typing import Callable

from app.events import types as ev
from app.events.bus import bus
from app.services.registry import call as _svc


def _invoke(
    run_id: str,
    agent_id: str,
    tool_name: str,
    service_id: str,
    action: str,
    args: dict[str, object],
) -> dict[str, object]:
    bus.publish(ev.tool_call(run_id, agent_id, tool_name, args))
    bus.publish(ev.service_call(run_id, agent_id, service_id, action, args))
    result = _svc(service_id, action, args)
    bus.publish(ev.service_result(run_id, agent_id, service_id, action, result))
    bus.publish(ev.tool_result(run_id, agent_id, tool_name, result))
    return result


# -- invoice-intake tools --

def extract_invoice(run_id: str, agent_id: str, invoice_id: str, document_ref: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "extract_invoice", "ocr-vision", "extract_invoice",
                   {"invoice_id": invoice_id, "document_ref": document_ref})


def get_vendor_profile(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "get_vendor_profile", "vendor-portal", "get_vendor_profile",
                   {"vendor_id": vendor_id})


def get_fx_rate(run_id: str, agent_id: str, from_currency: str, to_currency: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "get_fx_rate", "fx-rates", "get_rate",
                   {"from_currency": from_currency, "to_currency": to_currency})


# -- ledger-match tools --

def netsuite_match_invoice(run_id: str, agent_id: str, vendor_id: str, invoice_id: str, amount: float, currency: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "netsuite_match_invoice", "netsuite", "match_invoice",
                   {"vendor_id": vendor_id, "invoice_id": invoice_id, "amount": amount, "currency": currency})


def netsuite_get_vendor_record(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "netsuite_get_vendor_record", "netsuite", "get_vendor_record",
                   {"vendor_id": vendor_id})


def sap_match_invoice(run_id: str, agent_id: str, vendor_id: str, invoice_id: str, amount: float, currency: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "sap_match_invoice", "sap-erp", "match_invoice",
                   {"vendor_id": vendor_id, "invoice_id": invoice_id, "amount": amount, "currency": currency})


def sap_get_vendor_record(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "sap_get_vendor_record", "sap-erp", "get_vendor_record",
                   {"vendor_id": vendor_id})


def quickbooks_match_bill(run_id: str, agent_id: str, vendor_id: str, invoice_id: str, amount: float, currency: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "quickbooks_match_bill", "quickbooks", "match_bill",
                   {"vendor_id": vendor_id, "invoice_id": invoice_id, "amount": amount, "currency": currency})


def quickbooks_get_vendor(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "quickbooks_get_vendor", "quickbooks", "get_vendor",
                   {"vendor_id": vendor_id})


# -- policy-check tools --

def check_vendor(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "check_vendor", "compliance-nexus", "check_vendor",
                   {"vendor_id": vendor_id})


def check_transaction(run_id: str, agent_id: str, vendor_id: str, amount: float, currency: str, rail: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "check_transaction", "compliance-nexus", "check_transaction",
                   {"vendor_id": vendor_id, "amount": amount, "currency": currency, "rail": rail})


def get_withholding_rate(run_id: str, agent_id: str, region: str, currency: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "get_withholding_rate", "tax-rules", "get_withholding_rate",
                   {"region": region, "currency": currency})


def validate_tax_id(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "validate_tax_id", "tax-rules", "validate_tax_id",
                   {"vendor_id": vendor_id})


# -- route-optimization tools --

def get_account_balance(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "get_account_balance", "mercury-bank", "get_account_balance",
                   {"vendor_id": vendor_id})


def get_quote(run_id: str, agent_id: str, from_currency: str, to_currency: str, amount: float) -> dict[str, object]:
    return _invoke(run_id, agent_id, "get_quote", "wise-payouts", "get_quote",
                   {"from_currency": from_currency, "to_currency": to_currency, "amount": amount})


# -- payment-execution tools --

def submit_payment(
    run_id: str,
    agent_id: str,
    vendor_id: str,
    amount: float,
    currency: str,
    rail: str,
    reference: str,
) -> dict[str, object]:
    return _invoke(run_id, agent_id, "submit_payment", "mercury-bank", "submit_payment",
                   {"vendor_id": vendor_id, "amount": amount, "currency": currency, "rail": rail, "reference": reference})


def submit_payout(
    run_id: str,
    agent_id: str,
    vendor_id: str,
    amount: float,
    currency: str,
    rail: str,
    reference: str,
) -> dict[str, object]:
    return _invoke(run_id, agent_id, "submit_payout", "wise-payouts", "submit_payout",
                   {"vendor_id": vendor_id, "amount": amount, "currency": currency, "rail": rail, "reference": reference})


def create_outbound_payment(
    run_id: str,
    agent_id: str,
    vendor_id: str,
    amount: float,
    currency: str,
    rail: str,
    reference: str,
) -> dict[str, object]:
    return _invoke(run_id, agent_id, "create_outbound_payment", "stripe-treasury", "create_outbound_payment",
                   {"vendor_id": vendor_id, "amount": amount, "currency": currency, "rail": rail, "reference": reference})


# -- audit tools --

def get_contract_terms(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "get_contract_terms", "vendor-portal", "get_contract_terms",
                   {"vendor_id": vendor_id})


def get_payment_status(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "get_payment_status", "netsuite", "get_payment_status",
                   {"vendor_id": vendor_id})


# -- vendor lifecycle tools --

def kyb_screen_vendor(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "kyb_screen_vendor", "compliance-nexus", "kyb_screen_vendor",
                   {"vendor_id": vendor_id})


def register_vendor(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "register_vendor", "vendor-portal", "register_vendor",
                   {"vendor_id": vendor_id})


def refresh_vendor_compliance(run_id: str, agent_id: str, vendor_id: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "refresh_vendor_compliance", "compliance-nexus", "refresh_vendor_compliance",
                   {"vendor_id": vendor_id})


# -- treasury tools --

def get_cash_position(run_id: str, agent_id: str, region: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "get_cash_position", "treasury-ops", "get_cash_position",
                   {"region": region})


def forecast_liquidity(run_id: str, agent_id: str, horizon_days: int) -> dict[str, object]:
    return _invoke(run_id, agent_id, "forecast_liquidity", "treasury-ops", "forecast_liquidity",
                   {"horizon_days": horizon_days})


def place_fx_hedge(run_id: str, agent_id: str, from_currency: str, to_currency: str, notional: float, tenor_days: int) -> dict[str, object]:
    return _invoke(run_id, agent_id, "place_fx_hedge", "treasury-ops", "place_fx_hedge",
                   {"from_currency": from_currency, "to_currency": to_currency, "notional": notional, "tenor_days": tenor_days})


def transfer_funds(run_id: str, agent_id: str, from_region: str, to_region: str, amount_usd: float) -> dict[str, object]:
    return _invoke(run_id, agent_id, "transfer_funds", "treasury-ops", "transfer_funds",
                   {"from_region": from_region, "to_region": to_region, "amount_usd": amount_usd})


# -- close tools --

def post_journal_entry(run_id: str, agent_id: str, account_id: str, amount: float, currency: str, period: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "post_journal_entry", "close-engine", "post_journal_entry",
                   {"account_id": account_id, "amount": amount, "currency": currency, "period": period})


def reconcile_account(run_id: str, agent_id: str, account_id: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "reconcile_account", "close-engine", "reconcile_account",
                   {"account_id": account_id})


def compute_accrual(run_id: str, agent_id: str, category: str, period: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "compute_accrual", "close-engine", "compute_accrual",
                   {"category": category, "period": period})


def close_period(run_id: str, agent_id: str, period: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "close_period", "close-engine", "close_period",
                   {"period": period})


# -- compliance / regulatory tools --

def aml_monitor_transaction(run_id: str, agent_id: str, vendor_id: str, amount: float, currency: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "aml_monitor_transaction", "regulatory-filings", "aml_monitor_transaction",
                   {"vendor_id": vendor_id, "amount": amount, "currency": currency})


def sanctions_screen_batch(run_id: str, agent_id: str, batch_id: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "sanctions_screen_batch", "regulatory-filings", "sanctions_screen_batch",
                   {"batch_id": batch_id})


def prepare_regulatory_filing(run_id: str, agent_id: str, filing_type: str, period: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "prepare_regulatory_filing", "regulatory-filings", "prepare_regulatory_filing",
                   {"filing_type": filing_type, "period": period})


def attest_control(run_id: str, agent_id: str, control_id: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "attest_control", "regulatory-filings", "attest_control",
                   {"control_id": control_id})


# -- receivables tools --

def issue_customer_invoice(run_id: str, agent_id: str, customer_id: str, amount: float, currency: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "issue_customer_invoice", "customer-billing", "issue_customer_invoice",
                   {"customer_id": customer_id, "amount": amount, "currency": currency})


def send_dunning_notice(run_id: str, agent_id: str, customer_id: str, stage: int) -> dict[str, object]:
    return _invoke(run_id, agent_id, "send_dunning_notice", "customer-billing", "send_dunning_notice",
                   {"customer_id": customer_id, "stage": stage})


def apply_customer_payment(run_id: str, agent_id: str, invoice_id: str, amount: float) -> dict[str, object]:
    return _invoke(run_id, agent_id, "apply_customer_payment", "customer-billing", "apply_customer_payment",
                   {"invoice_id": invoice_id, "amount": amount})


def get_ar_aging(run_id: str, agent_id: str, region: str) -> dict[str, object]:
    return _invoke(run_id, agent_id, "get_ar_aging", "customer-billing", "get_ar_aging",
                   {"region": region})


# Registry mapping tool name -> function for dispatch by the orchestration layer.
TOOLS: dict[str, Callable] = {
    "extract_invoice": extract_invoice,
    "get_vendor_profile": get_vendor_profile,
    "get_fx_rate": get_fx_rate,
    "netsuite_match_invoice": netsuite_match_invoice,
    "netsuite_get_vendor_record": netsuite_get_vendor_record,
    "sap_match_invoice": sap_match_invoice,
    "sap_get_vendor_record": sap_get_vendor_record,
    "quickbooks_match_bill": quickbooks_match_bill,
    "quickbooks_get_vendor": quickbooks_get_vendor,
    "check_vendor": check_vendor,
    "check_transaction": check_transaction,
    "get_withholding_rate": get_withholding_rate,
    "validate_tax_id": validate_tax_id,
    "get_account_balance": get_account_balance,
    "get_quote": get_quote,
    "submit_payment": submit_payment,
    "submit_payout": submit_payout,
    "create_outbound_payment": create_outbound_payment,
    "get_contract_terms": get_contract_terms,
    "get_payment_status": get_payment_status,
    "kyb_screen_vendor": kyb_screen_vendor,
    "register_vendor": register_vendor,
    "refresh_vendor_compliance": refresh_vendor_compliance,
    "get_cash_position": get_cash_position,
    "forecast_liquidity": forecast_liquidity,
    "place_fx_hedge": place_fx_hedge,
    "transfer_funds": transfer_funds,
    "post_journal_entry": post_journal_entry,
    "reconcile_account": reconcile_account,
    "compute_accrual": compute_accrual,
    "close_period": close_period,
    "aml_monitor_transaction": aml_monitor_transaction,
    "sanctions_screen_batch": sanctions_screen_batch,
    "prepare_regulatory_filing": prepare_regulatory_filing,
    "attest_control": attest_control,
    "issue_customer_invoice": issue_customer_invoice,
    "send_dunning_notice": send_dunning_notice,
    "apply_customer_payment": apply_customer_payment,
    "get_ar_aging": get_ar_aging,
}
