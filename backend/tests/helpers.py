from datetime import date, timedelta

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
COMPANY_B = {
    **COMPANY,
    "company_name": "Beta Corp",
    "email": "hr@beta.com",
    "registration_number": "REG-2002",
}

VACANCY = {
    "title": "Frontend Developer",
    "description": "Build modern web apps with React and JavaScript for our product team.",
    "required_skills": ["React.js", "JavaScript"],
    "required_technologies": ["REST APIs"],
    "employment_type": "full_time",
    "work_mode": "remote",
    "location": "Kolkata",
    "experience_requirements": "1-3 years",
    "openings": 2,
    "interview_instructions": "Focus on React hooks.",
}


def admin_headers(client):
    r = client.post(
        "/api/admin/login",
        json={"email": "admin@example.com", "password": "AdminPass123"},
    )
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def company_headers(client, data=COMPANY, approve=True):
    """Register, verify, login (OTP), tarpor chaile admin diye approve kore."""
    client.post("/api/auth/company/register", json=data)
    client.post(
        "/api/auth/company/verify-email", json={"email": data["email"], "otp": "123456"}
    )
    client.post(
        "/api/auth/company/login",
        json={"email": data["email"], "password": data["password"]},
    )
    r = client.post(
        "/api/auth/company/login/verify",
        json={"email": data["email"], "otp": "123456"},
    )
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    if approve:
        me = client.get("/api/auth/company/me", headers=headers).json()
        client.patch(
            f"/api/admin/companies/{me['id']}/status",
            headers=admin_headers(client),
            json={"status": "approved"},
        )
    return headers


def create_vacancy(client, headers, **overrides):
    r = client.post(
        "/api/company/vacancies", headers=headers, json={**VACANCY, **overrides}
    )
    assert r.status_code == 201, r.text
    return r.json()


def publish(client, headers, vacancy_id):
    return client.post(f"/api/company/vacancies/{vacancy_id}/publish", headers=headers)


def days(n: int) -> str:
    return (date.today() + timedelta(days=n)).isoformat()



PDF = ("cv.pdf", b"%PDF-1.4 fake cv content", "application/pdf")


def candidate_headers(client, email="cand@example.com"):
    data = {
        "full_name": "Test Candidate",
        "email": email,
        "phone": "+8801700000000",
        "password": "Test1234",
        "confirm_password": "Test1234",
    }
    client.post("/api/auth/candidate/register", json=data)
    client.post("/api/auth/candidate/verify-email", json={"email": email, "otp": "123456"})
    r = client.post(
        "/api/auth/candidate/login", json={"email": email, "password": "Test1234"}
    )
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def published_vacancy(client, company_h):
    v = create_vacancy(client, company_h)
    assert publish(client, company_h, v["id"]).status_code == 200
    return v


def apply(client, headers, vacancy_id, file=PDF, **over):
    form = {
        "vacancy_id": vacancy_id,
        "applicant_name": "Test Candidate",
        "applicant_email": "cand@example.com",
        "applicant_phone": "+8801700000000",
        "education": "BSc Computer Science",
        "message": "Hello",
    }
    form.update(over)
    return client.post(
        "/api/applications",
        headers=headers,
        data=form,
        files={"cv": file} if file else None,
    )
