from tests.conftest import sign_in, sign_up


def add_member(api, name, *, email=None, phone=None, level="employee", role_ids=()):
    response = api.post(
        "/api/members",
        {
            "full_name": name,
            "email": email,
            "phone": phone,
            "password": "password-123",
            "access_level": level,
            "role_ids": list(role_ids),
        },
    )
    return response


def test_signup_makes_the_owner_and_login_works(client):
    owner = sign_up(client)
    me = owner.get("/api/auth/me").json()
    assert me["user"]["access_level"] == "owner"
    assert me["organization"]["name"] == "Test Co"
    assert me["organization"]["timezone"] == "Asia/Kolkata"
    sign_in(client, "OWNER@example.com")

    bad = client.post("/api/auth/login", json={"identifier": "owner@example.com", "password": "wrong-pass"})
    assert bad.status_code == 401


def test_signup_rejects_duplicate_email(client):
    sign_up(client)
    again = client.post(
        "/api/auth/signup",
        json={"organization_name": "B", "full_name": "B", "email": "owner@example.com", "password": "password-123"},
    )
    assert again.status_code == 409


def test_owner_adds_supervisors_and_supervisors_cannot(client):
    owner = sign_up(client)
    assert add_member(owner, "Sam Supervisor", email="sam@example.com", level="supervisor").status_code == 201
    supervisor = sign_in(client, "sam@example.com")

    assert add_member(supervisor, "Another", email="x@example.com", level="supervisor").status_code == 403
    assert add_member(supervisor, "Erin Employee", phone="+91 98765 43210").status_code == 201

    # Phone sign-in works with or without spacing.
    sign_in(client, "+919876543210")

    employee = sign_in(client, "+91 98765 43210")
    assert employee.get("/api/members").status_code == 403


def test_owner_can_promote_and_demote(client):
    owner = sign_up(client)
    erin = add_member(owner, "Erin", email="erin@example.com").json()
    promoted = owner.patch(f"/api/members/{erin['id']}", {"access_level": "supervisor"})
    assert promoted.json()["access_level"] == "supervisor"
    demoted = owner.patch(f"/api/members/{erin['id']}", {"access_level": "employee"})
    assert demoted.json()["access_level"] == "employee"


def test_member_needs_email_or_phone(client):
    owner = sign_up(client)
    assert add_member(owner, "Nobody").status_code == 422


def test_role_task_flow_with_completion_undo_and_report(client):
    owner = sign_up(client)
    role = owner.post("/api/roles", {"name": "Barista"}).json()
    add_member(owner, "Erin", email="erin@example.com", role_ids=[role["id"]])
    add_member(owner, "Kai", email="kai@example.com")  # not a barista
    task = owner.post(
        "/api/tasks", {"title": "Clean the steam wand", "role_id": role["id"], "recurrence": "daily"}
    ).json()

    erin = sign_in(client, "erin@example.com")
    day = erin.get("/api/me/day").json()
    assert [o["task"]["title"] for o in day["occurrences"]] == ["Clean the steam wand"]
    occurrence = day["occurrences"][0]
    assert occurrence["status"] == "pending" and occurrence["can_complete"]

    kai = sign_in(client, "kai@example.com")
    assert kai.get("/api/me/day").json()["occurrences"] == []

    done = erin.post(
        "/api/me/completions", {"task_id": task["id"], "period_date": occurrence["period_date"], "note": "All good"}
    )
    assert done.status_code == 201, done.text
    assert done.json()["status"] == "done"
    again = erin.post("/api/me/completions", {"task_id": task["id"], "period_date": occurrence["period_date"]})
    assert again.status_code == 409

    # Kai isn't assigned, so he can't complete it.
    assert kai.post("/api/me/completions", {"task_id": task["id"], "period_date": occurrence["period_date"]}).status_code == 404

    report = erin.get("/api/me/report").json()
    assert report["summary"]["done"] == 1

    board = owner.get("/api/board").json()
    assert board["summary"]["done"] == 1
    assert [m["member"]["full_name"] for m in board["members"]] == ["Erin"]

    team = owner.get("/api/reports/team").json()
    assert team["summary"]["done"] == 1
    assert team["tasks"][0]["task"]["title"] == "Clean the steam wand"

    undone = erin.delete(f"/api/me/completions/{done.json()['completion']['id']}")
    assert undone.status_code == 200 and undone.json()["status"] == "pending"


