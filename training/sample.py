"""Sample one reply from the trained adapter.

    .venv/bin/python training/sample.py "did you make it to dani on tuesday?"
    .venv/bin/python training/sample.py --checkpoint river://... --base-model Qwen/Qwen3.8-27B-FP8 "hey"
"""
from __future__ import annotations

import argparse

from common import SYSTEM_PREFIX, load_api_key, load_latest, make_renderer, strip_thinking


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("text")
    ap.add_argument("--checkpoint")
    ap.add_argument("--base-model")
    ap.add_argument("--max-tokens", type=int, default=80)
    ap.add_argument("--temperature", type=float, default=0.7)
    args = ap.parse_args()

    if not (args.checkpoint and args.base_model):
        latest = load_latest()
        args.checkpoint = args.checkpoint or latest["checkpoint"]
        args.base_model = args.base_model or latest["base_model"]

    import river_client as river

    renderer = make_renderer(args.base_model)
    prompt = renderer.build_sample_prompt(
        [{"role": "system", "content": SYSTEM_PREFIX}, {"role": "user", "content": args.text}]
    ).to_kwargs()["prompt"]
    client = river.Client(api_key=load_api_key(), endpoint="api.river.ai")
    with client.session(project="remnant", purpose="sample") as session:
        out = session.sample(
            prompt,
            base_model=args.base_model,
            checkpoint=args.checkpoint,
            max_tokens=args.max_tokens,
            temperature=args.temperature,
            stop=renderer.get_stop_strings(),
        )
    print(strip_thinking(out[0][0].text))


if __name__ == "__main__":
    main()
