# CampusFind (finditvitc/finditvitc.github.io) — Security & Code Review

**Repo:** https://github.com/finditvitc/finditvitc.github.io
**Scope:** Full source (not just README) — `backend/lambda/*.py`, `infrastructure/`, docs (`AGENTS.md`, `TEST_REPORT.md`, `REBUILD_SUMMARY.md`)

This looks like a real, currently-deployed AWS project — the repo publishes a live API Gateway URL, Cognito Pool ID, S3 bucket name, and SNS topic ARN. So the issues below aren't just theoretical; several are live and exploitable as shipped.

---

## Critical

### 1. Self-service admin privilege escalation via Cognito custom attribute
`backend/lambda/post_confirmation.py` reads `custom:role` straight from the user's own sign-up attributes:

```python
role = str(user_attrs.get('custom:role', '')).lower()
if email == 'jerisheugin2567@gmail.com' or role in ['admin', 'security', 'campus_police']:
    target_group = 'Admin'
```

Unless the Cognito User Pool schema explicitly marks `custom:role` as non-mutable / admin-only (nothing in the template enforces this), any student can sign up with `custom:role=admin` in the registration payload and get auto-added to the `Admin` group — which controls the campus-wide emergency SMS/email broadcast.

### 2. Authorization can be bypassed with a value from the request body, not the token
In `items.py` (`handle_update_item`) and `alerts.py` (`is_admin_or_security`), the "ownership"/admin check falls back to trusting fields the caller supplies themselves:

```python
is_owner = (... or (bool(body_email) and body_email == existing_email) or ...)
...
email = str(claims.get('email') or body_data.get('userEmail') or '').strip().lower()
```

Since `GET /items` already returns every item's `userEmail` / `userId` to anyone unauthenticated, an attacker can read an item's owner email, then replay it in the body of a `PATCH /items/{id}` or `POST /alerts` call to impersonate that user. For alerts, this means **anyone can trigger a fake campus-wide emergency broadcast** just by putting `"userEmail": "jerisheugin2567@gmail.com"` in the POST body — no valid token needed.

### 3. Hardcoded "god mode" email
Both `items.py` and `alerts.py` grant admin rights to one literal, real email address (`jerisheugin2567@gmail.com`) baked into the source. It's a backdoor that's now public, and it's also used as the default SES sender/recipient — leaking a real person's inbox as a fixed dependency.

### 4. JWTs are decoded, not verified
`get_user_from_event` / `is_admin_or_security` base64-decode the JWT payload manually and trust whatever claims are inside — there's no signature check in the Lambda itself:

```python
payload = parts[1]
claims = json.loads(base64.urlsafe_b64decode(payload...))
```

This is only safe if API Gateway's Cognito authorizer is strictly enforced upstream on every route. The repo's own `TEST_REPORT.md` states it isn't: *"API Gateway routes have `authorizationType: NONE`. Anyone can create, read, and mutate records without a token."* That means this manual decode path is the actual authorization mechanism in production right now, and it accepts self-signed/forged tokens.

---

## High

### 5. PII exposed with zero auth
`GET /items` (no auth required per the audit above) returns every reporter's `userEmail`, `userId`, and `contactInfo` for every lost/found item — full contact info for anyone who ever filed a report, scrapeable by anyone with the API URL (which is published in this same repo).

### 6. Live infrastructure identifiers committed to a public repo
`AGENTS.md`, `TEST_REPORT.md`, and `REBUILD_SUMMARY.md` publish the real API Gateway URL, Cognito User Pool ID + App Client ID, S3 bucket name (with the AWS account ID `694442891642` embedded in it), and the SNS topic ARN. None of these are secrets by themselves, but combined with #1–#4 they give an attacker everything needed to target the live system directly.

### 7. Committed build artifacts and uploaded user photos
`infrastructure/.aws-sam/build/` (should be gitignored — SAM build output) and `backend/uploads/*.jpg/png/avif` (real uploaded item photos, presumably from testing) are checked into the repo.

---

## Medium / hygiene

- **Documentation doesn't match the code**: `REBUILD_SUMMARY.md` claims *"ALL CRITICAL, MAJOR, AND HYGIENE DEFECTS RESOLVED"*, but the bypasses in #2 and #3 are still present in `main` as of this review — worth checking whether the fix actually landed or the summary is stale/aspirational.
- Wildcard CORS (`Access-Control-Allow-Origin: '*'`) on every Lambda response — fine given Bearer-token (not cookie) auth, but worth tightening once auth is fixed.
- `ensure_presigned_url` issues 7-day presigned S3 GET URLs, a long window for a link that could leak.
- Scattered `# BUG-04`, `# BUG-07`, `# BUG-08` style comments in `items.py`/`alerts.py` read like a tracked punch-list (possibly from an internal audit) — #2 and #3 above appear to be the ones still open.

---

## Recommended fixes, in priority order

1. **#2 / #3** — Derive identity *only* from verified token claims, never from `body_data`. Remove the hardcoded email bypass entirely.
2. **#4** — Confirm the Cognito authorizer is actually attached to every route in `infrastructure/template.yaml` (not `authorizationType: NONE`), so unverified/forged tokens can't be trusted at the Lambda layer.
3. **#1** — Mark `custom:role` as an admin-only-writable attribute in the Cognito User Pool schema, or drop client-settable roles entirely and assign `Admin`/`Security` groups manually/out-of-band.
4. **#5** — Strip `userEmail`/`userId`/raw `contactInfo` from the public `GET /items` response, or require auth for that route.
5. **#6 / #7** — Rotate/redeploy exposed resource IDs if this is a genuinely public repo long-term, and clean `.aws-sam/build/` plus test upload artifacts out of git history.
