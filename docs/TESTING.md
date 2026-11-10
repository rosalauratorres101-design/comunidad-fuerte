# Testing guide for judges

Comunidad Fuerte is a mobile-first web app. It works in any current browser on a phone or a computer. No account is needed.

## Option A: hosted demo (fastest)

Open the URL on the Devpost page. It runs with the PayPal sandbox and Claude.
On the free hosting plan, the first visit can take about a minute while the server wakes up.

## Option B: run it yourself (2 minutes)

```
npm install
npm start          # http://localhost:3000
```

Without keys, the app runs in **demo mode**:
- the AI is a transparent rule-based engine;
- PayPal calls are simulated and labeled as simulated on every screen.

For **live mode**:
1. Copy `.env.example` to `.env`.
2. Add `ANTHROPIC_API_KEY`, `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` (sandbox).
3. Run `npm run check-live`.
4. Run `npm start`.

To pay or receive payments, use a sandbox personal account.

## Fastest look at every screen

On the home page, press **Load a completed example**. It works on the hosted demo too. Its payments are always simulated and labeled "Simulated", even on a live server, so they never touch the PayPal sandbox. The example also gives the Statistics page enough reports to show. It creates a finished sargassum response and an escalated chemical report. Open them from **My reports**.

## A 3-minute path through the main story

Sargassum in Tulum. The steps match the demo video.

1. **Start a report.** On the home page, under **Sargassum on the beach**, press **Start this scenario**.
   - At the place step, write `Playa Paraíso, Tulum, Quintana Roo`.
   - Press **Next** until **Check and send**, tick the consent box, then press **Send report and get the safety tier**.
2. **Safety.** The **Safety** tab shows the hazard level with Mexico's own safety colours and signal words (NOM-026). It also shows pictogram steps; you can switch them to any of 10 languages.
3. **Laws by level.** Open the **Report** tab and look at **Laws that apply, by level**. It lists the verified international, national (Mexico), state (Quintana Roo) and local (Tulum) rules, each with its source and check date.
4. **Government answers inside the app.**
   - In the **Report** tab, press **Create official link**.
   - Open the link in a private window. This is what the office sees: never the resident's name if the report is anonymous.
   - Record an answer, for example **In progress** with a case number.
   - Under **Offer matching funds**, pledge to match donations, for example up to 300 USD.
   - Back in the resident's window, reload: the answer appears in the Report tab.
5. **PayPal fund.**
   - In **Fund and work**, donate with PayPal (sandbox).
   - Press **Request … in matching funds**. The AI agent invoices the office through the PayPal Agent Toolkit, for exactly the amount owed.
   - **Ask a sponsor (AI agent)** invoices a local business for one milestone and creates a printable QR poster.
6. **Payment only for verified work.**
   - For milestone 1, upload an evidence photo (choose a sample), then press **Send for AI verification**.
   - Claude compares the photo with the milestone criteria.
   - A named verifier approves, and PayPal Payouts pays the crew.
   - The verifier cannot pay themselves, and red-tier incidents cannot fund hands-on cleanup.
7. **Transparency without exposing people.**
   - **Public ledger** (AG Grid): every donation and payment, with no places. Donors are anonymous; the people paid or approving appear as initials.
   - **Statistics**: anonymous totals, hotspots and authority response times. It includes an AG Grid table with CSV export.
   - **How it learns**: the table of every law and contact the app relies on, with its review status.

## Other flows worth a look

- **Damaged stairs (Texas).** Start the scenario **Cracked condo entrance stairs**. You will see:
  - who is responsible under Texas law and why;
  - letters ready to send, with follow-up dates you can add to a calendar;
  - crack tracking over time;
  - an approximate repair cost.

  Mark a letter as sent and then **No answer**: the app suggests the next authority and drafts the follow-up.
- **Other neighborhood problems.** Try **Report another community problem**: a pothole, a gas smell (always Red: leave first), flooding or illegal dumping.
- **Privacy.**
  - Reports are private to the browser that created them.
  - To open a report on another device, copy its **access code** from the **Evidence** tab and use **Open a report from another device** on the home page.
  - The neighbor support link shows only the kind of problem, the hazard level, the city and the month.
- **Spanish.** Use the **EN / ES** switch at the top.

## Automated tests

```
npm test        # unit and integration tests, including live mode against mock Claude and PayPal servers
npm run e2e     # Playwright browser test of every flow (needs Python Playwright and Chromium)
```
