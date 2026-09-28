# Remnant submission video: edit notes

Built 2026-09-27, 16:01-16:35 PDT, unattended. Every judgment call is here.

## Deliverables

| File | What |
|---|---|
| `video/out/remnant_scratch.mp4` | Full cut with scratch voiceover. 1:56.0, 1920x1080, 24 fps, H.264 (CRF 17, capped 18 Mbit/s, about 17 Mbit/s average), AAC 256k 48 kHz. Measured -14.3 LUFS integrated, true peak -1.1 dBTP. 250 MB. |
| `video/out/remnant_novo.mp4` | Same picture and same mix with the voiceover track removed. -14.2 LUFS, true peak -1.2 dBTP. 249 MB. |
| `video/out/VO_SCRIPT.md` | Each VO line, its in-time in the cut, the max it can run, and the scratch length. Also the call-line timings. |
| `video/out/frames/f_004.png` … `f_100.png` | Check frames at 0:04, 0:12, 0:24, 0:50, 1:20, 1:40. |
| `video/out/contact_sheet.png` | One frame every 2 s of the finished cut. |
| `video/out/audio/raw/*.mp3` | Every generated voice line and sound effect (ElevenLabs). |
| `video/out/audio/mix_scratch.wav`, `mix_novo.wav` | The two finished mixes, 24-bit 48 kHz, before AAC. |
| `video/out/audio/times.txt` | The exact in-times and loudness measurements the build used. |
| `video/scripts/build_cut.sh` | Rebuilds everything from `video/inbox/` in about 2 minutes (`segments`, `audio`, `mux`, or `all`). |
| `video/scripts/gen_audio.cjs`, `gen_vo_fast.cjs` | ElevenLabs generation. They read the key from the main checkout's `.env` and never print it. |

Deadline was 4:20 pm. First complete render landed at 4:16 pm but was 2.4 GB and off-target on loudness; the corrected render finished at 4:31 pm. Both are logged below.

## Tooling

- No system ffmpeg. The Remotion-bundled ffmpeg in `video/node_modules/@remotion/compositor-darwin-arm64` is a stripped build (no `fps`, `eq`, `fade`, `noise`, `vignette`, `deshake`, `tile`), so I installed `ffmpeg-static` 6.0 via npm into the session scratchpad and used it for all rendering. Its companion `ffprobe-static` shipped an x86 binary that does not run here; the Remotion ffprobe works when `DYLD_LIBRARY_PATH` points at its own folder, so the build script sets that.
- No Claude Code skills or plugins for video, Remotion or ffmpeg were installed. Remotion itself was not used for the cut: a straight ffmpeg pipeline was faster to iterate under the deadline.
- ElevenLabs: `GET /v1/voices` returned no premade voices for this account, so the script falls back to the documented premade voice IDs (Sarah `EXAVITQu4vr4xnSDxMaL`, male scratch George `JBFqnCBsd6RMkjVDRZzb`). Sound effects came from `POST /v1/sound-generation`.

## Inbox classification (ffprobe)

The brief said `video/inbox/`; it did not exist, so I created it and copied in the files you listed from `~/Downloads`, plus the screen recording you added mid-run.

