#!/bin/bash
# Builds video/out/remnant_scratch.mp4 and video/out/remnant_novo.mp4 with ffmpeg.
# Usage: FFMPEG=/path/to/ffmpeg FFPROBE=/path/to/ffprobe bash video/scripts/build_cut.sh [segments|audio|mux|all]
set -u
export DYLD_LIBRARY_PATH=/Users/kartik/hack/remnant-explainer/video/node_modules/@remotion/compositor-darwin-arm64
R=/Users/kartik/hack/remnant-explainer
V=$R/video
IN=$V/inbox
OUT=$V/out
SEG=$OUT/seg
AUD=$OUT/audio
RAW=$AUD/raw
mkdir -p "$SEG" "$AUD" "$OUT/frames"
FFMPEG=${FFMPEG:-ffmpeg}
FFPROBE=${FFPROBE:-ffprobe}
STEP=${1:-all}

# ---------- sources ----------
COUCH_A=$IN/IMG_2159.MOV      # looking at the dead thread, band over header
COUCH_B=$IN/IMG_2160.MOV      # typing, call tap, call screen in hand
COUCH_C=$IN/IMG_2161.MOV      # lowering the phone
SCREEN=$IN/screen.mp4
A0=$IN/hf_20260927_215012_4d376561-b53c-45f3-ba43-3e11edfbfa6f.mp4   # drone, car at night
A1=$IN/hf_20260927_213850_d8783e74-13e5-42e0-b9ed-d8ada4399d6e.mp4   # over the dash / headrest, bokeh
A2=$IN/hf_20260927_213827_8f265c1d-8bc4-447f-ad07-4d291bdc573b.mp4   # rain on windshield, white light
A3=$IN/hf_20260927_214832_f3e1f05b-d33e-4da4-b018-50c150e96b30.mp4   # headlights white-out
CC=$IN/hf_20260927_213901_1e6275de-3df1-43fb-a93d-69471a119783.mp4   # hospital corridor / gurney POV
EXPL=$V/explainer.mp4

ENC="-c:v libx264 -preset fast -crf 12 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -video_track_timescale 24000 -an"
GRAIN="noise=alls=14:allf=t+u"
# couch look: tonemap HLG->SDR, crop lower two-thirds of phone + hand, stabilize, -1.5 stops, crushed blacks, sat -30%, heavy vignette
TONEMAP="zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
LOOK="curves=m='0/0 0.12/0 0.5/0.28 0.8/0.48 1/0.62',eq=saturation=0.7,vignette=a=PI/3.2"
GENLOOK="curves=m='0/0 0.5/0.42 1/0.85'"

couch() { # name src ss frames cropw croph cropx cropy [extra-filter]
  local name=$1 src=$2 ss=$3 fr=$4 cw=$5 ch=$6 cx=$7 cy=$8 extra=${9:-null}
  "$FFMPEG" -v error -y -ss "$ss" -i "$src" -vf "fps=24,crop=$cw:$ch:$cx:$cy,$TONEMAP,deshake=rx=32:ry=32:edge=mirror,scale=1920:1080:flags=lanczos,$LOOK,$extra,$GRAIN,format=yuv420p" -frames:v "$fr" $ENC "$SEG/$name.mp4" \
  || "$FFMPEG" -v error -y -ss "$ss" -i "$src" -vf "fps=24,crop=$cw:$ch:$cx:$cy,format=yuv420p,deshake=rx=32:ry=32:edge=mirror,scale=1920:1080:flags=lanczos,eq=contrast=1.4,$LOOK,$extra,$GRAIN,format=yuv420p" -frames:v "$fr" $ENC "$SEG/$name.mp4"
  echo "done $name"
}
gen() { # name src ss frames
  "$FFMPEG" -v error -y -ss "$3" -i "$2" -vf "fps=24,format=yuv420p,$GENLOOK,$GRAIN,format=yuv420p" -frames:v "$4" $ENC "$SEG/$1.mp4"; echo "done $1"
}
screen() { # name ss frames
  "$FFMPEG" -v error -y -ss "$2" -i "$SCREEN" -vf "fps=24,crop=1290:1620:0:900,scale=-2:1080:flags=lanczos,pad=1920:1080:(ow-iw)/2:0:black,$GRAIN,format=yuv420p" -frames:v "$3" $ENC "$SEG/$1.mp4"; echo "done $1"
}
black() { # name frames
  "$FFMPEG" -v error -y -f lavfi -i "color=c=black:s=1920x1080:r=24" -frames:v "$2" $ENC "$SEG/$1.mp4"; echo "done $1"
}
expl() { # name ss frames
  "$FFMPEG" -v error -y -ss "$2" -i "$EXPL" -vf "fps=24,$GRAIN,format=yuv420p" -frames:v "$3" $ENC "$SEG/$1.mp4"; echo "done $1"
}

