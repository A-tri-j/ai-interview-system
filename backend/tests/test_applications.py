from tests.helpers import (
    COMPANY_B,
    PDF,
    apply,
    candidate_headers,
    company_headers,
    create_vacancy,
    publish,
    published_vacancy,
)


def setup_one(client):
    """Company + published vacancy + candidate + ekta application."""
    ch = company_headers(client)
    v = published_vacancy(client, ch)
    cand = candidate_headers(client)
    r = apply(client, cand, v["id"])
    assert r.status_code == 201, r.text
    return ch, cand, v, r.json()["id"]


def test_apply_requires_login(client):
    ch = company_headers(client)
    v = published_vacancy(client, ch)
    assert client.post("/api/applications", data={"vacancy_id": v["id"]}).status_code == 401


def test_apply_sends_confirmation_and_blocks_duplicate(client, sent_emails):
    ch, cand, v, _ = setup_one(client)
    assert any("Application received" in s for _, s, _ in sent_emails)
    assert apply(client, cand, v["id"]).status_code == 409


def test_cannot_apply_to_draft_vacancy(client):
    ch = company_headers(client)
    draft = create_vacancy(client, ch)
    cand = candidate_headers(client)
    assert apply(client, cand, draft["id"]).status_code == 404


def test_bad_files_rejected(client):
    ch = company_headers(client)
    v = published_vacancy(client, ch)
    cand = candidate_headers(client)
    exe = ("virus.exe", b"MZ....", "application/octet-stream")
    fake_pdf = ("cv.pdf", b"this is not a pdf", "application/pdf")
    big_pdf = ("cv.pdf", b"%PDF-" + b"0" * (6 * 1024 * 1024), "application/pdf")
    assert apply(client, cand, v["id"], file=exe).status_code == 400
    assert apply(client, cand, v["id"], file=fake_pdf).status_code == 400
    assert apply(client, cand, v["id"], file=big_pdf).status_code == 413
    assert apply(client, cand, v["id"], file=None).status_code == 400  # CV nei


def test_candidate_sees_status_but_not_notes(client):
    ch, cand, v, app_id = setup_one(client)
    client.patch(
        f"/api/company/applications/{app_id}/status",
        headers=ch,
        json={"status": "under_review", "note": "internal only"},
    )
    item = client.get("/api/applications/mine", headers=cand).json()["items"][0]
    assert item["status"] == "under_review"
    assert item["job_title"] == "Frontend Developer"
    assert "company_notes" not in item and "note" not in item


def test_company_sees_only_own_applications(client):
    ch, cand, v, app_id = setup_one(client)
    other = company_headers(client, data=COMPANY_B)
    assert client.get("/api/company/applications", headers=other).json()["total"] == 0
    assert client.get(f"/api/company/applications/{app_id}", headers=other).status_code == 404
    assert client.get(f"/api/company/applications/{app_id}/cv", headers=other).status_code == 404
    r = client.patch(
        f"/api/company/applications/{app_id}/status",
        headers=other,
        json={"status": "approved_for_interview"},
    )
    assert r.status_code == 404


def test_company_can_read_application_and_download_cv(client):
    ch, cand, v, app_id = setup_one(client)
    detail = client.get(f"/api/company/applications/{app_id}", headers=ch).json()
    assert detail["applicant_name"] == "Test Candidate"
    cv = client.get(f"/api/company/applications/{app_id}/cv", headers=ch)
    assert cv.status_code == 200 and cv.content.startswith(b"%PDF-")
    assert client.get(f"/api/company/applications/{app_id}/cv").status_code == 401


def test_approve_sends_invite_once(client, sent_emails):
    ch, cand, v, app_id = setup_one(client)
    url = f"/api/company/applications/{app_id}/status"
    r = client.patch(url, headers=ch, json={"status": "approved_for_interview"})
    assert r.status_code == 200 and r.json()["changed"] is True
    invites = [e for e in sent_emails if "Interview invitation" in e[1]]
    assert len(invites) == 1
    assert "/interview/" in invites[0][2] and "Acme Ltd" in invites[0][1]
    # Ekই status abar dile notun email jabe na
    again = client.patch(url, headers=ch, json={"status": "approved_for_interview"})
    assert again.json()["changed"] is False
    assert len([e for e in sent_emails if "Interview invitation" in e[1]]) == 1


def test_reject_sends_no_email_by_default(client, sent_emails):
    ch, cand, v, app_id = setup_one(client)
    before = len(sent_emails)
    r = client.patch(
        f"/api/company/applications/{app_id}/status",
        headers=ch,
        json={"status": "rejected"},
    )
    assert r.status_code == 200
    assert len(sent_emails) == before
    mine = client.get("/api/applications/mine", headers=cand).json()["items"][0]
    assert mine["status"] == "rejected"


def test_invalid_status_transition(client):
    ch, cand, v, app_id = setup_one(client)
    url = f"/api/company/applications/{app_id}/status"
    client.patch(url, headers=ch, json={"status": "rejected"})
    r = client.patch(url, headers=ch, json={"status": "approved_for_interview"})
    assert r.status_code == 400


def test_profile_update_and_cv_upload(client):
    cand = candidate_headers(client)
    r = client.put(
        "/api/candidates/me/profile",
        headers=cand,
        json={
            "education": "BSc",
            "skills": ["React", "react", "Python"],
            "portfolio_url": "https://me.dev",
        },
    )
    assert r.status_code == 200 and r.json()["skills"] == ["React", "Python"]
    up = client.post("/api/candidates/me/cv", headers=cand, files={"cv": PDF})
    assert up.status_code == 201
    prof = client.get("/api/candidates/me/profile", headers=cand).json()
    assert len(prof["documents"]) == 1
    bad = client.put(
        "/api/candidates/me/profile",
        headers=cand,
        json={"portfolio_url": "javascript:alert(1)"},
    )
    assert bad.status_code == 422


def test_change_password(client):
    cand = candidate_headers(client)
    wrong = client.post(
        "/api/candidates/me/change-password",
        headers=cand,
        json={
            "current_password": "Wrong1234",
            "new_password": "NewPass1234",
            "confirm_password": "NewPass1234",
        },
    )
    assert wrong.status_code == 400
    ok = client.post(
        "/api/candidates/me/change-password",
        headers=cand,
        json={
            "current_password": "Test1234",
            "new_password": "NewPass1234",
            "confirm_password": "NewPass1234",
        },
    )
    assert ok.status_code == 200
    login = client.post(
        "/api/auth/candidate/login",
        json={"email": "cand@example.com", "password": "NewPass1234"},
    )
    assert login.status_code == 200