| File | Type | Notes |
|---|---|---|
| `IMG_2159.MOV` | couch | 16.1 s, 3840x2160 HEVC 10-bit HLG, 29.97 fps, stereo AAC. Close on the phone 4-12 s, wide with face 0-3 s and 13-16 s. |
| `IMG_2160.MOV` | couch | 62.1 s, same format, 30 fps. Close on the phone throughout: typing at 39.5-42.5 s, thumb goes to the call button 48.5-51 s, call screen in hand 52-59.5 s, Control Centre at 60 s. |
| `IMG_2161.MOV` | couch | 15.2 s, same format. Close 4-6 s, phone lowers to the lap 6-11 s, face at 14 s. |
| `ScreenRecording_09-27-2026 15-54-40_1.mp4` → `inbox/screen.mp4` | screen recording | 141.8 s, 1290x2796 HEVC 60 fps. Dead thread 0-8.5 s; "Hey" sent 10.0; typing indicator 12.5; bursts land 16.5 / 17.5 / 18.5; "How are you texting me???" sent 29.0; indicator 30.0; bursts 35.0 / 36.0 / 37.0; first attempt at "I want to hear you" abandoned 39-48 s; second take typed 57-62 s, sent 62.5; call button 66-68.5; microphone permission dialog with a trycloudflare URL at 69.0 (never used); call screen 69.5-125.5 with waveform activity around 90, 102, 118.5-119, 121-121.5; back to thread 126 s; from 135 s a real iMessage thread with a different person is on screen (never used). |
| `hf_…_215012_….mp4` | generated A0 | drone over a car on a wet road at night. 4.05 s, 1920x1080 HEVC 10-bit, 24 fps. |
| `hf_…_213850_….mp4` | generated A1 | over the dash, bokeh tail lights through the windshield. 4.05 s. The duplicate `(1)` copy in Downloads is byte-identical (same md5) and was dropped. |
| `hf_…_213827_….mp4` | generated A2 | rain on the windshield, soft white light ahead. 5.05 s. |
| `hf_…_214832_….mp4` | generated A3 | oncoming headlights on a wet road, white-out. 4.05 s. |
| `hf_…_213901_….mp4` | generated C | hospital corridor ceiling from a gurney, blurred, vignetted. 4.05 s. |
| `video/explainer.mp4` | explainer | 44.0 s, silent, 1080p24. |
| audio | none supplied | No sfx and no music in the inbox. All five sfx were synthesized with ElevenLabs sound generation (rain 20 s, approaching horn 5 s, sub thud 2 s, phone-line hiss 20 s, room tone 20 s). Music: none, so the cut is rendered without it, per the brief. |

`IMG_2157`, `IMG_2158`, `IMG_2162` also sit in Downloads but were not in your list, so they were not used.

## Timeline as built

All cuts are hard. Times are cut time; "src" is source time.

| Cut | Shot | Source |
|---|---|---|
| 0:00-0:02 | black, silence | |
| 0:02-0:05 | couch: looking at the dead thread | IMG_2159 src 4.0-7.0 |
| 0:05-0:10 | screen: dead thread, "8 months ago", nothing typed | screen src 2.0-7.0 |
| 0:10-0:11 | A0 drone | src 1.5-2.5 |
| 0:11-0:12 | A1 dash | src 1.5-2.5 |
| 0:12-0:13 | A2 rain | src 2.0-3.0 |
| 0:13-0:14 | A3 headlights | src 2.5-3.5 |
| 0:14-0:15 | black | |
| 0:15-0:18 | C corridor | src 0.5-3.5 |
| 0:18-0:21 | couch: typing, hands only | IMG_2160 src 39.5-42.5 |
| 0:21-0:29 | screen: indicator, three bursts land at 0:25.0 / 0:26.0 / 0:27.0 | screen src 12.5-20.5 |
| 0:29-0:38 | screen: "How are you texting me???" sent 0:29.5, indicator, bursts at 0:35.5 / 0:36.5 / 0:37.5 | screen src 28.5-37.5 |
| 0:38-0:40 | screen: "I want to hear you not this..." just sent | screen src 62.5-64.5 |
| 0:40-0:42 | couch: the Call tap | IMG_2160 src 49.0-51.0 |
| 0:42-0:45 | couch: call screen in hand | IMG_2160 src 52.5-55.5 |
| 0:45-0:55 | screen: call screen (waveform at 0:50) | screen src 85-95 |
| 0:55-0:58 | couch: call screen in hand | IMG_2160 src 56.0-59.0 |
| 0:58-1:10 | screen: call screen (waveform at 1:02) | screen src 98-110 |
| 1:10-1:15 | couch: lowering the phone, hold | IMG_2161 src 6.0-11.0 |
| 1:15-1:54 | explainer with its 0:01-0:06 removed (src 0-1, then 6-44). Architecture 1:21, guardrails 1:35, serif line 1:41, wordmark 1:45, its own black 1:53 | explainer.mp4 |
| 1:54-1:56 | black | |

