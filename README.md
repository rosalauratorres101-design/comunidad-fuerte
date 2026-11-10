# Comunidad Fuerte

**Community response to pollution and unsafe shared spaces: AI checks the danger, the right institution gets a formal report, and PayPal releases money only for verified work.**

When sargassum rots on a beach, an unknown chemical reaches a river, or the entrance stairs of a building crack around the handrail, the people who live there are the first to notice. They rarely have an expert, a safe plan, the right institution to call, or money donors can trust. Comunidad Fuerte gives them:

1. **A guided field interview** (text, photos, voice) in plain language, for three kinds of problems: **pollution**, **damaged shared infrastructure** (stairs, railings, walkways), and **other community problems that directly affect residents**: gas smell, fallen power lines, flooding, water leaks, potholes, streetlights, rental home repairs and illegal dumping.
2. **A safety tier** (Green / Yellow / Red) set by rules in code; the AI can make it stricter, never weaker. Nobody is ever asked to approach a chemical or to push a damaged railing to test it.
3. **Safety steps with pictograms** in the 10 most spoken languages, plus recordings by paid community interpreters for local and Indigenous languages (Yucatec Maya, Nahuatl).
4. **Report to the right institution**: who is responsible and why (with legal sources for Texas: HOA, builder under Property Code Ch. 27, landlord under § 92.052, City of Austin 3-1-1), in priority order, with the formal letter or report prepared, the right channel (certified mail, email, 3-1-1), and follow-up dates once it is sent. For pollution: emergency services, PROFEPA, the US National Response Center and others.
5. **Approximate repair cost by country or community**: US cost-guide averages scaled by the BEA price level of the area or, abroad, by the World Bank price level (labor only), shown in USD and local currency; real local quotes replace the formula once 3 are recorded.
6. **Crack monitoring**: dated width measurements; growth raises the tier and the urgency of the reports.
7. **Sourced solutions and help**: every method and organization shows its source and check date; live AI results without a verifiable source are discarded.
8. **A PayPal fund per incident**: donations through the Orders API; payouts through the Payouts API one milestone at a time, only after AI photo verification **and** approval by a named community verifier. For damaged buildings the fund pays only for evidence and pressure (engineer report, barriers, certified mail), never the repair the responsible party owes.
9. **An AI fundraising agent on the PayPal Agent Toolkit**: invoices a local sponsor for one milestone and makes a printable QR poster. It can request money but never send it.
10. **Tamper-evident evidence** (SHA-256 hash chain), **offline field mode**, and a **knowledge base that keeps learning** from real costs, community ratings and reviewed corrections.
11. **Law and contact watch**: every legal rule, deadline and phone number the app relies on is listed with the exact facts it uses, when a person last checked it and when it is due again. In live mode a scheduled job asks Claude, with web search, whether each fact still holds; a possible change counts only if it cites a page the search actually retrieved, and it waits for a named reviewer. Nothing in the app text changes by itself; a confirmed change shows a warning on every report that cites that rule until the text is updated and re-checked.

Built on **MAREA (Motor de Análisis y Respuesta Ambiental)**, an existing environmental analysis tool. Everything in this repository was built during the hackathon submission period.

## Run it (2 minutes, no keys needed)

Requirements: Node.js 20 or later.

```bash
npm install
npm start
# open http://localhost:3000
```

With no keys the app runs in **demo mode**: the AI layer is a transparent rule-based engine and PayPal calls are **simulated** (every simulated record is labeled). On the home page, choose **Load a completed example** to see every screen filled in, or **Start this scenario** for either demo:

- **Scenario A, sargassum (Yellow):** report → safety tier → solutions → help → donate → 3 milestones verified and paid (one rejected first, one needing human review) → community rating.
- **Scenario B, unknown chemical in a river (Red):** zoom-only photos, isolation guidance, funding limited to lab testing and advocacy.
- **Scenario C, cracked condominium entrance stairs (Yellow):** who is responsible, the HOA letter and builder notice, 3-1-1, approximate repair cost in Austin, crack tracking.
- **Scenario D, pothole on a neighborhood street (Yellow):** Austin 3-1-1 report with a checked source. Try **Report another community problem → Gas smell** to see the Red path: leave on foot first, then 911 and Texas Gas Service.

