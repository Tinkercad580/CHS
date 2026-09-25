# Flow: telling residents something

Rules: [../modules/notices-and-notifications.md](../modules/notices-and-notifications.md).

```mermaid
sequenceDiagram
  participant Admin as Admin console
  participant API
  participant Jobs
  participant FCM as Firebase
  participant SMTP
  participant Apps as Resident / gate apps
  Admin->>API: POST /notices (draft: title, body, category, audience, channels, ack?)
  Admin->>API: POST /notices/:id/publish
  API->>API: lock · resolve audience → notice_recipients (proof of service) · commit
  API->>API: notify(): inbox rows + deliveries per preferences
  API-->>Apps: realtime notices.changed, notifications.changed
  Jobs->>FCM: push (waits for quiet hours unless EMERGENCY)
  Jobs->>SMTP: email
  FCM-->>Apps: banner → tap opens /notices/:id
  Apps->>API: POST /notices/:id/read, then /acknowledge (if ack required)
  Admin->>API: GET /notices/:id/report → who got it, read it, acknowledged it
```

**Details:**
- **Emergencies:** an EMERGENCY notice needs a reason, which is logged. It
  goes out immediately on the high-priority emergency channel, and nobody
  can mute it.
- **Corrections:** a published notice is a record. To fix one, publish a
  correction with `supersedesId`; the original becomes SUPERSEDED and links
  to the correction.
- **Proof of service:** the report exports as Excel or CSV
  (`reports.email`, type `notice-delivery`).