Audio (cut time):

- 0:00-0:10 silence except VO 1 at 0:03.0.
- 0:10.0 rain hard in (no fade), hard out on the cut at 0:14.0. Horn from 0:13.2 with a 0.6 s fade-in so it peaks on the cut, hard out at 0:14.0. Sub thud on 0:14.0, faded out by 0:15.0. Nothing else until 0:15.
- 0:15-0:18 a 4 kHz sine, fading in over 2.8 s to -38 dBFS, hard out at 0:18.
- 0:18-1:15 room tone at -30 dB, 1.5 s fade-out into the explainer.
- 0:42-1:10 phone-line hiss bed at -28 dB, continuous.
- Call lines: you 0:43.0 "hi", Sarah 0:46.0 "hi", you 0:48.1 "I missed you", Sarah 0:50.7 "I know", Sarah 0:52.9 "You had the hackathon today…", you 0:56.3 "ok", Sarah 0:57.2 "You said ok…", Sarah 1:00.6 "It's Sunday…", Sarah 1:06.5 "Go get some sleep. (beat) Love you."
- VO: 0:03.0, 0:25.2, 0:38.0, 1:14.0, 1:22.9, 1:35.0, 1:45.5 (see VO_SCRIPT.md).
- No music anywhere. Nothing from any source clip: every video segment was encoded with `-an`, and the muxed audio comes only from the generated files. Verified: zero audio streams in all 22 segments; 0:00-0:02 measures -91 dB; the no-VO file is silent at 0:03-0:05.5 where the scratch file has VO.

## Look

- Couch: HLG to SDR tonemap (zscale linear, hable), crop 2489x1400 of the 4K frame around the lower part of the phone and the hand, `deshake` stabilization, curves that drop white to 0.62 (about -1.5 stops) and crush everything below 0.12 to black, saturation 0.7, `vignette` at PI/3.2, grain `noise=alls=14` temporal. The lowering shot got a second curve (white to 0.72) and an extra vignette because the couch cushions were still legible.
- Generated: curves white to 0.85 (about half a stop down), same grain.
- Screen: crop 1290x1620 from y=900 (drops the status bar and the red recording pill), scaled to 860x1080, pillarboxed on black, same grain. All readable thread content comes from here.
- Explainer: same grain, nothing else.
- No text overlays, no logos added.

## Voices

- Sarah: ElevenLabs premade "Sarah", `eleven_multilingual_v2`, stability 0.35, similarity 0.8, style 0.15, speed 0.95. Line 6 was generated as one file with `<break time="1.2s"/>` between "Go get some sleep." and "Love you." Phone treatment on all six: highpass 300 Hz and lowpass 3400 Hz (2-pole each), compressor -18 dB threshold 3:1, 150 ms fade in, 250 ms fade out, -2 dB in the mix.
- Your call lines: SCRATCH. ElevenLabs premade "George" (calm male), clean, no EQ. Files `me1.mp3`, `me2.mp3`, `me3.mp3`. Replace them.
- Voiceover: SCRATCH, same "George" voice. Lines 1-3 at speed 0.92 (`vo1-3.mp3`). Lines 4-7 were first generated at 0.92 and came out 10.0 / 14.2 / 6.3 / 4.9 s, which did not fit the explainer scenes, so they were regenerated at speed 1.15 (`vo4f-vo7f.mp3`, 8.6 / 11.8 / 5.2 / 3.8 s). The fast versions are in the mix; the slow ones are kept in `audio/raw/`.

## Departures from the brief, and why

