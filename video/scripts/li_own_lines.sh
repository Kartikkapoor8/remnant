#!/bin/bash
# The user's three call lines from the live take (IMG_2162.MOV, stream 0:a:0):
# denoise (rnnoise "mp" model), gain to Sarah's speech level, gate the room between words, trim to the words.
# Writes video/out/audio/li/own/me{1,2,3}.wav (+ me3b alternate) and a level report.
set -u
S=/private/tmp/claude-501/-Users-kartik/c0196dd7-d520-431a-8553-29ac7a7af21b/scratchpad
FF=${FFMPEG:-$S/ffmpeg}
MODEL=${RNN_MODEL:-$S/fonts/mp.rnnn}
SRC=${OWN_SRC:-/Users/kartik/Downloads/IMG_2162.MOV}
O=/Users/kartik/hack/remnant-explainer/video/out/audio/li/own
mkdir -p "$O"
TARGET_RMS_PEAK=-17   # Sarah's phone-chain clips measure -15 to -17 dBFS RMS peak
# id  window-start  window-len  keep-from  keep-to   (keep = speech extent inside the window, seconds)
LINES=(
  "me1 48.56 0.60 0.02 0.34"
  "me2 57.32 0.75 0.10 0.64"
  "me3 81.00 0.72 0.08 0.58"
)
for spec in "${LINES[@]}"; do set -- $spec; id=$1; ss=$2; d=$3; k0=$4; k1=$5
  "$FF" -v error -y -ss "$ss" -t "$d" -i "$SRC" -map 0:a:0 -ac 1 -ar 48000 "$O/${id}_raw.wav"
  "$FF" -v error -y -i "$O/${id}_raw.wav" -af "arnndn=m=$MODEL:mix=0.8" "$O/${id}_dn.wav"
  rp=$("$FF" -hide_banner -i "$O/${id}_dn.wav" -af "atrim=$k0:$k1,astats=measure_overall=RMS_peak:measure_perchannel=none" -f null - 2>&1 | grep "RMS peak" | sed -E 's/.*: *//')
  gain=$(awk -v r="$rp" -v t="$TARGET_RMS_PEAK" 'BEGIN{printf "%.2f", t-r}')
  fo=$(awk -v a="$k0" -v b="$k1" 'BEGIN{printf "%.3f", b-a-0.10}')
  "$FF" -v error -y -i "$O/${id}_dn.wav" -af "volume=${gain}dB,agate=threshold=0.0126:ratio=4:range=0.01:attack=5:release=150:knee=2.8,highpass=f=100:poles=2,atrim=$k0:$k1,asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st=$fo:d=0.10" "$O/${id}.wav"
  printf "%-5s rms_peak_dn=%s gain=%+sdB  " "$id" "$rp" "$gain"
  "$FF" -hide_banner -i "$O/${id}.wav" -af "ebur128=peak=true" -f null - 2>&1 | grep -E '^\s+(I:|Peak:)' | tr -s ' ' | tr '\n' ' '
  "$FF" -hide_banner -i "$O/${id}.wav" -af "astats=measure_overall=RMS_peak+Noise_floor:measure_perchannel=none" -f null - 2>&1 | grep -E 'RMS peak|Noise floor' | sed -E 's/.*(RMS peak|Noise floor)[^:]*: */\1=/' | tr '\n' ' '
  # room left in the 80 ms before the words and after them (should be far below the speech)
  pre=$("$FF" -hide_banner -i "$O/${id}.wav" -af "atrim=0:0.06,astats=measure_overall=RMS_level:measure_perchannel=none" -f null - 2>&1 | grep 'RMS level' | sed -E 's/.*: *//')
  printf "pre_rms=%s\n" "$pre"
done