def test_everyone_tasks_go_to_employees_only(client):
    owner = sign_up(client)
    add_member(owner, "Sam", email="sam@example.com", level="supervisor")
    add_member(owner, "Erin", email="erin@example.com")
    owner.post("/api/tasks", {"title": "Read the handbook"})
    assert len(sign_in(client, "erin@example.com").get("/api/me/day").json()["occurrences"]) == 1
    assert sign_in(client, "sam@example.com").get("/api/me/day").json()["occurrences"] == []


def test_completing_a_past_day_is_refused(client):
    owner = sign_up(client)
    erin_id = add_member(owner, "Erin", email="erin@example.com").json()["id"]
    task = owner.post("/api/tasks", {"title": "Daily check", "assignee_id": erin_id, "recurrence": "daily"}).json()
    erin = sign_in(client, "erin@example.com")
    response = erin.post("/api/me/completions", {"task_id": task["id"], "period_date": "2020-01-01"})
    assert response.status_code == 404


def test_task_validation(client):
    owner = sign_up(client)
    role = owner.post("/api/roles", {"name": "Kitchen"}).json()
    erin = add_member(owner, "Erin", email="erin@example.com").json()
    both = owner.post("/api/tasks", {"title": "x", "role_id": role["id"], "assignee_id": erin["id"]})
    assert both.status_code == 422
    window = owner.post("/api/tasks", {"title": "x", "start_time": "11:00", "end_time": "09:00"})
    assert window.status_code == 422
    no_days = owner.post("/api/tasks", {"title": "x", "recurrence": "specific_days", "days_of_week": []})
    assert no_days.status_code == 422
    ok = owner.post(
        "/api/tasks",
        {"title": "Restock", "recurrence": "specific_days", "days_of_week": [4, 0, 2, 2], "start_time": "09:00",
         "end_time": "11:00", "due_date": "2030-01-01"},
    ).json()
    assert ok["days_of_week"] == [0, 2, 4]
    assert ok["due_date"] is None  # only one-time tasks keep a due date


def test_role_with_tasks_cannot_be_deleted(client):
    owner = sign_up(client)
    role = owner.post("/api/roles", {"name": "Kitchen"}).json()
    task = owner.post("/api/tasks", {"title": "Prep", "role_id": role["id"]}).json()
    assert owner.delete(f"/api/roles/{role['id']}").status_code == 409
    owner.delete(f"/api/tasks/{task['id']}")
    assert owner.delete(f"/api/roles/{role['id']}").status_code == 204


def test_duplicate_role_names_are_rejected_case_insensitively(client):
    owner = sign_up(client)
    owner.post("/api/roles", {"name": "Kitchen"})
    assert owner.post("/api/roles", {"name": "kitchen"}).status_code == 409


def test_organizations_are_isolated(client):
    first = sign_up(client)
    task = first.post("/api/tasks", {"title": "Secret"}).json()
    role = first.post("/api/roles", {"name": "Kitchen"}).json()
    second = sign_up(client, email="other@example.com", org="Other Co")
    assert second.get(f"/api/tasks/{task['id']}").status_code == 404
    assert second.get("/api/tasks").json() == []
    assert second.post("/api/tasks", {"title": "x", "role_id": role["id"]}).status_code == 422


def test_paused_tasks_leave_the_checklist(client):
    owner = sign_up(client)
    add_member(owner, "Erin", email="erin@example.com")
    task = owner.post("/api/tasks", {"title": "Daily check", "recurrence": "daily"}).json()
    owner.patch(f"/api/tasks/{task['id']}", {"is_active": False})
    assert sign_in(client, "erin@example.com").get("/api/me/day").json()["occurrences"] == []


def test_deactivated_people_cannot_sign_in(client):
    owner = sign_up(client)
    erin = add_member(owner, "Erin", email="erin@example.com").json()
    owner.patch(f"/api/members/{erin['id']}", {"is_active": False})
    response = client.post("/api/auth/login", json={"identifier": "erin@example.com", "password": "password-123"})
    assert response.status_code == 403