if [ "$STEP" = segments ] || [ "$STEP" = all ]; then
  black  s01_black 48 &
  couch  s02_couch_look "$COUCH_A" 4.0 72 2489 1400 369 720 &
  screen s03_screen_dead 2.0 120 &
  gen    s04_A0 "$A0" 1.5 24 &
  gen    s05_A1 "$A1" 1.5 24 &
  gen    s06_A2 "$A2" 2.0 24 &
  gen    s07_A3 "$A3" 2.5 24 &
  black  s08_black 24 &
  wait
  gen    s09_C "$CC" 0.5 72 &
  couch  s10_couch_typing "$COUCH_B" 39.5 72 2489 1400 1351 700 &
  screen s11_screen_bursts1 12.5 192 &
  screen s12_screen_bursts2 28.5 216 &
  screen s13_screen_hear 62.5 48 &
  couch  s14_couch_calltap "$COUCH_B" 49.0 48 2489 1400 1351 700 &
  wait
  couch  s15_couch_call1 "$COUCH_B" 52.5 72 2489 1400 1351 700 &
  screen s16_screen_call1 85.0 240 &
  couch  s17_couch_call2 "$COUCH_B" 56.0 72 2489 1400 1351 700 &
  screen s18_screen_call2 98.0 288 &
  couch  s19_couch_lower "$COUCH_C" 6.0 120 2489 1400 0 300 "curves=m='0/0 0.5/0.34 1/0.72',vignette=a=PI/3.6" &
  expl   s20_expl_a 0 24 &
  expl   s21_expl_b 6 912 &
  black  s22_black 48 &
  wait
  : > "$SEG/list.txt"
  for f in "$SEG"/s[0-9][0-9]_*.mp4; do echo "file '$f'" >> "$SEG/list.txt"; done
  "$FFMPEG" -v error -y -f concat -safe 0 -i "$SEG/list.txt" -c copy "$OUT/video_only.mp4"
  echo "video_only:"; "$FFPROBE" -v error -show_entries format=duration:stream=nb_frames,r_frame_rate -of compact=p=0:nk=0 "$OUT/video_only.mp4"
fi

# ---------- audio ----------
dur() { "$FFPROBE" -v error -show_entries format=duration -of csv=p=0 "$1"; }
pick() { [ -s "$RAW/$1f.mp3" ] && echo "$RAW/$1f.mp3" || echo "$RAW/$1.mp3"; }
ms() { awk -v t="$1" 'BEGIN{printf "%d", t*1000}'; }