1. **Runtime 1:56, not 1:49.** The call lines with the gaps you specified sum to about 26 s, not the 22 s the timeline allowed (0:42-1:04). I tightened the gaps a little (2.2 s after "hi", 1.5 s between the others, 0.8 s before "It's Sunday", 1.2 s before "Go get some sleep") and let the call run to 1:10. Everything after it shifts by +6 s: lowering the phone 1:10-1:15, VO 4 at 1:14, explainer 1:15-1:54, black to 1:56. Within the 1:40-1:58 window.
2. **VO 4 overlaps the architecture scene by 1.6 s** even at the faster read. VO 5 therefore starts at 1:22.9 in the scratch mix instead of 1:21.0. Your own read of line 4 needs to be 7 s or under to land cleanly; VO_SCRIPT.md has the numbers.
3. **No phone-to-ear couch footage exists.** The three couch clips never show the phone at the ear, so the call section alternates the on-screen call UI with IMG_2160 at 52-59 s, where the call screen is lit in the hand. Three cuts, as allowed.
4. **The app's third burst reads "the ones you kept"**, not "she's not here. this is what's left" as in the brief. VO 3 is timed 0.5 s after the actual third burst lands (0:37.5), so it starts at 0:38.0, on the cut.
5. **The couch "typing hey" shot is IMG_2160 at 39.5 s**, which is the only moment with the keyboard up and hands only. What is typed there is not "hey"; the readable content is carried by the screen recording.
6. **Couch clip picks and the glare band.** The band sits over the header in IMG_2159 4-7 s and over the keyboard in the typing shot, not over the messages. In the call-in-hand shots the screen is the call UI, so there is nothing readable to protect.
7. **Loudness was normalized per output** (two-pass `loudnorm`, linear mode) so both files hit -14 LUFS. That makes the no-VO file about 2.3 dB hotter overall than the scratch file's bed; the balance between elements is identical.
8. **Delivery bitrate.** The first render concatenated the CRF 12 segments unchanged and came out at 2.4 GB per file because of the grain. The delivered files are a single re-encode at CRF 17 with an 18 Mbit/s cap (about 250 MB each). The CRF 12 segments are still the source of truth and are regenerated by the script.
9. **Grain on the explainer too**, since the brief says every clip.
10. **Screen recording after 2:06 was never used**: it shows a real iMessage thread with a named third party.
11. **Music**: none supplied, none rendered. The slot is documented in the brief; nothing was substituted.

## Missing or to replace

- Music (not supplied).
- Your own voiceover (7 lines) and your three call lines. All scratch, all labelled SCRATCH above.
- A phone-to-ear couch shot, if you want one in the call.

## Checks

- ffprobe both outputs: 116.000 s, 1920x1080, 24/1, h264 + aac 48000 Hz stereo.
- Loudness (ebur128 on the final AAC): scratch -14.3 LUFS / -1.1 dBTP, novo -14.2 LUFS / -1.2 dBTP.
- Frames at 0:04, 0:12, 0:24, 0:50, 1:20, 1:40 in `frames/`: 0:04 is hand, sleeve and a dark phone edge, the glare band is dim cream over the header not the messages; 0:12 rain windshield, dark; 0:24 the thread is fully readable, indicator visible; 0:50 call screen; 1:20 explainer app clip; 1:40 guardrails log. No blown-out screen, no bright room. The generated clips measure darker than the phone UI.
- Contact sheet in `contact_sheet.png`.

## Git

Committed on `explainer`: scripts, notes, VO_SCRIPT, check frames, contact sheet, the generated mp3s and `times.txt`. Not committed: the two 250 MB MP4s, the WAV mixes, `video/inbox/` (about 500 MB of camera originals) and the render segments; they are over GitHub's 100 MB limit and are reproducible with `build_cut.sh`. A `.gitignore` in `video/out/` records this.

## Addendum, 16:38-16:50 PDT: final pass

