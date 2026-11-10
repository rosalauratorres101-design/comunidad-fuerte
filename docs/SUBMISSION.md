# Devpost submission text (copy into the form)

**Project name:** Comunidad Fuerte

**Tagline (short):** AI checks the danger, the right institution gets the report, and PayPal releases money only for verified work.

---

## Inspiration

When sargassum piles up on a beach or foam appears below a pipe in a river, the first people on the scene are the people who live there. They usually have no expert, no safe plan, and no way to raise money that donors trust. Some try to help and get hurt: decomposing sargassum releases hydrogen sulfide and ammonia, and the US EPA notes these gases typically form after mats sit on the beach for about 48 hours. Others never report anything because the authorities are slow or absent.

I am an industrial hygiene and environmental engineering professional with 30+ years in education. I built the tool I wished communities had: one that keeps people safe first, tells them what actually works, connects them to help, and makes every donated dollar traceable to verified work.

**What is new in this hackathon:** Comunidad Fuerte started from MAREA, my earlier single-page environmental analysis tool. Everything in this repository was built during the submission period (from October 1, 2026): the server, the PayPal Checkout, Payouts and Agent Toolkit integration, the milestone verification, privacy and anonymous statistics, the laws by level, the government features and the tests.

## What it does

1. **Guided field interview.** Residents report with photos, voice and simple answers, in plain language. If anything suggests a chemical hazard, the app stops asking for close-ups and asks only for zoomed photos from where they stand.
2. **Safety tier set in code.** Rules compute a minimum tier (Green: act with care, Yellow: act only with protection, Red: do not touch, isolate, escalate). Claude analyzes the photos and can make the tier stricter, never weaker. Low AI confidence moves the tier up. Lowering a tier requires new photo evidence.
3. **Safety steps anyone can follow.** Pictogram protocols in the 10 most spoken languages, and for local and Indigenous languages (Yucatec Maya, Nahuatl) recordings made by paid community interpreters, never machine translation.
4. **Solutions and help with sources.** Claude with web search finds accessible remediation methods and local organizations. The server keeps an item only if its URL was actually retrieved in that response, and masks phone numbers that do not appear in the cited text. Everything shows its source and check date; new findings wait for expert review.
5. **A PayPal response fund per incident.** Donations come in through PayPal Checkout (Orders v2). Money goes out through the PayPal Payouts API one milestone at a time, only after Claude compares the evidence photos with the milestone criteria and a named community verifier approves. The verifier cannot pay themselves. Red incidents can only fund lab testing, legal help, advocacy and interpreters, never hands-on cleanup.
6. **An AI fundraising agent built on the PayPal Agent Toolkit.** Claude runs a tool-use loop over the Agent Toolkit's invoice tools to invoice a local sponsor (a business, a fishing cooperative, a family abroad) for one milestone, send it, and generate a QR code the community prints as a poster for people without the app. The agent can request money but never send it, and every tool call passes a policy check in code: right recipient, amount within the milestone, only its own invoice.
7. **Tamper-evident evidence.** Every action is written to a SHA-256 hash chain; originals are fingerprinted, and public photo copies have GPS and camera metadata removed. A printable evidence file is ready for NGOs, press or lawyers.
8. **Works without signal.** The safety protocol and opened incidents work offline; reports made without connection are saved on the phone and sent on reconnect.
9. **Damaged shared infrastructure.** The same flow works for cracked stairs, loose railings and broken walkways: a no-touch interview, crack tracking over time, who is responsible under the law (Texas pack with sources), formal letters to the right institution with follow-up dates, and an approximate repair cost by country using World Bank and BEA price levels.
10. **Other community problems.** Gas smells, fallen power lines, flooding, water leaks, potholes, streetlights, rental home repairs and illegal dumping use the same flow: a tier set by rules (a gas smell is always Red: leave on foot first), safety steps in 10 languages, and the right channel with a verified source (in Austin: 911, Texas Gas Service, Austin Energy, Austin Water, 3-1-1, or the landlord under Texas Property Code § 92.052).
11. **Keeps learning, and keeps its rules current.** Real milestone costs and community ratings update cost estimates and rank methods; scheduled searches add new methods for expert review; anyone can report a correction, reviewed by a named person. Every law, deadline and phone number the app relies on is watched: Claude re-checks each one on a schedule with web search, a possible change counts only if it cites a page the search actually retrieved, and a named reviewer decides. Safety protocols and legal text never change automatically.

