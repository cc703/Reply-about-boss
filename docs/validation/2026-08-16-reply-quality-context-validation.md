# Reply Quality Context Validation

## Scope

This validation covers v0.8 recent-context retention, latest-HR reply focus, explicit anti-invention guidance, deterministic output filtering, and one bounded retry. It does not cover automatic input filling or sending; those remain prohibited.

## Implemented Behavior

- The extension keeps the newest 12 valid HR/self records instead of the oldest 12.
- The backend identifies the latest HR message and whether the candidate has already replied after it.
- The prompt explicitly prohibits invented delayed-response reasons, unsupported concern denial, and repeated questions.
- The backend removes unsupported phrases unless they already appear in candidate-authored context.
- Empty or fully rejected output receives one retry; a second failure returns `unsafe_or_empty_drafts`.

## TDD Evidence

- Extension RED: newest-record test expected `message 4` but received `message 0`.
- Prompt RED: `analyze_reply_focus` was missing, recent-record assertions failed, and focus/factuality instructions were absent.
- Guard RED: unsafe variants were returned unchanged and the route made only one model call.
- Each focused test passed after its minimal implementation.

## Automated Verification

Commands:

```powershell
npm.cmd test
npm.cmd run check
backend\.venv\Scripts\python.exe -m unittest discover -s backend\tests -v
backend\.venv\Scripts\python.exe -m compileall -q backend\app backend\tests
```

Results:

- Extension tests: 33 passed, 0 failed.
- Backend tests: 24 passed, 0 failed.
- JavaScript syntax checks: passed.
- Python compile checks: passed.
- Boundary scan for extension storage, cookies, submit calls, and auto-send terms: clean.

## Live Backend Verification

- Backend restarted on `127.0.0.1:8765` with terminal PID `4064` and listener PID `8992` at validation time.
- `/health` returned success and the credential status remained configured without returning the Key.
- An anonymized recruiter follow-up scenario generated three drafts with `deepseek-v4-flash`.
- The returned drafts contained no detected delayed-response excuse or unsupported concern-denial pattern.
- No API Key value was printed, copied, written to source, or included in the test payload.

## Remaining Risk

The local guard is intentionally conservative and cannot encode every Chinese semantic variation. Real-page QA should cover several recruiter intents and record anonymized failures before publishing. The browser extension must be reloaded because `replyDraftClient.js` and the manifest version changed.

## Conclusion

The v0.8 implementation and local backend path are verified. Real BOSS-page reply-quality QA remains the next gate before publish preparation.