- **`video/out/remnant_final.mp4`** is now the deliverable: 1:56.0, 1920x1080, 24 fps, H.264 (CRF 17, 18 Mbit/s cap), AAC 256k 48 kHz, -13.8 LUFS integrated, true peak -1.1 dBTP, 251 MB. `remnant_novo.mp4` was re-muxed from the same picture (-14.2 LUFS, -1.2 dBTP). `remnant_scratch.mp4` is the earlier George-voiced version and is superseded.
- **VO 1-7 regenerated** with voice `T4x5CtnhOiichhcqFzgg` on `eleven_v3`, stability 0.4, similarity 0.8, style 0.55, speaker boost on. Lines rewritten with `[quiet]`, `[breath]`, `[steady]`, `[warm]` tags; every fact unchanged. Lines 2 and 7 were generated at stability 0.5: the script retried on a 429 concurrency error with the next value in its list. v3 reads slowly, so lines 4, 5 and 6 exceeded their slots and are time-compressed with `atempo` (1.225, 1.11, 1.14). Line 6 was regenerated once with the `[quiet]` tag and the comma removed to get it from 9.7 s to 6.8 s; the long take is kept as `vo6v3_long.mp3`. VO 4 now starts at 1:12.0 instead of 1:14.0 so it clears the architecture scene at 1:21.
- **Your own call lines: not used.** Speech detection on IMG_2160 (highpass 150 / lowpass 5000, -36 dB, 0.3 s) shows background voices across the whole clip and no burst of 1 s or more inside the call-screen window (52-59.5 s); the only bursts near the call are 49.1-50.4 s and 51.9-52.5 s, which coincide with the call tap. I could not confirm any of them is you saying the lines, so all three slots fall back to the ElevenLabs "George" lines as instructed. Four denoised candidates (`afftdn`, gate, highpass) are in `video/out/audio/me_candidates/` for you to audition. Because no couch audio is in the mix, there is no source room noise anywhere in the final; verified again by construction (all 22 segments have zero audio streams, the mix is built only from generated files).
- Intermediates (`seg/`, `video_only.mp4`, `video_delivery.mp4`, WAV mixes) were left in place this time, as asked.

## Addendum, 16:35-16:45 PDT: voice moved to after the story

- Direction changed: no voiceover inside the film; the voice starts when the story ends and each part lands on its screen cue. `remnant_final.mp4` is now 2:00.0 exactly, -14.1 LUFS, true peak -1.2 dBTP; `remnant_novo.mp4` re-muxed (-14.2 LUFS).
- Structure after the call: lowering the phone 1:07.5-1:11.5, the thread again from the screen recording (src 126-132, "2 min ago") 1:11.5-1:17.5, black 1:17.5-1:27, then the explainer from its architecture scene (src 11-44): columns 1:27, guardrails 1:41, serif line 1:47 in silence, wordmark 1:51, black 1:59.
- To stay at or under 2:00 the explainer's app montage (src 6-11) was dropped as redundant after the film, and three waits in the film were trimmed within the brief's ±1 s: the dead-thread screen 5→4 s, the first typing-indicator wait 8→7 s, the second 9→8.5 s. The call and everything in it moved 2.5 s earlier (starts 0:40.5).
- Part A (story lines plus "Remnant takes...") was generated twice as one continuous v3 read; both takes are 22 s, so it starts on the lowering cut (1:07.5) with a 20 s slot and is compressed 1.11x; part B (GBrain) starts 0.9 s after the columns appear with a 13 s slot (1.18x); part C 1.18x; part D untouched. The longer tagged take is kept as `voAv3_long.mp3`. Your own reads drop in as `video/out/audio/own_voA.wav` etc.

## LinkedIn cut, 2026-09-27 evening

**Deliverables:** `video/out/remnant_linkedin_16x9.mp4` (1920x1080) and `video/out/remnant_linkedin_4x5.mp4` (1080x1350). Both 1:50.5, 24 fps, H.264 (CRF 17, 18 Mbit/s cap, about 235 MB each), AAC 256k 48 kHz, -14.3 LUFS integrated, true peak -1.3 dBTP. Captions burned in from `video/out/li/cap_169.ass` and `cap_45.ass`; the same cues as SRT in `video/out/captions/remnant_linkedin_16x9.srt` and `_4x5.srt`. Build: `bash video/scripts/build_li.sh all both` (about 4 minutes; the Remotion cards and portrait explainer render separately, see below).

