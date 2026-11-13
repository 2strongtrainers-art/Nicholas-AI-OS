# BrowserSkill integration

BrowserSkill is installed on the self-hosted Mac through `.github/workflows/install-browserskill.yml` using `scripts/install_browserskill.sh`.

Expected local aliases after a successful run:

```bash
bsk
browserskill
```

Use BrowserSkill as the browser-control layer for Hermes/Codex tasks that require the authenticated Chrome session. Keep destructive or externally consequential actions approval-gated and verify mutations after execution.
