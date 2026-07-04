#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
import argparse


class SPARequestHandler(SimpleHTTPRequestHandler):
    def _should_fallback_to_index(self, request_path: str) -> bool:
        path_only = urlparse(request_path).path
        local_path = Path(self.translate_path(path_only))

        if local_path.exists() and local_path.is_file():
            return False

        # Fallback for app routes like /video/<id>/<slug> and any extension-less route.
        route_name = Path(path_only).name
        return "." not in route_name

    def do_GET(self):
        if self._should_fallback_to_index(self.path):
            self.path = "/index.html"
        return super().do_GET()

    def do_HEAD(self):
        if self._should_fallback_to_index(self.path):
            self.path = "/index.html"
        return super().do_HEAD()


def main():
    parser = argparse.ArgumentParser(description="Serve static files with SPA fallback")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind")
    parser.add_argument("--port", type=int, default=5500, help="Port to bind")
    args = parser.parse_args()

    with ThreadingHTTPServer((args.host, args.port), SPARequestHandler) as server:
        print(f"Serving SPA on http://{args.host}:{args.port}")
        server.serve_forever()


if __name__ == "__main__":
    main()
