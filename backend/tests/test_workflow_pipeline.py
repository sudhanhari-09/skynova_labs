"""End-to-end workflow pipeline tests for the quote -> contract -> project flow.

These tests validate the integration fixes against the running app's OpenAPI
schema and the module symbols, without requiring a live database or pytest.
They are written in pytest style so they can run under pytest when installed,
and can also be executed directly (`python tests/test_workflow_pipeline.py`).
"""

import os
import sys
import pathlib

BACKEND_DIR = pathlib.Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def _schema_paths():
    from app.main import app
    return set(app.openapi()["paths"])


class TestPipelineSymbols:
    """Regression guards for the crash bugs fixed in this milestone."""

    def test_leads_module_imports_quoterequest(self):
        """leads.create_lead_from_quote must reference an imported QuoteRequest."""
        import app.api.v1.leads as leads
        assert hasattr(leads, "QuoteRequest")
        assert "QuoteRequest" in leads.__dict__

    def test_contracts_module_has_no_stub_lookups(self):
        """No fake type('Q',...) / type('L',...) stubs remain in contracts."""
        import inspect
        import app.api.v1.contracts as contracts
        src = inspect.getsource(contracts)
        assert "type('Q'" not in src
        assert "type('L'" not in src

    def test_activity_kwarg_consistency(self):
        """Activity model accepts performed_by, not performed_by_id."""
        from app.models.auth import Activity
        # performed_by is a real column; performed_by_id is NOT
        assert hasattr(Activity, "performed_by")
        assert not hasattr(Activity, "performed_by_id")


class TestPipelineEndpoints:
    """Confirm the full workflow surface is registered in the OpenAPI schema."""

    def test_public_project_explorer(self):
        paths = _schema_paths()
        assert "/public/projects/" in paths

    def test_quotation_view_and_pdf(self):
        paths = _schema_paths()
        assert "/admin/quotations/{quotation_id}/view" in paths
        assert "/admin/quotations/{quotation_id}/pdf" in paths

    def test_quotation_and_contract_accept_actions(self):
        paths = _schema_paths()
        assert "/admin/quotations/{quotation_id}/accept" in paths
        assert "/admin/contracts/{contract_id}/accept" in paths

    def test_auth_password_management(self):
        paths = _schema_paths()
        assert "/auth/change-password" in paths
        assert "/auth/forgot-password" in paths
        assert "/auth/reset-password" in paths

    def test_admin_users_and_roles(self):
        paths = _schema_paths()
        assert "/admin/users/" in paths
        assert "/admin/users/roles" in paths

    def test_catalogs_and_audit(self):
        paths = _schema_paths()
        assert "/admin/catalogs/clients" in paths
        assert "/admin/catalogs/expenses" in paths
        assert "/admin/audit-logs" in paths


def _run_all():
    failures = 0
    for cls in (TestPipelineSymbols, TestPipelineEndpoints):
        for name in sorted(dir(cls)):
            if not name.startswith("test_"):
                continue
            fn = getattr(cls(), name)
            try:
                fn()
                print(f"PASS  {cls.__name__}.{name}")
            except Exception as exc:  # noqa: BLE001
                failures += 1
                print(f"FAIL  {cls.__name__}.{name}: {exc!r}")
    print(f"\n{0 if failures else 'ALL'} failures ({failures})")
    return failures


if __name__ == "__main__":
    raise SystemExit(_run_all())
