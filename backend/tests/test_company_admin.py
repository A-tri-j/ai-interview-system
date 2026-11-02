COMPANY = {
    "company_name": "Acme Ltd",
    "email": "hr@acme.com",
    "registration_number": "REG-1001",
    "manager_name": "Jane Manager",
    "manager_designation": "HR Manager",
    "phone": "+8801800000000",
    "industry": "Software",
    "company_size": "11-50",
    "address": "12 Main Road, Kolkata",
    "website": "https://acme.com",
    "description": "We build software.",
    "password": "Company1234",
    "confirm_password": "Company1234",
}


def company_token(client):
    """Register, verify email, 2-step login. Token return kore."""
    assert client.post("/api/auth/company/register", json=COMPANY).status_code == 201
    r = client.post(
        "/api/auth/company/verify-email",
        json={"email": COMPANY["email"], "otp": "123456"},
    )
    assert r.status_code == 200
    r = client.post(
        "/api/auth/company/login",
        json={"email": COMPANY["email"], "password": COMPANY["password"]},
    )
    assert r.status_code == 200 and "access_token" not in r.json()  # ekhono token nai
    r = client.post(
        "/api/auth/company/login/verify",
        json={"email": COMPANY["email"], "otp": "123456"},
    )
    assert r.status_code == 200
    return r.json()["access_token"]


def admin_headers(client):
    r = client.post(
        "/api/admin/login",
        json={"email": "admin@example.com", "password": "AdminPass123"},
    )
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_company_login_flow_and_pending_status(client):
    token = company_token(client)
    me = client.get(
        "/api/auth/company/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert me.status_code == 200
    assert me.json()["status"] == "pending_approval"


def test_company_login_needs_verified_email(client):
    client.post("/api/auth/company/register", json=COMPANY)
    r = client.post(
        "/api/auth/company/login",
        json={"email": COMPANY["email"], "password": COMPANY["password"]},
    )
    assert r.status_code == 403


def test_duplicate_registration_number_rejected(client):
    client.post("/api/auth/company/register", json=COMPANY)
    client.post(
        "/api/auth/company/verify-email",
        json={"email": COMPANY["email"], "otp": "123456"},
    )
    other = {**COMPANY, "email": "other@acme.com"}
    assert client.post("/api/auth/company/register", json=other).status_code == 409


def test_admin_login_wrong_password(client):
    r = client.post(
        "/api/admin/login",
        json={"email": "admin@example.com", "password": "WrongPass1"},
    )
    assert r.status_code == 401


def test_admin_approves_company(client, sent_emails):
    token = company_token(client)
    h = admin_headers(client)
    listing = client.get("/api/admin/companies", headers=h).json()
    assert listing["total"] == 1
    cid = listing["items"][0]["id"]

    r = client.patch(
        f"/api/admin/companies/{cid}/status", headers=h, json={"status": "approved"}
    )
    assert r.status_code == 200 and r.json()["status"] == "approved"

    me = client.get(
        "/api/auth/company/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert me.json()["status"] == "approved"
    assert any("approved" in subject for _, subject, _ in sent_emails)


def test_admin_cannot_approve_unverified_company(client):
    client.post("/api/auth/company/register", json=COMPANY)
    h = admin_headers(client)
    cid = client.get("/api/admin/companies", headers=h).json()["items"][0]["id"]
    r = client.patch(
        f"/api/admin/companies/{cid}/status", headers=h, json={"status": "approved"}
    )
    assert r.status_code == 400


def test_company_token_cannot_use_admin_api(client):
    token = company_token(client)
    r = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_admin_stats(client):
    r = client.get("/api/admin/stats", headers=admin_headers(client))
    assert r.status_code == 200 and r.json()["candidates"] == 0

