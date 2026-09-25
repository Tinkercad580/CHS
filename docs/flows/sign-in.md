# Flow: signing in

Applies to all three apps. The screens differ, but every app calls the same
`SessionController` methods. Rules: [../modules/auth.md](../modules/auth.md).

```mermaid
sequenceDiagram
  participant App
  participant API
  App->>API: POST /auth/lookup { mobile }
  alt NOT_REGISTERED
    API-->>App: "contact your society office" (nothing else)
  else LOCKED
    API-->>App: lockedUntil → countdown screen
  else CREATE_PASSWORD (admin added the number, never activated)
    App->>API: POST /auth/activate { password, confirm, acceptTerms }
    API-->>App: SIGNED_IN (tokens, me) · admins get users.changed
  else ENTER_PASSWORD
    App->>API: POST /auth/login { mobile, password, client }
    alt temporary password
      API-->>App: PASSWORD_CHANGE (restricted token)
      App->>API: POST /auth/forced-change (restricted token)
      API-->>App: SIGNED_IN, all other sessions revoked
    else admin with 2FA
      API-->>App: TWO_FACTOR (challenge)
      App->>API: POST /auth/2fa/verify { challenge, code }
      API-->>App: SIGNED_IN
    else wrong password
      API-->>App: INVALID_CREDENTIALS (5th: ACCOUNT_LOCKED)
    else
      API-->>App: SIGNED_IN
    end
  end
  Note over App: store tokens (keychain / localStorage), connect realtime,<br/>register for push (mobile), render the app
```

**After sign-in:**
- **Token refresh:** the client refreshes the 15-minute access token before it
  expires, and once more on any 401. The refresh token rotates each time.
- **Session ending elsewhere:** if the session is revoked elsewhere (another
  device's "log out all", an admin's force logout, a suspension), the next
  request gets 401. The socket also receives `session.revoked`, and the app
  returns to sign-in.
- **App restart:** `session.restore()` validates the stored tokens with
  `GET /me`. If the server can't be reached, the tokens are kept and the app
  offers a retry.

**Forgotten password:**
1. There's no self-service reset. The user asks the society office.
2. An admin issues a temporary password from Users & access. It's shown once,
   with a WhatsApp share link, and also sent by SMS and email.
3. The user signs in with it and must set a new password before anything else.
