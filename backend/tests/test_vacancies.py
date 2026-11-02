from tests.helpers import COMPANY_B, company_headers, create_vacancy, days, publish


def test_draft_is_not_public(client):
    h = company_headers(client)
    v = create_vacancy(client, h)
    assert v["status"] == "draft"
    assert client.get("/api/vacancies").json()["total"] == 0
    assert client.get(f"/api/vacancies/{v['id']}").status_code == 404


def test_unapproved_company_cannot_publish(client):
    h = company_headers(client, approve=False)
    v = create_vacancy(client, h)
    assert publish(client, h, v["id"]).status_code == 403


def test_published_vacancy_is_public_without_secrets(client):
    h = company_headers(client)
    v = create_vacancy(client, h)
    assert publish(client, h, v["id"]).status_code == 200

    listing = client.get("/api/vacancies").json()
    assert listing["total"] == 1
    item = listing["items"][0]
    assert item["company"]["company_name"] == "Acme Ltd"
    # Private tothyo public-e jabe na
    assert "interview_instructions" not in item
    assert "email" not in item["company"] and "phone" not in item["company"]
    assert client.get(f"/api/vacancies/{v['id']}").status_code == 200


def test_search_and_filters(client):
    h = company_headers(client)
    a = create_vacancy(client, h)
    b = create_vacancy(
        client,
        h,
        title="Python Backend Developer",
        required_skills=["Python", "FastAPI"],
        required_technologies=[],
        work_mode="onsite",
        location="Mumbai",
        employment_type="contract",
    )
    publish(client, h, a["id"])
    publish(client, h, b["id"])

    def titles(**params):
        return [
            i["title"]
            for i in client.get("/api/vacancies", params=params).json()["items"]
        ]

    assert titles(q="fastapi") == ["Python Backend Developer"]  # skill diye
    assert titles(q="acme") and len(titles(q="acme")) == 2  # company diye
    assert titles(q="React.js") == ["Frontend Developer"]
    assert titles(work_mode="onsite") == ["Python Backend Developer"]
    assert titles(location="kolkata") == ["Frontend Developer"]
    assert titles(employment_type="contract") == ["Python Backend Developer"]
    assert titles(q="%") == []  # wildcard kaj korbe na


def test_expired_vacancy_hidden_and_cannot_publish(client):
    h = company_headers(client)
    v = create_vacancy(client, h, deadline=days(-1))
    assert publish(client, h, v["id"]).status_code == 400
    ok = create_vacancy(client, h, deadline=days(5))
    assert publish(client, h, ok["id"]).status_code == 200
    assert client.get("/api/vacancies").json()["total"] == 1


def test_close_hides_vacancy(client):
    h = company_headers(client)
    v = create_vacancy(client, h)
    publish(client, h, v["id"])
    assert (
        client.post(f"/api/company/vacancies/{v['id']}/close", headers=h).status_code
        == 200
    )
    assert client.get("/api/vacancies").json()["total"] == 0


def test_update_vacancy(client):
    h = company_headers(client)
    v = create_vacancy(client, h)
    r = client.patch(
        f"/api/company/vacancies/{v['id']}",
        headers=h,
        json={
            "title": "Senior Frontend Developer",
            "required_skills": ["React", " react "],
        },
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Senior Frontend Developer"
    assert r.json()["required_skills"] == ["React"]  # duplicate bad gelo
    bad = client.patch(
        f"/api/company/vacancies/{v['id']}", headers=h, json={"title": None}
    )
    assert bad.status_code == 422


def test_company_cannot_touch_other_company_vacancy(client):
    a = company_headers(client)
    v = create_vacancy(client, a)
    b = company_headers(client, data=COMPANY_B)
    url = f"/api/company/vacancies/{v['id']}"
    assert client.get(url, headers=b).status_code == 404
    assert (
        client.patch(url, headers=b, json={"title": "Hacked title"}).status_code == 404
    )
    assert publish(client, b, v["id"]).status_code == 404
    assert client.post(f"{url}/close", headers=b).status_code == 404
    assert client.get("/api/company/vacancies", headers=b).json()["total"] == 0


def test_vacancy_api_requires_company_token(client):
    assert client.post("/api/company/vacancies", json={}).status_code == 401
    assert client.get("/api/company/vacancies").status_code == 401


def test_validation_errors(client):
    h = company_headers(client)
    r = client.post(
        "/api/company/vacancies",
        headers=h,
        json={"title": "x", "description": "short"},
    )
    assert r.status_code == 422

