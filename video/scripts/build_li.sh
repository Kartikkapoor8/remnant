#!/bin/bash
# LinkedIn cut of the Remnant film: video/out/remnant_linkedin_16x9.mp4 and remnant_linkedin_4x5.mp4.
# usage: bash video/scripts/build_li.sh [segments|audio|captions|mux|qa|all] [169|45|both]
set -u
R=/Users/kartik/hack/remnant-explainer; V=$R/video; IN=$V/inbox; OUT=$V/out; LI=$OUT/li; AUD=$OUT/audio/li; RAW=$OUT/audio/raw; OWN=$AUD/own; PROC=$AUD/proc
S=/private/tmp/claude-501/-Users-kartik/c0196dd7-d520-431a-8553-29ac7a7af21b/scratchpad
export DYLD_LIBRARY_PATH=$V/node_modules/@remotion/compositor-darwin-arm64
export PATH=$HOME/.local/node/bin:$PATH
FFMPEG=${FFMPEG:-$S/ffmpeg}; FFPROBE=${FFPROBE:-$DYLD_LIBRARY_PATH/ffprobe}
FONTS=${FONTS:-$S/fonts/inter/extras/ttf}
STEP=${1:-all}; WHICH=${2:-both}
[ "$WHICH" = both ] && ASPECTS="169 45" || ASPECTS="$WHICH"
mkdir -p "$LI/seg169" "$LI/seg45" "$LI/cards" "$LI/frames" "$OUT/captions" "$PROC" "$AUD/stt"
TOTAL=110.5

# ---------- sources ----------
COUCH_A=$IN/IMG_2159.MOV; COUCH_B=$IN/IMG_2160.MOV; COUCH_C=$IN/IMG_2161.MOV; SCREEN=$IN/screen.mp4
A0=$IN/hf_20260927_215012_4d376561-b53c-45f3-ba43-3e11edfbfa6f.mp4
A1=$IN/hf_20260927_213850_d8783e74-13e5-42e0-b9ed-d8ada4399d6e.mp4
A2=$IN/hf_20260927_213827_8f265c1d-8bc4-447f-ad07-4d291bdc573b.mp4
A3=$IN/hf_20260927_214832_f3e1f05b-d33e-4da4-b018-50c150e96b30.mp4
CC=$IN/hf_20260927_213901_1e6275de-3df1-43fb-a93d-69471a119783.mp4
EXPL=$V/explainer.mp4; EXPLP=$LI/cards/explainer_portrait.mp4
MUSIC=$IN/music_theme_from_anon.mp3

GRAIN="noise=alls=14:allf=t+u"
TONEMAP="zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
LOOK="curves=m='0/0 0.12/0 0.5/0.28 0.8/0.48 1/0.62',eq=saturation=0.7,vignette=a=PI/3.2"
GENLOOK="curves=m='0/0 0.5/0.42 1/0.85'"
ENC="-c:v libx264 -preset fast -crf 12 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -video_track_timescale 24000 -an"
size() { [ "$1" = 169 ] && echo "1920:1080" || echo "1080:1350"; }
dur() { "$FFPROBE" -v error -show_entries format=duration -of csv=p=0 "$1"; }
ms() { awk -v t="$1" 'BEGIN{printf "%d", t*1000}'; }

# ---------- segment renderers (A = 169 | 45) ----------
couch() { local A=$1 name=$2 src=$3 ss=$4 fr=$5 crop=$6 extra=${7:-null}; local sz; sz=$(size $A)
  "$FFMPEG" -v error -y -ss "$ss" -i "$src" -vf "fps=24,crop=$crop,$TONEMAP,deshake=rx=32:ry=32:edge=mirror,scale=$sz:flags=lanczos,$LOOK,$extra,$GRAIN,format=yuv420p" -frames:v "$fr" $ENC "$LI/seg$A/$name.mp4" && echo "done $A $name"; }
gen() { local A=$1 name=$2 src=$3 ss=$4 fr=$5 x45=$6; local vf
  if [ "$A" = 169 ]; then vf="fps=24,format=yuv420p"; else vf="fps=24,crop=864:1080:$x45:0,scale=1080:1350:flags=lanczos"; fi
  "$FFMPEG" -v error -y -ss "$ss" -i "$src" -vf "$vf,$GENLOOK,$GRAIN,format=yuv420p" -frames:v "$fr" $ENC "$LI/seg$A/$name.mp4" && echo "done $A $name"; }
