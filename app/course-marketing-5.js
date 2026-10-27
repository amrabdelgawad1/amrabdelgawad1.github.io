// Marketing course, level 5: Capstone (module 15). See course-marketing.js for the format.
window.LH_COURSES.mkt.modules.push(

// ================================================================ 15
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
