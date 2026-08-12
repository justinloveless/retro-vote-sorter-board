#!/bin/sh
# Pin heavy Coolify/Docker build steps to a single core.
# `nice` alone does NOT cap CPU — a niced Vite build still pegs every core.
set -eu

CPU_LIST="${BUILD_CPU_LIST:-0}"
export GOMAXPROCS="${GOMAXPROCS:-1}"
export RAYON_NUM_THREADS="${RAYON_NUM_THREADS:-1}"
export UV_THREADPOOL_SIZE="${UV_THREADPOOL_SIZE:-1}"

if command -v taskset >/dev/null 2>&1; then
  exec nice -n 19 taskset -c "$CPU_LIST" "$@"
fi

echo "run-cpu-limited: taskset not found; falling back to nice only" >&2
exec nice -n 19 "$@"
