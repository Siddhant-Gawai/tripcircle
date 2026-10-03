# Enable Google sign-in

TripCircle uses Google OAuth through the existing Relay Supabase project. There are no SMS messages or phone verification charges. Supabase quotas still apply; Google sign-in does not verify a participant's phone number.

## Google Cloud Console

Create an OAuth client with application type **Web application**.

**Authorized JavaScript origins** (no path):

```
https://siddhant-gawai.github.io
```

**Authorized redirect URIs**:

```
https://azoxrnmhtqwgvvsjbjuu.supabase.co/auth/v1/callback
```

Configure branding and audience for the intended users. While an external app is in Testing, add the people who will test it to the test-user list. Make it available to the intended public audience before wider release. Request only `openid`, `email` and `profile` for sign-in.

## Supabase dashboard

Open Relay → Authentication → Sign In / Providers → Google. Enter the client ID and client secret directly there, enable the provider and save. Never place the secret in a frontend file, GitHub, a screenshot or chat.

Under Authentication → URL Configuration, **add** the following redirect URL:

```
https://siddhant-gawai.github.io/tripcircle/
```

Keep the existing Relay Site URL and other redirects; Relay is shared with another project. The frontend supplies this TripCircle URL explicitly in `signInWithOAuth`.

## Check the real flow

1. Refresh TripCircle and choose Continue with Google.
2. Finish Google sign-in using your own account.
3. Create a private room, copy its invite link, and use a second account to request joining.
4. Confirm pending members cannot see the plan. Accept the request; then test comments, picks and checklist updates across accounts.
5. Publish a room and confirm a signed-out browser sees only its preview.

Database permission tests simulate authenticated identities and roll back all records. They do not replace checking an actual OAuth redirect and session after provider setup.

Official guide: https://supabase.com/docs/guides/auth/social-login/auth-google
Redirect guide: https://supabase.com/docs/guides/auth/redirect-urls
