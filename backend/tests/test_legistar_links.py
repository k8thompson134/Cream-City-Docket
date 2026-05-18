"""Tests for Legistar bill URL construction."""
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

DETAIL_BASE = "https://milwaukee.legistar.com/LegislationDetail.aspx"
SEARCH_URL = "https://milwaukee.legistar.com/Legislation.aspx"


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
        file_number="123456",
        legistar_matter_id=8029585,
        legistar_guid="2DA9DB39-DB06-4B1E-BBE1-AF7CC4FB7BD1",
        trigger_reason="housing",
        manage_url="https://creamcitydocket.com/manage/abc",
        unsubscribe_url="https://creamcitydocket.com/unsubscribe/abc",
    )
    defaults.update(overrides)
    return tmpl.alert_email(**defaults)


class TestAlertEmailLegistarUrl:
    def test_direct_link_when_id_and_guid_present(self):
        _, html, text = _call_alert_email(
            legistar_matter_id=8029585,
            legistar_guid="2DA9DB39-DB06-4B1E-BBE1-AF7CC4FB7BD1",
        )
        expected = f"{DETAIL_BASE}?ID=8029585&GUID=2DA9DB39-DB06-4B1E-BBE1-AF7CC4FB7BD1"
        assert expected in html
        assert expected in text

    def test_fallback_when_id_missing(self):
        _, html, text = _call_alert_email(legistar_matter_id=None, legistar_guid="some-guid")
        assert SEARCH_URL in html
        assert SEARCH_URL in text
        assert DETAIL_BASE not in html

    def test_fallback_when_guid_missing(self):
        _, html, text = _call_alert_email(legistar_matter_id=123, legistar_guid=None)
        assert SEARCH_URL in html
        assert SEARCH_URL in text
        assert DETAIL_BASE not in html

    def test_search_page_not_used_when_both_present(self):
        _, html, text = _call_alert_email(
            legistar_matter_id=999,
            legistar_guid="AAAABBBB-CCCC-DDDD-EEEE-FFFFGGGGHHHH",
        )
        assert SEARCH_URL not in html
        assert SEARCH_URL not in text


class TestPriorityEmailLegistarUrl:
    def _make_matter(self, matter_id=8029585, guid="2DA9DB39-DB06-4B1E-BBE1-AF7CC4FB7BD1"):
        m = types.SimpleNamespace(
            legistar_matter_id=matter_id,
            legistar_guid=guid,
            title="Test Priority Bill",
            matter_type="Resolution",
            matter_status="Passed",
            summary=None,
            file_number="654321",
            intro_date=None,
            agenda_date=None,
            sponsors=[],
            tags=[],
            mayor_actions=[],
        )
        return m

    def test_direct_link_in_priority_email(self):
        matter = self._make_matter()
        _, html, text = tmpl.render_priority_email(
            matter, "passed", "https://creamcitydocket.com/unsubscribe/x"
        )
        expected = f"{DETAIL_BASE}?ID=8029585&GUID=2DA9DB39-DB06-4B1E-BBE1-AF7CC4FB7BD1"
        assert expected in html
        assert expected in text