screen() { local A=$1 name=$2 ss=$3 fr=$4; local vf
  if [ "$A" = 169 ]; then vf="fps=24,crop=1290:1620:0:900,scale=-2:1080:flags=lanczos,pad=1920:1080:(ow-iw)/2:0:black"; else vf="fps=24,crop=1290:1612:0:900,scale=1080:1350:flags=lanczos"; fi
  "$FFMPEG" -v error -y -ss "$ss" -i "$SCREEN" -vf "$vf,$GRAIN,format=yuv420p" -frames:v "$fr" $ENC "$LI/seg$A/$name.mp4" && echo "done $A $name"; }
black() { local A=$1 name=$2 fr=$3; local sz; sz=$(size $A)
  "$FFMPEG" -v error -y -f lavfi -i "color=c=black:s=${sz/:/x}:r=24" -frames:v "$fr" $ENC "$LI/seg$A/$name.mp4" && echo "done $A $name"; }
expl() { local A=$1 name=$2 ss=$3 fr=$4; local src=$EXPL; local t=$ss
  if [ "$A" = 45 ]; then src=$EXPLP; t=$(awk -v s="$ss" 'BEGIN{printf "%.3f", s-11.0}'); fi
  "$FFMPEG" -v error -y -ss "$t" -i "$src" -vf "fps=24,$GRAIN,format=yuv420p" -frames:v "$fr" $ENC "$LI/seg$A/$name.mp4" && echo "done $A $name"; }
card() { local A=$1 name=$2 file=$3 fr=$4
  "$FFMPEG" -v error -y -i "$file" -vf "fps=24,$GRAIN,format=yuv420p" -frames:v "$fr" $ENC "$LI/seg$A/$name.mp4" && echo "done $A $name"; }

render_segments() { local A=$1
  local C_LOOK C_TYPE C_TAP C_CALL1 C_CALL2 C_LOWER
  if [ "$A" = 169 ]; then
    C_LOOK="2489:1400:369:720"; C_TYPE="2489:1400:1351:700"; C_TAP="2489:1400:1351:700"; C_CALL1="2489:1400:1351:700"; C_CALL2="2489:1400:1351:700"; C_LOWER="2489:1400:0:300"
  else  # 4:5 recrops: phone centred, hands in frame, face out
    C_LOOK="1500:1875:1412:285"; C_TYPE="1728:2160:736:0"; C_TAP="1728:2160:656:0"; C_CALL1="1728:2160:816:0"; C_CALL2="1728:2160:776:0"; C_LOWER="1728:2160:0:0"
  fi
  rm -f "$LI/seg$A"/s[0-9][0-9]_*.mp4
  card   $A s00_coldopen "$LI/cards/coldopen_$A.mp4" 48 &
  couch  $A s02_couch_look "$COUCH_A" 4.0 72 "$C_LOOK" &
  screen $A s03_screen_dead 2.5 96 &
  gen    $A s04_A0 "$A0" 1.5 24 566 &
  gen    $A s05_A1 "$A1" 1.5 24 528 &
  gen    $A s06_A2 "$A2" 2.0 24 528 &
  gen    $A s07_A3 "$A3" 2.5 24 528 &
  black  $A s08_black 24 &
  wait
  gen    $A s09_C "$CC" 0.5 72 528 &
  couch  $A s10_couch_typing "$COUCH_B" 39.5 72 "$C_TYPE" &
  screen $A s11_screen_bursts1 13.5 168 &
  screen $A s12_screen_bursts2 30.5 168 &
  screen $A s13_screen_hear 62.5 48 &
  couch  $A s14_couch_calltap "$COUCH_B" 49.0 48 "$C_TAP" &
  wait
  couch  $A s15_couch_call1 "$COUCH_B" 52.5 72 "$C_CALL1" &
  screen $A s16_screen_call1 85.0 240 &
  couch  $A s17_couch_call2 "$COUCH_B" 56.0 72 "$C_CALL2" &
  screen $A s18_screen_call2 98.0 288 &
  couch  $A s19_couch_lower "$COUCH_C" 6.0 96 "$C_LOWER" "curves=m='0/0 0.5/0.34 1/0.72',vignette=a=PI/3.6" &
  screen $A s20_screen_after 126.0 96 &
  black  $A s21_black 84 &
  wait
  expl   $A s22_expl_body 11.0 576 &
  expl   $A s23_expl_close 35.0 120 &
  card   $A s24_endcard "$LI/cards/endcard_$A.mp4" 72 &
  black  $A s25_black 24 &
  wait
  : > "$LI/seg$A/list.txt"; for f in "$LI/seg$A"/s[0-9][0-9]_*.mp4; do echo "file '$f'" >> "$LI/seg$A/list.txt"; done
  "$FFMPEG" -v error -y -f concat -safe 0 -i "$LI/seg$A/list.txt" -c copy "$LI/video_$A.mp4"
  echo "video_$A: $("$FFPROBE" -v error -show_entries format=duration:stream=nb_frames -of compact=p=0:nk=0 "$LI/video_$A.mp4" | tr '\n' ' ')"
}

