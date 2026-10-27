// Marketing course, level 4: Growth (modules 12–14). See course-marketing.js for the format.
window.LH_COURSES.mkt.modules.push(

// ================================================================ 12
{ lvl:3, t:'Analytics and measurement', d:'KPIs and metric trees, tracking setup, unit economics, attribution and reporting.',
  outcomes:['Choose KPIs and build a metric tree from revenue down.','Set up GA4, UTMs, tag manager, pixels and CRM tracking.','Calculate CAC, LTV, payback and churn.','Handle attribution honestly and build a weekly dashboard.'],
  lessons:[
  { t:'KPIs and metric trees', mins:12, s:[
    ['Measure what matters', `<p>Pick a few numbers tied to money. <b>Vanity metrics</b> (likes, followers, impressions) feel good but don’t pay bills. <b>Actionable metrics</b> tell you what to do next: leads, cost per lead, conversion rate per step, customers, CAC, revenue, retention.</p>`],
    ['Leading and lagging', `<p><b>Lagging</b> indicators show results after the fact (revenue, customers). <b>Leading</b> indicators predict them (calls booked, demos, sign-ups, outbound touches). Manage leading numbers weekly; check lagging numbers monthly.</p>`],
    ['The metric tree', `<p>Break revenue into the numbers that drive it: <i>Revenue = customers × average value</i>; <i>customers = calls held × close rate</i>; <i>calls held = calls booked × show rate</i>; <i>calls booked = leads × booking rate</i>; <i>leads = traffic × conversion rate</i>. Now every team member knows which branch they move.</p>`],
    ['North star metric', `<p>One metric that best captures the value customers get and predicts growth (for BrightLine: “qualified seller appointments delivered per week”). Use it to align everyone.</p>`]],
    ex:`<p>BrightLine’s tree showed revenue was stuck because show rate was 55%, not because of lead volume. Fixing reminders (Module 9) grew revenue more than doubling ad spend would have.</p>`,
    terms:[['KPI','Key performance indicator.'],['Leading indicator','A number that predicts future results.'],['Metric tree','Revenue broken into the numbers that drive it.'],['North star metric','The one metric that best reflects value delivered.']] },

  { t:'Tracking setup', mins:16, s:[
    ['Google Analytics 4 (GA4)', `<p>GA4 records <b>events</b> (page views, clicks, form submits, bookings). Mark the important ones as <b>key events</b> (conversions). Use reports for traffic sources, landing pages and conversion paths. Exclude your own team’s visits where possible.</p>`],
    ['UTM parameters', `<p>Add tags to every link you share so you know where traffic came from: <code>utm_source</code> (linkedin, newsletter), <code>utm_medium</code> (social, email, cpc), <code>utm_campaign</code> (q1-script-download), optionally <code>utm_content</code> (which ad or post). Agree a naming rule (lowercase, hyphens) and stick to it.</p>`],
    ['Tag manager and pixels', `<p><b>Google Tag Manager</b> lets you add and manage tracking codes (GA4, Google Ads, Meta Pixel, LinkedIn Insight Tag) without editing the site each time. Fire conversion tags on thank-you pages or form-submit events. Test with preview/debug modes.</p>`],
    ['CRM is the source of truth', `<p>Every lead goes into the CRM with source, campaign, stage, owner and value. Pass the original UTM into hidden form fields so the CRM knows where each lead came from. Add “How did you hear about us?” — simple and surprisingly accurate.</p>`],
    ['Call tracking and privacy', `<p>Call-tracking numbers show which channel made the phone ring. Respect privacy laws: cookie consent where required (e.g. EU/UK), a privacy policy, and only collecting what you need.</p>`]],
    ex:`<p>BrightLine tagged every LinkedIn post link with UTMs and passed them into the booking form. They learned that carousel posts brought 3× more bookings than text posts, though text got more likes.</p>`,
    terms:[['GA4','Google Analytics 4.'],['Key event','A GA4 event marked as a conversion.'],['UTM','Tags on links that identify the traffic source.'],['Tag manager','A tool to manage tracking codes in one place.']] },

  { t:'Unit economics: CAC, LTV, payback and churn', mins:15, s:[
    ['CAC', `<p><b>Customer acquisition cost</b> = total marketing and sales cost in a period ÷ new customers in that period. Include ad spend, tools, content costs and the salaries or commissions of people doing marketing and sales (“fully loaded” CAC). Also track CAC per channel.</p>`],
    ['LTV', `<p><b>Lifetime value</b> ≈ average revenue per month × gross margin × average months a customer stays. Average months ≈ 1 ÷ monthly churn rate (if 10% leave each month, they stay about 10 months on average).</p>`],
    ['Ratios that matter', `<ul><li><b>LTV:CAC</b> — a common healthy target is 3:1 or better. Below 1:1 you lose money on every customer.</li><li><b>Payback period</b> = CAC ÷ monthly gross profit per customer. Shorter payback means you can reinvest faster; many small businesses aim for a few months.</li><li><b>Churn</b> — the % of customers who leave each period. Reducing churn raises LTV and lets you spend more to acquire.</li></ul>`],
    ['Cohorts', `<p>Group customers by the month they joined and track how many remain and how much they pay over time. Cohorts show if retention is getting better or worse, which averages hide.</p>`]],
    ex:`<p>BrightLine: $3,000 a month on marketing and sales → 5 new clients → CAC $600. Clients pay $1,800/month at 50% margin; monthly churn 12.5% → stay 8 months → LTV $7,200. LTV:CAC = 12:1; payback = $600 ÷ $900 = 0.7 months. Room to invest more in growth.</p>`,
    terms:[['CAC','Customer acquisition cost.'],['LTV','Lifetime value of a customer.'],['Churn','Share of customers lost per period.'],['Payback period','Time to earn back CAC from gross profit.'],['Cohort','A group of customers who joined in the same period.']] },

  { t:'Attribution, experiments and reporting', mins:14, s:[
    ['Attribution, honestly', `<p>Buyers touch many things before they buy. <b>Last-click</b> gives all credit to the final step and undervalues content and brand; <b>first-click</b> does the opposite; <b>data-driven</b> models (e.g. in GA4 and ad platforms) spread credit using patterns. Each platform also tends to claim credit for itself. Don’t chase perfect attribution: combine tracked data, “how did you hear about us” answers, CRM source data and common sense.</p>`],
    ['Incrementality', `<p>The real question is: “What would have happened without this campaign?” Test it with holdouts (pause a channel in one region or for a period) and compare. Branded search ads, for example, often capture people who would have found you anyway.</p>`],
    ['Experiment log', `<p>Record every test: hypothesis, change, dates, result, decision, lesson. Over a year this log becomes your most valuable marketing asset.</p>`],
    ['A weekly dashboard', `<p>One page, same numbers every week: traffic, leads by source, CPL, calls booked, show rate, close rate, new customers, revenue, CAC, plus the north star. Show trends (this week vs last 4 weeks), add one line of commentary per number, and end with one decision. Tools: Google Sheets, Looker Studio, your CRM’s reports.</p>`]],
    ex:`<p>BrightLine paused branded Google ads for 4 weeks. Total bookings didn’t change — people clicked the organic result instead. They saved $400 a month and moved it to Meta retargeting.</p>`,
    terms:[['Attribution','Deciding which touchpoints get credit for a sale.'],['Incrementality','The extra results caused by a campaign.'],['Holdout test','Withholding a campaign from a group to measure its real effect.']] }
  ],
  playbook:{ t:'Tracking and reporting setup', steps:['Write your metric tree from revenue down.','Pick a north star metric.','Install GA4 and mark key events.','Set up Tag Manager with GA4, ad pixels and conversion tags.','Write a UTM naming rule and use it on every link.','Pass UTMs into hidden form fields and the CRM.','Add “How did you hear about us?”.','Calculate CAC (fully loaded and per channel), LTV, payback and churn.','Start an experiment log.','Build a one-page weekly dashboard and review it every week.'] },
  pad:['Your metric tree with current numbers:','Your UTM naming rule:','Your CAC, LTV, LTV:CAC and payback:','Dashboard: the 8–10 numbers you’ll review weekly:'],
  calc:'ltv',
  exam:[
    ['Which is a vanity metric?', ['Cost per lead','Followers','Customers','Revenue'], 1, 'Followers don’t directly pay bills.'],
    ['Calls booked this week is a…', ['Lagging indicator','Leading indicator','Vanity metric','Cohort'], 1, 'It predicts future customers and revenue.'],
    ['A metric tree…', ['Lists social platforms','Breaks revenue into the numbers that drive it','Is a CRM','Is a chart type'], 1, 'It shows which lever moves results.'],
    ['UTM parameters help you…', ['Design pages','Know where traffic came from','Send emails','Write copy'], 1, 'They tag links by source, medium and campaign.'],
    ['Google Tag Manager is used to…', ['Write ads','Manage tracking codes in one place','Host the website','Send newsletters'], 1, 'Add GA4, pixels and conversions without code edits.'],
    ['$2,000 spent, 4 new customers. CAC?', ['$200','$500','$800','$8,000'], 1, '2,000 ÷ 4 = $500.'],
    ['If 10% of customers leave each month, they stay on average about…', ['1 month','10 months','100 months','Forever'], 1, '1 ÷ 0.10 = 10.'],
    ['A common healthy LTV:CAC ratio is at least…', ['1:1','3:1','0.5:1','100:1'], 1, '3:1 is a widely used rule of thumb.'],
    ['Payback period is…', ['CAC ÷ monthly gross profit per customer','Revenue ÷ ads','LTV × CAC','Months until churn'], 0, 'How fast you earn back acquisition cost.'],
    ['“Last click” attribution tends to…', ['Overvalue content','Undervalue earlier touchpoints like content and brand','Be perfect','Ignore ads'], 1, 'It gives all credit to the final step.'],
    ['An incrementality test asks…', ['Which ad looks best','What would have happened without this campaign','How many likes','Which font'], 1, 'Measures the real extra effect.'],
    ['If LTV is low, you should first…', ['Spend more on ads','Fix retention or pricing','Stop tracking','Hire more callers'], 1, 'Scaling acquisition with low LTV loses money.']
  ] },

// ================================================================ 13
{ lvl:3, t:'Outbound: cold email, calls, mail and SMS', d:'Lists and data, cold email infrastructure and copy, cold calling and SMS, direct mail and LinkedIn, and the rules.',
  outcomes:['Build and clean targeted prospect lists.','Set up cold email infrastructure and write sequences that get replies.','Run cold calls and compliant SMS with scripts and cadences.','Use direct mail and LinkedIn outreach, and follow the main US and international rules.'],
  lessons:[
  { t:'Lists and data', mins:13, s:[
    ['Inbound vs outbound', `<p><b>Inbound</b> brings people to you (content, SEO, ads). <b>Outbound</b> means you go to them (cold email, calls, mail, SMS, LinkedIn messages). Outbound is fast to start and very targeted; it works only with a sharp list and a relevant message.</p>`],
    ['Building the list', `<ul><li>Start from the ICP: exact titles, industries, sizes, locations, triggers.</li><li>Sources: LinkedIn Sales Navigator, Apollo, ZoomInfo, Clay, industry directories, associations, event lists, public records.</li><li><b>Enrich</b> with emails, phones, company data and recent activity (hiring, funding, new listings).</li><li><b>Verify</b> emails before sending (bounces hurt deliverability).</li></ul>`],
    ['Segment by situation', `<p>Split the list so each group gets a relevant message: by role, trigger, size or recent event. 200 well-segmented prospects beat 5,000 random ones.</p>`],
    ['Data hygiene', `<p>Remove duplicates, existing customers, open deals, do-not-contact and unsubscribed records. Keep a suppression list and honour it across every tool and channel.</p>`]],
    ex:`<p>BrightLine built a list of 300 land investors who posted deals in the last 60 days (a trigger), verified emails, and split them into “mailers” and “PPC users” with different first lines.</p>`,
    terms:[['Enrichment','Adding contact and company data to records.'],['Suppression list','Contacts you must never message.'],['Trigger event','A change that makes outreach timely.']] },

  { t:'Cold email', mins:16, s:[
    ['Infrastructure first', `<p>Send cold email from <b>separate domains</b> (e.g. getbrightline.com) to protect your main domain’s reputation. Set up SPF, DKIM and DMARC, <b>warm up</b> new inboxes for a few weeks, send small volumes per inbox per day, and use plain text with few or no links and no attachments in the first email.</p>`],
    ['Writing the email', `<ul><li><b>Subject:</b> short, lowercase, internal-looking (“land leads in polk county”).</li><li><b>First line:</b> about them — a specific observation.</li><li><b>Problem:</b> one pain relevant to their situation.</li><li><b>Proof:</b> one short result.</li><li><b>Soft ask:</b> an interest question (“Worth a quick look?”), not “book 30 minutes”.</li></ul><p>Keep it under ~100 words. Write it like a person, not a brochure.</p>`],
    ['Sequences', `<p>3–5 emails over 2–3 weeks: new angle each time (different pain, a case study, a useful resource), shorter as you go, and a polite final “close the loop” email. Stop on reply.</p>`],
    ['Metrics', `<p>Bounce rate (keep very low), reply rate, <b>positive reply rate</b>, meetings booked, deals. Test one variable at a time: list, first line, offer, CTA.</p>`],
    ['Rules (general guidance)', `<p>US CAN-SPAM allows B2B cold email if you use honest headers and subject lines, include a postal address and an easy opt-out you honour. Many countries (e.g. under GDPR, CASL) are stricter — check before emailing outside the US.</p>`]],
    ex:`<p>BrightLine’s first email: “Saw your new 40-acre listing in Polk County — nice deal. Most land investors we talk to lose sellers because callers quit after a few weeks. We run a managed calling team that booked 38 seller appointments last month. Worth a quick look?” 62 words; 11% reply rate.</p>`,
    terms:[['Warm-up','Gradually building a new inbox’s sending reputation.'],['Positive reply rate','Share of prospects who reply with interest.'],['Sequence','A series of follow-up emails.']] },

  { t:'Cold calling and SMS', mins:16, s:[
    ['The call structure', `<ol><li><b>Opener:</b> who you are and a permission or pattern-interrupt line (“I know I’m calling out of the blue — can I take 30 seconds to tell you why?”).</li><li><b>Reason:</b> why them, why now.</li><li><b>Questions:</b> qualify the situation and pain.</li><li><b>Value:</b> one relevant result.</li><li><b>Next step:</b> book a specific time.</li></ol><p>Write the script, then practise until it sounds natural. Listen more than you talk.</p>`],
    ['Objection handling', `<p>Acknowledge → ask a question → answer briefly → return to the next step. Common ones: “Not interested” (“Totally fair — is that because you already have callers, or because the timing isn’t right?”), “Send me an email”, “How much is it?”, “We do it in-house”. Prepare answers for the top 5.</p>`],
    ['Cadence', `<p>Most results come after the 2nd–5th touch. Mix channels: call + email day 1, call day 3, email day 6, call day 10, breakup email day 14. Call at different times. Leave short voicemails with a reason to call back. Log every touch in the CRM.</p>`],
    ['SMS', `<p>Text messages get read fast but carry the strictest rules. Use them mainly for people who opted in (appointment reminders, follow-up after a conversation). For marketing texts in the US, carriers also require <b>A2P 10DLC</b> registration of your brand and campaign. Always identify yourself and include opt-out instructions (“Reply STOP to opt out”).</p>`],
    ['The rules for calls and texts (US, general guidance, not legal advice)', `<ul><li><b>TCPA:</b> autodialed or prerecorded/artificial-voice marketing calls and texts to mobile numbers generally require prior express written consent.</li><li><b>Do Not Call:</b> scrub against the National DNC Registry and keep your own internal DNC list; honour opt-outs promptly.</li><li><b>Calling hours:</b> 8am–9pm in the recipient’s local time.</li><li>Many states add stricter rules (hours, registration, frequency). Fines per call or text can be large; use a compliance tool and check with a lawyer before launching.</li></ul>`]],
    ex:`<p>BrightLine’s callers book from a 5-touch cadence. “Send me an email” is answered with: “Happy to — so I send the right thing, are you mostly using mail or PPC right now?” Half the time, the conversation continues.</p>`,
    terms:[['Cadence','A planned sequence of touches over time.'],['DNC','Do Not Call list.'],['TCPA','US law on marketing calls and texts.'],['A2P 10DLC','US carrier registration for business texting from local numbers.']] },

  { t:'Direct mail and LinkedIn outreach', mins:12, s:[
    ['Direct mail', `<p>Physical mail stands out because inboxes are crowded. Formats: letters (personal, longer), postcards (cheap, fast to read), handwritten-style notes, lumpy mail (a small object) for high-value prospects. Mail works best repeated to the same list (often every few weeks) and combined with calls or email. Track with unique phone numbers, URLs or QR codes.</p>`],
    ['Mail copy', `<p>Personal and specific: name, their property or company, one reason, one clear next step. A handwritten-looking envelope gets opened more. Test one variable per drop.</p>`],
    ['LinkedIn outreach', `<p>Connection request with a short personal note (or none), then a value-first message, then a soft ask (Module 7). Keep volumes modest and personal — LinkedIn limits and restricts accounts that spam. Combine with email and calls for a multi-channel cadence.</p>`],
    ['Multi-channel beats single', `<p>The same prospect seeing a postcard, an email and a call recognises your name by the third touch. Plan sequences across channels and log them all in one CRM.</p>`]],
    ex:`<p>BrightLine’s outbound to investors: 300 hand-checked land investors, 4-touch cadence (email, LinkedIn, postcard, call). 11% replied, 18 calls booked, 4 clients.</p>`,
    terms:[['Lumpy mail','Mail with a physical object inside.'],['Multi-channel cadence','A sequence that combines email, calls, mail and social.']] }
  ],
  playbook:{ t:'Outbound campaign launch', steps:['Define the exact list from your ICP and a trigger.','Build, enrich and verify; remove suppression and DNC records.','Segment by situation; write a message per segment.','Set up separate sending domains with SPF/DKIM/DMARC and warm-up.','Write a 3–5 email sequence under 100 words each.','Write a call script and answers to the top 5 objections.','Plan a 4–6 touch multi-channel cadence.','Check compliance: consent, DNC, calling hours, opt-out, 10DLC for SMS.','Log every touch in the CRM.','Track reply rate, positive replies, meetings and deals.'] },
  pad:['Who exactly is on your list, and what trigger?','A cold email under 100 words:','Your call opener and answers to 3 objections:','Your multi-channel cadence (day + channel):'],
  exam:[
    ['Outbound means…', ['Waiting for leads','Reaching out first','Only SEO','Only referrals'], 1, 'You contact them first.'],
    ['The biggest factor in outbound success is usually…', ['Fancy design','The list and relevance','Sending more emails','Long messages'], 1, 'Right people + relevant message.'],
    ['Why verify emails before sending?', ['It’s required','Bounces hurt deliverability','To find phone numbers','No reason'], 1, 'High bounce rates damage sender reputation.'],
    ['Why use a separate domain for cold email?', ['It looks nicer','To protect your main domain’s reputation','It’s required','To hide your identity'], 1, 'Protects deliverability of your main email.'],
    ['A good cold email is…', ['Long with attachments','Short, personal, one soft ask','All images','A full price list'], 1, 'Short and relevant gets replies.'],
    ['The best first line of a cold email is about…', ['Your company history','Them, with a specific observation','The weather','Your prices'], 1, 'Relevance earns attention.'],
    ['Most replies come…', ['On the first touch','After several follow-ups','Never','Only by mail'], 1, 'Follow-up is where the results are.'],
    ['A good objection response starts by…', ['Arguing','Acknowledging, then asking a question','Hanging up','Offering a discount'], 1, 'Acknowledge, ask, answer, next step.'],
    ['Allowed calling hours for US telemarketing are generally…', ['Any time','8am–9pm recipient’s local time','Midnight–6am','Weekends only'], 1, 'Under federal rules; states can be stricter.'],
    ['Autodialed marketing texts to US mobiles generally require…', ['Nothing','Prior express written consent','A discount','A logo'], 1, 'TCPA consent rules apply.'],
    ['A2P 10DLC is…', ['An ad format','US carrier registration for business texting','A CRM','A mail format'], 1, 'Required for business texts from local numbers.'],
    ['Direct mail works best when…', ['Sent once','Repeated and combined with other channels','Sent without tracking','Generic'], 1, 'Repetition and multi-channel build recognition.']
  ] },

// ================================================================ 14
{ lvl:3, t:'Planning and running the growth system', d:'Strategy and budgets, campaign planning, retention, referrals and partnerships, and CRM, automation, AI and teams.',
  outcomes:['Build an annual and 90-day plan from a revenue goal, with a budget.','Brief and launch campaigns with a checklist.','Grow through retention, referrals and partnerships.','Run marketing with a CRM, automation, AI tools and a small team or freelancers.'],
  lessons:[
  { t:'Strategy, goals and budget', mins:15, s:[
    ['Work backwards from the goal', `<p><i>Revenue goal ÷ average deal = customers needed ÷ close rate = calls needed ÷ show rate = bookings ÷ booking rate = leads needed.</i> Now you know how many leads you need and, from your margins, what you can pay per lead.</p>`],
    ['Setting the budget', `<ul><li><b>Goal-based:</b> leads needed × affordable CPL (best).</li><li><b>% of revenue:</b> many businesses spend a single-digit to low-double-digit % of revenue on marketing; growth-focused companies more.</li><li><b>Allocation rule of thumb (70/20/10):</b> ~70% on proven channels, ~20% on promising ones, ~10% on experiments.</li></ul>`],
    ['Pick few channels, go deep', `<p>1–2 main channels that fit your audience and budget, plus one long-term compounding channel (SEO, newsletter or YouTube). Three channels done well beat seven done badly. Add a channel only when the current ones are running smoothly.</p>`],
    ['Plans at three levels', `<ul><li><b>Annual:</b> goals, positioning, main channels, budget, big launches.</li><li><b>90-day:</b> one number, channels with weekly actions, owners, experiments.</li><li><b>Weekly:</b> tasks, dashboard review, one decision.</li></ul><p>Use OKRs if helpful: an <b>objective</b> (qualitative) with 2–4 measurable <b>key results</b>.</p>`]],
    ex:`<p>Goal: $9,000 new monthly revenue. Avg client $1,800 → 5 clients. Close rate 25% → 20 calls held. Show rate 80% → 25 booked. Booking rate 10% → 250 leads. At $25 CPL = $6,250 in ads, or a mix with outbound and content to lower it.</p>`,
    terms:[['Reverse funnel math','Working back from the revenue goal to leads needed.'],['70/20/10','Budget split: proven, promising, experimental.'],['OKR','Objective and key results.']] },

  { t:'Campaign planning and launch', mins:13, s:[
    ['The campaign brief', `<p>One page: <b>goal and metric</b>, audience (persona and awareness level), key message and offer, proof, channels and formats, budget, timeline, owners, how you’ll measure success. Everyone working on it reads the brief first.</p>`],
    ['Launch checklist', `<ul><li>Landing page live, tested on mobile, message-matched.</li><li>Tracking and UTMs working end to end (test a submission).</li><li>CRM fields, tags and automations ready; sales team briefed.</li><li>Creative and copy approved and proofread.</li><li>Compliance checked (consent, disclosures, special ad categories).</li><li>Budget caps set; dashboard ready.</li></ul>`],
    ['During and after', `<p>Check daily in the first week for broken things, weekly for performance. At the end, run a <b>retro</b>: what worked, what didn’t, what we’ll keep, fix and stop. Add lessons to the experiment log.</p>`],
    ['Experiments and ICE', `<p>Write ideas as hypotheses (“If we do X, Y will change by Z, because…”), score by <b>Impact, Confidence, Ease</b>, run the top ones, record results.</p>`]],
    ex:`<p>BrightLine’s “Q2 script download” brief: goal 300 sign-ups and 15 calls; audience problem-aware land investors; channels LinkedIn + Meta + newsletter swaps; budget $1,500; owner: founder. Result: 340 sign-ups, 17 calls.</p>`,
    terms:[['Campaign brief','One-page plan for a campaign.'],['Retro','A review after a campaign: keep, fix, stop.'],['ICE score','Impact × confidence × ease.']] },

  { t:'Retention, referrals and partnerships', mins:15, s:[
    ['Retention is marketing too', `<p>Keeping a customer is usually far cheaper than finding a new one, and small gains in retention raise LTV a lot. Onboard well (quick first win), check in proactively, share results regularly (reports, QBRs), and fix problems before customers ask.</p>`],
    ['Measure satisfaction', `<p><b>NPS</b> (“How likely are you to recommend us, 0–10?”): promoters 9–10, detractors 0–6; NPS = % promoters − % detractors. Follow up with detractors fast; ask promoters for reviews, referrals and case studies.</p>`],
    ['Referral programs', `<p>Ask at moments of success. Make it easy (a short intro email they can forward). Reward both sides if it fits your industry (a free month, a cash bonus, a gift) — and check local rules on referral payments where they apply.</p>`],
    ['Upsell and cross-sell', `<p>Offer more value to happy customers: higher tiers, add-ons, related services. Time it after results, not before.</p>`],
    ['Partnerships and affiliates', `<p>Partner with businesses that serve the same customers but don’t compete (for BrightLine: land data providers, CRMs, title companies, investor coaches). Options: co-hosted webinars, newsletter swaps, bundles, referral or affiliate commissions. One good partner can beat a whole ad channel.</p>`]],
    ex:`<p>BrightLine sends a monthly results report and asks for referrals when a client closes a deal from their leads. 30% of new clients now come from referrals and a partnership with a land-data company that co-hosts a monthly webinar.</p>`,
    terms:[['Retention','Keeping customers over time.'],['NPS','Net Promoter Score.'],['Affiliate','A partner paid a commission for referrals.'],['QBR','Quarterly business review with a client.']] },

  { t:'CRM, automation, AI and running the team', mins:15, s:[
    ['CRM', `<p>The CRM (GoHighLevel, HubSpot, Pipedrive, Salesforce…) holds every lead, stage, source, owner, value and next step. Define pipeline stages with clear entry rules, required fields per stage, and a rule that every open lead has a next task with a date.</p>`],
    ['Automation', `<ul><li>Instant reply to new leads (email/SMS with consent) and task to call.</li><li>Lead routing to the right person.</li><li>Follow-up sequences by stage; reminders; no-show recovery.</li><li>Review and referral requests after success.</li></ul><p><b>Speed to lead</b> matters: leads contacted within minutes convert far better than those reached hours later.</p>`],
    ['AI in marketing', `<p>Use AI tools to research, outline, draft, repurpose, summarise calls, analyse data and generate ad variations faster. Always add your real experience, check facts and numbers, keep your voice, and protect private data. AI speeds up good thinking; it doesn’t replace knowing your customer.</p>`],
    ['Working with freelancers and agencies', `<p>Write clear briefs, agree deliverables and metrics up front, own your accounts and data (ad accounts, domains, CRM), start with a small paid test, and review results monthly. Document recurring work as SOPs so anyone can repeat it.</p>`],
    ['Keep learning', `<p>Free certifications worth doing: Google Ads and Google Analytics (Skillshop), Meta Blueprint, HubSpot Academy. Follow practitioners, not gurus; test what you learn on real campaigns.</p>`]],
    ex:`<p>BrightLine’s GoHighLevel setup texts new inbound leads within 60 seconds (with consent) and creates a call task. Their contact rate on inbound leads went from 40% to 75%.</p>`,
    terms:[['Pipeline stage','A step in the sales process with clear entry rules.'],['Speed to lead','How fast you respond to a new lead.'],['SOP','Standard operating procedure.']] }
  ],
  playbook:{ t:'Growth system setup', steps:['Set one revenue goal; do reverse funnel math.','Set the budget (goal-based) and split 70/20/10.','Choose 1–2 main channels + 1 compounding channel.','Write the 90-day plan with weekly actions and owners.','Write a campaign brief and run the launch checklist.','Score 5 experiments with ICE.','Set up onboarding, monthly reports and NPS.','Launch a referral ask and approach 3 partners.','Define CRM stages, required fields and speed-to-lead automation.','Write SOPs for recurring work; review monthly.'] },
  pad:['Reverse funnel math for your goal:','Budget and 70/20/10 split:','Campaign brief (goal, audience, message, channels, budget, owner):','5 experiments with ICE scores:','3 partner ideas:'],
  calc:'funnel',
  exam:[
    ['Campaign planning should start from…', ['The ad platform','The revenue goal','The logo','Competitors’ posts'], 1, 'Work backwards from the goal.'],
    ['Need 4 clients, close rate 25%. How many calls held?', ['4','8','16','25'], 2, '4 ÷ 0.25 = 16.'],
    ['The 70/20/10 rule splits budget into…', ['Ads, SEO, email','Proven, promising, experimental','Salary, tools, ads','Q1, Q2, Q3'], 1, 'Most on what works, some on bets.'],
    ['How many main channels should a small team focus on?', ['1–2 (+1 long-term)','7','All of them','None'], 0, 'Depth beats breadth.'],
    ['A campaign brief should include…', ['Only the budget','Goal, audience, message, channels, budget, owners, measurement','Just the creative','Nothing'], 1, 'It aligns everyone before work starts.'],
    ['ICE stands for…', ['Income, cost, earnings','Impact, confidence, ease','Ideas, content, email','Inbound, cold, email'], 1, 'Used to rank experiments.'],
    ['NPS is calculated as…', ['% promoters − % detractors','Average score × 10','Number of reviews','Revenue per customer'], 0, 'Promoters 9–10, detractors 0–6.'],
    ['When is the best moment to ask for a referral?', ['At signup','After a success','At cancellation','Never'], 1, 'Happy moments create willing advocates.'],
    ['A good partner is a business that…', ['Competes with you','Serves the same customers without competing','Is the biggest','Is cheapest'], 1, 'Shared audience, different offer.'],
    ['Why does speed to lead matter?', ['It doesn’t','Fast replies convert far better','Only for SEO','Only for email'], 1, 'Interest fades in minutes.'],
    ['The right way to use AI for marketing is…', ['Publish whatever it writes','Use it to speed up, then add experience and check facts','Never use it','Only for images'], 1, 'AI accelerates; you stay responsible.'],
    ['When working with an agency, you should…', ['Let them own your ad accounts','Own your accounts and data','Skip metrics','Pay a year upfront without a test'], 1, 'Owning accounts protects the business.']
  ] }
);
