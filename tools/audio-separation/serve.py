"""Run the Worship audio separator on this computer only."""

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
import struct
from threading import Lock
from urllib.parse import urlsplit

from separate import create_session, encode_stems, read_mix, separate


PORT = 4381
INPUT_LIMIT = 64 * 1024 * 1024


def build_handler(origin, infer):
    active = Lock()

    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            self.request.settimeout(15)
            super().setup()

        def allowed(self):
            return self.headers.get('Host') == f'127.0.0.1:{self.server.server_port}' and self.headers.get('Origin') == origin

        def reply(self, code, length=0):
            self.send_response(code)
            if self.allowed():
                self.send_header('Access-Control-Allow-Origin', origin)
                self.send_header('Access-Control-Allow-Methods', 'POST')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Vary', 'Origin')
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Length', str(length))
            self.end_headers()

        def do_OPTIONS(self):
            self.reply(204 if self.allowed() and self.path == '/separate' else 403)

        def do_POST(self):
            if not self.allowed():
                self.reply(403)
                return
            if self.path != '/separate':
                self.reply(404)
                return
            if self.headers.get('Content-Type') != 'application/octet-stream':
                self.reply(415)
                return
            try:
                size = int(self.headers.get('Content-Length', '0'))
            except ValueError:
                size = 0
            if not 0 < size <= INPUT_LIMIT:
                self.reply(413)
                return
            if not active.acquire(blocking=False):
                self.reply(409)
                return
            try:
                self.process(size)
            except (ConnectionError, TimeoutError):
                pass
            finally:
                active.release()

        def process(self, size):
            raw = self.rfile.read(size)
            if len(raw) != size:
                self.reply(400)
                return
            try:
                mix = read_mix(BytesIO(raw))
            except (ValueError, EOFError):
                self.reply(422)
                return
            try:
                vocals, backing = separate(mix, infer, lambda *_: None)
                left, right = BytesIO(), BytesIO()
                encode_stems(vocals, backing, left, right)
            except Exception as error:
                self.log_error('%s', error)
                self.reply(500)
                return
            voice, accompaniment = left.getbuffer(), right.getbuffer()
            self.request.settimeout(60)
            self.reply(200, 4 + len(voice) + len(accompaniment))
            self.wfile.write(struct.pack('<I', len(voice)))
            self.wfile.write(voice)
            self.wfile.write(accompaniment)

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', type=Path, required=True)
    parser.add_argument('--origin', required=True, help='Exact origin of the Worship web app')
    args = parser.parse_args()
    origin = urlsplit(args.origin)
    if origin.path or origin.query or origin.fragment or origin.username is not None or not origin.hostname or not (
        origin.scheme == 'https' or (origin.scheme == 'http' and origin.hostname in ('localhost', '127.0.0.1'))
    ):
        parser.error('Use an exact HTTPS origin or a localhost development origin')
    session = create_session(args.model)
    handler = build_handler(args.origin, lambda spec: session.run(['mask'], {'spec': spec})[0])
    with ThreadingHTTPServer(('127.0.0.1', PORT), handler) as server:
        print(f'Worship separator ready for {args.origin}', flush=True)
        server.serve_forever()


if __name__ == '__main__':
    main()
