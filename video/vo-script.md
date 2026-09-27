# Remnant explainer: voiceover

Timestamps are file time in `video/explainer.mp4` (44.0s, 1080p24). The file opens and closes on 1s of black, so the first line starts at 0:01. Word counts assume about 2.6 words a second, with room to breathe.

| Time | On screen | Voiceover |
|---|---|---|
| 0:01-0:11 | Four app clips: the last message, typing, bursts, the call | That was Remnant. It starts from her last message. She types the way she typed, in short bursts, and when you call, it's her voice. |
| 0:11-0:25 | GBrain, River AI, ElevenLabs columns; "runs on your machine" at 0:17 | The memory is GBrain: 78 facts, each with a source. The model is Qwen, fine-tuned on her messages through River. The voice is an ElevenLabs clone, and it needs consent first. |
| 0:25-0:31 | Guardrails typing in as a log | I know this sounds like Black Mirror's Be Right Back. So I gave it rules. |
| 0:31-0:35 | "we didn't soften it. we made it honest about what it is." | (silence, let the line sit) |
| 0:35-0:43 | REMNANT resolves from hex; "own your intelligence" at 0:37 | The theme is Own Your Intelligence. You keep the brain and the weights. |

Numbers on screen, for reference: 78/78 facts inserted into GBrain (docs/DECISIONS.md); River LoRA on Qwen/Qwen3.8-27B-FP8, 36 steps, 95 examples, loss 4.1926 at step 1 and 0.7534 at step 36 (training/runs/latest.json, train.stdout.log).
