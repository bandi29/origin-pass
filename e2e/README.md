# E2E Tests (Playwright)

## Setup

```bash
# Install Playwright browsers (first time only)
npx playwright install chromium
```

## Running Tests

### Public tests (no login needed)
```bash
npx playwright test e2e/public-ux.spec.ts
```

### Authenticated tests (requires credentials)
```bash
E2E_EMAIL=you@youremail.com E2E_PASSWORD=yourpassword npx playwright test
```

### Run all tests with UI (recommended for debugging)
```bash
npx playwright test --ui
```

### View last test report
```bash
npx playwright show-report
```

## Test Files

| File | What it tests | Auth required |
|------|--------------|---------------|
| `public-ux.spec.ts` | Login page fields/modes, support page, home page, auth redirect to login | ❌ No |
| `dashboard-draft-flow.spec.ts` | Products draft save/resume/delete, dashboard KPI cards, sidebar nav links | ✅ Yes |
| `dashboard-batch-guidance.spec.ts` | Batch creation page, step checklist guidance | ✅ Yes |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `E2E_EMAIL` | Email of a test account | For auth tests |
| `E2E_PASSWORD` | Password of a test account | For auth tests |
| `E2E_BASE_URL` | Base URL (default: `http://localhost:3000`) | No |

## Tips

- Make sure your dev server is running on `localhost:3000` before running tests
- Use `--headed` flag to watch the browser: `npx playwright test --headed`
- Use `--debug` flag to step through interactively: `npx playwright test --debug`
- Use `--ui` for a visual test runner with time-travel debugging
