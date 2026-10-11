"""A stand-in for Supabase's PostgREST root, so the readiness probe has a
dependency to call during a local load test. It answers 200 to everything.
It is not a model of Supabase's latency: the readiness numbers in
docs/perf/LOAD_TEST.md measure this app plus a loopback stub, nothing more."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = b"{}"
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 54321), Handler).serve_forever()
