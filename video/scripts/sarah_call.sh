#!/bin/bash
# Assembles Sarah's six phone-treated lines with fixed gaps and a hiss bed into video/out/sarah_call.mp4 (black picture).
set -e
R=/Users/kartik/hack/remnant-explainer; cd "$R"
S=/private/tmp/claude-501/-Users-kartik/c0196dd7-d520-431a-8553-29ac7a7af21b/scratchpad
FF=${FFMPEG:-$S/ffmpeg}
export DYLD_LIBRARY_PATH=$R/video/node_modules/@remotion/compositor-darwin-arm64
FP=$DYLD_LIBRARY_PATH/ffprobe
dur() { "$FP" -v error -show_entries format=duration -of csv=p=0 "$1"; }
mkdir -p video/out/sarah
# lines are generated straight into video/out/sarah/ with the user voice ID
gaps=(4 4 2 3 1 1.5); t=0; FC=""; IN=""; starts=()
for i in 0 1 2 3 4 5; do n=$((i+1)); f=video/out/sarah/sarah_line$n.mp3; d=$(dur $f)
  t=$(awk -v t=$t -v g=${gaps[$i]} 'BEGIN{printf "%.3f", t+g}'); starts+=($t)
  st=$(awk -v d=$d 'BEGIN{printf "%.3f", d-0.25}'); ms=$(awk -v t=$t 'BEGIN{printf "%d", t*1000}')
  IN="$IN -i $f"
  FC="$FC[$i:a]aformat=sample_rates=48000:channel_layouts=stereo,highpass=f=300:poles=2,lowpass=f=3400:poles=2,acompressor=threshold=-18dB:ratio=3:attack=5:release=80:makeup=2,afade=t=in:d=0.15,afade=t=out:st=$st:d=0.25,adelay=$ms|$ms[l$n];"
  t=$(awk -v t=$t -v d=$d 'BEGIN{printf "%.3f", t+d}')
done
TOTAL=$(awk -v t=$t 'BEGIN{printf "%.3f", t+3}')
FO=$(awk -v T=$TOTAL 'BEGIN{printf "%.2f",T-0.5}')
FC="$FC[6:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:$TOTAL,asetpts=PTS-STARTPTS,afade=t=in:d=0.3,afade=t=out:st=$FO:d=0.5,volume=-30dB[hiss];[l1][l2][l3][l4][l5][l6][hiss]amix=inputs=7:normalize=0:dropout_transition=0,atrim=0:$TOTAL,apad=whole_dur=$TOTAL,alimiter=limit=0.891:level=false[a]"
$FF -v error -y $IN -stream_loop 2 -i video/out/audio/raw/sfx_hiss.mp3 -f lavfi -i "color=c=black:s=1920x1080:r=24" -filter_complex "$FC" -map 7:v -map "[a]" -t $TOTAL -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -movflags +faststart video/out/sarah_call.mp4
"$FP" -v error -show_entries format=duration:stream=codec_name,sample_rate -of compact=p=0:nk=0 video/out/sarah_call.mp4
echo "TOTAL $TOTAL"
for i in 0 1 2 3 4 5; do n=$((i+1)); echo "L$n start ${starts[$i]} dur $(dur video/out/sarah/sarah_line$n.mp3)"; done
