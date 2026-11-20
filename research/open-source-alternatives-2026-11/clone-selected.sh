#!/usr/bin/env bash
# Clone reviewed upstream GitHub source repositories; DO NOT install or run the projects.
# Usage: bash clone-selected.sh [list|higgsfield|video|business|all] [destination_directory]
set -euo pipefail

MODE="${1:-list}"
DEST="${2:-$HOME/ai-open-source-repositories}"

case "$MODE" in
  list|higgsfield|video|business|all) ;;
  *) echo "Usage: $0 [list|higgsfield|video|business|all] [destination_directory]" >&2; exit 2;;
esac

if [[ "$MODE" == "list" ]]; then
cat <<'CATALOG'
HIGGSFIELD VIDEO
  Anil-matcha/Open-Generative-AI  (exact repo from Instagram screenshot)
  Comfy-Org/ComfyUI               (local AI workflow engine)
  Lightricks/LTX-Desktop          (local AI video app)
  Wan-Video/Wan2.2                (open video models)
  D3voz/openjutsu                 (local character / object swap)
  RVC-Boss/GPT-SoVITS             (voice cloning / TTS)
  TMElyralab/MuseTalk             (lip sync)
  KlingAIResearch/LivePortrait   (portrait driving)
  deepbeepmeep/WanGP              (local model runtime; optional)

BUSINESS
  towfiqi/serpbear                (SEO keyword tracking)
  AppFlowy-IO/AppFlowy            (Notion-like docs)
  makeplane/plane                 (Asana-like tasks)
  alextselegidis/easyappointments (Calendly-like scheduling)
  chatwoot/chatwoot               (Intercom-like support)
  CapSoftware/Cap                 (Loom-like recordings)

This script only clones code. Model weights, runtime dependencies and GPU hosting are separate.
CATALOG
exit 0
fi

command -v git >/dev/null 2>&1 || { echo "git is required" >&2; exit 1; }
mkdir -p "$DEST"

clone_repo() {
  local full="$1"
  local folder="${full//\//__}"
  local target="$DEST/$folder"
  local url="https://github.com/$full.git"
  if [[ -d "$target/.git" ]]; then
    printf 'SKIP already cloned: %s\n' "$target"
    return 0
  fi
  if [[ -e "$target" ]]; then
    printf 'SKIP path exists and is not a git checkout: %s\n' "$target" >&2
    return 0
  fi
  printf 'CLONE %s -> %s\n' "$full" "$target"
  if [[ "$full" == "Anil-matcha/Open-Generative-AI" ]]; then
    # This repo contains linked workflow/agent submodules.
    git clone --depth 1 --recurse-submodules --shallow-submodules "$url" "$target"
  else
    git clone --depth 1 "$url" "$target"
  fi
}

if [[ "$MODE" == "higgsfield" || "$MODE" == "video" || "$MODE" == "all" ]]; then
  clone_repo "Anil-matcha/Open-Generative-AI"
  clone_repo "Comfy-Org/ComfyUI"
  clone_repo "Lightricks/LTX-Desktop"
  clone_repo "Wan-Video/Wan2.2"
fi
if [[ "$MODE" == "video" || "$MODE" == "all" ]]; then
  clone_repo "D3voz/openjutsu"
  clone_repo "RVC-Boss/GPT-SoVITS"
  clone_repo "TMElyralab/MuseTalk"
  clone_repo "KlingAIResearch/LivePortrait"
  clone_repo "deepbeepmeep/WanGP"
fi
if [[ "$MODE" == "business" || "$MODE" == "all" ]]; then
  clone_repo "towfiqi/serpbear"
  clone_repo "AppFlowy-IO/AppFlowy"
  clone_repo "makeplane/plane"
  clone_repo "alextselegidis/easyappointments"
  clone_repo "chatwoot/chatwoot"
  clone_repo "CapSoftware/Cap"
fi

echo "Repository download completed. Nothing has been installed or deployed."
