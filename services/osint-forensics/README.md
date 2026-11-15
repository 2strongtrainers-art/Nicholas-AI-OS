# ARGUS PRIME — Phase 1 offline image triage

This worker produces owner-private SHA-256, a selected ExifTool report,
and a C2PA manifest observation. It does not upload evidence, perform reverse
image searches, assert an image is authentic, or connect automatically to
ARGUS PRIME. It is not deployed to production.

## Build (from repo root)

```sh
docker build --pull -f services/osint-forensics/Dockerfile -t argus-osint:phase1 .
```

The Docker build obtains ExifTool from Debian and downloads the official
c2patool v0.29.0 Linux x86_64 release with SHA-256 validation. This container
targets x86_64 Linux; other platforms require an independently verified
artifact/build. An exact Debian package lock and base-image digest should be
added before a long-lived production deployment.

## Run on original evidence in private directories outside this repo

```sh
export ARGUS_INPUT_DIR=/absolute/private/evidence
export ARGUS_REPORT_DIR=/absolute/private/reports
mkdir -p "$ARGUS_REPORT_DIR"
chmod 700 "$ARGUS_REPORT_DIR"
docker run --rm --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges --pids-limit 64 --memory 256m --cpus 1 \
  --tmpfs /tmp:rw,nosuid,nodev,size=32m \
  --user "$(id -u):$(id -g)" \
  --mount type=bind,src="$ARGUS_INPUT_DIR",dst=/evidence,readonly \
  --mount type=bind,src="$ARGUS_REPORT_DIR",dst=/reports \
  argus-osint:phase1 python /opt/argus/analyze.py \
  --input /evidence/original.jpg --output /reports/original.report.json
```

Default mode deliberately excludes GPS, timestamp and owner/device
identifiers. An authorized private investigation that needs those may opt in
with the --include-sensitive flag; do not expose its output publicly.

The report path must not already exist. Reports are created mode 0600.
No original file is changed. The tool has a 25 MiB input limit, 20-second
per-parser timeout, and 512 KiB parser-output limit. This is initial triage,
not a full-scale media-forensic laboratory.

## Security limitations

The Python program is not a network sandbox on its own; running it outside
the supplied network-disabled, read-only Docker invocation is not approved
for sensitive/untrusted evidence. Treat all metadata parsers as vulnerable
until patched. Restrict host directory permissions and avoid mount points
containing secrets, credentials or unrelated files. The Docker runtime and
host kernel still form part of the trust boundary.

ARCHIVEBOX IS NOT ENABLED: public web archiving requires a separate networked
worker with actual outbound IP/redirect restrictions, capture-size limits,
storage review, and human confirmation. Domain allowlisting alone does not
prevent SSRF, redirects or DNS rebinding. Face-search tools are excluded.

## Tests

```sh
python -m unittest discover -s tests -p 'test_osint_forensics.py' -v
```

The new GitHub Actions CI uses synthetic files only. It must never receive
private user evidence or access secrets. Production is pending end-to-end
private-worker and ARGUS report-handoff validation.
