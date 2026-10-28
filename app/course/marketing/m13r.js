// Module 13 recap: the module on one page. Every point names the part and section it comes from (see player.js recap()).
COURSE.modules.m13.recap = {
  ideas:[
    [ ['A measurement plan starts from the business goal, then a few KPIs, then the metrics behind them. If a number doesn’t help a decision, don’t report it.', 0],
      ['A KPI tree breaks the goal into numbers that multiply: leads × booking rate × run rate × average job value, plus plan revenue.', 1],
      ['Leading indicators move first (calls, quotes booked); lagging ones show results after (revenue, installs). Watch leading ones weekly.', 2],
      ['The job records are the source of truth for revenue; the other tools explain how people got there.', 3],
      ['Keep one page of numbers with fixed definitions. Quietly changing definitions ruins comparisons.', 4] ],
    [ ['GA4 records events; mark the important ones as key events and check each fires once, at the right moment.', 0],
      ['Use one naming guide for UTMs, tracking numbers per source and a fixed source field on every job.', 1],
      ['The most useful report joins a lead’s source to what it became: booked, run, revenue.', 2],
      ['Tell visitors what you collect, ask consent where required, and never send names or phone numbers into analytics.', 3],
      ['Compare totals across systems monthly. Big gaps, sudden zeros and growing “unknown” sources mean broken tracking.', 4] ],
    [ ['Every attribution model is a view, not the truth. GA4 now offers data-driven and last click.', 0],
      ['Use platform reports, “How did you hear?” and experiments, and trust the ones that agree.', 1],
      ['CAC = marketing cost ÷ new customers, worked out blended and by channel, including fees and tools.', 2],
      ['LTV is the gross profit over the whole relationship, estimated from what past customers actually did. Compare it with CAC and check payback.', 3],
      ['Cohorts show whether customers are getting more or less valuable over time, and which channels bring people back.', 4] ],
    [ ['A change only “worked” compared with a control. Before and after alone is fooled by weather and seasons.', 0],
      ['Small numbers jump around by chance. Lehr’s rule shows how many you need; if you can’t get that many, test bigger changes or run longer.', 1],
      ['A rough 95% range for a rate is ± 2 × √(p × (1 − p) ÷ n).', 2],
      ['Ask both: are we confident it’s real, and is it big enough to be worth the cost?', 3],
      ['Decide the measure and length first, don’t peek and stop, don’t cherry-pick, and log every test.', 4] ],
    [ ['A monthly report answers what happened, why, and what next, with the conclusion first.', 0],
      ['A channel scorecard (cost, jobs, new customers, gross profit, CAC) moves money on evidence, not habit.', 1],
      ['Simple charts: lines for trends, bars for comparison, tables for exact numbers; bars start at zero.', 2],
      ['Goodhart’s law: when a measure becomes a target, it stops being a good measure. Pair every target with a check.', 3],
      ['Report bad news as clearly as good news, and separate facts from guesses.', 4] ]
  ],
  nums:[
    ['KPI tree for May', '200 leads × 70% × 90% = 126 jobs; 24 quotes × 33% = 8 installs.', 1, 'ex'],
    ['Blended CAC', '$6,000 ÷ about 90 new customers ≈ $67. Google Ads: $6,000 ÷ 50 = $120.', 3, 'ex'],
    ['Five-year LTV', '$252 + $252 + $101 + $578 ≈ $1,180 for a new repair customer.', 3, 'ex'],
    ['LTV to CAC', 'About 10 to 1 against Google Ads; payback on the first job ($252 vs $120).', 3, 'ex'],
    ['Margin of error', '70% booked on 200 leads: about ± 6.5 points, so roughly 64% to 76%.', 4, 'ex'],
    ['$89 → $99 test', 'Detecting a 5-point drop needs about 1,400 leads per group, about 14 months.', 4, 'ex'],
    ['Tracking audit', 'GA4 counted 52 forms; the inbox had 30. 27% of jobs had no real source.', 2, 'ex']
  ],
  traps:[
    ['A key event that fires again on page reloads, inflating conversions.', 2, 'ex'],
    ['Leaving the source field optional, so “Other” and blanks creep up.', 2, 'ex'],
    ['Treating one attribution model as the truth.', 3, 0],
    ['Reading one month at 66% booked as proof of a problem.', 4, 'ex'],
    ['Rewarding bookings alone, so people book appointments that cancel.', 5, 3]
  ],
  check:[
    ['Calls this week: leading or lagging indicator?', 'Leading. It moves before revenue does.', 1, 2],
    ['A buyer read the guide, clicked an ad and says a neighbour recommended you. Who gets credit?', 'All three played a part; last click, first click and self-report each tell part of the story.', 3, 'ex'],
    ['What’s the rough 95% range for 70% booked on 200 leads?', 'About 64% to 76% (± 6.5 points).', 4, 'ex'],
    ['Why test the $99 fee in half the area instead of an A/B test?', 'An A/B test needs about 1,400 leads per group, over a year of leads.', 4, 'ex'],
    ['What does Goodhart’s law mean for the office bonus?', 'Base it on booked jobs that are actually run, not bookings alone.', 5, 'ex']
  ]
};
