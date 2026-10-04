# SPDX-License-Identifier: GPL-3.0-or-later
"""Bounded, single-job Blender conversion service. No network or user scripts."""
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from urllib.parse import parse_qs, quote, urlparse

MAX_SOURCE = 80 * 1024 * 1024
MAX_UNPACKED = 512 * 1024 * 1024
MAX_OUTPUT = 32 * 1024 * 1024
FORMATS = {"blend", "fbx", "obj", "gltf", "glb", "stl", "ply", "usd", "usda", "usdc", "usdz"}
BUSY = threading.Lock()


def unpack(archive, folder):
    candidates = []
    with zipfile.ZipFile(archive) as package:
        if len(package.infolist()) > 4096:
            raise ValueError("This ZIP contains too many files. Upload one asset package.")
        total = 0
        for entry in package.infolist():
            name = PurePosixPath(entry.filename)
            if name.is_absolute() or ".." in name.parts or "\\" in entry.filename or ((entry.external_attr >> 16) & 0o170000) == 0o120000:
                raise ValueError("The ZIP contains an unsafe path or symbolic link.")
            if len(entry.filename) > 500:
                raise ValueError("The ZIP contains an overly long path.")
            total += entry.file_size
            if total > MAX_UNPACKED or entry.file_size > 256 * 1024 * 1024:
                raise ValueError("Keep extracted asset packages under 512 MB, with each file under 256 MB.")
            output = folder.joinpath(*name.parts)
            if entry.is_dir():
                output.mkdir(parents=True, exist_ok=True)
                continue
            output.parent.mkdir(parents=True, exist_ok=True)
            with package.open(entry) as source, output.open("xb") as target:
                copied = 0
                while chunk := source.read(1024 * 1024):
                    copied += len(chunk)
                    if copied > entry.file_size:
                        raise ValueError("The ZIP is invalid.")
                    target.write(chunk)
            if "__MACOSX" not in name.parts and output.suffix.lstrip(".").lower() in FORMATS:
                candidates.append(output)
    for formats in [{"blend"}, {"glb", "gltf"}, {"fbx"}, {"obj"}, {"usd", "usda", "usdc", "usdz", "stl", "ply"}]:
        matching = [p for p in candidates if p.suffix.lstrip(".").lower() in formats]
        if len(matching) > 1:
            raise ValueError("The ZIP contains several models. Upload a ZIP containing the model you want and its textures.")
        if matching:
            return matching[0]
    raise ValueError("The ZIP does not contain a supported model.")


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, data, mime="application/json", headers=None):
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            self.reply(200, b'{"ok":true}')
        else:
            self.reply(404, b'{"error":"Not found"}')

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/convert":
            self.reply(404, b'{"error":"Not found"}')
            return
        if not BUSY.acquire(blocking=False):
            self.reply(429, b'{"error":"Another model is being converted."}')
            return
        try:
            self.connection.settimeout(60)
            started = time.monotonic()
            extension = parse_qs(parsed.query).get("format", [""])[0]
            length = int(self.headers.get("Content-Length", "0"))
            if extension not in FORMATS | {"zip"} or not 0 < length <= MAX_SOURCE:
                raise ValueError("Upload a supported model or asset ZIP up to 80 MB.")
            with tempfile.TemporaryDirectory(prefix="tana-convert-") as temporary:
                folder = Path(temporary)
                source = folder / ("source." + extension)
                with source.open("wb") as output:
                    remaining = length
                    while remaining:
                        chunk = self.rfile.read(min(remaining, 1024 * 1024))
                        if not chunk:
                            raise ValueError("The uploaded asset is incomplete.")
                        output.write(chunk)
                        remaining -= len(chunk)
                if extension == "zip":
                    source = unpack(source, folder / "asset")
                model, report, log = folder / "model.glb", folder / "result.json", folder / "log.txt"
                env = dict(os.environ, BLENDER_USER_RESOURCES=str(folder / "preferences"))
                with log.open("wb") as output:
                    process = subprocess.Popen([sys.executable, "-I", str(Path(__file__).with_name("convert.py")), str(source), str(model), str(report)], stdin=subprocess.DEVNULL, stdout=output, stderr=output, env=env)
                    try:
                        while process.poll() is None:
                            if time.monotonic() - started > 300 or log.stat().st_size > 8 * 1024 * 1024:
                                raise ValueError("Conversion took too long or produced too many errors. Try a smaller asset.")
                            time.sleep(.1)
                    finally:
                        if process.poll() is None:
                            process.kill()
                        process.wait()
                if not report.is_file():
                    raise ValueError("Blender could not open this model. Check its file version and contents.")
                result = json.loads(report.read_text())
                if not result.get("ok") or process.returncode:
                    raise ValueError(result.get("error", "Conversion failed."))
                if not model.is_file() or model.stat().st_size > MAX_OUTPUT:
                    raise ValueError("The converted model exceeds 32 MB. Use smaller textures or a simpler model.")
                self.reply(200, model.read_bytes(), "model/gltf-binary", {"X-Conversion-Warnings": quote(json.dumps(result.get("warnings", []))), "X-Conversion-Ms": str(round((time.monotonic()-started)*1000))})
        except Exception as error:
            self.reply(400, json.dumps({"error": str(error)[:2000]}).encode())
        finally:
            BUSY.release()


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
