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
export async function initSentry(app, router) {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return // disabled: no DSN configured

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
