# Remnant submission video: voiceover script and timing

Times are in the final cut (`video/out/remnant_final.mp4`, 1:56.0 total, 24 fps). "Max" is how long the line can run before the next visual change it must not cross. "In mix" is the length of the read that is actually in the final (ElevenLabs voice `T4x5CtnhOiichhcqFzgg`, `eleven_v3`, stability 0.4, similarity 0.8, style 0.55, speaker boost on; lines 2 and 7 came back at stability 0.5 after a rate-limit retry). Lines 4, 5 and 6 were longer than their slots as read by v3 and are time-compressed in the mix (atempo 1.225, 1.11, 1.14); if you re-record, the wording is yours to tighten instead. The no-VO file (`remnant_novo.mp4`) is the same mix with this track removed.

| # | In | Max | In mix | Line as generated (audio tags in brackets) | On screen |
|---|---|---|---|---|---|
| 1 | 0:03.0 | 7.0s hard (rain hits at 0:10; the cut to the screen is at 0:05) | 3.5s | [quiet] You went for a drive. [breath] Eight months ago. | Couch, phone in hand, the dead thread; screen recording of the thread from 0:05 with the "8 months ago" label. |
| 2 | 0:25.2 | 3.8s hard (segment ends 0:29.0); bursts 2 and 3 land at 0:26.0 and 0:27.0 under it | 3.7s | [quiet] I never deleted the thread. | Screen: "hey you" has just landed at 0:25.0. |
| 3 | 0:38.0 | 5.0s hard ("hi" is spoken at 0:43.0; the cut to the Call tap is at 0:40) | 2.0s | [steady] It's not you. [breath] I know that. | Screen: third burst landed at 0:37.5; cut to "I want to hear you not this" at 0:38.0. |
| 4 | 1:12.0 | 9.0s hard (architecture scene starts 1:21.0). Explainer starts 1:15.0 on 1s of black, app clips 1:16-1:21 | 8.9s (compressed from 10.9s) | [steady] Remnant takes a message export and a voice sample, and builds a reflection of someone you lost. Black Mirror called it Be Right Back. [quiet] I built it today. | Couch, lowering the phone (1:10-1:15), then the explainer opens. Moved 2 s earlier than the brief's 1:14 so the line clears the architecture scene. |
| 5 | 1:21.2 | 13.8s hard (guardrails log starts 1:35.0) | 13.8s (compressed from 15.4s) | [steady] Her memories are in GBrain. Seventy-eight facts, each with a source. The model is a LoRA fine tune on her messages, through River AI, and the weights are mine. [warm] Her voice is ElevenLabs, behind a consent gate. | Explainer architecture scene: GBrain, River AI, ElevenLabs; "runs on your machine" at 1:27. |
| 6 | 1:35.2 | 5.8s hard (serif ethics line starts 1:41.0 and sits in silence) | 5.9s (compressed from 6.8s; a longer 9.7s take with a [quiet] tag is kept as `vo6v3_long.mp3`) | [steady] It never says it's alive. It never texts first. In a crisis it steps aside entirely. | Explainer guardrails typing in as a log. |
| — | 1:41.0-1:45.0 | silence | — | — | "we didn't soften it. we made it honest about what it is." |
| 7 | 1:45.5 | 7.5s hard (wordmark holds to 1:53.0, then black) | 6.0s | [quiet] They said, own your intelligence. [breath] [warm] Nothing is more yours than the people you loved. | REMNANT wordmark; "own your intelligence" under it at 1:47. Quiet close. |

## Call lines (0:42-1:10)

Sarah's lines are final (ElevenLabs premade "Sarah", phone treatment). Your three lines are still the ElevenLabs "George" fallbacks: the couch source audio has background voices throughout and no clear utterance of yours inside the call window that I could verify without listening. Four denoised candidate bursts from IMG_2160 are in `video/out/audio/me_candidates/`; if one is you, save it as `video/out/audio/me_own_me1.wav` (or `me2`, `me3`) and rerun `build_cut.sh audio` then `mux`.

| In | Who | Line | Length |
|---|---|---|---|
| 0:43.0 | you (fallback) | hi. | 0.78s |
| 0:46.0 | Sarah | hi. | 0.60s |
| 0:48.1 | you (fallback) | I missed you. | 1.10s |
| 0:50.7 | Sarah | I know. | 0.68s |
| 0:52.9 | Sarah | You had the hackathon today. How'd it actually go. | 3.29s |
| 0:56.3 | you (fallback) | ok. | 0.84s |
| 0:57.2 | Sarah | You said ok every time it went well. | 2.59s |
| 1:00.6 | Sarah | It's Sunday. Tuesday I'd have been at the salon. Eleven, same as always. | 4.68s |
| 1:06.5 | Sarah | Go get some sleep. (beat) Love you. | 2.87s |

The phone-line hiss bed runs 0:42.0-1:10.0. The call screen is on the phone 0:45-0:55 and 0:58-1:10; the couch shots with the call screen in hand are 0:42-0:45 and 0:55-0:58.
