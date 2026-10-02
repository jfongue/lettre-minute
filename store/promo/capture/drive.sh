#!/bin/zsh
# Films one take on the emulator and logs when each gesture happened, so the
# sound score can be laid on the footage without hunting for it frame by frame.
#   drive.sh <out-basename> <home|replay> <seconds to keep filming after the words> word...
# A word is typed letter by letter, at a human pace: "_" hesitates, "<" is a
# backspace (so "romu<arin" types a slip and corrects it). JOKER casts Tricherie,
# and a word starting with "!" is typed at once, for prompts the edit cuts away.
zmodload zsh/datetime
OUT=$1; START=$2; TAIL=$3; shift 3
LOG=$OUT.log; : > $LOG
note() { printf '%.3f %s\n' $(( EPOCHREALTIME - T0 )) "$*" >> $LOG }
pause() { sleep $(( $1 + RANDOM % 1000 / 1000.0 * ($2 - $1) )) }
type_word() {
  for ch in ${(s::)1}; do
    case $ch in
      _) pause 0.6 1.1 ;;
      '<') adb shell input keyevent 67; note back; pause 0.25 0.45 ;;
      *) adb shell input text "$ch"; note key $ch; pause 0.12 0.32 ;;
    esac
  done
}
adb shell rm -f /sdcard/take.mp4
adb shell screenrecord --bit-rate 16000000 /sdcard/take.mp4 & REC=$!
T0=$EPOCHREALTIME; sleep 1.5
if [ $START = replay ]; then adb shell input tap 540 1510; else adb shell input tap 540 1180; fi
note play; sleep 9
for w in "$@"; do
  if [ $w = JOKER ]; then type_word Joker; pause 0.5 0.8; adb shell input keyevent 66; note cast; sleep 2.2; adb shell input keyevent 66; note enter
  elif [[ $w = !* ]]; then adb shell input text ${w#!}; note fast; sleep 0.3; adb shell input keyevent 66; note enter
  else type_word $w; pause 0.4 0.8; adb shell input keyevent 66; note enter; fi
  [[ $w = !* ]] && sleep 0.4 || pause 1.0 1.6
done
note done; sleep $TAIL
adb shell pkill -INT screenrecord; wait $REC; sleep 2
adb pull /sdcard/take.mp4 $OUT.mp4 >/dev/null && echo "$OUT.mp4"
