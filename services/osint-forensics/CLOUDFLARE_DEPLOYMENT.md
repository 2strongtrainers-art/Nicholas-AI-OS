# ARGUS PRIME private Cloudflare forensic container

This deployment creates a **separate** Cloudflare Worker named argus-prime-forensics.
It does not modify nicholas-ai-switchboard or nicholas-ai-os.
The Worker is NOT live until its actual deployed URL and authenticated smoke
tests have been verified. Deployment requires Workers Paid with Containers.

## Privacy architecture

The public-facing Cloudflare Worker requires Bearer authentication with an
independent 32+ character ARGUS_FORENSICS_API_KEY secret before it accepts
POST /analyze. Without a configured key, it returns 503 and does not start
a container. Unauthenticated requests return 401.

A private Durable Object forwards to the container, which starts with
enableInternet:false. Cloudflare documents that this denies all public
Internet and DNS egress, including non-HTTP protocols. All inputs are read
from request bytes into a request-private temporary directory and deleted
before the response is returned. No images or forensic reports are put in
GitHub, R2, KV, Durable Object storage, or public CI artifacts.

Only synthetic image bytes are used in GitHub Actions. No external URL crawler,
facial-search adapter, automatic paid provider, or autonomous uploading is enabled.

The service defaults to EXIF fields without GPS, original capture timestamps
or owner identifiers; explicit X-Argus-Sensitive: 1 requires authorized scope.
Cloudflare ingress and account/platform telemetry retention policies must still
be assessed before using confidential cases.

## Cloudflare connection prerequisite

The previously saved browser profile named TriValley Cloudflare Admin does
not currently document a verified cloudflare.com sign-in. A fresh owner-approved
sign-in or confirmed existing session is needed to inspect the account. Never
bypass provider permission or store credentials in GitHub source or this chat.

The account must have Containers on Workers Paid, and cost controls reviewed:
https://developers.cloudflare.com/containers/platform/pricing/

Configure a separate GitHub environment named osint-forensics-production:
- vars.CLOUDFLARE_ACCOUNT_ID: actual target Cloudflare account
- secrets.CLOUDFLARE_API_TOKEN: separately scoped deployment credential
- secrets.ARGUS_FORENSICS_API_KEY: 32+ random characters, distinct from
  the Nicholas Switchboard bearer secret
- vars.ARGUS_FORENSICS_URL: real URL of the newly created Worker

Restrict the environment and choose minimal Cloudflare token permissions
for the new Worker and Containers. The target Worker must not overwrite
the existing nicholas-ai-switchboard or nicholas-ai-os Workers.

## Deploy and prove operation

From main, trigger GitHub Actions > Deploy ARGUS Private Forensics.
It checks every required secret before spending money, then runs unit and
synthetic network-disabled Docker tests, deploys the new Cloudflare Worker,
provisions the independent Worker secret, and verifies:
1. GET /health identifies argus-prime-forensics with enabled true
2. Unauthenticated POST /analyze returns 401
3. An authenticated synthetic 1x1 PNG returns a matching SHA-256, ExifTool
   status ok, and sensitive_metadata_included false
4. The running container is configured with enableInternet false
5. Existing Nicholas Switchboard and Hermes routes are unaffected

Only mark "Worker live" after the actual HTTPS URL and authenticated test pass.
"ARGUS connector integrated" requires a separate verified connector execution
and is never implied by a GitHub commit or successful build.

## API after deployment

POST /analyze with Authorization Bearer <approved secret> and body as the
raw original bytes. Content-Type may be image/jpeg, image/png, image/webp,
image/tiff, image/heic, image/avif, or video/mp4 (25 MiB maximum).
Default EXIF response is privacy-filtered; an explicitly authorized client
may request sensitive fields with the X-Argus-Sensitive header set to 1.
The response is no-store JSON with hash, tool observations and limitations.

For a restricted original image, ensure the storage and transit policy
matches that evidence classification. Cloudflare has access to request
transport and possible platform-level telemetry. Provider terms apply.

## Final security cautions

Stolen bearer tokens can leak submitted images and incur processing costs.
Rotate secrets on compromise. Add Cloudflare Access and rate limiting before
larger-scale use. Keep dependencies updated and pin Docker/Exiv2/C2PA
artifacts for long-lived deployment. Signed C2PA provenance does not prove
incident truth, and an analysis error never establishes a clean image.
