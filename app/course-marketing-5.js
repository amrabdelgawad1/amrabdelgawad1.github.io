// Marketing course, level 5: Real estate (modules 15–16). See course-marketing.js for the format.
window.LH_COURSES.mkt.modules.push(

// ================================================================ 15
{ lvl:4, t:'Real estate marketing: finding motivated sellers', d:'Seller motivations, lists and skip tracing, the channels investors use, follow-up and the numbers, plus buyer (disposition) marketing.',
  outcomes:['Explain what makes a seller motivated and which situations to target.','Build, stack, skip-trace and scrub property-owner lists.','Choose and run seller-lead channels: mail, calls, SMS, PPC, SEO, referrals.','Follow up, qualify on the four pillars, track cost per deal, and market deals to buyers.'],
  lessons:[
  { t:'Motivated sellers and the landscape', mins:13, s:[
    ['Why motivation matters', `<p>Investors buy below market value, so they need sellers who value <b>speed, certainty or simplicity</b> more than the top price. Marketing’s job is to find those owners early and start the first conversation before anyone else does.</p>`],
    ['Common motivations', `<ul><li><b>Inherited property</b> (probate): heirs often live far away and want it handled.</li><li><b>Tax delinquent:</b> behind on property taxes.</li><li><b>Pre-foreclosure:</b> behind on the mortgage.</li><li><b>Divorce</b>, <b>relocation</b>, <b>job loss</b>, <b>health</b>.</li><li><b>Tired landlords:</b> problem tenants, repairs.</li><li><b>Vacant or distressed properties</b>, code violations.</li><li><b>Land:</b> out-of-state owners of land they never use, inherited lots, owners paying taxes on land with no plan.</li></ul>`],
    ['Houses vs land', `<p>House investors (wholesalers, flippers, landlords) usually target distress and equity. Land investors often send <b>blind offers</b> (a price in the first letter) or <b>neutral letters</b> (“would you consider selling?”) to large lists of absentee land owners, because land owners are less emotionally attached and pricing is more formulaic.</p>`],
    ['Empathy wins', `<p>Many sellers are dealing with loss, debt or stress. Respectful, honest, patient marketing and conversations build the trust that wins deals — and referrals. Never pressure, mislead or misrepresent who you are.</p>`]],
    ex:`<p>A land investor sent neutral letters to 2,000 out-of-state owners of 1–10 acre parcels in one county. Most didn’t respond — but those who did often said the same thing: “I’ve been paying taxes on this for years and never use it.” That phrase became the headline of the next mailer.</p>`,
    terms:[['Motivated seller','An owner with a strong reason to sell fast or simply.'],['Probate','The legal process of handling a deceased person’s estate.'],['Blind offer','A first letter that includes a price.'],['Absentee owner','An owner who doesn’t live at the property.']] },

  { t:'Lists, data and skip tracing', mins:14, s:[
    ['Where lists come from', `<ul><li><b>County records:</b> tax delinquency, probate, code violations, liens, deeds.</li><li><b>Data providers</b> (e.g. PropStream, DataTree, BatchLeads, Land Portal-type tools): filter by equity, ownership length, absentee, vacancy, property type, acreage.</li><li><b>Driving for dollars:</b> spotting distressed or vacant properties in person and logging them (apps like DealMachine).</li><li><b>Referrals</b> from agents, attorneys, wholesalers and bird dogs.</li></ul>`],
    ['List stacking', `<p>Owners who appear on several lists (e.g. absentee + tax delinquent + long ownership) are usually more motivated. Stack lists in a spreadsheet or CRM and prioritise records with the most overlaps.</p>`],
    ['Skip tracing', `<p>Skip tracing finds phone numbers and emails for owners. Quality varies by provider; numbers can be wrong or outdated. Test providers and track the “right party contact” rate.</p>`],
    ['Scrubbing (compliance)', `<p>Before calling or texting, scrub numbers against the <b>National DNC Registry</b>, your internal DNC list and known <b>litigator</b> lists (people who sue over calls and texts), and identify mobile numbers. Follow TCPA consent rules for autodialers and texts (Module 13). This is general guidance, not legal advice.</p>`],
    ['Clean data = cheaper deals', `<p>Remove duplicates, existing deals, bad addresses and properties outside your buy box. Every bad record wastes mail, calls and caller time.</p>`]],
    ex:`<p>BrightLine’s land client stacked “out-of-state owner” and “tax delinquent” lists in one county: 1,000 records from a starting list of 12,000. Response per letter was 3× higher than the full list.</p>`,
    terms:[['List stacking','Finding owners who appear on several lists.'],['Skip tracing','Finding contact details for owners.'],['Driving for dollars','Finding distressed properties by driving or walking areas.'],['Buy box','The property types, areas and prices you buy.']] },

  { t:'Seller-lead channels', mins:16, s:[
    ['Direct mail', `<p>Letters, postcards, yellow letters (handwritten-style), blind offers. Response is low per piece (often well under 2%) but steady; it works through repetition (sending to the same list every few weeks) and pairs well with calls. Track each campaign with its own phone number or URL.</p>`],
    ['Cold calling', `<p>Often the cheapest cost per conversation. Needs trained callers, good data, a compliant dialer setup, scripts and tight follow-up. Callers qualify and hand off to an acquisitions manager to make offers.</p>`],
    ['SMS', `<p>Fast and widely used, but the highest legal risk. Follow TCPA consent rules, register for A2P 10DLC, include opt-out language and honour it. Get compliance advice before running texting campaigns.</p>`],
    ['PPC and Meta ads', `<p><b>Google Ads</b> on “sell my house fast [city]”, “sell my land” and similar: expensive per click but high intent; strong negative keywords needed (rent, buy, Zillow, realtor jobs). <b>Meta</b> ads fall under the housing special ad category (limited targeting) — use broad targeting and strong creative.</p>`],
    ['SEO and Google Business Profile', `<p>Slow to build but often the cheapest leads long-term: city/service pages, helpful content (“How to sell inherited land in [state]”), reviews, and a complete Google Business Profile.</p>`],
    ['Other channels', `<p>Referrals and agent relationships (expired listings, probate attorneys), networking, TV/radio in some markets. <b>Bandit signs</b> are illegal in many cities — check local rules before using them.</p>`],
    ['Compliance for wholesalers', `<p>Some states regulate how wholesalers advertise and contract (for example, disclosure of assignment, or rules about marketing a property you don’t own). Check your state’s rules or ask a local attorney.</p>`]],
    ex:`<p>A house investor’s channel mix: cold calling (lowest cost per lead), PPC (highest-quality leads), direct mail (steady), SEO (growing). They cut TV after tracking showed one deal in six months at 4× their cost per deal elsewhere.</p>`,
    terms:[['Yellow letter','A handwritten-style letter on yellow paper.'],['PPC','Pay-per-click advertising.'],['Bandit signs','Roadside signs, illegal in many places.'],['Wholesaling','Contracting a property and assigning the contract to another buyer.']] },

  { t:'Follow-up, the numbers, and buyer marketing', mins:15, s:[
    ['The four pillars', `<p>Qualify every lead on <b>motivation</b> (why sell?), <b>timeline</b> (when?), <b>condition</b> (what shape is it in?) and <b>price</b> (what would they accept?). Record answers in the CRM and set the lead’s temperature: hot, warm, cold.</p>`],
    ['Follow-up wins deals', `<p>Many deals close months after first contact, because the seller’s situation changes. Follow-up schedule by temperature: hot every few days, warm weekly or bi-weekly, cold monthly — by call, mail and email. Use the CRM so no lead is forgotten. Polite persistence is often the biggest edge an investor has.</p>`],
    ['The numbers', `<p>Track per channel and per campaign: cost per lead, cost per appointment, cost per contract, cost per deal, contract-to-close rate, average profit per deal and marketing ROI.</p><p>Example: $3,000 of mail → 30 leads ($100 CPL) → 2 contracts → 1 closed deal with $15,000 profit. Marketing ROI = (15,000 − 3,000) ÷ 3,000 = 4×. A channel with costlier leads can still win if those leads close more often.</p>`],
    ['Buyer (disposition) marketing', `<p>Once under contract, the investor must find a buyer (when wholesaling) or sell the property. Build a <b>buyers list</b> (people who opted in, with their buy box), market deals by email/SMS to that list, in investor groups (following group rules), through agents and partners, and with good photos, numbers and a clear deadline. Some states treat publicly advertising a property you don’t own as brokering — check local rules.</p>`],
    ['The team', `<p>A common setup: lead manager or callers (qualify), acquisitions manager (offers and contracts), dispositions manager (buyers), and marketing/data (lists, campaigns, tracking). Clear handoffs in the CRM keep leads from falling through the cracks.</p>`]],
    ex:`<p>A BrightLine client’s lead said “not now” four times over five months. On the fifth call, the tenant had left and the owner was ready. That deal paid for the whole quarter’s marketing.</p>`,
    terms:[['Four pillars','Motivation, timeline, condition, price.'],['Cost per deal','Total marketing cost ÷ deals closed.'],['Dispositions','Selling or assigning a property after contracting it.'],['Buyers list','Investors who want to hear about deals that fit their buy box.']] }
  ],
  playbook:{ t:'Seller lead machine', steps:['Define your market and buy box.','Pick 2–3 motivations to target and pull those lists.','Stack lists; prioritise overlaps.','Skip-trace; scrub DNC, internal DNC and litigators.','Choose 1–2 channels (e.g. mail + calls) and write the scripts and mail pieces.','Check TCPA, 10DLC, housing ad category and state wholesaling rules.','Qualify on motivation, timeline, condition, price.','Set follow-up by temperature and log everything in the CRM.','Build a buyers list for dispositions.','Track CPL, cost per contract, cost per deal and ROI by channel.'] },
  pad:['Your market, buy box and 3 motivations to target:','Lists to stack:','Your 2 channels and monthly budget:','Four-pillar questions you will ask:','Expected cost per deal and ROI:'],
  calc:'reroi',
  exam:[
    ['Why do investors look for motivated sellers?', ['They pay more','They value speed, certainty or simplicity','They have newer homes','They need agents'], 1, 'Motivation makes a below-market deal possible.'],
    ['A blind offer is…', ['A secret deal','A first letter that includes a price','An offer without seeing photos','An illegal offer'], 1, 'Common in land investing.'],
    ['List stacking means…', ['Printing lists','Finding owners on several lists','Buying more lists','Deleting old lists'], 1, 'Overlap signals higher motivation.'],
    ['Skip tracing is…', ['Skipping bad leads','Finding owners’ contact details','A mail format','A CRM feature'], 1, 'It finds phones and emails.'],
    ['Before cold calling a list you should…', ['Nothing','Scrub DNC, internal DNC and litigator lists','Text everyone','Buy ads'], 1, 'Data quality and compliance first.'],
    ['Direct mail response is…', ['Usually very high','Low per piece; works through repetition','Instant','Guaranteed'], 1, 'Consistency over months produces deals.'],
    ['Meta ads for sellers usually fall under…', ['No restrictions','The housing special ad category','Political ads','Employment'], 1, 'Limited targeting applies.'],
    ['Bandit signs are…', ['Legal everywhere','Illegal in many cities; check local rules','Required','A digital ad'], 1, 'Fines and removal are common.'],
    ['The four pillars of qualifying are…', ['Name, email, phone, address','Motivation, timeline, condition, price','Price, product, place, promotion','Mail, calls, SMS, PPC'], 1, 'They tell you if there’s a deal.'],
    ['A seller says “not now”. You should…', ['Delete the lead','Put them on a follow-up schedule','Argue','Lower the price at once'], 1, 'Many deals close months later.'],
    ['$4,000 marketing, 1 deal with $16,000 profit. ROI?', ['3×','4×','12×','16×'], 0, '(16,000 − 4,000) ÷ 4,000 = 3×.'],
    ['Disposition marketing is about…', ['Finding sellers','Finding buyers for contracted deals','Hiring callers','SEO'], 1, 'It’s the buyer side of the business.']
  ] },

// ================================================================ 16
{ lvl:4, t:'Capstone: your marketing plan and 30-day sprint', d:'Write a complete marketing plan for a real business, run a 30-day launch sprint, then review, present and keep growing.',
  outcomes:['Write a complete, specific marketing plan.','Execute a 30-day sprint and collect real results.','Review results, present them and plan the next 90 days.'],
  lessons:[
  { t:'The plan', mins:20, s:[
    ['What you will build', `<p>A complete marketing plan for a real business — your own, a client’s or BrightLine. Use your notes and scratch pads from every module. When it’s done, someone else should be able to run your marketing from it.</p>`],
    ['Plan template', `<ol><li><b>Business and goal:</b> one number and a deadline.</li><li><b>Customer:</b> ICP, persona, job to be done, triggers, voice-of-customer phrases (Module 2).</li><li><b>Market:</b> competitors, gaps, SWOT.</li><li><b>Positioning and offer:</b> statement, value proposition, offer, tiers, prices, risk reversal (Module 3).</li><li><b>Message:</b> message house, headline, proofs, voice (Modules 4–5).</li><li><b>Channels:</b> 1–2 main + 1 compounding, with weekly actions (Modules 6–13).</li><li><b>Assets:</b> landing page, lead magnet, welcome emails, scripts, ads.</li><li><b>Numbers:</b> reverse funnel math, budget, max CPL and CAC, LTV (Modules 12, 14).</li><li><b>Tracking:</b> UTMs, key events, CRM stages, dashboard.</li><li><b>Retention and referrals.</b></li><li><b>90-day calendar</b> with owners, and 5 scored experiments.</li></ol>`],
    ['Quality bar', `<p>Specific (names, numbers, dates), consistent (every part agrees with the positioning), realistic (fits budget and time), measurable (clear numbers to judge it). 4–6 pages plus tables is plenty.</p>`]],
    ex:`<p>A strong plan fits on 4–6 pages, with one table for the numbers and one for the 90-day calendar. A weak plan lists every channel and has no numbers.</p>`,
    terms:[['Rubric','A checklist used to judge quality.']] },

  { t:'The 30-day sprint', mins:15, s:[
    ['Why a sprint', `<p>Plans teach you what you think; launching teaches you what’s true. In 30 days you’ll build the core assets and get real data.</p>`],
    ['Week by week', `<ul><li><b>Week 1 — foundations:</b> positioning statement, landing page live, tracking tested, CRM stages ready.</li><li><b>Week 2 — assets:</b> lead magnet, 5-email welcome sequence, 6 posts, call script or cold email sequence.</li><li><b>Week 3 — launch:</b> 3 posts a week, 50 outbound touches, one small ad test (3 angles) or one direct-mail drop.</li><li><b>Week 4 — optimise:</b> review the dashboard, fix the weakest funnel step, run one A/B test or new angle, collect testimonials.</li></ul>`],
    ['Minimum results to report', `<p>Traffic, leads by source, CPL (if paid), calls booked, show rate, and at least 3 lessons learned. Results can be small; the lessons are the point.</p>`]],
    ex:`<p>A team member’s sprint for a local cleaning company: landing page, Google Business Profile, 40 review requests, and a $300 search ad test. Result: 22 leads, 9 jobs booked, CPL $14, and the lesson that reviews doubled the map-pack calls.</p>`,
    terms:[['Sprint','A short, time-boxed burst of focused work.']] },

  { t:'Review, present and keep growing', mins:12, s:[
    ['Present it', `<p>10 minutes to your team lead or Amr: the customer, the offer, the channels, the numbers, what happened in 30 days, what you learned, and the next 90 days. Use the dashboard, not opinions.</p>`],
    ['Retro', `<p>Keep — fix — stop. Which assumptions were right? Which were wrong? What surprised you? Update the plan and the experiment log.</p>`],
    ['Your portfolio', `<p>Save your plan, assets, before/after numbers and screenshots. A portfolio of real campaigns proves skill better than any certificate.</p>`],
    ['Becoming an expert', `<p>This course gives you the full map. Expertise comes from repetition: running campaigns, measuring honestly and improving every week. Keep going: run one experiment a week, read one case study a week, talk to one customer a week, and do the free certifications (Google Skillshop, Meta Blueprint, HubSpot Academy).</p>`]],
    ex:`<p>After the course, BrightLine’s newest marketer ran a 90-day plan for one client: CPL down 35%, show rate up to 81%, and two case studies for the website. That’s the standard to aim for.</p>`,
    terms:[['Portfolio','A collection of your real work and results.']] }
  ],
  playbook:{ t:'Capstone rubric', steps:['Customer section is specific and based on real conversations.','Positioning statement is clear and different from alternatives.','Offer has a clear outcome, price and risk reversal.','Message house and headline match the positioning.','Channels are few, fit the audience and have weekly actions.','Key assets are drafted and the landing page is live.','Reverse funnel math and budget add up.','Tracking works end to end and the dashboard is defined.','30-day sprint completed with real numbers.','Retro done; next 90 days planned with owners and 5 experiments.'] },
  pad:['Business you are planning for and the goal:','Link to or paste your full plan:','30-day sprint results (numbers):','3 biggest lessons:','Next 90 days in 5 lines:'],
  calc:'funnel',
  exam:[
    ['A strong marketing plan is…', ['Long and general','Specific, consistent, realistic and measurable','Only a list of channels','Only design'], 1, 'The four qualities in the rubric.'],
    ['Every section of the plan should agree with…', ['The competitor','Your positioning','The ad platform','The latest trend'], 1, 'Positioning is the backbone.'],
    ['How many main channels should the plan focus on?', ['1–2 plus 1 compounding','As many as possible','None','Exactly 7'], 0, 'Depth beats breadth.'],
    ['The numbers section should include…', ['Only followers','Reverse funnel math, budget, max CPL/CAC and LTV','Nothing','Only likes'], 1, 'Numbers make the plan testable.'],
    ['Why run a 30-day sprint?', ['To look busy','To turn assumptions into real data','It’s required by law','To avoid planning'], 1, 'Launching teaches you what’s true.'],
    ['Week 1 of the sprint focuses on…', ['Scaling ads','Foundations: positioning, landing page, tracking, CRM','Hiring','Rebranding'], 1, 'Build the base before launching.'],
    ['What makes the plan runnable by someone else?', ['Owners, dates and weekly actions','A nice cover','Long paragraphs','Secret notes'], 0, 'Clear owners and actions.'],
    ['A presentation should be based on…', ['Opinions','The dashboard and real results','Competitors’ numbers','Guesses'], 1, 'Data first.'],
    ['A retro asks…', ['Who to blame','Keep, fix, stop','Nothing','How many likes'], 1, 'A simple structure for improving.'],
    ['Experiments in the plan should be…', ['Random','Scored and written as hypotheses','Hidden','Skipped'], 1, 'If X, then Y, because…, scored with ICE.'],
    ['What proves marketing skill best?', ['Certificates only','A portfolio of real campaigns and results','Followers','Job titles'], 1, 'Real results are the strongest proof.'],
    ['How does someone become an expert after this course?', ['They already are','By running, measuring and improving campaigns repeatedly','By reading more courses only','By buying tools'], 1, 'Expertise comes from repetition with feedback.']
  ] }
);
