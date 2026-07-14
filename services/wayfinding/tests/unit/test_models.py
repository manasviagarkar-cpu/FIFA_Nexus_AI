"""
FIFA Nexus AI — Wayfinding Pydantic Models Validation Tests
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.domain.models import RouteCalculateRequest


def test_request_validation_valid():
    req = RouteCalculateRequest(
        origin="gate-a",
        destination="concourse-100",
        accessibility_needs=["wheelchair"],
        is_vip=False,
        preference="fastest",
        max_density_threshold=0.8,
    )
    assert req.origin == "gate-a"
    assert req.preference == "fastest"


def test_request_validation_sanitization():
    # Bleach should clean origin/destination inputs
    req = RouteCalculateRequest(
        origin="<script>alert(1)</script>gate-a",
        destination="concourse-100   ",
        accessibility_needs=[],
    )
    assert req.origin == "gate-a"
    assert req.destination == "concourse-100"


def test_request_validation_invalid_preference():
    with pytest.raises(ValidationError):
        RouteCalculateRequest(
            origin="gate-a",
            destination="concourse-100",
            preference="invalid_pref",
        )


def test_request_validation_invalid_accessibility():
    with pytest.raises(ValidationError):
        RouteCalculateRequest(
            origin="gate-a",
            destination="concourse-100",
            accessibility_needs=["some_invalid_need"],
        )


def test_request_validation_invalid_density():
    with pytest.raises(ValidationError):
        RouteCalculateRequest(
            origin="gate-a",
            destination="concourse-100",
            max_density_threshold=1.5,
        )
