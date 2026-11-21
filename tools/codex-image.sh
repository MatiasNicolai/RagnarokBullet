#!/usr/bin/env bash
# Generate one art source through the Codex CLI with a pinned model and effort.
#
#   tools/codex-image.sh <prompt.txt> <out.png> [reference.png ...]
#
# Every art call goes through here so the model never drifts:
#   model  = $CODEX_MODEL  (default gpt-6-sol)
#   effort = $CODEX_EFFORT (default medium)
#
# Codex's Windows sandbox can't write into the repo, so the image is copied
# byte-for-byte from ~/.codex/generated_images/<session>/ to <out.png>.
# Approved sources are immutable: this refuses to overwrite an existing file
# (generate a -v2 instead).
set -euo pipefail

MODEL="${CODEX_MODEL:-gpt-6-sol}"
EFFORT="${CODEX_EFFORT:-medium}"

if [ $# -lt 2 ]; then
  echo "usage: $0 <prompt.txt> <out.png> [reference.png ...]" >&2
  exit 2
fi
PROMPT_FILE="$1"; OUT="$2"; shift 2

[ -f "$PROMPT_FILE" ] || { echo "prompt not found: $PROMPT_FILE" >&2; exit 2; }
[ -e "$OUT" ] && { echo "refusing to overwrite $OUT (sources are immutable; use -vN+1)" >&2; exit 2; }

IMAGES=()
for ref in "$@"; do
  [ -f "$ref" ] || { echo "reference not found: $ref" >&2; exit 2; }
  IMAGES+=("--image=$ref")   # '=' form: a bare -i swallows the prompt
done

GEN_DIR="$HOME/.codex/generated_images"
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

echo "codex: model=$MODEL effort=$EFFORT refs=$# -> $OUT" >&2
codex exec -s workspace-write \
  -m "$MODEL" -c "model_reasoning_effort=\"$EFFORT\"" \
  "${IMAGES[@]}" \
  "$(cat "$PROMPT_FILE")" </dev/null 2>&1 | tee "$LOG" >&2

# Take the image from this run's own session folder, so parallel runs can't swap outputs.
SESSION="$(grep -m1 -oE 'session id: [0-9a-f-]+' "$LOG" | awk '{print $3}')"
[ -n "$SESSION" ] || { echo "no session id in codex output" >&2; exit 1; }
grep -q "model: $MODEL" "$LOG" || { echo "codex did not run on $MODEL" >&2; exit 1; }
NEWEST="$(find "$GEN_DIR/$SESSION" -type f -name '*.png' -printf '%T@ %p\n' 2>/dev/null \
  | sort -n | tail -1 | cut -d' ' -f2-)"
[ -n "$NEWEST" ] || { echo "no image under $GEN_DIR/$SESSION" >&2; exit 1; }

mkdir -p "$(dirname "$OUT")"
cp "$NEWEST" "$OUT"
echo "saved $OUT  (from $NEWEST)" >&2
sha256sum "$OUT"