## Live mode (Claude + PayPal sandbox)

Copy `.env.example` to `.env` and fill in:

| Variable | Where to get it | Turns on |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | console.anthropic.com | Photo analysis, adaptive follow-up questions, live web search for methods and organizations, milestone photo verification, messages in 10 languages |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | developer.paypal.com → Apps & Credentials (Sandbox) | PayPal Smart Buttons checkout (Orders v2) and real sandbox Payouts |

For payouts, use the email of a **sandbox personal account** as the recipient, and make sure the sandbox business account has a balance. Each service switches to live independently; the top bar shows which mode is on. The fundraising agent runs live when both Claude and PayPal keys are present.

Before recording or judging, verify the keys:

```bash
npm run check-live -- --payout-to=<sandbox personal email> --invoice-to=<sandbox personal email>
```

It checks Claude, the Claude web search tool, a $1 sandbox order, a $1 sandbox payout and an Agent Toolkit draft invoice, and refuses to run against live PayPal.

## Privacy: every report is private

A report (consultation) can be seen only by the person who made it.

- When a report is saved, the server returns a random **access key** once and stores only its SHA-256. Every `/api/incidents/:id` route needs it in the `X-Owner-Key` header; without it the answer is the same 404 as for a report that does not exist, so ids cannot be probed. There is no public list of reports.
- The browser keeps the keys of the reports made on it. The **Evidence** tab shows the **access code** to open the report on another device (Home, "Open a report from another device"), and a button to remove it from this device.
- Photos and recordings are served only through **signed links that expire** (HMAC, 12 hours), handed out with an authorised report. Public copies already have location metadata removed.
- Public pages show only totals and categories: the **ledger** shows no place, description, photo or report id; donors are anonymous and people paid or approving appear as initials.
- Authorities and organizations see a person's information only in the messages that person chooses to send.
- **No contact details are stored**: emails and phone numbers are removed automatically from every free-text field that is saved (descriptions, answers, notes, names of recipients, authority answers). People's contact details are used only inside the letters a person prepares and are never kept.
- Reports are **anonymous by default**: no account, email or phone is needed, and a name is stored only if the person unticks "Report anonymously".
- Reports saved before this change get a key on first start, written to `data/private/owner-keys-migrated.json` for the operator to hand back.

## Laws by level: international, national, state, local

Each report is placed in its jurisdictions (`lib/jurisdiction.js`): international (and the EU for EU countries), the country, the state or province, and the city, recognised from the country and the place typed (for example "Tulum, Quintana Roo" → MX › MX-ROO › MX-ROO-Tulum). For each level the Report tab and the one-page summary list only rules the app has verified for that place and that kind of problem (36 rules and contacts in the law watch, each with source, facts, check date and review interval), and say plainly when a level has not been verified yet instead of guessing. Treaties apply only to countries where the app verified them (Escazú: Mexico). Where a national safety-colour standard exists, the ISO fallback is hidden. When rules differ on safety, the app shows the stricter safety rule and tells people to confirm with the local authority; it does not resolve legal conflicts. The privacy laws that govern the app itself are shown in the Evidence tab for the person's country and state (Mexico LFPDPPP 2025, Texas TDPSA, EU GDPR). To add a place: verify its rules, add them to `lib/laws.js` with their jurisdiction code and topics, and add the place pattern to `lib/jurisdiction.js`.

## Working with governments and neighbors

All written from scratch for this project (general ideas seen in civic apps, no code, text or design copied).

