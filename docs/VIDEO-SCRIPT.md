# Demo video script — one story, 2:45

**Contest rules for the video:**
- Under 3 minutes.
- Public on YouTube.
- Shows the app working on the device it was built for (a phone).
- English, or with English captions.
- No copyrighted music.
- No third-party logos or trademarks without permission.

**Before recording:**
- Run `npm run check-live`, then record in **live mode** (PayPal sandbox and Claude).
- Use a fresh server with no real reports.
- Never show a real address or a real person's case.

**Devices:**
- Phone screen recording for the resident.
- Laptop for the office page and the ledger.

**Narrator:** the creator, on camera at the start and at the end.

**Captions:**
- Upload `docs/captions-en.srt` (English) and `docs/subtitulos-es.srt` (Spanish) to YouTube as two caption tracks.
- If you change the narration, adjust the times.

**Music:** none, or a track from the YouTube Audio Library.

| Time | On screen | Narration |
|---|---|---|
| 0:00–0:12 | Narrator on camera. Cut to a beach covered in sargassum (your own footage or the app's sample illustration). | "I'm an industrial hygienist and teacher. When sargassum piles up on a beach, the first people there are the neighbors. They have no safety plan, and no way to raise money people trust." |
| 0:12–0:30 | Phone: home → "Sargassum on the beach" → interview. Type "Playa Paraíso, Tulum, Quintana Roo". Send. | "Comunidad Fuerte starts with a short interview, with photos and simple answers, in plain language. It works on any phone, and offline." |
| 0:30–0:50 | Phone: Safety tab. Hazard panel with Mexico's colours, pictogram steps. Switch the protocol language to French, then back. | "Rules in the code set the minimum safety level, and Claude reads the photos. The AI can make it stricter, never weaker. Rotting sargassum releases hydrogen sulfide, so the app says: protection, short shifts, children away. It uses the local safety colours, in ten languages." |
| 0:50–1:08 | Phone: Report tab, "Laws that apply, by level": International › Mexico › Quintana Roo › Tulum. | "It places the report in its laws: international, national, state and local. It shows only rules we verified, with the source and the date, and it says when a place is not verified yet." |
| 1:08–1:30 | Phone: Create official link. Laptop: the office page, "In progress", case number, then "Pledge to match donations" up to 300 dollars. Phone: the answer appears. | "The resident sends the report with an official link. The municipality answers inside the app, with no account: in progress, case number. And it pledges to match every community dollar." |
| 1:30–1:55 | Phone: Fund tab. Donate with the PayPal sandbox. Press "Request … in matching funds"; the invoice appears with its PayPal invoice number. | "Neighbors donate with PayPal. Then an AI agent, built on the PayPal Agent Toolkit, invoices the municipality for exactly the amount matched. Rules in the code stop it from asking for more, and it can never send money out." |
| 1:55–2:20 | Phone: milestone 1, upload an evidence photo, "Send for AI verification", the pass result, a named verifier approves, the Payouts confirmation. | "Money goes out only for verified work. The crew uploads photos, Claude checks them against the milestone, a named person approves, and PayPal Payouts pays. No photo, no payment." |
| 2:20–2:35 | Laptop: Public ledger (AG Grid), then the Statistics page and its table (press "Load a completed example" before recording, so the statistics have enough reports; its payments are labeled Simulated, while the story's payments say Sandbox). | "Every dollar is on a public, tamper-evident ledger, without exposing anyone. Reports are private and anonymous by default, and they still feed statistics that cities can use." |
| 2:35–2:45 | Narrator on camera. | "Safe first, the right authority, and money only for real work. Comunidad Fuerte. Strong communities." |

**Final checklist:**
- [ ] Length under 2:55.
- [ ] Every PayPal step done in the sandbox (the screen says Sandbox, not Simulated).
- [ ] No real addresses, real names or third-party logos.
- [ ] English and Spanish captions uploaded; video set to Public.
- [ ] YouTube link pasted in the Devpost form.
