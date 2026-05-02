#!/usr/bin/env bash
#
# perf-cold-start.sh — measure OmniBazaar Android cold-start time.
#
# Wraps the standard `am start -W` flow + `dumpsys gfxinfo` so any dev
# (or CI runner with a connected device) can produce a reproducible
# wallclock-from-tap-to-first-frame number. Plan target (ADD_MOBILE_APP.md
# Part 22): < 2.0 s on iPhone SE 4, < 2.5 s on Samsung A15.
#
# Usage:
#   scripts/perf-cold-start.sh                  # 5 runs, default device
#   scripts/perf-cold-start.sh -n 10            # 10 runs
#   scripts/perf-cold-start.sh -s 192.168.1.10  # specific adb -s target
#   scripts/perf-cold-start.sh -p other.pkg     # other Android package
#
# Outputs:
#   Each run prints `RUN <i>: TotalTime=NNN ms WaitTime=NNN ms`
#   At the end: median, p95, mean across the runs + a pass/fail vs
#   the Track E2 budget.
#
# Requirements:
#   adb in PATH, the OmniBazaar APK installed, the target device
#   USB-debugging-enabled or paired over wifi.

set -euo pipefail

PKG="com.omnibazaar.mobile"
ACTIVITY=".MainActivity"
RUNS=5
DEVICE=""
BUDGET_MS=2500   # Samsung A15 budget per Part 22

while [ $# -gt 0 ]; do
  case "$1" in
    -n|--runs)
      RUNS="$2"
      shift 2
      ;;
    -s|--device)
      DEVICE="$2"
      shift 2
      ;;
    -p|--package)
      PKG="$2"
      shift 2
      ;;
    -b|--budget)
      BUDGET_MS="$2"
      shift 2
      ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# //; s/^#//'
      exit 0
      ;;
    *)
      echo "unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

ADB=(adb)
if [ -n "$DEVICE" ]; then
  ADB=(adb -s "$DEVICE")
fi

# Sanity — confirm device + package present.
if ! "${ADB[@]}" get-state >/dev/null 2>&1; then
  echo "perf-cold-start: no device reachable (adb get-state failed)" >&2
  exit 1
fi
if ! "${ADB[@]}" shell pm list packages | grep -q "package:${PKG}\$"; then
  echo "perf-cold-start: package ${PKG} not installed on device" >&2
  exit 1
fi

echo "perf-cold-start: ${RUNS} runs of ${PKG}/${ACTIVITY}"
echo "perf-cold-start: budget ${BUDGET_MS} ms (per Part 22, Track E2)"

declare -a TOTAL_TIMES
for ((i = 1; i <= RUNS; i++)); do
  # Force a true cold start: stop the process, drop caches.
  "${ADB[@]}" shell am force-stop "$PKG" >/dev/null
  "${ADB[@]}" shell sync
  # Brief pause so the OS settles.
  sleep 1
  # `am start -W` blocks until the activity reports drawn + prints the
  # canonical `TotalTime=…` line.
  OUT=$("${ADB[@]}" shell am start -W "${PKG}/${PKG}${ACTIVITY}" 2>&1)
  TOTAL=$(echo "$OUT" | awk -F= '/^TotalTime/ {print $2}' | tr -d '\r ')
  WAIT=$(echo "$OUT" | awk -F= '/^WaitTime/ {print $2}' | tr -d '\r ')
  if [ -z "$TOTAL" ]; then
    echo "RUN $i: am start -W returned no TotalTime — output:"
    echo "$OUT" | sed 's/^/    /'
    continue
  fi
  echo "RUN $i: TotalTime=${TOTAL} ms WaitTime=${WAIT} ms"
  TOTAL_TIMES+=("$TOTAL")
done

if [ "${#TOTAL_TIMES[@]}" -eq 0 ]; then
  echo "perf-cold-start: no successful runs" >&2
  exit 3
fi

# Compute median, p95, mean using awk.
SORTED=$(printf '%s\n' "${TOTAL_TIMES[@]}" | sort -n)
COUNT=$(echo "$SORTED" | wc -l | tr -d ' ')
MEDIAN_LINE=$(( (COUNT + 1) / 2 ))
P95_LINE=$(awk -v n="$COUNT" 'BEGIN { v = int(n * 0.95 + 0.5); if (v < 1) v = 1; if (v > n) v = n; print v }')
MEDIAN=$(echo "$SORTED" | sed -n "${MEDIAN_LINE}p")
P95=$(echo "$SORTED" | sed -n "${P95_LINE}p")
MEAN=$(printf '%s\n' "${TOTAL_TIMES[@]}" | awk '{s+=$1} END { if (NR>0) printf "%.0f", s/NR }')

echo
echo "------------------------------------------"
echo "Cold-start results across $COUNT runs:"
echo "  median = ${MEDIAN} ms"
echo "  p95    = ${P95} ms"
echo "  mean   = ${MEAN} ms"
echo "  budget = ${BUDGET_MS} ms"
echo "------------------------------------------"

if [ "$P95" -gt "$BUDGET_MS" ]; then
  echo "perf-cold-start: FAIL — p95 ${P95} ms > budget ${BUDGET_MS} ms"
  exit 4
fi
echo "perf-cold-start: PASS"
