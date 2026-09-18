# frontend

Owner: Person 3.

Amplify-hosted web app with two panels:

- **Agent Console** — generate watermarked speech (calls `/generate`)
- **Verify a Call** — upload or record audio, show verified or unverified (calls `/verify`)

Functional over fancy. Scaffold against dummy data until Person 2's endpoints are live.

The verify result has three parts worth surfacing: whether a watermark was found, the
decoded agent ID, and a confidence score. Only show an entity name when the ID resolves
in `trust_registry` — see [../ml-audio/README.md](../ml-audio/README.md).