- **Official link for the authority** (`lib/official.js`): the resident creates a link that is added to the letters they send. The office opens it without an account, sees the report the resident chose to share (place, description, photos, evidence fingerprints, laws by level; never the name of an anonymous resident nor contact details) and records its answer: received with a case number, in progress with an estimated date, resolved, forwarded to another authority, or not within its authority. Each answer goes into the tamper-evident record and appears in the resident's Report tab. The resident can turn the link off.
- **Escalation when nobody answers** (`lib/escalation.js`): when a follow-up date passes, or the resident marks "no answer", the app suggests the next verified authority up the ladder (local → state → national → international), never the same office again, and drafts a polite follow-up message. For a builder under Texas Chapter 27 it says to wait until about 60 days after the notice before legal action.
- **What an answer means** (`lib/responses.js`): when an institution answers, the resident records the kind of answer. For "the warranty expired / the builder will not pay" or "the association will repair it directly", the app explains in plain words what the answer does and does not mean (an expired written warranty does not by itself end a builder's responsibility; the 10-year Texas limit; the implied warranty of habitability; an engineer's report before any repair so the evidence is not lost), cites only rules verified for the place, and drafts a polite reply. An email to a Texas builder is no longer treated as the Chapter 27 notice: the follow-up dates change and the summary reminds the resident to send the certified notice.
- **Calendar reminders**: all follow-up dates download as an .ics file (Google, Apple, Outlook) with a reminder the day before. Made on the device; nothing is sent to a server.
- **Neighbor support link** (`lib/support.js`): neighbors open a limited page (kind of problem, hazard, city or state, month; no address, description, photos or names) and confirm anonymously or co-sign with a name they choose and consent to share. The count and co-signers go into the letters.
- **Matching funds from government** (`lib/match.js`): through the official link an office pledges to match community donations 1:1 up to a limit. The resident requests the matched amount; the fundraising agent sends the office a PayPal invoice whose total the policy in code caps at what is owed (community donations received, up to the pledge, minus what was already invoiced; sponsor invoices do not count). Paid matching enters the same milestone-verified fund and appears in the public ledger under the office name.
- **Government use**: the Statistics page and CSV give any office anonymous totals, hotspots and response times for planning.
- **Next stage (designed, not built): government inbox.** A page where a verified office sees every report sent to it. It needs office registration and verification (official email domain plus a second check) so no one can impersonate a government; until then each office answers case by case through the link the resident sends.

## Example data on a live server

**Load a completed example** works in demo and live mode. Its requests run inside a per-request simulated scope (`lib/config.js`, AsyncLocalStorage): no Claude or PayPal calls are made, every payment is labeled simulated, and real users of the same server at the same moment are not affected. It creates four reports, so the anonymous statistics have enough data to show.

## Use on any device

Comunidad Fuerte is a web app: it runs in Chrome, Safari, Firefox or Edge on Android, iPhone, iPad, Windows, Mac, Chromebook and Linux, and can be installed on the home screen (web app manifest and icons). Browsers from about 2019 or newer are needed (it uses `flatMap` and `Object.fromEntries`); older ones get a clear message in Spanish and English. Checked with Chromium on iPhone SE, iPhone 15 Pro Max, Pixel 7, Galaxy S9+, iPad Mini, 320 px and desktop sizes with no horizontal scrolling; test on a real iPhone with Safari before launch.

## Anonymous community statistics

Reports stay private, but their non-identifying facts feed shared numbers (**Statistics** page, `GET /api/stats`, `GET /api/stats.csv`): problems by type, hazard level, country, month and community category; places where problems cluster; how many reports went to authorities, how many were answered or resolved and the median days to an answer; paid work stages; ratings; and how real repair costs compare with the first estimate. Filters: country, kind of problem, month range.

Privacy rules are in code (`lib/stats.js`): only reports whose owner allowed it are counted (a tick box when reporting, changeable later in the Evidence tab); no free text, names, photos, exact places, report ids or exact dates; time grouped by month and places by country and ~10 km squares; any group with fewer than 3 reports is merged into "Other" or shown as "<3"; nothing is published with fewer than 3 reports in total; one dimension at a time, no cross-tables. The same finished work and ratings also feed the learning loop (cost estimates and method ranking).

## One-page case summary, any app language

The **Summary** tab puts the whole case on one printable page: risk level, what to do now, who is responsible, reports sent and their follow-up dates, approximate repair cost, fund status, evidence fingerprints and next steps. The reader picks any of the 10 app languages. Headings and safety steps come from the app's own text in that language (right-to-left for Arabic). In live mode Claude translates the case details and the page is labeled as machine translation; in demo mode they stay in English with a notice. Print or save as PDF, copy, or share.