if [ "$STEP" = audio ] || [ "$STEP" = all ]; then
  VO4=$(pick vo4); VO5=$(pick vo5); VO6=$(pick vo6); VO7=$(pick vo7)
  D4=$(dur "$VO4"); D5=$(dur "$VO5"); D6=$(dur "$VO6"); D7=$(dur "$VO7")
  # VO in-times (s). Explainer starts at 75.0: architecture 81, guardrails 95, serif 101, wordmark 105.
  T_VO1=3.0; T_VO2=25.2; T_VO3=38.0; T_VO4=74.0
  T_VO5=$(awk -v a="$T_VO4" -v d="$D4" 'BEGIN{t=a+d+0.3; if(t<80.6)t=80.6; printf "%.2f", t}')
  T_VO6=$(awk -v a="$T_VO5" -v d="$D5" 'BEGIN{t=a+d+0.2; if(t<95.0)t=95.0; printf "%.2f", t}')
  T_VO7=105.5
  # call lines (s)
  T_ME1=43.0; T_S1=46.0; T_ME2=48.1; T_S2=50.7; T_S3=52.9; T_ME3=56.3; T_S4=57.2; T_S5=60.6; T_S6=66.5
  echo "VO times: 1=$T_VO1 2=$T_VO2 3=$T_VO3 4=$T_VO4 5=$T_VO5 6=$T_VO6 7=$T_VO7 (d4=$D4 d5=$D5 d6=$D6 d7=$D7)" | tee "$AUD/times.txt"
  echo "call: me1=$T_ME1 s1=$T_S1 me2=$T_ME2 s2=$T_S2 s3=$T_S3 me3=$T_ME3 s4=$T_S4 s5=$T_S5 s6=$T_S6" | tee -a "$AUD/times.txt"

  sarah() { # idx file at  -> filter chain label
    local d; d=$(dur "$2"); local st; st=$(awk -v d="$d" 'BEGIN{printf "%.3f", d-0.25}')
    echo "[$1:a]aformat=sample_rates=48000:channel_layouts=stereo,highpass=f=300:poles=2,lowpass=f=3400:poles=2,acompressor=threshold=-18dB:ratio=3:attack=5:release=80:makeup=2,afade=t=in:d=0.15,afade=t=out:st=$st:d=0.25,volume=-3dB,adelay=$(ms "$3")|$(ms "$3")"
  }
  plain() { # idx at gain
    echo "[$1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=$3,adelay=$(ms "$2")|$(ms "$2")"
  }
  # inputs
  I=( "$RAW/s1.mp3" "$RAW/s2.mp3" "$RAW/s3.mp3" "$RAW/s4.mp3" "$RAW/s5.mp3" "$RAW/s6.mp3" \
      "$RAW/me1.mp3" "$RAW/me2.mp3" "$RAW/me3.mp3" \
      "$RAW/sfx_rain.mp3" "$RAW/sfx_horn.mp3" "$RAW/sfx_thud.mp3" "$RAW/sfx_room.mp3" "$RAW/sfx_hiss.mp3" \
      "$RAW/vo1.mp3" "$RAW/vo2.mp3" "$RAW/vo3.mp3" "$VO4" "$VO5" "$VO6" "$VO7" )
  ARGS=()
  for i in "${!I[@]}"; do
    case $i in 12) ARGS+=( -stream_loop 3 -i "${I[$i]}" );; 13) ARGS+=( -stream_loop 1 -i "${I[$i]}" );; *) ARGS+=( -i "${I[$i]}" );; esac
  done
  FC="$(sarah 0 "$RAW/s1.mp3" $T_S1)[s1];
