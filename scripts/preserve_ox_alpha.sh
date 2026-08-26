#!/bin/zsh
set -euo pipefail

MODEL_REPO="zai-org/GLM-5.3-Flash"
MODEL_REVISION="84c6a6a"
EXPECTED_BYTES=$((328 * 1000 * 1000 * 1000))
MIN_FREE_BYTES=$((EXPECTED_BYTES + 40 * 1000 * 1000 * 1000))
DEST="$HOME/Models/Ox-Alpha/GLM-5.3-Flash"
STATE="$HOME/Models/Ox-Alpha/preservation-state.json"
LOG="$HOME/Models/Ox-Alpha/preservation.log"
mkdir -p "$HOME/Models/Ox-Alpha"

log(){ printf '%s\n' "$*" | tee -a "$LOG"; }
log "OX_PRESERVE_START=1"
log "OX_SOURCE_REPO=$MODEL_REPO"
log "OX_SOURCE_REVISION=$MODEL_REVISION"
log "OX_LICENSE=MIT"
log "OX_EXPECTED_REPO_BYTES=$EXPECTED_BYTES"

FREE_BYTES="$(df -Pk "$HOME" | awk 'NR==2 {print $4 * 1024}')"
log "OX_FREE_BYTES=$FREE_BYTES"
if [ "$FREE_BYTES" -lt "$MIN_FREE_BYTES" ]; then
  log "OX_DOWNLOAD_SKIPPED_INSUFFICIENT_SPACE=1"
  python3 - "$STATE" "$FREE_BYTES" "$EXPECTED_BYTES" <<'PY'
import json,sys,datetime
p,free,expected=sys.argv[1:]
json.dump({"status":"blocked_insufficient_space","model":"zai-org/GLM-5.3-Flash","revision":"84c6a6a","license":"MIT","expected_bytes":int(expected),"free_bytes":int(float(free)),"checked_at":datetime.datetime.now(datetime.timezone.utc).isoformat()},open(p,"w"),indent=2)
PY
  exit 0
fi

if [ -e "$DEST" ]; then
  log "OX_EXISTING_DESTINATION=1"
else
  mkdir -p "$DEST"
fi

# Install the official Hugging Face client if needed. No token is required for this public MIT repo.
python3 -m pip install --user -q --upgrade 'huggingface_hub[hf_xet]' || python3 -m pip install --user -q --upgrade huggingface_hub
HF_BIN="$(python3 - <<'PY'
import shutil
print(shutil.which('hf') or shutil.which('huggingface-cli') or '')
PY
)"
if [ -z "$HF_BIN" ]; then
  for c in "$HOME/Library/Python/3.9/bin/hf" "$HOME/.local/bin/hf"; do [ -x "$c" ] && HF_BIN="$c" && break; done
fi
[ -n "$HF_BIN" ] || { log "OX_HF_CLIENT_MISSING=1"; exit 31; }

# Pin to the observed official revision rather than floating main.
if "$HF_BIN" download "$MODEL_REPO" --revision "$MODEL_REVISION" --local-dir "$DEST"; then
  log "OX_DOWNLOAD_COMPLETE=1"
else
  log "OX_DOWNLOAD_FAILED=1"
  exit 32
fi

# Record cryptographic checksums for every downloaded file and the exact repository revision.
(cd "$DEST" && find . -type f -not -name 'SHA256SUMS' -print0 | sort -z | xargs -0 shasum -a 256 > SHA256SUMS)
COUNT="$(find "$DEST" -type f -name 'model-*.safetensors' | wc -l | tr -d ' ')"
SIZE="$(du -sk "$DEST" | awk '{print $1 * 1024}')"
LICENSE_OK=0
[ -f "$DEST/LICENSE" ] && grep -qi 'MIT License' "$DEST/LICENSE" && LICENSE_OK=1
log "OX_SAFETENSOR_SHARDS=$COUNT"
log "OX_LOCAL_BYTES=$SIZE"
log "OX_LICENSE_VERIFIED=$LICENSE_OK"

python3 - "$STATE" "$SIZE" "$COUNT" <<'PY'
import json,sys,datetime
p,size,count=sys.argv[1:]
json.dump({"status":"preserved","identity":"Ox Alpha official source release","model":"zai-org/GLM-5.3-Flash","publisher":"Z.ai","revision":"84c6a6a","license":"MIT","local_bytes":int(float(size)),"safetensor_shards":int(count),"checksums":"SHA256SUMS","preserved_at":datetime.datetime.now(datetime.timezone.utc).isoformat()},open(p,"w"),indent=2)
PY

# Do not replace or stop Qwen. Verify the existing local port remains untouched.
if lsof -nP -iTCP:8080 -sTCP:LISTEN >/dev/null 2>&1; then log "QWEN_PORT_8080_PRESERVED=1"; else log "QWEN_PORT_8080_PRESERVED=UNKNOWN"; fi

# Local inference is attempted only if an already-installed compatible runner can use the checkpoint.
# Failure here does not delete weights; preservation remains successful.
INFERENCE=0
if command -v vllm >/dev/null 2>&1; then
  log "OX_LOCAL_RUNNER_AVAILABLE=vllm"
elif python3 -c 'import transformers' >/dev/null 2>&1; then
  log "OX_LOCAL_RUNNER_AVAILABLE=transformers"
else
  log "OX_LOCAL_RUNNER_AVAILABLE=none"
fi
log "OX_LOCAL_INFERENCE_VERIFIED=$INFERENCE"
log "OX_PRESERVE_OK=1"
