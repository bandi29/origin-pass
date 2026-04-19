# E2E Test Notes

## Run

- `npm run test:e2e`
- `npm run test:e2e:headed`
- `npm run test:e2e:ui`

## Authenticated dashboard flows

Some E2E specs require a real signed-in dashboard session and are skipped unless these env vars are set:

- `E2E_EMAIL`
- `E2E_PASSWORD`

Optional:

- `E2E_BASE_URL` (defaults to `http://localhost:3000`)

## Coverage focus

- Public UX cues (required field legends / support CTA)
- Product draft save-resume-delete flow
- Batch step "why disabled" guidance visibility