**Your lines are your voice, but from IMG_2162, not the three clips in the inbox.** ElevenLabs speech-to-text over the couch audio showed IMG_2159 and IMG_2161 contain only room noise, and in IMG_2160 you say one "hello" and then "it went to my AirPods". The live take is `~/Downloads/IMG_2162.MOV`: "um, hello?" at 48.6 s, "I miss you." at 57.4 s, "It was okay." at 81.1 s, with the app's Sarah answering through the phone speaker in between. Those three were extracted from its stereo track (`video/scripts/li_own_lines.sh`): rnnoise denoise (the "mp" model, mix 0.8), gain to Sarah's speech level (RMS peak -17 dBFS, the same as her phone-treated clips), a gate with 40 dB range so nothing but the words is left, trimmed to the word boundaries with 30/100 ms fades. Speech-to-text on the processed clips reads them back as "Hello?", "I miss you", "Okay" (the "it was" before "okay" is too quiet to survive, so the caption says "it was okay." because that is what you said and what the final-mix transcription hears). Levels in the final mix: your lines -16 to -14 LUFS short-term, Sarah -14 to -17, narration -12.5, so the call is a touch under the narration, as intended. No other source audio is in the mix; the couch clips' own tracks were never used. Measured: -47 dBFS RMS in the hiss-only window before your first line and -42 to -44 between your lines and Sarah's replies, which is the hiss bed plus reverb tails, not room.

**Sarah** is voice `RXtWW6etvimS8QJ5nhVk`, `eleven_multilingual_v2`, stability 0.35, similarity 0.8, style 0.15, speed 0.95, same phone chain as before (300-3400 Hz, 3:1 compression, 150/250 ms fades). All six were generated fresh for this voice (`video/scripts/gen_li_voices_ts.cjs`, which also returns character timestamps). None clipped (peaks -3 to -10 dBFS after the chain).

**Narration** is voice `T4x5CtnhOiichhcqFzgg`, `eleven_v3`, stability 0.4, style 0.55, similarity 0.8, speaker boost on. Four lines, first person, written for the feed (`video/scripts/li_lines.json`):
- "I built this in one afternoon, at a YC hackathon. A message export, a voice sample, and Remnant builds a reflection of someone you lost." in at 1:08.0 over the phone lowering, the thread again, and black.
- "Her memory is in GBrain. The model is a LoRA on her messages, through River. Her voice is ElevenLabs, behind a consent gate. The memory and the weights are mine, not a company's." in at 1:17.8 as the three columns appear.
- "Never claims to be alive, never texts first, and in a crisis it steps aside." in at 1:31.8 on the guardrails log; silence over the serif line 1:38-1:41.5.
- "They said, own your intelligence. Nothing is more yours than the people you loved." in at 1:42.0 on the wordmark, running into the end card.
Edges trimmed and pauses over 0.4 s squeezed to 0.28 s (`silenceremove`), then only lines 6 and 7 needed a nudge (atempo 1.04 and 1.01). Total narration 34.1 s. Narration sits 3 dB under the Sarah/you group in the mix and comes out about 2 LU above the call after normalization because the film half is quiet.

**Picture.** Same cut structure as the 2:00 version, tightened: the cold-open card replaces the opening black (2 s, Cormorant Garamond, "the last text was 8 months ago.", silent); the second typing-indicator wait is 1.5 s shorter; the black hold before the explainer is 3.5 s instead of 9.5; the explainer's app montage is dropped (redundant after the film); the wordmark scene is held 5 s and cuts to a 3 s end card that keeps the wordmark in the same place and swaps the tagline for "built in one afternoon at YC's Own Your Intelligence Hackathon" and "github.com/Kartikkapoor8/remnant"; 1 s black. Cards and the portrait explainer are Remotion compositions in `video/src/LinkedIn.tsx` (ColdOpen169/45, EndCard169/45, ExplainerPortrait), rendered with `npx remotion render src/index.ts <id> out/li/cards/<name>.mp4 --codec=h264 --crf=16 --color-space=bt709 --muted`. The portrait explainer re-lays the architecture as three stacked rows with hairlines, the guardrails log at the left margin with the verdict wrapped to two lines, and the wordmark at 150 px; timings are identical to the 16:9 explainer so the narration cues hold in both.

