// Module 8 recap: the module on one page. Every point names the part and section it comes from (see player.js recap()).
COURSE.modules.m08.recap = {
  ideas:[
    [ ['Email and text lists are owned media: no algorithm decides who sees them, and for past customers they’re often the cheapest repeat work.', 0],
      ['Grow the list at every booking and job, with a real sign-up offer. Never buy or rent lists.', 1],
      ['CAN-SPAM: honest From and subject, say it’s an ad where it is, a postal address, a clear opt-out honoured within 10 business days.', 2],
      ['Marketing texts need prior express written consent under the TCPA. A number given to book a repair isn’t consent for marketing.', 3],
      ['Remove bounces, opt-outs and long-inactive addresses. A smaller list that wants your emails performs better.', 4] ],
    [ ['People see the sender name, subject line and preview text first. Use a name they recognise and a subject that says what’s inside.', 0],
      ['One email, one job, one main call to action, with the point in the first two lines.', 1],
      ['Write like a person and sign off as one. Simple, mostly text emails often do as well as designed ones.', 2],
      ['Make it for phones: one column, large text, a big button near the top, images that aren’t needed.', 3],
      ['Subject lines should be specific, useful or personal, and never misleading.', 4] ],
    [ ['Automations send the right message when something happens, every time, and usually earn more per message than one-off campaigns.', 0],
      ['The core sequences: welcome, after the job, quote follow-up, reminders and win-back.', 1],
      ['Stop rules matter as much as timing. Most automation mistakes are messages that should have stopped.', 2],
      ['Use real details and check every field fills; “Hi {first_name}” is worse than “Hi there”.', 3],
      ['Build the sequence closest to lost revenue first: usually quote follow-up and plan renewal.', 4] ],
    [ ['Texts suit short, timely, useful messages: reminders, “on the way”, a slot that opened, the review request.', 0],
      ['Service texts about the customer’s own job are different from marketing texts, which need written consent. Keep them separate.', 1],
      ['Say who it’s from, one action, under about 160 characters, the opt-out on marketing texts, sensible hours.', 2],
      ['Replies must reach a person, and STOP, QUIT or “please stop texting me” all count as opt-outs.', 3],
      ['Send marketing texts far less often than email: a few times a year is plenty.', 4] ],
    [ ['Since February 2024, Google and Yahoo require bulk senders to use SPF, DKIM and DMARC, one-click unsubscribe and low spam complaints.', 0],
      ['Old or bought lists, sudden big sends, misleading subjects and free sender addresses hurt deliverability.', 1],
      ['Sending the right message to a segment beats sending everything to everyone.', 2],
      ['Opens are unreliable since Apple’s 2021 change. Judge by clicks, bookings, revenue per email, unsubscribes and complaints.', 3],
      ['Test one thing at a time, judged by clicks or bookings. With a small list, learn from patterns across sends.', 4] ]
  ],
  nums:[
    ['Opt-out deadline', 'Within 10 business days, for email (CAN-SPAM) and texts (FCC rules from April 2025).', 1, 3],
    ['Spam complaints', 'Google asks for under 0.3% and recommends under 0.1%.', 5, 0],
    ['SMS length', 'Under about 160 characters where possible.', 4, 2],
    ['Quote follow-up value', '2 more sales a month × $11,000 = $22,000 revenue, about $7,700 gross profit.', 3, 'ex'],
    ['Renewal sequence', '75% → 80% of 1,000 members = 50 more × $180 = $9,000 a year.', 3, 'ex'],
    ['Click rate', 'People who clicked ÷ people who received it. Spring email: 157 ÷ 3,920 = 4%.', 5, 'ex'],
    ['Revenue per email', 'Revenue ÷ emails delivered. About $5,550 ÷ 3,920 ≈ $1.42.', 5, 'ex']
  ],
  traps:[
    ['Sending marketing texts to numbers people gave only to book service.', 1, 'ex'],
    ['A newsletter with a logo image, four articles, six links and the offer at the bottom.', 2, 'ex'],
    ['Automations without stop rules, like a sales email the day after a complaint.', 3, 2],
    ['Emailing 4,000 cold addresses at once from a free email account.', 5, 'ex'],
    ['Judging emails by open rate.', 5, 3]
  ],
  check:[
    ['A customer gave their number to book a repair. Can you send them a tune-up offer by text?', 'No. Appointment texts are fine, but marketing texts need prior express written consent.', 1, 3],
    ['What three things does someone see before opening an email?', 'The sender name, the subject line and the preview text.', 2, 0],
    ['Which sequence should Kestrel build first, and why?', 'The quote follow-up: it’s closest to revenue already being lost (24 quotes, only 8 sold).', 3, 4],
    ['What three records should a sender set up on its domain?', 'SPF, DKIM and DMARC.', 5, 0],
    ['Why not judge an email by its open rate?', 'Apple’s Mail Privacy Protection preloads images, so opens are inflated and unreliable.', 5, 3]
  ]
};
