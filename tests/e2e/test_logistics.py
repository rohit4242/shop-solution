"""Draft acceptance tests. Human review is pending; freeze after that review.
Run against the demo: python -m pytest tests/e2e/test_logistics.py -q
"""
import os
import re
import time
from datetime import datetime, timedelta, timezone
import pytest
from playwright.sync_api import sync_playwright, expect
BASE = os.environ.get("LOGISTICS_DEMO_TEST_URL", "http://127.0.0.1:3000")
API_BASE = os.environ.get("LOGISTICS_DEMO_TEST_API_URL", "http://127.0.0.1:8000")
@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        yield b
        b.close()
@pytest.fixture
def page(browser):
    context = browser.new_context(viewport={"width": 1440, "height": 1100})
    page = context.new_page()
    page.goto(BASE + "/logistics")
    page.get_by_label("Password", exact=True).fill("logistics-demo")
    page.get_by_role("button", name="Sign in", exact=True).click()
    expect(page.get_by_text("Signed in as staff@logistics.demo")).to_be_visible()
    yield page
    context.close()
def create(page):
    order = "O-" + str(time.time_ns())
    page.get_by_role("button", name="Use demo paid order").click()
    page.get_by_label("Order ID", exact=True).fill(order)
    page.get_by_role("button", name="Create shipment", exact=True).click()
    expect(page.get_by_text(re.compile(r"Shipment S-\d+ created\.")).first).to_be_visible()
    details = page.get_by_test_id("shipment-details")
    expect(details).to_be_visible()
    sid = re.search(r"S-\d+", details.inner_text()).group()
    return order, sid

def test_journey_create_find_and_track(page):
    order, sid = create(page)
    details = page.get_by_test_id("shipment-details")
    expect(details.get_by_text("CREATED", exact=True)).to_be_visible()
    expect(details.get_by_text("DHL", exact=True)).to_be_visible()
    expect(details.get_by_text("TRK-" + sid[2:], exact=True)).to_be_visible()
    page.get_by_label("Order ID filter", exact=True).fill(order)
    page.get_by_role("button", name="Search", exact=True).click()
    expect(page.get_by_role("row").filter(has_text=order)).to_have_count(1)
    page.get_by_role("button", name=f"Open {sid}", exact=True).click()
    expect(page.get_by_label("Shipment ID", exact=True)).to_have_value(sid)

def test_journey_unknown_shipment_retains_input_and_recovers(page):
    _, sid = create(page)
    field = page.get_by_label("Shipment ID", exact=True)
    field.fill("S-9999")
    page.get_by_role("button", name="Track", exact=True).click()
    expect(page.get_by_role("main").get_by_role("alert")).to_contain_text("Shipment not found. Please check the ID.")
    expect(field).to_have_value("S-9999")
    expect(page.get_by_test_id("shipment-details")).to_have_count(0)
    field.fill(sid)
    page.get_by_role("button", name="Track", exact=True).click()
    expect(page.get_by_test_id("shipment-details")).to_be_visible()

def test_journey_carrier_rejection_valid_report_and_duplicate(page):
    _, sid = create(page)
    stamp = (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    field = page.get_by_label("Reported time (UTC)", exact=True)
    field.fill(stamp)
    page.get_by_label("Reported status", exact=True).select_option("DELIVERED")
    page.get_by_role("button", name="Apply update", exact=True).click()
    expect(page.get_by_role("main").get_by_role("alert")).to_contain_text("INVALID_TRANSITION")
    expect(field).to_have_value(stamp)
    expect(page.get_by_test_id("shipment-details").get_by_text("CREATED", exact=True)).to_be_visible()
    expect(page.get_by_text("No status changes yet.", exact=True)).to_be_visible()
    page.get_by_label("Reported status", exact=True).select_option("LABEL_CREATED")
    page.get_by_role("button", name="Apply update", exact=True).click()
    expect(page.get_by_text("Carrier report recorded.", exact=True)).to_be_visible()
    history = page.get_by_role("list", name="Status history", exact=True)
    expect(history.get_by_role("listitem")).to_have_count(1)
    expect(history).to_contain_text(stamp)
    page.get_by_role("button", name="Apply update", exact=True).click()
    expect(page.get_by_text("No change: this report was already recorded.", exact=True)).to_be_visible()
    expect(history.get_by_role("listitem")).to_have_count(1)
    # Check actual API history, independent of the component rendering.
    r = page.request.get(BASE + f"/api/v1/logistics/shipments/{sid}/events")
    assert r.status == 200 and len(r.json()["data"]) == 1

def test_duplicate_order_does_not_create_second_shipment(page):
    order, _ = create(page)
    page.get_by_role("button", name="Create shipment", exact=True).click()
    expect(page.get_by_role("main").get_by_role("alert")).to_contain_text("ORDER_ALREADY_HAS_SHIPMENT")
    expect(page.get_by_label("Order ID", exact=True)).to_have_value(order)

def test_handoff_keeps_session_in_labelled_stub(page):
    order, _ = create(page)
    page.get_by_role("link", name="View order in Storefront (demo stub)", exact=True).click()
    expect(page.get_by_role("heading", level=1)).to_contain_text(order)
    expect(page.get_by_text("LOCAL DEMO STUB", exact=False)).to_be_visible()
    page.get_by_role("link", name="Return to Logistics", exact=True).click()
    expect(page.get_by_text("Signed in as staff@logistics.demo")).to_be_visible()
    expect(page.get_by_role("button", name="Sign in", exact=True)).to_have_count(0)

def test_blank_tracking_makes_no_api_request(page):
    calls = []
    page.on("request", lambda r: calls.append(r.url) if "/shipments/" in r.url else None)
    page.get_by_label("Shipment ID", exact=True).fill("")
    page.get_by_role("button", name="Track", exact=True).click()
    expect(page.get_by_role("main").get_by_role("alert")).to_contain_text("Please enter a Shipment ID like S-2001.")
    assert calls == []

def test_empty_filter_result(page):
    page.get_by_label("Order ID filter", exact=True).fill("O-999999999999999999999999")
    page.get_by_role("button", name="Search", exact=True).click()
    expect(page.get_by_text("No shipments match your filters.", exact=True)).to_be_visible()

def test_service_down_message(page):
    page.route("**/api/v1/logistics/shipments/S-9999", lambda route: route.abort())
    page.get_by_label("Shipment ID", exact=True).fill("S-9999")
    page.get_by_role("button", name="Track", exact=True).click()
    expect(page.get_by_role("main").get_by_role("alert")).to_contain_text("The Logistics service is unavailable. Please try again.")

def test_unsigned_gateway_and_direct_backend_are_rejected(browser):
    context = browser.new_context()
    assert context.request.get(BASE + "/api/v1/logistics/shipments").status == 401
    assert context.request.get(API_BASE + "/shipments").status == 401
    context.close()

def test_keyboard_tracking_and_mobile_layout(page):
    field = page.get_by_label("Shipment ID", exact=True)
    field.focus()
    page.keyboard.type("S-9999")
    page.keyboard.press("Tab")
    expect(page.get_by_role("button", name="Track", exact=True)).to_be_focused()
    page.keyboard.press("Enter")
    expect(page.get_by_role("main").get_by_role("alert")).to_contain_text("Shipment not found")
    page.set_viewport_size({"width":390,"height":844})
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