12. **Private by design, anonymous by default.** Every report is private to the person who made it: the server returns an access key once and stores only its hash, there is no public list of reports, and photos are served only through signed links that expire. Reports are anonymous by default and no account, email or phone is needed; emails and phone numbers typed into any saved text are removed automatically.
13. **Anonymous community statistics.** Reports feed shared numbers for communities, cities and researchers (by type, hazard level, country, month, 10 km hotspots, authority response times, real costs against estimates). No free text, names, photos, exact places or dates; any group with fewer than 3 reports is merged or hidden; people can opt out at any time.
14. **Laws by level.** Each report is placed in its international, national, state and local jurisdictions (for example Mexico › Quintana Roo › Tulum, or United States › Texas › Austin). The app shows only rules it has verified for that place and problem, with source and check date, and says plainly when a level is not verified yet instead of guessing. Hazard colours and signal words follow each country's own standard (OSHA/ANSI in the US, NOM-026 in Mexico, ISO 3864 elsewhere).
15. **Closing the loop with government.** The resident can add an official link to the letters they send. The office opens it without an account and answers inside the app (received with case number, in progress with date, resolved, forwarded); each answer goes into the tamper-evident record. Offices can pledge to **match community donations 1:1 up to a limit**: the agent invoices them through PayPal for exactly what is owed, capped by policy in code, and the money enters the same verified fund. When an answer arrives (for example "the warranty expired, the builder will not pay"), the app explains in plain words what it does and does not mean, with verified rules, and drafts a reply. If nobody answers by the follow-up date, the app suggests the next verified authority up the ladder and drafts the message. Neighbors can confirm or co-sign through a limited page that never shows the address, description, photos or names, and follow-up dates export to any calendar.

## How we built it

- **Backend:** Node.js and Express, JSON storage with a SHA-256 hash-chained event log.
- **AI:** Claude Messages API with vision for classification and milestone verification; Claude web search tool for methods and organizations; Claude tool use driving the PayPal Agent Toolkit.
- **PayPal:** Orders API v2 and JavaScript SDK buttons for donations, Payouts API for milestone and interpreter payments, Agent Toolkit invoicing tools (create, send, QR code, get) for sponsor invoices. All in the sandbox.
- **Sponsor tools:** AG Grid for the public ledger, the anonymous statistics table and the table of every law and contact the app relies on (sort, filter, CSV export); Render blueprint for deployment.
- **Frontend:** an installable web app (Android, iPhone, tablets, computers) with no build step, mobile first, Atkinson Hyperlegible font for low-vision readability, English and Spanish interface, service worker for offline use.
- **Quality:** 53 unit and integration tests (including a live-mode test against mock Claude and PayPal servers and privacy and statistics tests) and a Playwright end-to-end test with 117 checks covering four scenarios, the agent, the QR poster, offline queueing, privacy across devices, the statistics page and the Spanish interface.

## Challenges we ran into

- Making AI useful without letting it be dangerous: I moved every safety and money rule out of prompts and into code, so a wrong AI answer cannot lower a tier or release a payment.
- Preventing invented contacts: a hallucinated phone number in an emergency is worse than none, so live results are kept only when their source was really retrieved.
- Privacy without losing the data: reports had to stay private and anonymous while still feeding useful statistics, so the rules (opt-out, no free text, month and 10 km grouping, hiding groups smaller than 3) live in code and are tested.
- Language justice: the communities most affected often speak languages AI handles poorly. I chose pictograms plus paid human recordings over machine translation for safety content.

## Accomplishments we're proud of

- A complete loop from a resident's first photo to a verified, approved PayPal payout, with a public ledger anyone can audit.
- An agent that grows the fund with real PayPal invoices while being structurally unable to move money out.
- Testing found and fixed a real safety gap: the AI could have suggested smelling a sample; the question filter now blocks it at every tier.

## What we learned

The trust problem in community response is as big as the pollution problem. Tying every payment to verified evidence and a named person changes what donors and authorities are willing to do.

## What's next

A verified government inbox (office registration with official email domain plus a second check, so no one can impersonate an authority); pilots with coastal communities in the Mexican Caribbean and a river community in central Mexico; expert sign-off of all protocols and native-speaker review of the eight machine-translated languages; automatic face blurring for public photos; a production database; and partnerships with Indigenous-language institutes to validate recordings.

## Built with

`node.js` `express` `claude` `anthropic-api` `paypal` `paypal-orders-api` `paypal-payouts` `paypal-agent-toolkit` `ag-grid` `render` `service-worker` `playwright`

---

## Testing instructions for judges

**Hosted demo:** (paste the Render URL here). It runs with PayPal sandbox and Claude keys. On the free plan the first visit can take about a minute while the server wakes up.

**Privacy note for testing:** reports are private to the browser that created them. Use the same browser to come back to a report, or copy its access code from the Evidence tab and open it from the home page on another device. The Statistics page and the public ledger show only anonymous totals.

**A 3-minute path through the app:** see `docs/TESTING.md`.

**Run locally (2 minutes, no keys):**
```
npm install
npm start
# http://localhost:3000
```
On the home page: **Load a completed example** to see every screen filled in, or **Start this scenario** to walk the flows yourself. In demo mode the AI is a transparent rule-based engine and PayPal calls are simulated; every simulated record is labeled.

**Live mode:** copy `.env.example` to `.env`, add `ANTHROPIC_API_KEY`, `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` (sandbox), then `npm run check-live` to verify Claude, web search, Orders, Payouts and the Agent Toolkit before `npm start`. Use a sandbox personal account to donate and as the payout recipient.

**Tests:** `npm test` and `npm run e2e`.

## AI tools used (form field)

Claude (Anthropic Messages API, model configurable, default claude-sonnet-5-5): photo and report classification, adaptive follow-up questions, milestone evidence verification, multilingual message drafting, and tool use driving the PayPal Agent Toolkit. Claude web search tool: remediation methods and local organizations, with server-side source verification.
