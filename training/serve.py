"""HTTP sidecar that serves the Sarah LoRA adapter to the Bun API server.

River's client is Python/gRPC, so inference from the adapter lives here. One
River session is held open (checkpoint sampling is stateless per request:
the server loads the LoRA, generates, and unloads) and re-opened on failure.

    .venv/bin/python training/serve.py            # port 8765, reads runs/latest.json
    curl localhost:8765/health
    curl -X POST localhost:8765/sample -d '{"system":"...","turns":[{"role":"user","content":"hey"}]}'
"""
from __future__ import annotations

import argparse
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from common import load_api_key, load_latest, make_renderer, strip_thinking


class AdapterSampler:
    def __init__(self, base_model: str, checkpoint: str) -> None:
        import river_client as river

        self.river = river
        self.base_model = base_model
        self.checkpoint = checkpoint
        self.renderer = make_renderer(base_model)
        self.client = river.Client(api_key=load_api_key(), endpoint="api.river.ai")
        self._lock = threading.Lock()
        self._ctx = None
        self._session = None
        self._open()

    def _open(self) -> None:
        self._ctx = self.client.session(project="remnant", purpose="serve")
        self._session = self._ctx.__enter__()

    def close(self) -> None:
        if self._ctx is not None:
            self._ctx.__exit__(None, None, None)
            self._ctx = None
            self._session = None

    def sample(self, system: str, turns: list[dict], max_tokens: int, temperature: float) -> str:
        messages = [{"role": "system", "content": system}] + [
            {"role": t["role"], "content": t["content"]} for t in turns if t.get("role") in ("user", "assistant")
        ]
        prompt = self.renderer.build_sample_prompt(messages).to_kwargs()["prompt"]
        with self._lock:
            for attempt in range(2):
                try:
                    out = self._session.sample(
                        prompt,
                        base_model=self.base_model,
                        checkpoint=self.checkpoint,
                        max_tokens=max_tokens,
                        temperature=temperature,
                        stop=self.renderer.get_stop_strings(),
                    )
                    return strip_thinking(out[0][0].text)
                except (self.river.SessionHeartbeatError, self.river.RiverConnectionError):
                    if attempt == 1:
                        raise
                    self.close()
                    self._open()
        raise RuntimeError("unreachable")


def make_handler(sampler: AdapterSampler):
    class Handler(BaseHTTPRequestHandler):
        def _json(self, status: int, body: dict) -> None:
            data = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self) -> None:  # noqa: N802
            if self.path == "/health":
                self._json(200, {"ok": True, "checkpoint": sampler.checkpoint, "base_model": sampler.base_model})
            else:
                self._json(404, {"error": "not found"})

        def do_POST(self) -> None:  # noqa: N802
            if self.path != "/sample":
                self._json(404, {"error": "not found"})
                return
            length = int(self.headers.get("content-length", "0"))
            try:
                body = json.loads(self.rfile.read(length) or b"{}")
                text = sampler.sample(
                    system=body.get("system", ""),
                    turns=body.get("turns", []),
                    max_tokens=int(body.get("max_tokens", 120)),
                    temperature=float(body.get("temperature", 0.8)),
                )
                self._json(200, {"text": text})
            except Exception as e:  # noqa: BLE001
                self._json(500, {"error": f"{type(e).__name__}: {str(e)[:300]}"})

        def log_message(self, fmt: str, *args) -> None:  # quieter
            print(f"[serve] {fmt % args}", flush=True)

    return Handler


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--checkpoint")
    ap.add_argument("--base-model")
    args = ap.parse_args()
    if not (args.checkpoint and args.base_model):
        latest = load_latest()
        args.checkpoint = args.checkpoint or latest["checkpoint"]
        args.base_model = args.base_model or latest["base_model"]
    sampler = AdapterSampler(args.base_model, args.checkpoint)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(sampler))
    print(f"[serve] adapter {args.checkpoint} on {args.base_model} at http://127.0.0.1:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        sampler.close()


if __name__ == "__main__":
    main()
