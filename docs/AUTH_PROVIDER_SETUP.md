# Auth Provider Setup — Google & Phone (SMS)

The "Continue with Google" and "Sign in with phone" options are **built in the app**
(login + register), but they stay inert until you enable the providers in Supabase.
Code lives in `src/services/authService.js` (`signInWithGoogle`, `sendPhoneOtp`,
`verifyPhoneOtp`, `ensureUserProfile`) and the `/auth/callback` route
(`src/views/AuthCallbackView.vue`).

---

## 1. Google sign-in (free)

1. **Google Cloud Console** → create OAuth 2.0 credentials (Web application):
   - Authorized JavaScript origins: your app origins (e.g. `http://localhost:5173`, your Vercel domain).
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
     (this is Supabase's callback, **not** the app's `/auth/callback`).
   - Copy the **Client ID** and **Client secret**.
2. **Supabase Dashboard → Authentication → Providers → Google**: enable it, paste Client ID + secret, save.
3. **Supabase → Authentication → URL Configuration → Redirect URLs**: add
   `http://localhost:5173/auth/callback` and `https://<your-domain>/auth/callback`
   (the app passes `redirectTo = origin + '/auth/callback'`).
4. Test: click "Continue with Google" → Google consent → lands on `/auth/callback` → home.

The app auto-creates a `profiles` row on first Google sign-in (`ensureUserProfile`),
defaulting the role to `general_user`.

---

## 2. Phone / SMS sign-in (PAID — needs an SMS provider)

Supabase does not send SMS itself; you must connect a provider (cost per message).

1. Pick an SMS provider supported by Supabase (e.g. **Twilio**, **Twilio Verify**,
   **MessageBird**, **Vonage**, **Textlocal**). Create an account, get the API
   credentials, and (for Twilio) a sending number / messaging service SID.
2. **Supabase Dashboard → Authentication → Providers → Phone**: enable it, choose
   the SMS provider, paste credentials, save.
3. (Optional) customize the OTP message template and expiry.
4. Test: "Sign in with phone" → enter `+63917…` → receive SMS → enter the 6-digit code.

Phone numbers must be **E.164** (`+<country><number>`), which the login form validates.
The app auto-creates a profile on first phone sign-in too.

> Until a provider is configured, "Send code" returns an error ("SMS sign-in may not
> be enabled yet"); Google and email/password are unaffected.

---

## 3. Notes

- `detectSessionInUrl: true` is already set in `src/services/supabaseClient.js`, so the
  OAuth redirect is parsed automatically; `AuthCallbackView` just polls for the session,
  ensures a profile, loads the role, steps up to MFA if enabled, then redirects.
- New OAuth/phone accounts get role `general_user`; elevate via the normal role-application
  / admin flows (LGU has its own registration page at `/register/lgu`).
- No secrets live in the client bundle — provider credentials stay in Supabase.
