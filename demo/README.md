# demo

Owner: Person 4.

- Polly integration feeding into the watermark embed step
- End-to-end testing once backend and frontend connect
- Seed 1–2 entries into `trust_registry` (e.g. "SecureBank AI Assistant")
- Record the demo video — the live re-recording test is the key moment
- Submission writeup: problem, impact, what we learned

The watermark module's own robustness tests live in
[../ml-audio/](../ml-audio/) since they import it directly. End-to-end and integration
tests belong here.

Do the re-recording test early. If the watermark doesn't survive speaker-to-phone-mic
capture, the whole demo claim changes and the team needs to know immediately.
