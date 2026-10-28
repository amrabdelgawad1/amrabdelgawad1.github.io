// Module 9 recap: the module on one page. Every point names the part and section it comes from (see player.js recap()).
COURSE.modules.m09.recap = {
  ideas:[
    [ ['A website has three jobs: answer, prove and convert. Most visitors leave as soon as they can’t find their answer.', 0],
      ['Five-second test: can someone say what you do, for whom and what to do next? The top of the page needs a headline, the area, one action and a trust sign.', 1],
      ['People scan, often in an F-shape. Use headings, short paragraphs and important words first.', 2],
      ['A service business needs a page per main service with prices or ranges, proof and a button.', 3],
      ['Every page ends with a next step, and the phone and booking button are always easy to reach on phones.', 4] ],
    [ ['A landing page is built for one campaign and one action, usually with no main menu.', 0],
      ['Message match: the page must say what the person clicked, or they think they’re in the wrong place.', 1],
      ['It needs a matching headline, the offer, proof, three steps, one repeated action and answers to worries.', 2],
      ['Every form field costs sign-ups. Ask only what you need and make the button say what happens.', 3],
      ['The thank-you page says exactly what happens next and when, and it’s where you track the conversion.', 4] ],
    [ ['Map the funnel with numbers and the rate between each step. Start at the biggest or cheapest leak.', 0],
      ['Speed to lead: contacting within an hour made firms nearly seven times as likely to qualify a lead (HBR, 2011).', 1],
      ['Answer calls live, reply to forms within minutes with an instant text then a call, offer online booking and use a short script.', 2],
      ['Use tracking numbers and UTM links, and record the source in the job, so you see revenue by source.', 3],
      ['Fix the leak before buying more traffic.', 4] ],
    [ ['Core Web Vitals: main content within 2.5 seconds, response to taps within 200 ms, layout shift under 0.1.', 0],
      ['Common fixes: compress images, drop sliders and unused widgets, limit scripts, use good hosting.', 1],
      ['Design for the phone first and test on a real phone.', 2],
      ['WCAG basics: contrast, labels on every field, alt text, keyboard use, clear errors.', 3],
      ['Visitors notice neglect: https, a real address, privacy notes on forms, no broken pages or old offers.', 4] ],
    [ ['CRO starts with research into why people don’t act: analytics, recordings, the five-second test, surveys and the office team.', 0],
      ['Most problems are clarity, friction or anxiety. Fix the biggest one first.', 1],
      ['Write a hypothesis: because [evidence], we believe [change] will [result]. We’ll know by [measure].', 2],
      ['A/B tests need enough visitors to tell a real difference from luck. Small sites test bigger changes or act on research and watch the trend.', 3],
      ['Set the measure and sample size first, run full weeks, don’t stop early, and record every result.', 4] ]
  ],
  nums:[
    ['Landing page at 8%', '1,600 clicks → 128 leads instead of 80; cost per lead $60 → $37.50; about 81 jobs instead of 50.', 2, 'ex'],
    ['Website funnel in May', '3,000 visits → 90 leads (3%) → 63 booked (70%) → 57 jobs (90%).', 3, 'ex'],
    ['Form fix', 'Forms 50% → 75% booked: about 7 more jobs, roughly $2,900 a month.', 3, 'ex'],
    ['Core Web Vitals', 'LCP 2.5 s · INP 200 ms · CLS under 0.1.', 4, 0],
    ['Kestrel’s homepage speed', 'About 6 s on a phone → about 2.2 s after removing the 4 MB photo, slider and widget.', 4, 'ex'],
    ['Lehr’s rule', 'Visitors per version ≈ 16 × p × (1 − p) ÷ d².', 5, 3],
    ['Sample size example', '16 × 0.0575 × 0.9425 ÷ 0.015² ≈ 3,850 per version, about 5 months of Kestrel’s ad clicks.', 5, 'ex']
  ],
  traps:[
    ['A homepage with a sunset photo, a slider and the phone number in the footer.', 1, 'ex'],
    ['Sending every ad to the homepage instead of a matching landing page.', 2, 'ex'],
    ['Answering web forms the next morning while calls get answered live.', 3, 'ex'],
    ['Buying more traffic into a leaking funnel.', 3, 4],
    ['Stopping an A/B test the moment one version is ahead.', 5, 4]
  ],
  check:[
    ['What three things should someone know after five seconds on your homepage?', 'What the business does, who it’s for, and what to do next.', 1, 1],
    ['An ad says “$89 diagnostic” but the page says “Welcome to Kestrel”. What’s the problem?', 'No message match, so people think they’re in the wrong place and leave.', 2, 1],
    ['Visitors leave at the price and say they’re unsure what a repair costs. Clarity, friction or anxiety?', 'Anxiety, about cost.', 5, 'ex'],
    ['Why can’t Kestrel A/B test a 1.5-point change quickly?', 'It needs about 3,850 visitors per version, close to 5 months of its ad clicks.', 5, 'ex'],
    ['What does the thank-you page need?', 'Exactly what happens next and when, one useful extra, and the conversion tracking.', 2, 4]
  ]
};
