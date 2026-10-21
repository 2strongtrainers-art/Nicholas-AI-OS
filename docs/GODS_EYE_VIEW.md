# God's Eye View integration

This integrates Bilawal Sidhu's MIT-licensed `gods-eye-view` project into Nicholas AI OS without copying secrets or vendor configuration into this repository.

## What the upstream project actually is

The canonical project is a browser-based real-time Earth intelligence console built on Cesium/Vite. Its current package metadata describes a photorealistic 3D globe with live aircraft, ships, satellites, earthquakes, CCTV, traffic, fire data, voice control, and supporting data providers.

## One-command launcher

Run from the Nicholas-AI-OS repository:

```bash
bash scripts/gods_eye_view.sh
```

The launcher:

1. clones the canonical project into `~/.nicholas-ai-os/apps/gods-eye-view` if needed;
2. validates the Node runtime expected by upstream;
3. installs locked dependencies with `npm ci`;
4. runs upstream's `npm run doctor` setup validation;
5. starts Vite locally on `http://localhost:4173`;
6. waits for an HTTP health response before declaring the app operational;
7. opens the browser automatically on macOS/Linux when supported.

Useful commands:

```bash
bash scripts/gods_eye_view.sh status
bash scripts/gods_eye_view.sh restart
bash scripts/gods_eye_view.sh update
bash scripts/gods_eye_view.sh logs
bash scripts/gods_eye_view.sh stop
```

## Data/API setup

The launcher deliberately does not place API keys in GitHub. Some richer upstream layers require provider credentials or local settings. Start the app, follow its settings/setup flow, and keep secrets in the upstream project's supported local environment/configuration rather than committing them to Nicholas-AI-OS.

## Nicholas AI OS improvement path

Recommended next iteration after the base app is proven healthy:

- add a Nicholas-specific preset for Tri-Valley / California;
- expose God’s Eye View from the AI switchboard as a first-class module;
- add source-health badges (`LIVE`, `DELAYED`, `STALE`, `OFFLINE`);
- add a simplified mobile control surface;
- preserve upstream updates rather than maintaining a hard fork until custom features require one;
- add an optional private remote deployment only after local operation and provider terms are validated.

## Security

Do not commit API keys, cookies, private endpoint credentials, or personal tracking data. The integration should remain an orchestration layer around the upstream project unless a reviewed customization is intentionally added.