## Hazard colours by country

The safety logic keeps three internal tiers, but each incident is shown with the safety colours and signal words of the country where it happens: United States, ANSI Z535 and OSHA 29 CFR 1910.145 (DANGER red, WARNING orange, CAUTION yellow, safety instructions green); Mexico, NOM-026-STPS-2008 (red prohibition, yellow hazard warning, green safe condition); EU and UK, Directive 92/58/EEC; elsewhere, ISO 3864. Where the standard has an orange WARNING level, a yellow incident with signs that could cause serious injury is shown as WARNING. Signal words come in all 10 languages, and the standards are in the law watch.

## Sargassum: every solution, by stage

The Solutions tab for sargassum lists 22 sourced options in six stages: see it coming (LANOT-UNAM satellite forecast, the Quintana Roo daily traffic light, citizen photo stations), stop it at sea (Navy barriers and vessels, small harvester boats, experimental deep-sea sinking, which Mexico's rules prohibit), remove it from the beach (SEMARNAT 2021 rules: by hand, within 72 hours, never burn, bury or dump at sea; keep leachate away from the karst aquifer), protect people (hydrogen sulfide monitors, 5 ppm), turn it into something useful (Sargablock building blocks, industrial biostimulant and cosmetic emulsifier, co-composting up to 10%, small products, and laboratory routes: alginate, metal adsorbent, biogas, bio-oil) and the root cause (nutrients from the Amazon and West African upwelling). Each one says who can do it, how proven it is, and any caution such as arsenic. In Quintana Roo the Get help tab adds the municipal ZOFEMAT, the Red de Monitoreo del Sargazo and LANOT-UNAM.

## Other community problems

| Problem | Starting tier | Austin channels (verified 2026-10-18) | Elsewhere |
| --- | --- | --- | --- |
| Gas smell or leak | Red, emergency | Leave on foot; 911 and Texas Gas Service 1-800-959-5325 | Emergency number and the gas company's line |
| Fallen power line | Red | Austin Energy 512-322-9100 | Electric company outage line |
| Flooding or blocked drainage | Yellow (Red if dangerous now) | 3-1-1; 911 in an emergency | City services, emergency number |
| Water leak or main break | Yellow | Austin Water Dispatch 512-972-1000 (24/7) | Water utility |
| Pothole, streetlight, illegal dumping | Yellow / Green / Green | 3-1-1 (dumping also 1-877-NO-DUMPS) | City services line |
| Rental home repairs | Yellow | Landlord (Texas Property Code § 92.052) and 3-1-1 Code Compliance | Landlord and city housing inspection |

Urgency, injuries and hazardous waste can only raise the tier. Safety steps exist in all 10 languages, with an extra first step for gas, power lines and flooding. Outside verified places the app does not show phone numbers it has not confirmed; the live "Get help" search finds local ones with sources.

## How PayPal and AI work together

```
Resident report ──► rules set minimum tier ──► Claude (vision) may raise it
        │
        ▼
Plan with milestones (categories allowed by tier) ──► PayPal Orders v2: donations to this incident (custom_id = incident)
        │
        ▼
Brigade uploads photos ──► Claude compares with milestone criteria ──► pass / fail / needs human review
        │
        ▼
Named verifier approves (cannot pay themselves, fund balance checked) ──► PayPal Payouts API pays the crew or supplier
        │
        ▼
Hash-chained ledger entry + real cost recorded for learning

Fundraising agent (in parallel): Claude ──tool use──► PayPal Agent Toolkit
  create_invoice → send_invoice → generate_invoice_qr_code   (policy check in code before each call)
  sponsor pays → get_invoice confirms → donation added to the fund
```

Rules enforced in code (`lib/safety.js`): AI can never lower a tier; low AI confidence raises it; a lower tier needs new photo evidence; Red incidents can only fund testing, legal, advocacy and interpreters; Yellow plans must fund protective equipment first; follow-up questions that ask people to touch, open, sniff, or (in Red) approach the hazard are removed.

## AI tools used

- **Claude (Anthropic Messages API)**, model set by `CLAUDE_MODEL` (default `claude-sonnet-5-5`): image + text classification, follow-up questions, milestone verification, message drafting.
- **Claude web search tool** (`web_search_20250305`): new remediation methods and local organizations. The server keeps an item only if its URL was actually retrieved in that response, and masks phone numbers that do not appear in the cited text (`lib/ai.js`, `verifyAgainstSources`).
- **Claude tool use + PayPal Agent Toolkit** (`@paypal/agent-toolkit`, invoice tools): the fundraising agent (`lib/agent.js`). Toolkit tool schemas are converted to Claude tools; a policy check enforces recipient, amount limit, single invoice and traceable reference.

## Sponsor tools

- **AG Grid** (Community, bundled locally): the public ledger with sorting, filtering and quick search.
- **Render**: `render.yaml` included for one-click deployment.

## Tests

```bash
npm test        # 53 unit + integration tests (mock Claude, PayPal, Agent Toolkit, the rule re-check, report privacy, anonymous statistics, laws by level, escalation, neighbor support, the official link and matching funds)
npm run e2e     # Playwright browser test, 117 checks (including privacy across devices, the statistics page, laws by level, calendar file, neighbor support, escalation the authority answering through the official link and pledging matching funds): four scenarios, sargassum solutions by stage, gas-smell path, reports, costs, one-page summary in 4 languages, law watch review, agent, QR poster, offline queue, Spanish UI
```

## Project structure

```
server.js              API routes and static hosting
lib/safety.js          safety rules, payout gate, question filter
lib/ai.js              Claude calls, demo engine, source verification
lib/paypal.js          Orders v2, capture, Payouts (sandbox or simulated)
lib/agent.js           fundraising agent: Claude + PayPal Agent Toolkit with policy checks
lib/responsibility.js  who is responsible, by property type and jurisdiction (Texas pack with sources)
lib/letters.js         formal letters and reports for each institution, follow-up dates
lib/costs.js           approximate repair cost by place (BEA, World Bank) and local quotes
lib/content-infra.js   building and infrastructure protocols, actions, organizations
lib/content-community.js  other community problems: categories, channels with sources, plans
lib/laws.js            law and contact watch: facts relied on, check dates, live re-check, reviews
lib/knowledge.js       living knowledge base and learning loop
lib/content.js         curated sources, 10-language protocols, plan templates
lib/store.js           JSON storage and SHA-256 hash chain
lib/media.js           uploads, fingerprints, metadata removal for public copies
public/                single-page app (no build step) and offline service worker
docs/                  Devpost text, video script
test/                  unit, integration and end-to-end tests
```

## Honest limitations

- English and Spanish safety protocols are drafts awaiting final sign-off by the author, an industrial hygiene professional; the other eight languages are machine translations awaiting native review. Each is labeled in the app. Change `PROTOCOL_REVIEW` in `lib/content.js` after review.
- Demo-mode "AI" is rule-based and only recognizes the bundled sample illustrations; custom photos go to human review.
- Public photo copies remove JPEG/PNG metadata (including GPS); faces are not blurred automatically yet.
- Data is stored in a JSON file (`data/`), suitable for a demo, not for production scale. On hosts without a persistent disk (for example Render's free plan) learned data and rule checks reset on each deploy; attach a disk and point `DATA_DIR` to it to keep them.
- The live rule re-check flags possible changes; it does not rewrite legal text. A person updates the content and marks the rule as re-checked.
- Orders and Payouts use the PayPal REST APIs directly; the Agent Toolkit is used for sponsor invoices. The Toolkit's live calls were verified against its published interface and mocks; run `npm run check-live` with sandbox keys to confirm end to end.
- Offline reports are stored on the phone (browser storage); very large photos may not fit and the app says so.
- Live payouts outside the sandbox may require PayPal approval; PayPal availability varies by country.
- Legal guidance covers Texas in detail; elsewhere the app gives a general map and says to check local law. It is not legal advice.
- Repair costs are approximate: US cost-guide averages adjusted by price levels, with a ±30% band set by the app. They are not quotes.
- This app is first-response guidance, not a replacement for emergency services or professional assessment.

## License

MIT, see `LICENSE`.