if [ "$STEP" = segments ] || [ "$STEP" = all ]; then
  for A in $ASPECTS; do render_segments $A; done
fi

# ---------- audio ----------
if [ "$STEP" = audio ] || [ "$STEP" = all ]; then
  : > "$AUD/times.txt"
  # Sarah: phone treatment to files (also used for caption timing)
  for i in 1 2 3 4 5 6; do d=$(dur "$AUD/sarah$i.mp3"); st=$(awk -v d="$d" 'BEGIN{printf "%.3f", d-0.25}')
    "$FFMPEG" -v error -y -i "$AUD/sarah$i.mp3" -af "aformat=sample_rates=48000:channel_layouts=mono,highpass=f=300:poles=2,lowpass=f=3400:poles=2,acompressor=threshold=-18dB:ratio=3:attack=5:release=80:makeup=2,afade=t=in:d=0.15,afade=t=out:st=$st:d=0.25" "$PROC/sarah${i}_phone.wav"; done
  # Narration: trim edges, squeeze pauses over 0.4 s to 0.28 s, then fit to the scene slot (atempo only if still long)
  fit() { local id=$1 max=$2
    "$FFMPEG" -v error -y -i "$AUD/$id.mp3" -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.10,areverse,silenceremove=stop_periods=-1:stop_duration=0.40:stop_threshold=-45dB:stop_silence=0.28" -ar 48000 "$PROC/${id}_tight.wav"
    local d r; d=$(dur "$PROC/${id}_tight.wav"); r=$(awk -v d="$d" -v m="$max" 'BEGIN{r=d/m*1.005; if(r<1)r=1; if(r>1.12)r=1.12; printf "%.3f", r}')
    "$FFMPEG" -v error -y -i "$PROC/${id}_tight.wav" -af "atempo=$r" "$PROC/${id}_fit.wav"
    echo "$id: raw $(dur "$AUD/$id.mp3") tight $d atempo $r -> $(dur "$PROC/${id}_fit.wav") (slot $max)" | tee -a "$AUD/times.txt"; }
  fit nar4 9.3; fit nar5 13.5; fit nar6 5.7; fit nar7 6.6
  N4=$PROC/nar4_fit.wav; N5=$PROC/nar5_fit.wav; N6=$PROC/nar6_fit.wav; N7=$PROC/nar7_fit.wav
  NARR_TOTAL=$(awk -v a="$(dur $N4)" -v b="$(dur $N5)" -v c="$(dur $N6)" -v d="$(dur $N7)" 'BEGIN{printf "%.2f", a+b+c+d}'); echo "narration total ${NARR_TOTAL}s" | tee -a "$AUD/times.txt"
  # own lines (silence if a line is missing)
  for i in 1 2 3; do [ -s "$OWN/me$i.wav" ] || "$FFMPEG" -v error -y -f lavfi -i "anullsrc=r=48000:cl=mono" -t 0.3 "$OWN/me$i.wav"; done
  add() { awk -v a="$1" -v b="$2" 'BEGIN{printf "%.3f", a+b}'; }
  T_ME1=39.0
  T_S1=$(add $(add $T_ME1 $(dur $OWN/me1.wav)) 2.2)
  T_ME2=$(add $(add $T_S1 $(dur $PROC/sarah1_phone.wav)) 1.5)
  T_S2=$(add $(add $T_ME2 $(dur $OWN/me2.wav)) 1.5)
  T_S3=$(add $(add $T_S2 $(dur $PROC/sarah2_phone.wav)) 1.5)
  T_ME3=$(add $(add $T_S3 $(dur $PROC/sarah3_phone.wav)) 0.15)
  T_S4=$(add $(add $T_ME3 $(dur $OWN/me3.wav)) 0.15)
  T_S5=$(add $(add $T_S4 $(dur $PROC/sarah4_phone.wav)) 0.8)
  T_S6=$(add $(add $T_S5 $(dur $PROC/sarah5_phone.wav)) 1.2)
  CALL_END=$(add $T_S6 $(dur $PROC/sarah6_phone.wav))
  T_N4=68.0
  T_N5=$(awk -v a="$T_N4" -v d="$(dur $N4)" 'BEGIN{t=a+d+0.3; if(t<77.8)t=77.8; printf "%.3f", t}')
  T_N6=$(awk -v a="$T_N5" -v d="$(dur $N5)" 'BEGIN{t=a+d+0.3; if(t<91.8)t=91.8; printf "%.3f", t}')
  T_N7=102.0
  E4=$(add $T_N4 $(dur $N4)); E5=$(add $T_N5 $(dur $N5)); E6=$(add $T_N6 $(dur $N6)); E7=$(add $T_N7 $(dur $N7))
  echo "call: me1=$T_ME1 s1=$T_S1 me2=$T_ME2 s2=$T_S2 s3=$T_S3 me3=$T_ME3 s4=$T_S4 s5=$T_S5 s6=$T_S6 end=$CALL_END" | tee -a "$AUD/times.txt"
  echo "narration: n4=$T_N4-$E4 n5=$T_N5-$E5 n6=$T_N6-$E6 n7=$T_N7-$E7" | tee -a "$AUD/times.txt"
  # music envelope (t = seconds into the music segment, which starts at cut 66.0): base -14 dB, +10 dB lift under the
  # lowering shot before the theme's entrance, -8 dB under each narration line, pulled to silence across the serif line
  M0=66.0
  dk() { awk -v a="$1" -v b="$2" -v m="$M0" 'BEGIN{printf "-8*min(clip((t-(%.3f-0.25))/0.25,0,1),clip(((%.3f+0.6)-t)/0.6,0,1))", a-m, b-m}'; }
  # one duck across the whole narration block (gaps between lines are under 1.2 s; pumping there would be worse than staying down)
  ENV="pow(10,(-11+10*clip(1-(t-5.5)/1.5,0,1)-20*clip((t-31.5)/1.0,0,1)-40*clip((t-32.5)/3.0,0,1)+$(dk $T_N4 $E6))/20)"
  echo "music: theme src 4.0-17.0 at cut 0-13.0 (+4 dB, 1.5 s in, hard out on the thud); theme src 18.0-53.5 at cut 66.0-101.5; envelope: $ENV" >> "$AUD/times.txt"
  # phone-line hiss: the ElevenLabs clip came back at -70 LUFS, so synthesize band-limited pink noise and set it to -46 LUFS (pre-normalization)
  "$FFMPEG" -v error -y -f lavfi -i "anoisesrc=color=pink:amplitude=0.03:seed=7:d=28.0:r=48000" -af "highpass=f=300:poles=2,lowpass=f=3400:poles=2" "$PROC/hiss_synth_raw.wav"
  HI=$("$FFMPEG" -hide_banner -i "$PROC/hiss_synth_raw.wav" -af ebur128 -f null - 2>&1 | grep -E '^\s+I:' | tail -1 | awk '{print $2}')
  HG=$(awk -v i="$HI" 'BEGIN{printf "%.2f", -50-i}')
  "$FFMPEG" -v error -y -i "$PROC/hiss_synth_raw.wav" -af "volume=${HG}dB" "$PROC/hiss_synth.wav"
  echo "hiss: pink noise 300-3400 Hz, measured ${HI} LUFS, gain ${HG} dB -> -50 LUFS" | tee -a "$AUD/times.txt"
  fadeout() { awk -v d="$(dur "$1")" 'BEGIN{printf "%.3f", d-0.25}'; }
  I=( "$PROC/sarah1_phone.wav" "$PROC/sarah2_phone.wav" "$PROC/sarah3_phone.wav" "$PROC/sarah4_phone.wav" "$PROC/sarah5_phone.wav" "$PROC/sarah6_phone.wav" \
      "$OWN/me1.wav" "$OWN/me2.wav" "$OWN/me3.wav" "$N4" "$N5" "$N6" "$N7" \
      "$RAW/sfx_rain.mp3" "$RAW/sfx_horn.mp3" "$RAW/sfx_thud.mp3" "$RAW/sfx_room.mp3" "$PROC/hiss_synth.wav" "$MUSIC" "$MUSIC" )
  ARGS=(); for i in "${!I[@]}"; do case $i in 16) ARGS+=( -stream_loop 4 -i "${I[$i]}" );; *) ARGS+=( -i "${I[$i]}" );; esac; done
  pl() { echo "[$1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=$3,adelay=$(ms "$2")|$(ms "$2")"; }
  FC="$(pl 0 $T_S1 -2dB)[s1];$(pl 1 $T_S2 -2dB)[s2];$(pl 2 $T_S3 -2dB)[s3];$(pl 3 $T_S4 -2dB)[s4];$(pl 4 $T_S5 -2dB)[s5];$(pl 5 $T_S6 -2dB)[s6];
