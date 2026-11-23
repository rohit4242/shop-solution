"""Rules for shipment status changes (ported from the week-4 shipment-status.ts + delivery-retry spec).

EXPECTED_ALLOWED is typed out here on purpose, from the spec. It must not be imported from the module,
otherwise a wrong table would pass its own test.
"""

import dataclasses

import pytest

from shipment_rules import (
    InvalidTimestampError,
    InvalidTransitionError,
    MAX_DELIVERY_ATTEMPTS,
    StaleEventError,
    apply_status_update,
    create_shipment,
)

STATUSES = [
    "CREATED",
    "LABEL_CREATED",
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "DELIVERY_FAILED",
    "RETURNED",
    "CANCELLED",
]

EXPECTED_ALLOWED = {
    ("CREATED", "LABEL_CREATED"),
    ("CREATED", "CANCELLED"),
    ("LABEL_CREATED", "IN_TRANSIT"),
    ("LABEL_CREATED", "CANCELLED"),
    ("IN_TRANSIT", "OUT_FOR_DELIVERY"),
    ("OUT_FOR_DELIVERY", "DELIVERED"),
    ("OUT_FOR_DELIVERY", "DELIVERY_FAILED"),
    ("DELIVERY_FAILED", "OUT_FOR_DELIVERY"),
    ("DELIVERY_FAILED", "IN_TRANSIT"),
    ("DELIVERY_FAILED", "RETURNED"),
}

EVENT_FIELDS = {
    "shipmentId",
    "orderId",
    "carrierCode",
    "trackingNumber",
    "previousStatus",
    "status",
    "updatedAt",
    "attemptCount",
}


def at(hour: int, ms: int = 0) -> str:
    return f"2026-11-01T{hour:02d}:00:00.{ms:03d}Z"


def shipment(status="CREATED", failed=0, hour=8):
    base = create_shipment("S-2001", "O-1001", "C-501", "STANDARD", at(hour))
    return dataclasses.replace(base, status=status, failed_attempts=failed)


@pytest.mark.parametrize("old", STATUSES)
@pytest.mark.parametrize("new", STATUSES)
def test_only_the_listed_direct_transitions_are_allowed(old, new):
    s = shipment(old)
    if (old, new) in EXPECTED_ALLOWED:
        result = apply_status_update(s, new, at(9))
        assert result.shipment.status == new
    else:
        with pytest.raises(InvalidTransitionError):
            apply_status_update(s, new, at(9))


def test_created_shipment_has_status_created_carrier_and_tracking_number():
    s = create_shipment("S-2001", "O-1001", "C-501", "EXPRESS", at(8))
    assert (s.status, s.carrier_code, s.failed_attempts, s.customer_id) == ("CREATED", "UPS", 0, "C-501")
    assert s.tracking_number == "TRK-2001" and s.tracking_number != s.shipment_id
    assert create_shipment("S-2002", "O-1002", "C-502", "STANDARD", at(8)).carrier_code == "DHL"


def test_event_has_exactly_the_contract_fields_and_keeps_order_and_shipment_ids_apart():
    result = apply_status_update(shipment("CREATED"), "LABEL_CREATED", at(9))
    (event,) = result.events
    assert set(event) == EVENT_FIELDS
    assert event["shipmentId"] == "S-2001" and event["orderId"] == "O-1001"
    assert event["previousStatus"] == "CREATED" and event["status"] == "LABEL_CREATED"
    assert event["updatedAt"] == at(9) and event["attemptCount"] == 0


def test_input_shipment_is_not_mutated():
    s = shipment("CREATED")
    before = dataclasses.asdict(s)
    apply_status_update(s, "LABEL_CREATED", at(9))
    assert dataclasses.asdict(s) == before


def test_applied_update_sets_updated_at():
    assert apply_status_update(shipment("CREATED"), "LABEL_CREATED", at(9)).shipment.updated_at == at(9)


@pytest.mark.parametrize("terminal", ["DELIVERED", "RETURNED", "CANCELLED"])
def test_terminal_statuses_accept_no_further_change(terminal):
    for new in STATUSES:
        with pytest.raises(InvalidTransitionError):
            apply_status_update(shipment(terminal), new, at(9))


def test_repeated_observation_is_idempotent_no_event_no_change():
    first = apply_status_update(shipment("CREATED"), "LABEL_CREATED", at(9))
    again = apply_status_update(first.shipment, "LABEL_CREATED", at(9))
    assert again.events == [] and again.shipment == first.shipment


def test_replaying_an_older_already_applied_observation_is_still_idempotent():
    first = apply_status_update(shipment("CREATED"), "LABEL_CREATED", at(9))
    second = apply_status_update(first.shipment, "IN_TRANSIT", at(10))
    replay = apply_status_update(second.shipment, "LABEL_CREATED", at(9))
    assert replay.events == [] and replay.shipment == second.shipment


