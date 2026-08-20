import importlib.util
from pathlib import Path

import pytest


MODULE_PATH = Path(__file__).parents[1] / "stacks" / "free-ai-8" / "orchestrator.py"
spec = importlib.util.spec_from_file_location("free_ai_8_orchestrator", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)


def test_zero_spend_defaults(monkeypatch):
    for key in ["ALLOW_PAID_AI", "ALLOW_APOLLO_CREDIT_SPEND", "ALLOW_OUTBOUND_SEND"]:
        monkeypatch.delenv(key, raising=False)
    data = module.health()
    assert data["safety"]["allow_paid_ai"] is False
    assert data["safety"]["allow_apollo_credit_spend"] is False
    assert data["safety"]["allow_outbound_send"] is False


def test_minimax_fails_closed_without_paid_permission(monkeypatch):
    monkeypatch.setenv("ALLOW_PAID_AI", "false")
    monkeypatch.setenv("MINIMAX_API_KEY", "do-not-use")
    with pytest.raises(RuntimeError, match="ALLOW_PAID_AI"):
        module.minimax_text("test")


def test_csv_parser_normalizes_items():
    assert module.parse_csv("director, vp, c_suite") == ["director", "vp", "c_suite"]


def test_hubspot_upsert_requires_deterministic_email(monkeypatch):
    monkeypatch.setenv("HUBSPOT_ACCESS_TOKEN", "test-token")
    with pytest.raises(ValueError, match="requires an email"):
        module.hubspot_upsert_contact({"firstname": "Test"})