$(pl 6 $T_ME1 1dB)[m1];$(pl 7 $T_ME2 1dB)[m2];$(pl 8 $T_ME3 -1dB)[m3];
$(pl 9 $T_N4 -3dB)[n4];$(pl 10 $T_N5 -3dB)[n5];$(pl 11 $T_N6 -3dB)[n6];$(pl 12 $T_N7 -1dB)[n7];
[13:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=3.0:7.0,asetpts=PTS-STARTPTS,volume=-5dB,adelay=9000|9000[rain];
[14:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=2.0:2.8,asetpts=PTS-STARTPTS,afade=t=in:d=0.6,equalizer=f=3000:t=q:w=1.2:g=-3,volume=-9dB,adelay=12200|12200[horn];
[15:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:1.0,asetpts=PTS-STARTPTS,afade=t=out:st=0.6:d=0.4,volume=-3dB,adelay=13000|13000[thud];
[16:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:60.5,asetpts=PTS-STARTPTS,afade=t=in:d=0.4,afade=t=out:st=58.5:d=2.0,volume=10dB,adelay=17000|17000[room];
[17:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:28.0,asetpts=PTS-STARTPTS,afade=t=in:d=0.15,afade=t=out:st=27.5:d=0.5,adelay=38000|38000[hiss];
[18:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=18.0:53.5,asetpts=PTS-STARTPTS,afade=t=in:d=1.5,asetnsamples=n=256,volume='$ENV':eval=frame,adelay=66000|66000[music];
[19:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=4.0:17.0,asetpts=PTS-STARTPTS,afade=t=in:d=1.5,afade=t=out:st=12.95:d=0.05,volume=4dB[musicA];
sine=f=4000:d=3.0,aformat=sample_rates=48000:channel_layouts=stereo,afade=t=in:d=2.8,volume=-26dB,adelay=14000|14000[tone];
[s1][s2][s3][s4][s5][s6][m1][m2][m3][n4][n5][n6][n7]amix=inputs=13:normalize=0:dropout_transition=0,atrim=0:$TOTAL,apad=whole_dur=$TOTAL,alimiter=limit=0.354:attack=3:release=60:level=false[dial];
[rain][horn][thud][room][hiss][tone][music][musicA]amix=inputs=8:normalize=0:dropout_transition=0,atrim=0:$TOTAL,apad=whole_dur=$TOTAL,alimiter=limit=0.354:attack=3:release=60:level=false[bed];
[dial]asplit[dialA][dialB];[bed]asplit[bedA][bedB];
[dialA][bedA]amix=inputs=2:normalize=0:dropout_transition=0[mix]"
  "$FFMPEG" -v error -y "${ARGS[@]}" -filter_complex "$FC" -map "[mix]" -c:a pcm_s24le "$AUD/mix_li_raw.wav" -map "[dialB]" -c:a pcm_s24le "$AUD/stem_dialogue.wav" -map "[bedB]" -c:a pcm_s24le "$AUD/stem_bed.wav" || { echo "AUDIO MIX FAILED"; exit 1; }
  J=$("$FFMPEG" -hide_banner -nostats -i "$AUD/mix_li_raw.wav" -af "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
  g() { echo "$J" | grep "\"$1\"" | sed -E 's/.*: *"([^"]+)".*/\1/'; }
  echo "mix pass1: I=$(g input_i) TP=$(g input_tp) LRA=$(g input_lra) thresh=$(g input_thresh) offset=$(g target_offset)" | tee -a "$AUD/times.txt"
  "$FFMPEG" -v error -y -i "$AUD/mix_li_raw.wav" -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true:print_format=summary" -ar 48000 -c:a pcm_s24le "$AUD/mix_li.wav" 2>&1 | grep -E 'Normalization Type|Output Integrated|Output True Peak' | tee -a "$AUD/times.txt"
  # timeline for captions
  cat > "$AUD/li_timeline.json" <<EOF
{ "total": $TOTAL, "items": [
 { "id": "me1", "who": "me", "file": "$OWN/me1.wav", "start": $T_ME1, "dur": $(dur $OWN/me1.wav), "caption": "hello?" },
 { "id": "sarah1", "who": "sarah", "file": "$PROC/sarah1_phone.wav", "start": $T_S1, "dur": $(dur $PROC/sarah1_phone.wav), "caption": "hi." },
 { "id": "me2", "who": "me", "file": "$OWN/me2.wav", "start": $T_ME2, "dur": $(dur $OWN/me2.wav), "caption": "i miss you." },
 { "id": "sarah2", "who": "sarah", "file": "$PROC/sarah2_phone.wav", "start": $T_S2, "dur": $(dur $PROC/sarah2_phone.wav), "caption": "i know." },
 { "id": "sarah3", "who": "sarah", "file": "$PROC/sarah3_phone.wav", "start": $T_S3, "dur": $(dur $PROC/sarah3_phone.wav), "caption": "you had the hackathon today. | how'd it actually go." },
 { "id": "me3", "who": "me", "file": "$OWN/me3.wav", "start": $T_ME3, "dur": $(dur $OWN/me3.wav), "caption": "it was okay." },
 { "id": "sarah4", "who": "sarah", "file": "$PROC/sarah4_phone.wav", "start": $T_S4, "dur": $(dur $PROC/sarah4_phone.wav), "caption": "you said okay every time it went well." },
 { "id": "sarah5", "who": "sarah", "file": "$PROC/sarah5_phone.wav", "start": $T_S5, "dur": $(dur $PROC/sarah5_phone.wav), "caption": "it's sunday. | tuesday i'd have been at the salon. eleven, same as always." },
 { "id": "sarah6", "who": "sarah", "file": "$PROC/sarah6_phone.wav", "start": $T_S6, "dur": $(dur $PROC/sarah6_phone.wav), "caption": "go get some sleep. | love you." },
 { "id": "nar4", "who": "narr", "file": "$N4", "start": $T_N4, "dur": $(dur $N4), "caption": "i built this in one afternoon, at a yc hackathon. | a message export, a voice sample, | and remnant builds a reflection of someone you lost." },
 { "id": "nar5", "who": "narr", "file": "$N5", "start": $T_N5, "dur": $(dur $N5), "caption": "her memory is in gbrain. | the model is a lora on her messages, through river. | her voice is elevenlabs, behind a consent gate. | the memory and the weights are mine, not a company's." },
 { "id": "nar6", "who": "narr", "file": "$N6", "start": $T_N6, "dur": $(dur $N6), "caption": "never claims to be alive, never texts first, | and in a crisis it steps aside." },
 { "id": "nar7", "who": "narr", "file": "$N7", "start": $T_N7, "dur": $(dur $N7), "caption": "they said, own your intelligence. | nothing is more yours than the people you loved." }
] }
EOF
fi

# ---------- captions ----------
if [ "$STEP" = captions ] || [ "$STEP" = all ]; then
  node "$V/scripts/li_captions.cjs" "$AUD/li_timeline.json" "$FFMPEG" "$LI" "$OUT/captions" | tee "$LI/captions.log" | tail -40
fi

# ---------- mux: burn captions, encode, mux ----------
if [ "$STEP" = mux ] || [ "$STEP" = all ]; then
  for A in $ASPECTS; do
    name=$([ "$A" = 169 ] && echo 16x9 || echo 4x5)
    "$FFMPEG" -v error -y -i "$LI/video_$A.mp4" -i "$AUD/mix_li.wav" -vf "subtitles=$LI/cap_$A.ass:fontsdir=$FONTS" -map 0:v -map 1:a -c:v libx264 -preset medium -crf 17 -maxrate 18M -bufsize 36M -pix_fmt yuv420p -g 48 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest "$OUT/remnant_linkedin_$name.mp4"
    echo "== remnant_linkedin_$name.mp4"; "$FFPROBE" -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,sample_rate,channels -of compact=p=0:nk=0 "$OUT/remnant_linkedin_$name.mp4"
    "$FFMPEG" -hide_banner -i "$OUT/remnant_linkedin_$name.mp4" -af ebur128=peak=true -f null - 2>&1 | grep -E '^\s+(I:|Peak:)' | tail -2
  done
fi

# ---------- qa ----------
if [ "$STEP" = qa ] || [ "$STEP" = all ]; then
  for A in $ASPECTS; do
    name=$([ "$A" = 169 ] && echo 16x9 || echo 4x5); f="$OUT/remnant_linkedin_$name.mp4"
    if [ "$A" = 169 ]; then "$FFMPEG" -v error -y -i "$f" -vf "fps=1,scale=240:-1,tile=12x10" "$LI/qa_sheet_$name.jpg"; else "$FFMPEG" -v error -y -i "$f" -vf "fps=1,scale=180:-1,tile=12x10" "$LI/qa_sheet_$name.jpg"; fi
    echo "== luma of couch shots ($name): max frame-average Y (0-255)"
    for s in s02_couch_look s10_couch_typing s14_couch_calltap s15_couch_call1 s17_couch_call2 s19_couch_lower; do
      printf "  %-18s " $s; "$FFMPEG" -hide_banner -i "$LI/seg$A/$s.mp4" -vf "signalstats,metadata=print:key=lavfi.signalstats.YAVG" -f null - 2>&1 | grep -oE 'YAVG=[0-9.]+' | cut -d= -f2 | sort -n | tail -1; done
  done
  echo "== room-noise check: RMS (dBFS) of the final mix in windows with no line of yours"
  src="$AUD/times.txt"; me1=$(grep -oE 'me1=[0-9.]+' $src | cut -d= -f2); s1=$(grep -oE ' s1=[0-9.]+' $src | cut -d= -f2); me2=$(grep -oE 'me2=[0-9.]+' $src | cut -d= -f2); s2=$(grep -oE ' s2=[0-9.]+' $src | cut -d= -f2); me3=$(grep -oE 'me3=[0-9.]+' $src | cut -d= -f2); s4=$(grep -oE ' s4=[0-9.]+' $src | cut -d= -f2)
  win() { printf "  %-34s " "$1"; "$FFMPEG" -hide_banner -i "$AUD/mix_li.wav" -af "atrim=$2:$3,astats=measure_overall=RMS_level+Peak_level:measure_perchannel=none" -f null - 2>&1 | grep -E 'RMS level|Peak level' | sed -E 's/.*(RMS level|Peak level)[^:]*: */\1=/' | tr '\n' ' '; echo; }
  win "0-2 s (cold open, should be silent)" 0 2
  win "36.5-38.9 s (hiss bed only)" 36.5 38.9
  win "after hello?, before sarah" $(awk -v a=$me1 'BEGIN{print a+0.7}') $(awk -v a=$s1 'BEGIN{print a-0.1}')
  win "after i miss you, before sarah" $(awk -v a=$me2 'BEGIN{print a+0.9}') $(awk -v a=$s2 'BEGIN{print a-0.1}')
  win "during hello?" $me1 $(awk -v a=$me1 'BEGIN{print a+0.5}')
  win "during i miss you" $me2 $(awk -v a=$me2 'BEGIN{print a+0.7}')
  win "during okay" $me3 $(awk -v a=$me3 'BEGIN{print a+0.5}')
  echo "== horn moment (12.2-13.0 s) momentary max in the final mix"
  "$FFMPEG" -hide_banner -i "$AUD/mix_li.wav" -af "atrim=12.0:13.2,ebur128=peak=true" -f null - 2>&1 | grep -E '^\s+(I:|Peak:)' | tr -s ' ' | tr '\n' ' '; echo
  echo "== captions vs audio: speech-to-text of the final mix dialogue and narration sections"
  "$FFMPEG" -v error -y -i "$AUD/mix_li.wav" -af "atrim=38:110.5,asetpts=PTS-STARTPTS" -ac 1 -ar 16000 "$AUD/stt/final_speech.wav"
  node "$V/scripts/stt_couch.cjs" "$FFMPEG" "$AUD/stt/final_speech.wav" 2>&1 | grep -E '^==' | sed 's/^== final_speech.16k: /  stt: /'
  echo "  srt: $(grep -vE '^[0-9]+$|-->|^$' "$OUT/captions/remnant_linkedin_16x9.srt" | tr '\n' ' ')"
fi
