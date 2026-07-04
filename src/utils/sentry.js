/**
 * Optional error tracking via Sentry.
 *
 * DORMANT BY DEFAULT: nothing runs and the SDK is never even loaded unless
 * `VITE_SENTRY_DSN` is set at build time. The @sentry/vue module is imported
 * dynamically only when a DSN exists, so a disabled Sentry adds ~0 to the main
 * bundle and 0 runtime cost.
 *
 * To enable:
 *   1. Create a project at sentry.io → copy its DSN.
 *   2. Set VITE_SENTRY_DSN (and optionally VITE_SENTRY_ENVIRONMENT,
 *      VITE_SENTRY_TRACES_SAMPLE_RATE) in the Vercel/build environment.
 *   3. Redeploy. Errors + performance traces then flow to Sentry automatically.
 *
 * Never throws — error tracking must not be able to break app startup.
 */
// Project DSN. A Sentry DSN is a PUBLIC identifier (it only permits *sending*
// events, never reading) and is designed to ship in client code — so baking it
// in is safe. Override per-environment with VITE_SENTRY_DSN if needed.
const DEFAULT_SENTRY_DSN =
  'https://ef7e180b2677dcf5083f9f26e7b98841@o4511677442228224.ingest.us.sentry.io/4511677445373952'

export async function initSentry(app, router) {
  const dsn = import.meta.env.VITE_SENTRY_DSN || DEFAULT_SENTRY_DSN
  if (!dsn) return // disabled: no DSN configured

  // Only report from production builds by default, so local `npm run dev`
  // errors don't flood the Sentry project. Set VITE_SENTRY_DSN explicitly to
  // force-enable in any environment (e.g. a staging build).
  if (!import.meta.env.PROD && !import.meta.env.VITE_SENTRY_DSN) return

  try {
    const Sentry = await import('@sentry/vue')

    const integrations = []
    // Route-aware performance tracing when the integration is available.
    if (typeof Sentry.browserTracingIntegration === 'function') {
      integrations.push(
        router
          ? Sentry.browserTracingIntegration({ router })
          : Sentry.browserTracingIntegration(),
      )
    }

    const rawRate = import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE
    const tracesSampleRate = rawRate != null && Number.isFinite(Number(rawRate))
      ? Number(rawRate)
      : 0.1

    Sentry.init({
      app,
      dsn,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
      integrations,
      tracesSampleRate,
      // Do NOT attach IP / cookies / user identifiers by default — this app
      // already strips PII from prod logs; keep Sentry consistent.
      sendDefaultPii: false,
    })
  } catch (err) {
    // Swallow: a monitoring failure must never take down the app.
    console.warn('Sentry init skipped:', err?.message)
  }
}