**4:5 recrops** (per shot, 4K source coordinates, `render_segments` in `build_li.sh`): the dead-thread look 1500x1875 at (1412,285) on the lower phone and thumb; typing 1728x2160 at x 736 (keyboard and both thumbs); the Call tap at x 656; call-in-hand shots at x 816 and 776 (call UI centred); the lowering shot at x 0 (phone and both hands, face out of frame). The screen recording crop (1290x1612 from y 900) is already 4:5 and fills the frame. Generated clips take the centre 864x1080 (the drone shot is offset to x 566 to keep the car). Captions move up to MarginV 150 at 42 px; 16:9 uses MarginV 78 at 38 px. Grain, look and tonemap are unchanged.

**Captions.** Inter Regular (TTF from the Inter 4.1 release, passed to libass with `fontsdir`), lowercase, #EDE8DF, 1.4 px 60% black outline, bottom centre. Every spoken line and the narration; texted lines are not captioned because they are legible on screen. Timing comes from ElevenLabs speech-to-text on each processed clip (`video/scripts/li_captions.cjs`), chunked at the `|` marks in `li_lines.json`; two clips fell back to proportional timing inside the clip because the transcriber split a word differently. Check: speech-to-text of the finished mix reads back the SRT word for word.

**Audio bed.** Music is `~/Downloads/Theme from Anon.mp3` (copied to `video/inbox/music_theme_from_anon.mp3`), 18.0-53.5 s of it placed at 1:06.0-1:41.5: nothing before the phone lowers; a 1.5 s fade in; +10 dB lift under the lowering shot and the thread because the piece's intro is very quiet, released by 1:13 just before its entrance lands on the black at 1:13-1:14; the piece builds on its own through the architecture; -8 dB under the whole narration block (one duck, not three, so it does not pump in the one-second gaps); pulled 20 dB across the first second of the serif line and out by 1:41.5; silence under the wordmark and the end card. Base gain -11 dB, so the bed sits about 10 dB under the narration. Rain 0:09-0:13 hard in and out (-5 dB), horn 0:12.2-0:13 with a 0.6 s fade in, -9 dB and a -3 dB dip at 3 kHz for phone speakers (the horn moment measures -16.9 LUFS momentary, peak -6.5 dBFS in the final), thud on 0:13, 4 kHz tone 0:14-0:17 (ffmpeg's sine source is 1/8 amplitude, so it is at -26 dB, not -38), room tone 0:17-1:17.5. The ElevenLabs room tone and phone hiss came back at -64 and -70 LUFS; the room tone is used with +10 dB, the hiss was replaced by pink noise band-limited to 300-3400 Hz at -50 LUFS pre-normalization. Dialogue and bed stems each pass a -9 dBFS limiter before a linear two-pass `loudnorm` to -14 LUFS / -1.5 dBTP (AAC lands at -1.3).

**QA.** Sheets at 1 fps: `video/out/li/qa_sheet_16x9.jpg`, `qa_sheet_4x5.jpg`. Couch shots: maximum frame-average luma 33-54 of 255 in both aspects. 0:00-0:02 digital silence. Durations and codecs as above.

**Not done or worth knowing.** "Theme from Anon" is a commercial film cue; LinkedIn's audio matching may flag it. IMG_2157, IMG_2158 and the picture of IMG_2162 were not used. The "It was all right." take at 76.4 s in IMG_2162 was rejected (transcribes as "you know that").