def test_a_new_observation_that_is_not_allowed_is_not_mistaken_for_a_repeat():
    s = apply_status_update(shipment("OUT_FOR_DELIVERY"), "DELIVERY_FAILED", at(9)).shipment
    with pytest.raises(InvalidTransitionError):
        apply_status_update(s, "DELIVERY_FAILED", at(10))


def test_stale_update_is_rejected():
    s = shipment("LABEL_CREATED", hour=9)
    with pytest.raises(StaleEventError):
        apply_status_update(s, "IN_TRANSIT", at(7))


def test_update_at_the_same_time_with_a_new_status_is_not_stale():
    s = shipment("LABEL_CREATED", hour=9)
    assert apply_status_update(s, "IN_TRANSIT", at(9)).shipment.status == "IN_TRANSIT"


@pytest.mark.parametrize("bad", ["2026-11-01 09:00", "2026-11-01T09:00:00Z", "2026-11-01T09:00:00.000+01:00", "", "not-a-date"])
def test_non_canonical_timestamp_is_rejected(bad):
    with pytest.raises(InvalidTimestampError):
        apply_status_update(shipment("CREATED"), "LABEL_CREATED", bad)


def test_impossible_calendar_date_is_rejected():
    with pytest.raises(InvalidTimestampError):
        apply_status_update(shipment("CREATED"), "LABEL_CREATED", "2026-13-45T09:00:00.000Z")


# ---- delivery retry (week-4 spec criteria 1-7) ----


def test_criterion_3_each_new_delivery_failed_adds_one_failed_attempt():
    s = shipment("OUT_FOR_DELIVERY", failed=0)
    r1 = apply_status_update(s, "DELIVERY_FAILED", at(9))
    assert r1.shipment.failed_attempts == 1
    r2 = apply_status_update(apply_status_update(r1.shipment, "OUT_FOR_DELIVERY", at(10)).shipment, "DELIVERY_FAILED", at(11))
    assert r2.shipment.failed_attempts == 2


def test_criterion_1_and_2_retry_below_limit_goes_to_out_for_delivery_or_in_transit():
    for target in ("OUT_FOR_DELIVERY", "IN_TRANSIT"):
        r = apply_status_update(shipment("DELIVERY_FAILED", failed=2), target, at(9))
        assert r.shipment.status == target and r.shipment.failed_attempts == 2


def test_criterion_4_duplicate_delivery_failed_is_not_counted_and_emits_nothing():
    first = apply_status_update(shipment("OUT_FOR_DELIVERY"), "DELIVERY_FAILED", at(9))
    again = apply_status_update(first.shipment, "DELIVERY_FAILED", at(9))
    assert again.events == [] and again.shipment.failed_attempts == 1


def test_criterion_5_third_failure_returns_the_shipment_automatically_with_two_events():
    r = apply_status_update(shipment("OUT_FOR_DELIVERY", failed=MAX_DELIVERY_ATTEMPTS - 1), "DELIVERY_FAILED", at(9))
    assert r.shipment.status == "RETURNED" and r.shipment.failed_attempts == 3
    assert [(e["previousStatus"], e["status"]) for e in r.events] == [
        ("OUT_FOR_DELIVERY", "DELIVERY_FAILED"),
        ("DELIVERY_FAILED", "RETURNED"),
    ]
    assert all(e["updatedAt"] == at(9) and e["attemptCount"] == 3 for e in r.events)


def test_criterion_6_after_the_automatic_return_a_retry_is_rejected():
    r = apply_status_update(shipment("OUT_FOR_DELIVERY", failed=2), "DELIVERY_FAILED", at(9))
    for target in ("OUT_FOR_DELIVERY", "IN_TRANSIT"):
        with pytest.raises(InvalidTransitionError):
            apply_status_update(r.shipment, target, at(10))


def test_redelivered_third_failure_webhook_after_automatic_return_is_still_idempotent():
    r = apply_status_update(shipment("OUT_FOR_DELIVERY", failed=2), "DELIVERY_FAILED", at(9))
    again = apply_status_update(r.shipment, "DELIVERY_FAILED", at(9))
    assert again.events == [] and again.shipment == r.shipment


def test_criterion_7_cancel_from_delivery_failed_is_rejected():
    with pytest.raises(InvalidTransitionError):
        apply_status_update(shipment("DELIVERY_FAILED", failed=1), "CANCELLED", at(9))


def test_first_and_second_failure_do_not_return_the_shipment():
    for failed_before in (0, 1):
        r = apply_status_update(shipment("OUT_FOR_DELIVERY", failed=failed_before), "DELIVERY_FAILED", at(9))
        assert r.shipment.status == "DELIVERY_FAILED" and len(r.events) == 1
