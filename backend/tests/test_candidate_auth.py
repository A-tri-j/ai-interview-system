CAND = {
    "full_name": "Test User",
    "email": "test@example.com",
    "phone": "+8801700000000",
    "password": "Test1234",
    "confirm_password": "Test1234",
}
LOGIN = {"email": CAND["email"], "password": CAND["password"]}


def register_and_verify(client):
    assert client.post("/api/auth/candidate/register", json=CAND).status_code == 201
    r = client.post(
        "/api/auth/candidate/verify-email",
        json={"email": CAND["email"], "otp": "123456"},
    )
    assert r.status_code == 200


def test_register_sends_otp_email(client, sent_emails):
    assert client.post("/api/auth/candidate/register", json=CAND).status_code == 201
    assert sent_emails[0][0] == CAND["email"]


def test_password_mismatch_rejected(client):
    bad = {**CAND, "confirm_password": "Different1"}
    assert client.post("/api/auth/candidate/register", json=bad).status_code == 422


def test_login_blocked_until_verified(client):
    client.post("/api/auth/candidate/register", json=CAND)
    assert client.post("/api/auth/candidate/login", json=LOGIN).status_code == 403


def test_full_flow_and_me(client):
    register_and_verify(client)
    r = client.post("/api/auth/candidate/login", json=LOGIN)
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = client.get(
        "/api/auth/candidate/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert me.status_code == 200 and me.json()["email"] == CAND["email"]


def test_duplicate_verified_account_rejected(client):
    register_and_verify(client)
    assert client.post("/api/auth/candidate/register", json=CAND).status_code == 409


def test_wrong_otp_rejected(client):
    client.post("/api/auth/candidate/register", json=CAND)
    r = client.post(
        "/api/auth/candidate/verify-email",
        json={"email": CAND["email"], "otp": "000000"},
    )
    assert r.status_code == 400


def test_me_without_token_is_401(client):
    assert client.get("/api/auth/candidate/me").status_code == 401


def test_login_rate_limit(client):
    register_and_verify(client)
    bad = {"email": CAND["email"], "password": "WrongPass1"}
    codes = [
        client.post("/api/auth/candidate/login", json=bad).status_code for _ in range(6)
    ]
    assert codes[:5] == [401] * 5 and codes[5] == 429

