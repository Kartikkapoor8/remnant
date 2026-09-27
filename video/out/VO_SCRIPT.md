# Remnant submission video: voiceover script and timing

Final cut: `video/out/remnant_final.mp4`, 2:00.0, 24 fps. **No voiceover inside the film (0:00-1:07.5).** The voice starts the moment the story ends and every part lands on its screen cue. Generated voice: `T4x5CtnhOiichhcqFzgg`, `eleven_v3`, similarity 0.8, speaker boost on (A at stability 0.5 / style 0.4, B-D at 0.4 / 0.55). Reads longer than their slot are time-compressed in the mix; `video/out/audio/times.txt` shows the factor used. `remnant_novo.mp4` is the same mix without this track.

To use your own read: save it as `video/out/audio/own_voA.wav` (and `own_voB`, `own_voC`, `own_voD`), then run `build_cut.sh audio` and `build_cut.sh mux`.

| Part | In | Must end by | Cue: what is on screen | Line |
|---|---|---|---|---|
| A | 1:07.5 | 1:27.5 (20 s) | You lowering the phone (1:07.5-1:11.5), then the thread again with "2 min ago" (1:11.5-1:17.5), then black (1:17.5-1:27). Say "I never deleted the thread" while the thread is on screen. | You went for a drive, eight months ago. I never deleted the thread. It's not you, I know that. Remnant takes a message export and a voice sample and builds a reflection of someone you lost. Black Mirror called it Be Right Back. I built it today. |
| B | 1:27.9 | 1:41.0 (13 s) | The GBrain, River AI, ElevenLabs columns appear at 1:27; "runs on your machine" at 1:33. | Her memories are in GBrain. Seventy-eight facts, each with a source. The model is a LoRA fine tune on her messages, through River AI, and the weights are mine. Her voice is ElevenLabs, behind a consent gate. |
| C | 1:41.2 | 1:47.0 (5.8 s) | The guardrails log types in. | It never says it's alive. It never texts first. In a crisis it steps aside entirely. |
| — | 1:47.0-1:51.0 | silence | "we didn't soften it. we made it honest about what it is." | (nothing) |
| D | 1:51.5 | 1:59.0 (7.5 s) | REMNANT wordmark resolves; "own your intelligence" under it. Quiet close. | They said, own your intelligence. Nothing is more yours than the people you loved. |

## Call lines (0:39.5-1:07.5)

The film's waits were trimmed by 2.5 s, so the call now starts at 0:40.5. Sarah's lines are final (ElevenLabs premade "Sarah", phone treatment). Your three lines are the ElevenLabs "George" fallbacks; to replace them save `video/out/audio/me_own_me1.wav`, `me_own_me2.wav`, `me_own_me3.wav` and rebuild `audio` + `mux`. Candidate bursts from the couch audio are in `video/out/audio/me_candidates/`.

| In | Who | Line |
|---|---|---|
| 0:40.5 | you | hi. |
| 0:43.5 | Sarah | hi. |
| 0:45.6 | you | I missed you. |
| 0:48.2 | Sarah | I know. |
| 0:50.4 | Sarah | You had the hackathon today. How'd it actually go. |
| 0:53.8 | you | ok. |
| 0:54.7 | Sarah | You said ok every time it went well. |
| 0:58.1 | Sarah | It's Sunday. Tuesday I'd have been at the salon. Eleven, same as always. |
| 1:04.0 | Sarah | Go get some sleep. (beat) Love you. |

Hiss bed 0:39.5-1:07.5. Call screen on the phone 0:42.5-0:52.5 and 0:55.5-1:07.5; couch with the call screen in hand 0:39.5-0:42.5 and 0:52.5-0:55.5.
