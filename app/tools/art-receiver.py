"""Tiny local file receiver for the weapon-art export: POST /save?path=<relative path> with the file bytes as the body.
Only writes inside the output folder given on the command line."""
import os, sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = os.path.abspath(sys.argv[1])
os.makedirs(ROOT, exist_ok=True)


class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Private-Network', 'true')

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_POST(self):
        q = parse_qs(urlparse(self.path).query)
        rel = (q.get('path') or [''])[0]
        dest = os.path.abspath(os.path.join(ROOT, rel))
        if not rel or not dest.startswith(ROOT + os.sep):
            self.send_response(400); self._cors(); self.end_headers(); return
        n = int(self.headers.get('Content-Length') or 0)
        data = self.rfile.read(n)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, 'wb') as f:
            f.write(data)
        self.send_response(200); self._cors(); self.end_headers(); self.wfile.write(b'ok')

    def log_message(self, *a):
        pass


HTTPServer(('127.0.0.1', 5191), H).serve_forever()
