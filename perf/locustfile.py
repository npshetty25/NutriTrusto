"""Synthetic load test for the Next.js app.

Targets only endpoints that need no sign-in and call no paid API:
the liveness and readiness probes, the login page, the web manifest and the
offline page. The Gemini-backed routes are deliberately NOT exercised: they
need a valid Supabase token and every hit costs quota.

    locust -f perf/locustfile.py --host http://localhost:3100 \
           --headless -u 50 -r 10 -t 60s --csv perf/results/run
"""
import os

from locust import HttpUser, between, constant, task

# LT_NO_WAIT=1 removes think time, turning the run into a saturation test.
_WAIT = constant(0) if os.environ.get("LT_NO_WAIT") else between(0.2, 1.0)


class Visitor(HttpUser):
    wait_time = _WAIT

    @task(5)
    def liveness(self):
        self.client.get("/api/health?probe=live", name="/api/health?probe=live")

    @task(3)
    def readiness(self):
        self.client.get("/api/health", name="/api/health")

    @task(4)
    def login_page(self):
        self.client.get("/login", name="/login")

    @task(1)
    def manifest(self):
        self.client.get("/manifest.webmanifest", name="/manifest.webmanifest")

    @task(1)
    def offline_page(self):
        self.client.get("/offline.html", name="/offline.html")
