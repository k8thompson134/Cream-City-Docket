"""Tests for Legistar bill URL construction.

The Legistar web UI uses a LegislationID that has no mapping in the public API.
The poller scrapes the web UI by file number and caches the URL in legistar_web_url.
When present, legistarUrl() uses it directly; otherwise it falls back to the search page.
"""
import sys
import os
import types

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Stub out heavy dependencies before importing templates
_app_mod = types.ModuleType("app")
_models_mod = types.ModuleType("app.models")
_models_mod.Matter = object  # type: ignore
sys.modules.setdefault("app", _app_mod)
sys.modules.setdefault("app.models", _models_mod)
sys.modules.setdefault("notifications.email", types.ModuleType("notifications.email"))

import notifications.templates as tmpl

SEARCH_URL = "https://milwaukee.legistar.com/Legislation.aspx"
DETAIL_BASE = "https://milwaukee.legistar.com/LegislationDetail.aspx"


def _call_alert_email(**overrides):
    defaults = dict(
        trigger_event="introduced",
        matter_title="Test Bill",
        matter_summary=None,
        matter_type="Ordinance",
        matter_status="In Committee",
        intro_date=None,
        agenda_date=None,
        mayor_action_date=None,
        tags=[],
        sponsors=[],
        file_number="251790",
        trigger_reason="housing",
        manage_url="https://creamcitydocket.com/manage/abc",
        unsubscribe_url="https://creamcitydocket.com/unsubscribe/abc",
    )
    defaults.update(overrides)
    return tmpl.alert_email(**defaults)


class TestAlertEmailLegistarUrl:
    def test_links_to_search_page(self):
        _, html, text = _call_alert_email()
        assert SEARCH_URL in html
        assert SEARCH_URL in text

    def test_never_links_to_detail_page(self):
        """LegislationDetail.aspx requires a web-only ID not in the API."""
        _, html, text = _call_alert_email()
        assert DETAIL_BASE not in html
        assert DETAIL_BASE not in text

    def test_file_number_shown_in_link_label(self):
        _, html, _ = _call_alert_email(file_number="251790")
        assert "251790" in html

    def test_no_file_number_still_renders(self):
        _, html, text = _call_alert_email(file_number=None)
        assert SEARCH_URL in html
        assert SEARCH_URL in text


class TestPriorityEmailLegistarUrl:
    def _make_matter(self, file_number="654321"):
        return types.SimpleNamespace(
            legistar_matter_id=73889,
            legistar_guid="9BA38B99-A4D3-4AEC-890D-6BE8550F116B",
            title="Test Priority Bill",
            matter_type="Resolution",
            matter_status="Passed",
            summary=None,
            file_number=file_number,
            intro_date=None,
            agenda_date=None,
            sponsors=[],
            tags=[],
            mayor_actions=[],
        )

    def test_links_to_search_page(self):
        matter = self._make_matter()
        _, html, text = tmpl.render_priority_email(
            matter, "passed", "https://creamcitydocket.com/unsubscribe/x"
        )
        assert SEARCH_URL in html
        assert SEARCH_URL in text

    def test_never_links_to_detail_page(self):
        matter = self._make_matter()
        _, html, text = tmpl.render_priority_email(
            matter, "passed", "https://creamcitydocket.com/unsubscribe/x"
        )
        assert DETAIL_BASE not in html
        assert DETAIL_BASE not in text
