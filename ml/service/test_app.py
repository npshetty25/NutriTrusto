"""Service tests. They load the committed model artefact, so they also fail if
the artefact and the pinned scikit-learn ever stop being compatible."""
import pytest
from fastapi.testclient import TestClient

from ml.service.app import MAX_NAMES, app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:  # runs lifespan: loads the model
        yield c


def test_health_reports_version_and_classes(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["model_version"] == "category-v1"
    assert set(body["classes"]) == {
        "bakery", "beverage", "dairy", "frozen", "fruit", "grain", "meat", "pantry", "snack", "vegetable",
    }


@pytest.mark.parametrize(
    "name, expected",
    [
        ("Amul Masala Buttermilk", "dairy"),
        ("Aashirvaad Whole Wheat Atta 5kg", "grain"),
        ("Coca-Cola 750ml", "beverage"),
    ],
)
def test_predicts_obvious_products(client, name, expected):
    r = client.post("/predict", json={"names": [name]})
    assert r.status_code == 200
    assert r.json()["predictions"][0]["category"] == expected


def test_response_shape_and_probabilities(client):
    r = client.post("/predict", json={"names": ["Paneer 200g", "Basmati Rice"]}).json()
    assert r["model_version"] == "category-v1"
    assert [p["name"] for p in r["predictions"]] == ["Paneer 200g", "Basmati Rice"]
    for p in r["predictions"]:
        assert 0.0 < p["confidence"] <= 1.0
        assert len(p["alternatives"]) == 2
        assert p["alternatives"][0]["confidence"] <= p["confidence"]


def test_is_case_and_whitespace_insensitive(client):
    a = client.post("/predict", json={"names": ["  AMUL   butter  "]}).json()["predictions"][0]
    b = client.post("/predict", json={"names": ["amul butter"]}).json()["predictions"][0]
    assert a["category"] == b["category"] and a["confidence"] == b["confidence"]


@pytest.mark.parametrize("payload", [{"names": []}, {"names": ["   "]}, {}, {"names": "milk"}])
def test_rejects_bad_input(client, payload):
    assert client.post("/predict", json=payload).status_code == 422


def test_caps_batch_size(client):
    assert client.post("/predict", json={"names": ["milk"] * (MAX_NAMES + 1)}).status_code == 422
    assert client.post("/predict", json={"names": ["milk"] * MAX_NAMES}).status_code == 200


def test_long_input_is_truncated_not_rejected(client):
    r = client.post("/predict", json={"names": ["milk " * 500]})
    assert r.status_code == 200


# KNOWN MISSES, recorded rather than hidden. strict=True means that if a
# retrained model starts getting one right, this test fails until the marker is
# removed, so the list cannot go stale.
@pytest.mark.xfail(strict=True, reason="packaged spinach in Open Food Facts is mostly frozen; the model has no fresh-produce signal")
def test_known_miss_fresh_produce_name(client):
    r = client.post("/predict", json={"names": ["Fresh Spinach"]})
    assert r.json()["predictions"][0]["category"] == "vegetable"


@pytest.mark.xfail(strict=True, reason="biscuit/cookie vs snack is genuinely ambiguous in the source taxonomy")
def test_known_miss_cookie_is_bakery(client):
    r = client.post("/predict", json={"names": ["Britannia Good Day Cashew Cookies"]})
    assert r.json()["predictions"][0]["category"] == "bakery"