$(sarah 1 "$RAW/s2.mp3" $T_S2)[s2];
$(sarah 2 "$RAW/s3.mp3" $T_S3)[s3];
$(sarah 3 "$RAW/s4.mp3" $T_S4)[s4];
$(sarah 4 "$RAW/s5.mp3" $T_S5)[s5];
$(sarah 5 "$RAW/s6.mp3" $T_S6)[s6];
$(plain 6 $T_ME1 -1dB)[m1];
$(plain 7 $T_ME2 -1dB)[m2];
$(plain 8 $T_ME3 -1dB)[m3];
[9:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=3.0:7.0,asetpts=PTS-STARTPTS,volume=-9dB,adelay=10000|10000[rain];
[10:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=2.0:2.8,asetpts=PTS-STARTPTS,afade=t=in:d=0.6,volume=-5dB,adelay=13200|13200[horn];
[11:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:1.0,asetpts=PTS-STARTPTS,afade=t=out:st=0.6:d=0.4,volume=-3dB,adelay=14000|14000[thud];
[12:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:57.0,asetpts=PTS-STARTPTS,afade=t=in:d=0.4,afade=t=out:st=55.5:d=1.5,volume=-30dB,adelay=18000|18000[room];
[13:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:28.0,asetpts=PTS-STARTPTS,afade=t=in:d=0.15,afade=t=out:st=27.5:d=0.5,volume=-28dB,adelay=42000|42000[hiss];
sine=f=4000:d=3.0,aformat=sample_rates=48000:channel_layouts=stereo,afade=t=in:d=2.8,volume=-38dB,adelay=15000|15000[tone];
$(plain 14 $T_VO1 0dB)[v1];
$(plain 15 $T_VO2 0dB)[v2];
$(plain 16 $T_VO3 0dB)[v3];
$(plain 17 $T_VO4 0dB)[v4];
$(plain 18 $T_VO5 0dB)[v5];
$(plain 19 $T_VO6 0dB)[v6];
$(plain 20 $T_VO7 0dB)[v7];
[s1][s2][s3][s4][s5][s6][m1][m2][m3][rain][horn][thud][room][hiss][tone]amix=inputs=15:normalize=0:dropout_transition=0,atrim=0:116.0,apad=whole_dur=116.0[bed];
[v1][v2][v3][v4][v5][v6][v7]amix=inputs=7:normalize=0:dropout_transition=0,atrim=0:116.0,apad=whole_dur=116.0[vo];
[bed]asplit[bedA][bedB];
[bedA][vo]amix=inputs=2:normalize=0:dropout_transition=0[scratch]"
  "$FFMPEG" -v error -y "${ARGS[@]}" -filter_complex "$FC" -map "[scratch]" -c:a pcm_s24le "$AUD/mix_scratch_raw.wav" -map "[bedB]" -c:a pcm_s24le "$AUD/mix_novo_raw.wav" || { echo "AUDIO MIX FAILED"; exit 1; }
  # two-pass loudnorm per output: -14 LUFS integrated, -1 dBTP
  for k in scratch novo; do
    J=$("$FFMPEG" -hide_banner -nostats -i "$AUD/mix_${k}_raw.wav" -af "loudnorm=I=-14:TP=-1.2:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
    g() { echo "$J" | grep "\"$1\"" | sed -E 's/.*: *"([^"]+)".*/\1/'; }
    echo "$k pass1: I=$(g input_i) TP=$(g input_tp) LRA=$(g input_lra) thresh=$(g input_thresh) offset=$(g target_offset)" | tee -a "$AUD/times.txt"
    "$FFMPEG" -v error -y -i "$AUD/mix_${k}_raw.wav" -af "loudnorm=I=-14:TP=-1.2:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true" -ar 48000 -c:a pcm_s24le "$AUD/mix_${k}.wav"
  done
fi

if [ "$STEP" = mux ] || [ "$STEP" = all ]; then
  # one delivery encode of the picture (high bitrate but capped), then mux twice with stream copy
  "$FFMPEG" -v error -y -i "$OUT/video_only.mp4" -c:v libx264 -preset medium -crf 17 -maxrate 18M -bufsize 36M -pix_fmt yuv420p -g 48 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -an "$OUT/video_delivery.mp4"
  for k in scratch novo; do
    "$FFMPEG" -v error -y -i "$OUT/video_delivery.mp4" -i "$AUD/mix_${k}.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest "$OUT/remnant_${k}.mp4"
    echo "== remnant_${k}.mp4"; "$FFPROBE" -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,sample_rate,channels -of compact=p=0:nk=0 "$OUT/remnant_${k}.mp4"
    "$FFMPEG" -hide_banner -i "$OUT/remnant_${k}.mp4" -af ebur128=peak=true -f null - 2>&1 | grep -E '^\s+(I:|Peak:)' | tail -2
  done
  for t in 4 12 24 50 80 100; do "$FFMPEG" -v error -y -ss $t -i "$OUT/remnant_scratch.mp4" -frames:v 1 "$OUT/frames/f_$(printf %03d $t).png"; done
  ls "$OUT/frames"
fi
