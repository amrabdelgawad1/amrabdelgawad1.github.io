// Marketing course for the Learning Hub (learn.js reads window.LH_COURSES.mkt).
// Each module: lesson (sections), a worked example, key terms, a playbook checklist,
// scratch-pad prompts, an optional calculator and an exam [question, options, right answer index, why].
// The running example is BrightLine Calls, a made-up team that cold-calls for US real estate investors.
window.LH_COURSES = window.LH_COURSES || {};
window.LH_COURSES.mkt = { levels:['Foundations', 'Channels', 'Growth', 'Real estate'], modules:[

// ---------------------------------------------------------------- Foundations
{ lvl:0, t:'What marketing really is', mins:20,
  d:'Marketing vs sales vs brand, the customer journey and why most marketing fails.',
  lesson:[
    ['Marketing is getting the right people to want what you offer', `<p>Marketing is everything you do so that the right people <b>notice you, understand you, trust you and choose you</b>. Ads and posts are only the visible part. Picking who you serve, what you offer, what you charge and how you talk about it are all marketing decisions, and they matter more than any single campaign.</p>
      <p>A useful test: if a stranger who fits your ideal customer saw your offer for ten seconds, would they know <b>what it is, who it is for and why it beats the alternatives</b>? If not, more ads will only spend money faster.</p>`],
    ['Marketing, sales and brand', `<ul><li><b>Marketing</b> creates and warms up demand: it brings people in and makes them ready to talk.</li>
      <li><b>Sales</b> turns a warm person into a paying customer: conversations, proposals, closing.</li>
      <li><b>Brand</b> is what people say about you when you're not in the room. Every touch builds or spends it.</li></ul>
      <p>In a small business one person often does all three. Keep them separate in your head anyway, because each has its own numbers and its own fixes.</p>`],
    ['The customer journey', `<p>Every buyer moves through the same stages. Name them and you can see where people get stuck.</p>
      <ol><li><b>Awareness:</b> they learn you exist.</li><li><b>Interest:</b> they want to know more.</li><li><b>Consideration:</b> they compare you with other options, including doing nothing.</li>
      <li><b>Decision:</b> they buy, sign or book.</li><li><b>Retention:</b> they stay and buy again.</li><li><b>Referral:</b> they bring others.</li></ol>
      <p>Each stage needs different content. A cold stranger needs a reason to care; someone comparing options needs proof; a customer needs a great experience and an easy way to refer.</p>`],
    ['The four Ps, in plain words', `<p>The classic marketing mix still works as a checklist: <b>Product</b> (what exactly they get), <b>Price</b> (what it costs and how it's packaged), <b>Place</b> (where and how they buy) and <b>Promotion</b> (how they hear about it). When results are poor, check all four before blaming promotion.</p>`],
    ['Why most marketing fails', `<ul><li>Talking to everyone, so it speaks to no one.</li><li>Describing features instead of the result the customer wants.</li><li>No clear next step (call to action).</li><li>Quitting a channel after two weeks, before it can work.</li><li>Not measuring, so nobody knows what to keep or cut.</li></ul>`]
  ],
  example:`<p><b>BrightLine Calls</b> started with “We make calls for businesses.” Few replies. They narrowed it to “We call absentee land owners for US land investors, and book you motivated sellers.” Same team, same price. Replies tripled because the right people instantly saw themselves in it.</p>`,
  terms:[['Customer journey','The stages from first hearing about you to buying, staying and referring.'],['Call to action (CTA)','The one next step you ask someone to take.'],['Marketing mix (4 Ps)','Product, price, place and promotion.']],
  playbook:{ t:'Marketing health check', steps:['Write who you serve in one sentence.','Write the result you deliver in one sentence.','List the 3 alternatives your customer has (including doing nothing).','Map where your leads come from today.','Mark the journey stage where most people drop off.','Pick one number per stage you will track.'] },
  pad:['Who is your customer, in one sentence?','What result do they want (not what you do)?','Where in the journey are you losing the most people, and why do you think so?'],
  exam:[
    ['Which is the best description of marketing?', ['Running ads and posting on social media','Getting the right people to notice, trust and choose you','Closing deals on the phone','Designing a logo'], 1, 'Ads and posts are tools. Marketing covers who you serve, what you offer and how you get chosen.'],
    ['What is the main job of sales, compared with marketing?', ['Creating awareness','Turning a warm prospect into a paying customer','Building the brand voice','Choosing the price'], 1, 'Marketing warms people up; sales converts them.'],
    ['A prospect is comparing you with two competitors. Which stage are they in?', ['Awareness','Consideration','Retention','Referral'], 1, 'Comparing options is the consideration stage, where proof matters most.'],
    ['Which of these is NOT one of the four Ps?', ['Price','Place','People','Promotion'], 2, 'The classic four are product, price, place and promotion.'],
    ['Your ads get clicks but nobody books. Before raising the budget you should…', ['Post more often','Check the offer, page and next step','Change the logo','Switch to a new platform'], 1, 'Spending more on a leaking funnel only loses money faster.'],
    ['“Brand” is best described as…', ['Your logo and colours','What people say about you when you are not there','Your ad budget','Your website'], 1, 'Logos are brand assets; the brand is the reputation.'],
    ['Which message will usually perform best?', ['We help businesses grow','We do calls','We book motivated land sellers for US land investors','We are the best in the market'], 2, 'Specific audience plus specific result beats vague claims.'],
    ['Why is “doing nothing” listed as a competitor?', ['It isn’t a competitor','Many buyers choose to keep things as they are','Because it is cheaper','Because of the law'], 1, 'The most common lost deal is not to a rival but to inaction.']
  ] },

{ lvl:0, t:'Know your customer', mins:25,
  d:'Ideal customer profile, personas, jobs to be done and how to interview customers.',
  lesson:[
    ['Start narrow', `<p>Your <b>ideal customer profile (ICP)</b> is the type of customer who gets the most value from you, pays well, and is easy to work with. Narrow does not mean small: it means your message lands so well with one group that they refer others like them. You can widen later.</p>
      <p>For businesses (B2B) an ICP includes industry, size, location, budget and the trigger that makes them look for help. For people (B2C) it includes life situation, problem, budget and where they spend time.</p>`],
    ['Personas: the person behind the profile', `<p>A <b>persona</b> describes one real-feeling buyer: their role, goals, frustrations, fears, what they read and what words they use. Two or three personas are plenty. Base them on real conversations, not guesses.</p>`],
    ['Jobs to be done', `<p>People “hire” a product to get a job done. A land investor does not want cold calls; they want <b>a steady flow of sellers ready to talk</b>, without managing callers themselves. Write the job as: <i>When [situation], I want to [motivation], so I can [outcome].</i></p>
      <p>Behind every job there are three layers: <b>functional</b> (get leads), <b>emotional</b> (stop worrying about the pipeline) and <b>social</b> (look successful to partners).</p>`],
    ['Pains, gains and triggers', `<ul><li><b>Pains:</b> what hurts today, costs money, wastes time or creates risk.</li><li><b>Gains:</b> what they hope will be true after.</li><li><b>Triggers:</b> the moment they start looking (a bad month, a new hire quitting, a new market).</li></ul>
      <p>Triggers are gold: if you know them, you know when to show up.</p>`],
    ['How to interview customers', `<p>Talk to 5–10 customers or prospects. Ask about the past, not opinions about the future:</p>
      <ul><li>“Tell me about the last time you tried to solve this.”</li><li>“What made you start looking then?”</li><li>“What else did you try? What was frustrating about it?”</li><li>“What almost stopped you from buying?”</li><li>“How would you describe what we do to a friend?”</li></ul>
      <p>Write down their <b>exact words</b>. Those phrases become your headlines.</p>`]
  ],
  example:`<p>BrightLine interviewed 8 clients. Six said almost the same thing: “I was tired of hiring callers who quit after two weeks.” That became their headline: <i>“Callers who stay. Leads that show up.”</i></p>`,
  terms:[['ICP','Ideal customer profile: the type of customer you serve best.'],['Persona','A described individual buyer inside your ICP.'],['Jobs to be done','The progress a customer is trying to make by buying.'],['Trigger','The event that makes someone start looking for a solution.']],
  playbook:{ t:'Customer research sprint', steps:['List your 10 best customers and what they have in common.','Book 5 short interviews (15–20 minutes).','Ask about past behaviour, not hypothetical opinions.','Record exact phrases in a shared doc.','Write 1–3 personas from the patterns.','Write the main job to be done in the When / I want / So I can format.','List the top 3 triggers.'] },
  pad:['Describe your ideal customer (who, where, size, budget).','Write their job to be done: When…, I want to…, so I can…','List 3 pains, 3 gains and 2 triggers.','Write 3 exact phrases a customer used.'],
  exam:[
    ['What is an ICP?', ['A pricing model','The type of customer who gets the most value from you','A social media metric','A sales script'], 1, 'ICP = ideal customer profile.'],
    ['Why start with a narrow audience?', ['It is cheaper to print','Your message lands harder and spreads by referral','Wide audiences are illegal','It is not recommended'], 1, 'A sharp message for one group converts better; you widen later.'],
    ['Which interview question is best?', ['Would you buy this if it existed?','Tell me about the last time you tried to solve this','Do you like our logo?','How much would you pay?'], 1, 'Past behaviour is far more reliable than guesses about the future.'],
    ['A “trigger” is…', ['A discount code','The event that makes someone start looking','An ad format','A type of persona'], 1, 'Know the trigger and you know when to show up.'],
    ['Which is a job to be done, not a product?', ['Cold-calling software','Keep my pipeline full without managing callers','A CRM','A 30-minute call'], 1, 'Jobs are about the progress the customer wants.'],
    ['Feeling less stressed about leads is which layer of the job?', ['Functional','Emotional','Social','Financial'], 1, 'Emotional jobs are about how the customer wants to feel.'],
    ['Why record customers’ exact words?', ['For legal reasons','They become your strongest copy','To train AI','It is not useful'], 1, 'Customers trust words that sound like their own thoughts.'],
    ['How many personas does a small business usually need?', ['1–3','10–15','One per customer','None'], 0, 'A few well-researched personas beat many shallow ones.']
  ] },

{ lvl:0, t:'Positioning and your offer', mins:25,
  d:'Stand out from the alternatives and build an offer people find easy to say yes to.',
  lesson:[
    ['Positioning is the context you choose', `<p><b>Positioning</b> is how you want the right customer to think of you compared with their other options. You don't invent it in a slogan; you choose it on purpose from five parts:</p>
      <ol><li><b>Alternatives:</b> what they would use if you didn't exist.</li><li><b>Unique strengths:</b> what you have that those alternatives don't.</li><li><b>Value:</b> what those strengths do for the customer.</li><li><b>Best-fit customers:</b> who cares most about that value.</li><li><b>Category:</b> the market you place yourself in so people instantly understand you.</li></ol>`],
    ['The positioning statement', `<p>An internal sentence, not an ad: <i>For [best-fit customer] who [need], [brand] is the [category] that [key value]. Unlike [alternative], we [unique strength].</i></p>
      <p>Everyone in the team should be able to say it. Every page, post and call should agree with it.</p>`],
    ['Value proposition', `<p>The customer-facing version: a headline that says the result, a sub-line that says how and for whom, and 3 bullet proofs. Clear beats clever.</p>`],
    ['Building an offer', `<p>An offer is more than the service and the price. People judge value roughly as <b>dream outcome × likelihood it works</b>, divided by <b>time to result × effort and sacrifice</b>. Improve any of these and the same price feels cheaper:</p>
      <ul><li><b>Outcome:</b> name the specific result.</li><li><b>Likelihood:</b> proof, case studies, guarantees.</li><li><b>Time:</b> a quick first win.</li><li><b>Effort:</b> you do the work, onboarding is simple.</li></ul>`],
    ['Pricing and risk reversal', `<ul><li><b>Anchor</b> the price against the cost of the problem or the alternative (e.g. hiring in-house).</li><li><b>Package</b> it in 2–3 tiers so people choose between your options, not between you and nothing.</li><li><b>Reverse risk</b> with a trial, a guarantee or no long contract, but only promise what you can keep.</li></ul>`]
  ],
  example:`<p>BrightLine's statement: <i>For land investors who want seller leads without managing callers, BrightLine is the managed calling team that books motivated sellers on your calendar. Unlike freelance callers, we train, manage and replace callers so your calls never stop.</i> Offer: first leads in 7 days, weekly report, cancel any month.</p>`,
  terms:[['Positioning','How you are understood compared with alternatives.'],['Value proposition','The promise of the result you deliver, stated for the customer.'],['Risk reversal','Taking risk off the buyer: trial, guarantee, easy exit.'],['Anchoring','Showing a reference price or cost so yours is judged against it.']],
  playbook:{ t:'Positioning workshop', steps:['List the alternatives customers really use.','List what you have that they don’t.','Turn each strength into a customer value.','Pick the customers who care most about that value.','Choose a category people already understand.','Write the positioning statement and share it with the team.','Write the headline, sub-line and 3 proofs.','Design 2–3 offer tiers and one risk reversal.'] },
  pad:['Your alternatives:','Your unique strengths → value for the customer:','Your positioning statement:','Your offer: outcome, timeframe, proof, risk reversal.'],
  exam:[
    ['Positioning starts with…', ['A slogan','The alternatives your customer has','A logo','The price'], 1, 'You can only stand out relative to something.'],
    ['Who is the positioning statement mainly for?', ['Customers in ads','The internal team','Investors only','Search engines'], 1, 'It aligns everyone; the public copy comes from it.'],
    ['Which change increases perceived value without changing price?', ['Longer contract','A faster first result','More paperwork','A vaguer promise'], 1, 'Cutting time to result raises value.'],
    ['Why offer 2–3 tiers?', ['To confuse buyers','So they choose between your options','Because it is required','To hide the price'], 1, 'Tiers move the decision from “if” to “which”.'],
    ['Which is risk reversal?', ['A 12-month lock-in','Cancel any month','Paying upfront','Hidden fees'], 1, 'It lowers the buyer’s risk of saying yes.'],
    ['A good value proposition headline should be…', ['Clever and mysterious','Clear about the result','Full of industry jargon','As long as possible'], 1, 'Clear beats clever.'],
    ['Choosing a category helps because…', ['It ranks you on Google','People instantly know what you are and compare you correctly','It is a legal requirement','It sets your price'], 1, 'The category gives buyers a frame of reference.'],
    ['When should you promise a guarantee?', ['Always, any guarantee','Only when you can keep it','Never','Only for big clients'], 1, 'Broken guarantees destroy trust and brand.']
  ] },

{ lvl:0, t:'Messaging and copywriting', mins:30,
  d:'Write headlines, pages, posts and emails that are clear, believable and make people act.',
  lesson:[
    ['Clarity first', `<p>Good copy is a conversation with one reader. Write like you talk, short sentences, one idea per paragraph. If a 12-year-old couldn't explain your headline back to you, rewrite it.</p>`],
    ['Features, benefits and outcomes', `<p>A <b>feature</b> is what it is (“trained callers”). A <b>benefit</b> is what it does (“calls go out every day”). An <b>outcome</b> is what changes for them (“seller appointments on your calendar every week”). Lead with outcomes, back them with features.</p>
      <p>Trick: after each feature ask “so what?” until you reach something the customer would pay for.</p>`],
    ['Two formulas that always work', `<p><b>PAS:</b> Problem (name it in their words) → Agitate (what it costs them) → Solution (your offer, with proof).</p>
      <p><b>AIDA:</b> Attention (headline) → Interest (why it matters) → Desire (proof, outcome) → Action (one clear CTA).</p>`],
    ['Headlines and hooks', `<p>Most people read only the headline. Strong headlines are specific, about the reader and promise something: numbers (“7 days to your first seller lead”), questions that sting (“Still managing callers yourself?”), or a clear how-to. Write 10 options, pick the best two, test them.</p>`],
    ['Proof and the call to action', `<p>Claims need proof: numbers, testimonials with names, before/after, screenshots, logos, guarantees. Then end with <b>one</b> action, in active words (“Book a 15-minute call”), and say what happens next.</p>
      <p>Avoid: buzzwords (“synergy”, “world-class”), talking about yourself first, and several competing CTAs.</p>`]
  ],
  example:`<p>Before: <i>“BrightLine is a world-class provider of outbound solutions.”</i><br>After (PAS): <i>“Your callers keep quitting. Every week without calls is a week without deals. BrightLine gives you a managed team that calls every day — 38 seller appointments booked for clients last month. Book a 15-minute call.”</i></p>`,
  terms:[['PAS','Problem, agitate, solution.'],['AIDA','Attention, interest, desire, action.'],['Hook','The first line that earns the next one.'],['Social proof','Evidence others trust you: reviews, results, numbers.']],
  playbook:{ t:'Copy checklist (use before anything goes out)', steps:['Is it written to one specific reader?','Does the headline promise a clear outcome?','Did you lead with outcomes, not features?','Is every claim backed by proof?','Is there exactly one call to action?','Did you cut jargon and filler words?','Read it out loud: does it sound like a person?','Did someone in your audience read it and understand it?'] },
  pad:['Write 10 headlines for your offer.','Turn 3 features into outcomes using “so what?”.','Write a 5-sentence PAS for your offer.'],
  exam:[
    ['“Calls go out every day” is a…', ['Feature','Benefit','Testimonial','CTA'], 1, 'It describes what the feature does for them.'],
    ['What does PAS stand for?', ['Price, audience, sale','Problem, agitate, solution','Post, action, share','Proof, ask, send'], 1, 'Problem → agitate → solution.'],
    ['How many calls to action should a page have?', ['One main action','As many as possible','None','Three different ones'], 0, 'Several competing CTAs split attention.'],
    ['Which headline is strongest?', ['Innovative outbound solutions','Seller appointments on your calendar in 7 days','Welcome to our website','We are BrightLine'], 1, 'Specific, about the reader, promises a result.'],
    ['Best way to find headline words?', ['A thesaurus','Customers’ own phrases','Competitor slogans','Industry jargon'], 1, 'Voice-of-customer language converts best.'],
    ['Which is social proof?', ['Your logo','A named client result','Your mission statement','A stock photo'], 1, 'Proof from others makes claims believable.'],
    ['In AIDA, “Desire” is usually built with…', ['The headline','Proof and outcomes','The button','The footer'], 1, 'Desire comes from seeing the result is real.'],
    ['A quick test that copy is clear is…', ['Count the adjectives','Read it out loud and have a customer explain it back','Make it longer','Add more CTAs'], 1, 'If they can explain it back, it is clear.']
  ] },

// ---------------------------------------------------------------- Channels
{ lvl:1, t:'Brand basics', mins:20,
  d:'Identity, voice, consistency and the small brand assets that build trust.',
  lesson:[
    ['What a small brand needs', `<p>You don't need a big agency. You need to be <b>recognisable and consistent</b>: same name, logo, colours, fonts, photo style and tone everywhere. Consistency makes you look bigger and more trustworthy than you are.</p>`],
    ['Brand identity kit', `<ul><li>Logo (full, icon, light and dark versions).</li><li>2–3 colours with exact codes, 1–2 fonts.</li><li>Photo style (real team photos beat stock).</li><li>Templates for posts, proposals, reports and email signatures.</li></ul>`],
    ['Brand voice', `<p>Pick 3 words for how you sound, and what each does <i>not</i> mean. E.g. <b>Direct</b> (not rude), <b>Warm</b> (not chatty), <b>Expert</b> (not jargon). Write a few do/don't examples so anyone on the team can write in the voice.</p>`],
    ['Trust signals', `<p>Reviews, a real address and phone number, named team members with photos, case studies, clear prices or ranges, fast replies, and a professional email domain. Each small signal lowers the risk a buyer feels.</p>`],
    ['Personal brand', `<p>In service businesses people buy from people. A founder who shares useful lessons and real work on LinkedIn often outsells the company page. Treat the founder's profile as part of the brand.</p>`]
  ],
  example:`<p>BrightLine wrote a one-page brand guide: navy and gold, one font, team photos only, voice “direct, warm, expert”. New callers now send emails that sound like the company, and proposals look the same whoever makes them.</p>`,
  terms:[['Brand identity','The visual parts: logo, colours, fonts, imagery.'],['Brand voice','How you sound in writing and speech.'],['Trust signals','Small proofs that make a buyer feel safe.']],
  playbook:{ t:'One-page brand guide', steps:['Collect logo files (light, dark, icon).','Write colour codes and fonts.','Pick 3 voice words with do/don’t examples.','Choose a photo style; take real team photos.','Make templates: post, proposal, email signature.','Audit every channel for the same name, photo and bio.','Collect 5 reviews or testimonials.'] },
  pad:['Your 3 voice words and what they don’t mean:','List every place your brand appears and what is inconsistent:','Trust signals you have and ones you are missing:'],
  exam:[
    ['The main goal of brand consistency is…', ['Winning awards','Being recognisable and trusted','Spending more','Looking different every time'], 1, 'Consistency builds recognition and trust.'],
    ['Which is part of a brand identity kit?', ['Sales targets','Colour codes and fonts','Payroll','CRM fields'], 1, 'Identity = the visual parts.'],
    ['Why define what a voice word does NOT mean?', ['To fill space','So people don’t overdo it','For legal reasons','It is not needed'], 1, '“Direct” could become rude without a limit.'],
    ['Which photo style builds more trust for a service business?', ['Generic stock photos','Real team photos','No photos','Cartoons only'], 1, 'Real people signal a real business.'],
    ['Which is a trust signal?', ['A free Gmail address','Named reviews','A blurry logo','No phone number'], 1, 'Named reviews lower the buyer’s risk.'],
    ['In service businesses, the founder’s profile is…', ['Irrelevant','Often a key part of the brand','Only for HR','Something to hide'], 1, 'People buy from people.'],
    ['Templates help mainly because…', ['They are free','Everyone produces on-brand work fast','They replace strategy','Clients demand them'], 1, 'Speed and consistency.'],
    ['Brand is mostly built by…', ['A logo','Every interaction with customers','One big campaign','The website alone'], 1, 'Every touch builds or spends the brand.']
  ] },

{ lvl:1, t:'Content marketing', mins:30,
  d:'Content pillars, formats, a calendar you can keep, and repurposing one idea into ten.',
  lesson:[
    ['Why content works', `<p>Content lets buyers <b>get to know, like and trust</b> you before they ever talk to you. It answers their questions, shows your expertise and keeps you top of mind until their trigger happens.</p>`],
    ['Content pillars', `<p>Pick 3–5 topics you will always talk about, linked to what you sell. For BrightLine: (1) finding motivated sellers, (2) cold-calling skills, (3) running a remote team, (4) client results. Every post fits a pillar.</p>`],
    ['The content mix', `<ul><li><b>Educate:</b> how-tos, tips, mistakes to avoid.</li><li><b>Prove:</b> case studies, results, behind the scenes.</li><li><b>Connect:</b> stories, opinions, lessons learned.</li><li><b>Sell:</b> offers and invitations, around 1 in 5 posts.</li></ul>
      <p>Map content to the journey: awareness content answers broad questions; consideration content compares and proves; decision content removes the last doubts (pricing, FAQ, guarantees).</p>`],
    ['A calendar you can keep', `<p>Consistency beats volume. Pick a rhythm you can keep for 90 days: e.g. 3 LinkedIn posts, 1 newsletter, 1 short video a week. Batch: plan monthly, write weekly, schedule ahead.</p>`],
    ['Repurposing', `<p>One strong idea → a long piece (article, video or call breakdown) → 3–5 short posts → a carousel → an email → clips. Create once, distribute many times. Most people see only a fraction of what you post, so repeating your best ideas is fine.</p>`]
  ],
  example:`<p>BrightLine recorded one 10-minute breakdown of a real (anonymised) seller call. It became a YouTube video, 4 LinkedIn posts (one per objection), a carousel “4 objections land sellers raise”, and the weekly newsletter. One hour of recording, a week of content.</p>`,
  terms:[['Content pillar','A core topic you return to again and again.'],['Repurposing','Turning one piece into many formats.'],['Evergreen','Content that stays useful for a long time.']],
  playbook:{ t:'90-day content plan', steps:['Choose 3–5 pillars linked to your offer.','List 30 questions customers ask; assign each to a pillar.','Pick channels and a weekly rhythm you can keep.','Plan one long “source” piece per week.','Cut each source piece into short posts and an email.','Keep sales posts around 1 in 5.','Schedule a week ahead.','Review results monthly; double down on winners.'] },
  pad:['Your 3–5 pillars:','10 customer questions you can answer:','Your weekly rhythm (channel × number):','Repurpose one idea into 5 pieces:'],
  exam:[
    ['Content pillars are…', ['Random viral topics','3–5 core topics linked to what you sell','Your posting times','Paid ad audiences'], 1, 'Pillars keep content focused on your offer.'],
    ['Roughly how often should content be a direct sales pitch?', ['Every post','About 1 in 5','Never','Once a year'], 1, 'Mostly value, with regular clear invitations.'],
    ['What matters more for content results?', ['Volume in week one','Consistency over months','Fancy design','Hashtags'], 1, 'Consistency compounds.'],
    ['Pricing and FAQ content serves which stage?', ['Awareness','Decision','Referral','None'], 1, 'It removes last doubts before buying.'],
    ['Repurposing means…', ['Copying competitors','Turning one piece into many formats','Deleting old posts','Paying for reposts'], 1, 'Create once, distribute many times.'],
    ['A good source of content ideas is…', ['Customer questions','Random trends only','Competitor slogans','Nothing; just post'], 0, 'Answering real questions attracts real buyers.'],
    ['“Evergreen” content…', ['Is about the environment','Stays useful for a long time','Expires in 24 hours','Is only video'], 1, 'Evergreen pieces keep bringing traffic.'],
    ['Is reposting your best idea a few months later OK?', ['No, never','Yes, most people missed it','Only on weekends','Only if paid'], 1, 'Reach is limited; best ideas deserve repeats.']
  ] },

{ lvl:1, t:'Social media and LinkedIn', mins:30,
  d:'Pick the right platform, set up a profile that converts and turn engagement into conversations.',
  lesson:[
    ['Choose platforms by audience', `<p>Be where your buyers already spend time, and master one before adding another. B2B and service businesses: <b>LinkedIn</b> first. Local and visual businesses: Instagram and Facebook. Education and search: YouTube. Younger audiences: TikTok.</p>`],
    ['A profile that converts', `<p>Treat your profile like a landing page:</p><ul><li><b>Photo:</b> clear face, good light.</li><li><b>Banner:</b> who you help and the result, plus proof.</li><li><b>Headline:</b> “I help [who] get [result]” beats a job title.</li><li><b>About:</b> problem, how you solve it, proof, CTA with a link.</li><li><b>Featured:</b> your best case study, booking link, lead magnet.</li></ul>`],
    ['Posts that perform', `<p>Strong hook in the first line, short lines, one idea, a clear takeaway, and a question or soft CTA at the end. Text posts, carousels and short native videos all work; links in the post usually reduce reach, so put them in the comments or profile.</p>`],
    ['Engagement is half the job', `<p>Spend 15–20 minutes a day commenting thoughtfully on posts by your ideal customers and people they follow. A good comment adds an insight or a question, not “Great post!”. Reply to every comment on your posts in the first hour.</p>`],
    ['From engagement to conversations', `<p>Connect with people who engage, with a short personal note. Start conversations about <i>them</i>, not your pitch. Offer value first (a resource, an answer). Invite to a call only when there's a real fit. Never send a long pitch as the first message.</p>`]
  ],
  example:`<p>The BrightLine founder changed their headline from “CEO at BrightLine” to “I help land investors get seller appointments without managing callers.” With 3 posts a week plus 20 minutes of comments daily, profile views rose 4× and 6 discovery calls came from DMs in a month.</p>`,
  terms:[['Hook','The first line that makes people stop scrolling.'],['Engagement','Likes, comments, shares and saves.'],['DM','Direct (private) message.'],['Featured section','Pinned links and posts on a LinkedIn profile.']],
  playbook:{ t:'LinkedIn weekly routine', steps:['Profile: photo, banner, outcome headline, About with CTA, Featured links.','Post 3 times a week from your pillars.','Write a strong first-line hook for each post.','Comment on 10 ideal-customer posts daily.','Reply to all comments within the first hour.','Send 10–20 personal connection requests a week.','Start conversations with value, not a pitch.','Track: profile views, followers, DMs, calls booked.'] },
  pad:['Rewrite your headline: I help [who] get [result].','Write the first lines of 5 posts (hooks).','A first DM that offers value, not a pitch:'],
  exam:[
    ['How should you choose a platform?', ['The newest one','Where your buyers spend time','Wherever is cheapest','All at once'], 1, 'Go where your audience already is.'],
    ['Which LinkedIn headline converts best?', ['CEO','Entrepreneur | Visionary','I help land investors get seller appointments','Open to work'], 2, 'It says who you help and the result.'],
    ['Links inside a post usually…', ['Increase reach','Reduce reach; put them in comments or profile','Are required','Have no effect'], 1, 'Platforms prefer people stay on the platform.'],
    ['A good comment on someone else’s post…', ['Says “Great post!”','Adds an insight or question','Pitches your service','Tags 10 friends'], 1, 'Thoughtful comments get you noticed.'],
    ['The first DM to a new connection should…', ['Pitch your full offer','Be about them or offer value','Include your price list','Be a voice note pitch'], 1, 'Value first, pitch only when there is fit.'],
    ['The first line of a post is…', ['The CTA','The hook','The hashtag line','Optional'], 1, 'If the hook fails, nobody reads the rest.'],
    ['When should you reply to comments?', ['Never','Within the first hour if possible','After a week','Only to negative comments'], 1, 'Early replies boost the conversation and reach.'],
    ['For a B2B service, which platform is usually first?', ['TikTok','LinkedIn','Pinterest','Snapchat'], 1, 'LinkedIn is where business buyers are.']
  ] },

{ lvl:1, t:'Email marketing', mins:30,
  d:'Build a list you own, write a welcome sequence, send a newsletter and stay out of spam.',
  lesson:[
    ['Why email', `<p>Social followers belong to the platform; your <b>email list belongs to you</b>. Email is still one of the highest-return channels because it reaches people who already asked to hear from you.</p>`],
    ['Building the list', `<p>Offer a <b>lead magnet</b>: something useful in exchange for an email — a checklist, template, script, calculator or short guide that solves one specific problem. Put sign-up forms on your site, profile and content. Use double opt-in (people confirm by email) for a cleaner list.</p>`],
    ['The welcome sequence', `<p>An automated series for new subscribers, e.g.:</p><ol><li>Day 0: deliver the lead magnet, say what to expect.</li><li>Day 2: your story and why you do this.</li><li>Day 4: your most useful lesson.</li><li>Day 7: a case study (proof).</li><li>Day 10: an invitation (book a call, start a trial).</li></ol>`],
    ['Newsletter and campaigns', `<p>Send on a fixed rhythm (weekly or every two weeks). One main idea per email, a subject line that earns the open, a personal tone and one CTA. Segment by interest or stage so people get what's relevant.</p>
      <p>Key numbers: <b>open rate</b> (less reliable since privacy changes), <b>click rate</b>, <b>reply rate</b>, <b>unsubscribe rate</b>, and most importantly calls or sales from email.</p>`],
    ['Deliverability and the rules', `<ul><li>Use your own domain and set up SPF, DKIM and DMARC (ask your email tool).</li><li>Never buy lists. Clean out people who haven't opened in months.</li><li>US CAN-SPAM: honest sender and subject lines, a physical postal address, a working unsubscribe honoured promptly (within 10 business days).</li><li>EU/UK GDPR: you need a lawful basis (usually clear consent) and must keep records of it.</li></ul><p class="note">This is general guidance, not legal advice.</p>`]
  ],
  example:`<p>BrightLine offered a free “Land seller call script + objection sheet”. 400 sign-ups in two months. The 5-email welcome sequence ends with “Book a 15-minute pipeline review”; 3% of subscribers booked, 1 in 4 of those became clients.</p>`,
  terms:[['Lead magnet','A free resource given in exchange for an email.'],['Double opt-in','Subscriber confirms by clicking a link in an email.'],['Segmentation','Splitting your list so people get relevant emails.'],['SPF / DKIM / DMARC','Email authentication records that help you reach the inbox.']],
  playbook:{ t:'Email launch checklist', steps:['Pick an email tool and connect your own domain.','Set up SPF, DKIM and DMARC.','Create one lead magnet that solves one specific problem.','Add sign-up forms (site, profile, content).','Turn on double opt-in.','Write a 5-email welcome sequence.','Add your postal address and unsubscribe link to the footer.','Choose a newsletter rhythm and stick to it.','Track clicks, replies, unsubscribes and calls booked.'] },
  pad:['3 lead magnet ideas for your customer:','Subject lines for your 5 welcome emails:','Your newsletter rhythm and main sections:'],
  exam:[
    ['Main advantage of an email list over followers?', ['It is free','You own it','It needs no content','It goes viral'], 1, 'Platforms can change; your list stays yours.'],
    ['A lead magnet is…', ['A paid ad','A free resource in exchange for an email','A spam filter','A CRM'], 1, 'Give value, get permission.'],
    ['Double opt-in means…', ['Sending two emails a day','Subscribers confirm by clicking a link','Two lists','Two CTAs'], 1, 'It keeps your list clean and engaged.'],
    ['Should you buy an email list?', ['Yes, to grow fast','No','Only big ones','Only in the US'], 1, 'It hurts deliverability and often breaks the rules.'],
    ['Under CAN-SPAM, commercial emails must include…', ['A discount','A physical postal address and an unsubscribe option','A video','Your phone number'], 1, 'Plus honest sender and subject lines.'],
    ['Which metric is least reliable today?', ['Replies','Clicks','Opens','Sales'], 2, 'Privacy features inflate or hide opens.'],
    ['The last email in a welcome sequence usually…', ['Says goodbye','Makes a clear invitation','Is blank','Asks for a review'], 1, 'After value and proof, invite the next step.'],
    ['SPF, DKIM and DMARC help with…', ['Design','Reaching the inbox','Writing copy','Pricing'], 1, 'They prove your emails are really from you.']
  ] },

{ lvl:1, t:'Websites, landing pages and funnels', mins:30,
  d:'Pages that turn visitors into leads: structure, forms, speed and conversion basics.',
  lesson:[
    ['Website vs landing page', `<p>A <b>website</b> explains everything about you and serves many visitors. A <b>landing page</b> has one audience, one offer and one goal (book, sign up, call). Send ad and campaign traffic to landing pages, not your homepage.</p>`],
    ['The landing page structure', `<ol><li><b>Headline:</b> the outcome, for whom.</li><li><b>Sub-line:</b> how it works in one sentence.</li><li><b>CTA</b> above the fold.</li><li><b>Proof:</b> logos, numbers, testimonials.</li><li><b>How it works:</b> 3 steps.</li><li><b>Benefits / what you get.</b></li><li><b>Objections / FAQ.</b></li><li><b>Final CTA</b> with risk reversal.</li></ol>`],
    ['Forms and friction', `<p>Every extra field lowers sign-ups. Ask only what you need now (name, email or phone); collect the rest later. Make the button say the result (“Get my script” not “Submit”). Show what happens after they click.</p>`],
    ['Speed and mobile', `<p>Most visitors are on phones. The page must load in about 2–3 seconds, read well on a small screen and have big tap targets. Compress images, avoid heavy pop-ups.</p>`],
    ['Funnels and conversion rate', `<p>A <b>funnel</b> is the path from first visit to sale: ad → landing page → form → call booked → call held → client. The <b>conversion rate</b> is the % who move from one step to the next. Improve the weakest step first. Test one change at a time (A/B test) and wait for enough visitors before deciding.</p>`]
  ],
  example:`<p>BrightLine sent ads to their homepage: 0.8% booked. A dedicated landing page with one headline, a 3-step “how it works”, two testimonials and a 2-field form converted 4.1% from the same ads — 5× more calls for the same budget.</p>`,
  terms:[['Landing page','A single-goal page for one audience and offer.'],['Above the fold','What is visible before scrolling.'],['Conversion rate','% of people who take the next step.'],['A/B test','Comparing two versions to see which performs better.']],
  playbook:{ t:'Landing page checklist', steps:['One audience, one offer, one goal.','Outcome headline and one-line “how”.','CTA visible without scrolling.','Proof near the top.','3-step “how it works”.','FAQ answering the top objections.','Form with the fewest fields possible.','Button text says the result.','Loads fast on a phone.','Tracking set up (see Analytics module).'] },
  pad:['Draft your landing page headline and sub-line:','Your 3 “how it works” steps:','Top 5 objections for your FAQ:'],
  calc:'funnel',
  exam:[
    ['Where should paid ad traffic usually go?', ['Homepage','A dedicated landing page','Your LinkedIn','A blog post'], 1, 'One goal per page converts better.'],
    ['Adding more form fields usually…', ['Raises sign-ups','Lowers sign-ups','Has no effect','Is required'], 1, 'More friction, fewer conversions.'],
    ['Which button text is better?', ['Submit','Get my call script','Click here','Send'], 1, 'Say the result they get.'],
    ['“Above the fold” means…', ['The footer','Visible before scrolling','The second page','Printed area'], 1, 'Key message and CTA belong there.'],
    ['In a funnel, what should you improve first?', ['The strongest step','The weakest step','The logo','Nothing'], 1, 'The biggest leak gives the biggest gain.'],
    ['An A/B test should change…', ['Everything at once','One thing at a time','Only colours','Nothing'], 1, 'Otherwise you can’t know what caused the result.'],
    ['100 visitors, 5 book a call. Conversion rate?', ['0.5%','5%','20%','50%'], 1, '5 ÷ 100 = 5%.'],
    ['Why does page speed matter?', ['It doesn’t','Slow pages lose visitors, especially on phones','Only for SEO','Only for desktop'], 1, 'People leave slow pages.']
  ] },

{ lvl:1, t:'SEO and local search', mins:30,
  d:'Get found on Google: search intent, keywords, on-page basics, Google Business Profile and links.',
  lesson:[
    ['How search works', `<p>Search engines try to show the most <b>helpful, trustworthy</b> answer for what someone typed. SEO is making it easy for them to see that your page is that answer. It's slow (months) but compounds: good pages bring visitors for years.</p>`],
    ['Search intent and keywords', `<p>Every search has an intent: <b>informational</b> (“how to sell land fast”), <b>commercial</b> (“best cold calling service for investors”), <b>transactional</b> (“hire cold callers”), or <b>local</b> (“sell my house fast Atlanta”). Match the page to the intent. Start with specific, longer phrases (long-tail) you can actually rank for.</p>`],
    ['On-page basics', `<ul><li>One main topic per page; the keyword in the title, headline (H1), URL and early text.</li><li>Answer the question fully and better than what ranks now.</li><li>Clear headings, short paragraphs, images with alt text.</li><li>A meta description that earns the click.</li><li>Link to your related pages.</li><li>Fast, mobile-friendly, secure (https).</li></ul>`],
    ['Local SEO', `<p>For local searches, your <b>Google Business Profile</b> is often more important than your website: correct name, address, phone, categories, hours, photos, services, and regular posts. Ask every happy customer for a review, and reply to all reviews. Keep your name, address and phone identical everywhere online.</p>`],
    ['Links and authority', `<p>Links from other relevant, trusted sites act as votes. Earn them with useful resources, guest articles, podcasts, partners, local directories and press. Avoid buying links; it can get you penalised.</p>`]
  ],
  example:`<p>BrightLine wrote “Cold calling scripts for land investors (with objections)” — a full guide targeting a long-tail phrase. Six months later it ranks on page one, brings 900 visits a month and 20 email sign-ups via the script download.</p>`,
  terms:[['SEO','Search engine optimisation: getting found in organic search.'],['Search intent','What the searcher really wants.'],['Long-tail keyword','A longer, specific search phrase with less competition.'],['Backlink','A link from another site to yours.'],['Google Business Profile','Your free business listing on Google Search and Maps.']],
  playbook:{ t:'SEO starter checklist', steps:['Set up Google Search Console.','List 20 questions/phrases your customers search.','Group them by intent; pick 5 long-tail targets.','Write one excellent page per target.','Keyword in title, H1, URL and first paragraph.','Add internal links between related pages.','Set up and complete your Google Business Profile (if local).','Ask for reviews and reply to them.','Earn 2–3 relevant links a month.','Check rankings and clicks monthly.'] },
  pad:['20 phrases your customers would search:','Pick 5 long-tail targets and their intent:','Outline your first SEO page (H1 + headings):'],
  exam:[
    ['How fast does SEO usually work?', ['Hours','Months, then compounds','Never','Only with ads'], 1, 'SEO is slow but long-lasting.'],
    ['“Sell my house fast Atlanta” has which intent?', ['Informational','Local / transactional','Navigational only','None'], 1, 'Location + action = local transactional.'],
    ['A long-tail keyword is…', ['A short popular word','A specific longer phrase','A paid keyword','A hashtag'], 1, 'Less competition, clearer intent.'],
    ['Where should your main keyword appear?', ['Only the footer','Title, H1, URL and early text','Hidden text','Nowhere'], 1, 'Standard on-page basics.'],
    ['For local businesses, a key free tool is…', ['Google Business Profile','A fax line','Paid links','Pop-ups'], 0, 'It drives Maps and local results.'],
    ['Buying backlinks is…', ['Recommended','Risky; it can get you penalised','Required','Free'], 1, 'Earn links, don’t buy them.'],
    ['What should you do with reviews?', ['Ignore them','Ask for them and reply to all','Delete bad ones','Write your own'], 1, 'Reviews and replies build trust and rankings.'],
    ['Which tool shows how Google sees your site?', ['Google Search Console','Photoshop','Excel','Zoom'], 0, 'It shows searches, clicks and errors.']
  ] },

{ lvl:1, t:'Paid ads', mins:35,
  d:'Meta and Google ads basics: targeting, budget, creative, testing and the numbers that matter.',
  lesson:[
    ['Before you spend', `<p>Ads amplify what already works. Have a clear offer, a landing page that converts and tracking in place first. Start with a small test budget you can afford to lose while learning.</p>`],
    ['Search ads vs social ads', `<p><b>Search ads</b> (Google, Bing) catch people already looking (“sell inherited land”) — high intent, often higher cost per click. <b>Social ads</b> (Meta, LinkedIn, TikTok) interrupt people who fit a profile — lower intent, great for awareness, lead magnets and retargeting.</p>`],
    ['Targeting', `<ul><li><b>Search:</b> choose keywords and match types; add negative keywords to block irrelevant searches (e.g. “jobs”, “free”).</li><li><b>Social:</b> interests, job titles, lookalikes of your customers, or broad targeting with strong creative.</li><li><b>Retargeting:</b> show ads to people who visited your site or engaged; usually your best-performing audience.</li></ul>`],
    ['Creative and testing', `<p>On social, the creative <i>is</i> the targeting: the hook decides who stops. Test 3–5 different angles (pain, result, proof, story), keep the winners, kill the losers. Change one thing at a time and give each test enough spend to judge.</p>`],
    ['The numbers', `<ul><li><b>CTR</b> = clicks ÷ impressions (is the ad interesting?).</li><li><b>CPC</b> = spend ÷ clicks.</li><li><b>CPL</b> (cost per lead) = spend ÷ leads.</li><li><b>CAC</b> (cost per customer) = spend ÷ customers.</li><li><b>ROAS</b> = revenue ÷ ad spend.</li></ul><p>Judge ads by cost per lead and per customer, not by likes. Know your maximum CAC before you start (see the Analytics module).</p>`]
  ],
  example:`<p>BrightLine tested $600 on Meta: 3 angles to land investors. “Your callers quit again?” got a $38 CPL; the others above $90. They moved the budget to the winner and retargeted page visitors with a case study. 14 leads, 3 clients worth $1,800/month each.</p>`,
  terms:[['CTR','Click-through rate: clicks ÷ impressions.'],['CPC / CPL / CAC','Cost per click, per lead, per customer.'],['ROAS','Return on ad spend: revenue ÷ ad spend.'],['Retargeting','Ads to people who already visited or engaged.'],['Negative keyword','A search term you block your ads from.']],
  playbook:{ t:'First ad campaign', steps:['Confirm offer, landing page and tracking work.','Decide max cost per lead and per customer.','Pick one platform that fits intent.','Set a small daily test budget.','Search: tight keywords + negative keywords.','Social: 3–5 creatives with different angles.','Run long enough to get data (at least a week or ~50 clicks per ad).','Kill losers, scale winners slowly (~20% at a time).','Add retargeting.','Report weekly: spend, CPL, CAC, ROAS.'] },
  pad:['Your max cost per lead and per customer:','3 ad angles (hook + image/video idea):','10 negative keywords for your search ads:'],
  calc:'ads',
  exam:[
    ['When should you start paid ads?', ['Before you have an offer','When the offer, page and tracking are ready','Never','Only with a big budget'], 1, 'Ads amplify what already works.'],
    ['Search ads are best for…', ['People already looking','Brand colours','Recruiting only','Free traffic'], 0, 'They catch existing intent.'],
    ['A negative keyword…', ['Is a rude word','Blocks your ad from irrelevant searches','Lowers your rank','Is required by law'], 1, 'It saves money on wrong clicks.'],
    ['$500 spent, 20 leads. CPL?', ['$10','$25','$50','$100'], 1, '500 ÷ 20 = $25.'],
    ['$1,000 spend, $4,000 revenue. ROAS?', ['0.25','4','40','1,000'], 1, '4,000 ÷ 1,000 = 4 (4×).'],
    ['Usually the best-performing audience is…', ['Cold strangers','Retargeting visitors','Random interests','Competitors'], 1, 'They already know you.'],
    ['How should you scale a winning ad?', ['10× the budget overnight','Gradually, ~20% at a time','Never','Pause it'], 1, 'Big jumps can reset learning and raise costs.'],
    ['Which number matters most for a lead-gen ad?', ['Likes','Cost per lead and per customer','Followers','Shares'], 1, 'Judge ads by business results.']
  ] },

// ---------------------------------------------------------------- Growth
{ lvl:2, t:'Analytics and measurement', mins:35,
  d:'KPIs, tracking links, funnel metrics, CAC, lifetime value and a simple weekly dashboard.',
  lesson:[
    ['Measure what matters', `<p>Pick a few numbers tied to money. Vanity metrics (likes, followers, impressions) feel good but don't pay bills. Useful metrics: leads, cost per lead, conversion rate per step, customers, CAC, revenue and lifetime value.</p>`],
    ['Tracking basics', `<ul><li><b>Analytics</b> on your site (e.g. Google Analytics 4) with conversions set for form sends and bookings.</li><li><b>UTM parameters</b> on every link you share: source, medium, campaign — so you know which post, email or ad brought the lead.</li><li>A <b>“How did you hear about us?”</b> question on forms and calls — simple and surprisingly accurate.</li><li>A <b>CRM</b> where every lead has a source and a stage.</li></ul>`],
    ['Unit economics', `<p><b>CAC</b> = total marketing and sales cost ÷ new customers.<br><b>LTV</b> (lifetime value) ≈ average revenue per month × gross margin × average months a customer stays.</p>
      <p>A common healthy target is <b>LTV at least 3× CAC</b>, and earning back CAC within a few months (payback period). If LTV is low, fix retention or pricing before scaling acquisition.</p>`],
    ['Attribution, honestly', `<p>Buyers touch many things before they buy. “Last click” gives all credit to the final step and undervalues content and brand. Don't chase perfect attribution: combine tracked data, the “how did you hear” answers and common sense.</p>`],
    ['A weekly dashboard', `<p>One page, same numbers every week: traffic, leads by source, cost per lead, calls booked, show rate, close rate, new customers, revenue, CAC. Look for trends, ask why, pick one thing to improve.</p>`]
  ],
  example:`<p>BrightLine's numbers: $3,000 a month on marketing and sales → 5 new clients → CAC $600. Clients pay $1,800/month at 50% margin and stay 8 months on average → LTV $7,200. LTV:CAC = 12:1 — room to spend more on growth.</p>`,
  terms:[['KPI','Key performance indicator: a number that shows progress toward a goal.'],['UTM','Tags added to links to track where traffic came from.'],['CAC','Customer acquisition cost.'],['LTV','Lifetime value of a customer.'],['Attribution','Deciding which touchpoints get credit for a sale.']],
  playbook:{ t:'Tracking setup', steps:['Install analytics on your site and mark conversions.','Create a UTM naming rule and use it on every link.','Add “How did you hear about us?” to forms and calls.','Log every lead in the CRM with source and stage.','Calculate CAC and LTV.','Build a one-page weekly dashboard.','Review weekly; pick one improvement.'] },
  pad:['Your 5 key numbers:','Your UTM naming rule:','Your CAC and LTV estimate:'],
  calc:'ltv',
  exam:[
    ['Which is a vanity metric?', ['Cost per lead','Followers','Customers','Revenue'], 1, 'Followers don’t directly pay bills.'],
    ['UTM parameters help you…', ['Design pages','Know where traffic came from','Send emails','Write copy'], 1, 'They tag links by source, medium and campaign.'],
    ['$2,000 spent, 4 new customers. CAC?', ['$200','$500','$800','$8,000'], 1, '2,000 ÷ 4 = $500.'],
    ['LTV roughly equals…', ['Ad spend × clicks','Monthly revenue × margin × months they stay','Followers × likes','Price ÷ 2'], 1, 'Revenue over the customer’s life, after costs.'],
    ['A common healthy LTV:CAC ratio is at least…', ['1:1','3:1','0.5:1','100:1'], 1, '3:1 is a widely used rule of thumb.'],
    ['“Last click” attribution tends to…', ['Overvalue content','Undervalue earlier touchpoints like content and brand','Be perfect','Ignore ads'], 1, 'It gives all credit to the final step.'],
    ['A simple, accurate source of attribution is…', ['Guessing','Asking “How did you hear about us?”','Counting likes','Nothing'], 1, 'Self-reported answers catch what tracking misses.'],
    ['If LTV is low, you should first…', ['Spend more on ads','Fix retention or pricing','Stop tracking','Hire more callers'], 1, 'Scaling acquisition with low LTV loses money.']
  ] },

{ lvl:2, t:'Outbound: cold email, calls, mail and SMS', mins:35,
  d:'Reach people who don’t know you yet, the right way: lists, scripts, cadences and the rules.',
  lesson:[
    ['Inbound vs outbound', `<p><b>Inbound</b> brings people to you (content, SEO, ads). <b>Outbound</b> means you go to them (cold email, calls, direct mail, SMS, LinkedIn messages). Outbound is faster to start and very targeted; it works best with a sharp list and a relevant message.</p>`],
    ['The list is everything', `<p>A great message to the wrong list fails. Define who exactly (from your ICP), find accurate data, remove duplicates and do-not-contact records, and split lists by situation so each gets a relevant message.</p>`],
    ['Cold email and calls', `<ul><li><b>Cold email:</b> short (under ~100 words), personal first line, one problem, one soft ask (“Worth a quick chat?”), plain text, from a separate warmed-up domain, small daily volumes.</li><li><b>Cold calls:</b> permission opener, reason for the call, one question to qualify, handle objections calmly, book the next step. Write the script, then practise until it sounds natural.</li></ul>`],
    ['Cadence and follow-up', `<p>Most replies come after the 2nd–5th touch. Plan a <b>cadence</b>: e.g. call + email day 1, call day 3, email day 6, call day 10, breakup email day 14. Mix channels. Log every touch in the CRM.</p>`],
    ['Know the rules', `<ul><li><b>US calls/texts (TCPA):</b> autodialed or prerecorded marketing calls and texts to mobiles generally need prior express written consent; respect the National Do Not Call Registry and your own internal DNC list; call only between 8am and 9pm the recipient's local time. Some states add stricter rules.</li><li><b>Cold email (CAN-SPAM):</b> honest headers and subject, postal address, easy opt-out honoured.</li><li>Rules change and fines are large. Check current rules with a lawyer or your compliance tool before launching.</li></ul><p class="note">This is general guidance, not legal advice.</p>`]
  ],
  example:`<p>BrightLine's own outbound to investors: 300 hand-checked land investors, 4-touch cadence (email, LinkedIn, email, call). 11% replied, 18 calls booked, 4 clients. Their first email was 62 words and mentioned the investor's latest deal.</p>`,
  terms:[['Outbound','Reaching out first to people who haven’t contacted you.'],['Cadence','A planned sequence of touches over time.'],['DNC','Do Not Call list.'],['TCPA','US law covering marketing calls and texts.']],
  playbook:{ t:'Outbound campaign launch', steps:['Define the exact list from your ICP.','Clean the data; remove DNC and duplicates.','Write a short, personal message per segment.','Plan a 4–6 touch multi-channel cadence.','Check compliance (consent, DNC, hours, opt-out).','Warm up email domains; start small.','Log every touch in the CRM.','Track: reply rate, positive replies, meetings, deals.'] },
  pad:['Who exactly is on your list?','A cold email under 100 words:','Your 5-touch cadence (day + channel):'],
  exam:[
    ['Outbound means…', ['Waiting for leads','Reaching out first','Only SEO','Only referrals'], 1, 'You contact them first.'],
    ['The biggest factor in outbound success is usually…', ['Fancy design','The list and relevance','Sending more emails','Long messages'], 1, 'Right people + relevant message.'],
    ['A good cold email is…', ['Long with attachments','Short, personal, one soft ask','All images','A full price list'], 1, 'Short and relevant gets replies.'],
    ['Most replies come…', ['On the first touch','After several follow-ups','Never','Only by mail'], 1, 'Follow-up is where the results are.'],
    ['Allowed calling hours for US telemarketing are generally…', ['Any time','8am–9pm recipient’s local time','Midnight–6am','Weekends only'], 1, 'Under federal rules; states can be stricter.'],
    ['Autodialed marketing texts to US mobiles generally require…', ['Nothing','Prior express written consent','A discount','A logo'], 1, 'TCPA consent rules apply.'],
    ['What should you do with numbers on the DNC list?', ['Call them anyway','Remove them unless an exemption clearly applies','Text instead','Call at night'], 1, 'Respect DNC lists and your own opt-outs.'],
    ['Why use a separate domain for cold email?', ['It looks nicer','To protect your main domain’s reputation','It’s required','To hide your identity'], 1, 'Protects deliverability of your main email.']
  ] },

{ lvl:2, t:'Campaign planning and your growth system', mins:35,
  d:'Turn everything into a plan: goals, budget, a 90-day calendar, experiments, CRM and automation.',
  lesson:[
    ['Work backwards from the goal', `<p>Start with the revenue goal and work back through your funnel: <i>revenue ÷ average deal = customers needed ÷ close rate = calls needed ÷ booking rate = leads needed</i>. Now you know how many leads you need and what you can spend per lead.</p>`],
    ['Pick few channels and go deep', `<p>Choose 1–2 main channels that fit your audience and budget (e.g. LinkedIn + outbound), and one long-term channel (SEO or newsletter). Doing three channels well beats seven badly.</p>`],
    ['The 90-day plan', `<ul><li><b>Goal:</b> one number (e.g. 30 qualified calls).</li><li><b>Channels and weekly actions.</b></li><li><b>Budget</b> per channel.</li><li><b>Owners</b> and deadlines.</li><li><b>Weekly review</b> and a monthly retro: keep, fix, stop.</li></ul>`],
    ['Run experiments', `<p>Treat ideas as tests: <i>“If we do X, we expect Y to change by Z, because…”</i>. Score ideas by impact, confidence and ease (ICE), run the best ones, write down what you learned whether they win or lose.</p>`],
    ['CRM and automation', `<p>Your <b>CRM</b> (e.g. GoHighLevel, HubSpot) holds every lead, stage, source and next step. Automate the repetitive parts: instant reply to new leads, reminders, follow-up sequences, appointment confirmations, review requests. Speed matters: leads contacted within minutes are far more likely to convert than those reached hours later.</p>`]
  ],
  example:`<p>Goal: $9,000 new monthly revenue. Avg client $1,800 → 5 clients. Close rate 25% → 20 calls held. Show rate 80% → 25 booked. Booking rate 10% of leads → 250 leads. At a $25 CPL that's $6,250 of ads, or a mix of outbound and content to lower it.</p>`,
  terms:[['Reverse funnel math','Working back from the revenue goal to leads needed.'],['ICE score','Impact × confidence × ease, used to rank ideas.'],['CRM','Customer relationship management system.'],['Speed to lead','How fast you respond to a new lead.']],
  playbook:{ t:'90-day marketing plan', steps:['Set one revenue goal and work back to leads needed.','Choose 1–2 main channels + 1 long-term channel.','Write weekly actions per channel with owners.','Set budget and max cost per lead.','Set up CRM stages and lead sources.','Automate instant lead reply and follow-ups.','List 5 experiments and score them (ICE).','Weekly review of the dashboard.','Monthly retro: keep, fix, stop.'] },
  pad:['Reverse funnel math for your goal:','Your channels and weekly actions:','5 experiments with an ICE score:'],
  calc:'funnel',
  exam:[
    ['Campaign planning should start from…', ['The ad platform','The revenue goal','The logo','Competitors’ posts'], 1, 'Work backwards from the goal.'],
    ['Need 4 clients, close rate 25%. How many calls held?', ['4','8','16','25'], 2, '4 ÷ 0.25 = 16.'],
    ['How many main channels should a small team focus on?', ['1–2 (+1 long-term)','7','All of them','None'], 0, 'Depth beats breadth.'],
    ['ICE stands for…', ['Income, cost, earnings','Impact, confidence, ease','Ideas, content, email','Inbound, cold, email'], 1, 'Used to rank experiments.'],
    ['A failed experiment is…', ['Wasted','Useful if you record what you learned','Should be hidden','Proof marketing doesn’t work'], 1, 'Learning is the point of testing.'],
    ['Why does speed to lead matter?', ['It doesn’t','Fast replies convert far better','Only for SEO','Only for email'], 1, 'Interest fades in minutes.'],
    ['Good things to automate include…', ['Strategy','Instant replies and reminders','Choosing your ICP','Writing your positioning'], 1, 'Automate repetitive follow-up, not thinking.'],
    ['A monthly retro asks…', ['Who to blame','Keep, fix, stop','Nothing','How many likes'], 1, 'Simple structure for improving.']
  ] },

// ---------------------------------------------------------------- Real estate
{ lvl:3, t:'Real estate marketing: finding motivated sellers', mins:40,
  d:'How investors generate seller leads: lists, direct mail, cold calling, SMS, PPC, SEO and follow-up.',
  lesson:[
    ['The goal: motivated sellers', `<p>Investors buy below market value, so they need sellers with a <b>reason</b> to sell quickly or simply: inherited property, tax delinquency, divorce, relocation, tired landlords, vacant property, code violations, pre-foreclosure, or out-of-state owners of land they never use. Marketing finds them early and gets the first conversation.</p>`],
    ['Lists and stacking', `<p>Pull lists from county records or data providers (absentee owners, tax delinquent, probate, vacant, long-time owners, free-and-clear). <b>List stacking</b> — finding owners who appear on several lists — points to higher motivation. Always skip-trace for phone numbers and scrub against DNC and litigator lists.</p>`],
    ['The main channels', `<ul><li><b>Direct mail:</b> letters, postcards or blind offers; repeated every few weeks to the same list. Response is low per piece but steady.</li><li><b>Cold calling:</b> cheapest per conversation; needs trained callers, good data and compliance.</li><li><b>SMS:</b> fast, but carries the strictest consent rules — get compliance advice first.</li><li><b>PPC:</b> Google ads on “sell my house fast [city]” or “sell my land”; expensive but high intent.</li><li><b>SEO and Google Business Profile:</b> slow, but cheapest leads long-term.</li><li><b>Referrals:</b> agents, wholesalers, attorneys, probate contacts, bird dogs.</li></ul>`],
    ['Follow-up wins deals', `<p>Most deals close after many touches over months, because the seller's situation changes. Have a follow-up schedule for every lead: hot (days), warm (weekly), cold (monthly), and keep calling and mailing. Qualify each lead on the four pillars: <b>motivation, timeline, condition, price</b>.</p>`],
    ['The numbers that matter', `<p>Track by channel: cost per lead, cost per contract, cost per deal, and profit per deal. Example: $3,000 of mail → 30 leads ($100 CPL) → 2 contracts → 1 closed deal with $15,000 profit. Marketing ROI = (15,000 − 3,000) ÷ 3,000 = 4×. A channel with costlier leads can still win if its deals close more often.</p>`]
  ],
  example:`<p>A land investor client of BrightLine stacked “out-of-state owner” and “tax delinquent” lists in one county: 1,000 records. Mail + calls over 60 days → 42 leads, 6 offers, 2 contracts. The lead that closed said yes on the 5th call; the first four were “not now”.</p>`,
  terms:[['Motivated seller','An owner with a strong reason to sell fast or at a discount.'],['List stacking','Finding owners who appear on several distress lists.'],['Skip tracing','Finding contact details for property owners.'],['Four pillars','Motivation, timeline, condition, price.'],['Cost per deal','Total marketing cost ÷ deals closed.']],
  playbook:{ t:'Seller lead machine', steps:['Choose a market and property type.','Pull and stack 2–3 lists.','Skip-trace; scrub DNC and litigators.','Pick 1–2 channels (e.g. mail + calls).','Write scripts/mail pieces about the seller’s situation.','Qualify on motivation, timeline, condition, price.','Set follow-up cadence by temperature (hot/warm/cold).','Log every lead and touch in the CRM.','Track CPL, cost per contract, cost per deal and ROI by channel.'] },
  pad:['Your target market and 3 lists to stack:','Your 2 channels and monthly budget:','Four-pillar questions you will ask:','Expected cost per deal and ROI:'],
  calc:'reroi',
  exam:[
    ['Why do investors look for motivated sellers?', ['They pay more','They have a reason to sell fast or at a discount','They have newer homes','They need agents'], 1, 'Motivation makes a below-market deal possible.'],
    ['List stacking means…', ['Printing lists','Finding owners on several lists','Buying more lists','Deleting old lists'], 1, 'Overlap signals higher motivation.'],
    ['Before cold calling a list you should…', ['Nothing','Skip-trace and scrub against DNC lists','Text everyone','Buy ads'], 1, 'Data quality and compliance first.'],
    ['Which channel is usually the cheapest per conversation?', ['Cold calling','TV ads','Billboards','PPC'], 0, 'It needs trained callers and compliance.'],
    ['The four pillars of qualifying are…', ['Name, email, phone, address','Motivation, timeline, condition, price','Price, product, place, promotion','Mail, calls, SMS, PPC'], 1, 'They tell you if there’s a deal.'],
    ['A seller says “not now”. You should…', ['Delete the lead','Put them on a follow-up schedule','Argue','Lower the price at once'], 1, 'Many deals close months later.'],
    ['$4,000 marketing, 1 deal with $16,000 profit. ROI?', ['3×','4×','12×','16×'], 0, '(16,000 − 4,000) ÷ 4,000 = 3×.'],
    ['Which channel needs the strictest consent check?', ['Direct mail','SMS','SEO','Referrals'], 1, 'Texting rules are strict and penalties high.']
  ] },

{ lvl:3, t:'Capstone: your marketing plan', mins:60,
  d:'Put it all together: one complete marketing plan for a real business, from customer to dashboard.',
  lesson:[
    ['What you will build', `<p>A one-document marketing plan for a real business — your own, a client's, or BrightLine. Use your notes and scratch pads from every module. When it's done, someone else should be able to run your marketing from it.</p>`],
    ['The plan, section by section', `<ol><li><b>Customer:</b> ICP, persona, job to be done, triggers.</li><li><b>Positioning:</b> alternatives, statement, value proposition.</li><li><b>Offer:</b> tiers, price, risk reversal.</li><li><b>Message:</b> headline, 3 proofs, voice words.</li><li><b>Channels:</b> 1–2 main + 1 long-term, with weekly actions.</li><li><b>Assets:</b> landing page, lead magnet, welcome emails, scripts.</li><li><b>Numbers:</b> goal, reverse funnel math, budget, max CAC.</li><li><b>Tracking:</b> UTMs, CRM stages, weekly dashboard.</li><li><b>90-day calendar</b> and 5 experiments.</li></ol>`],
    ['How it is judged', `<p>Use the playbook as a rubric. A strong plan is specific (names, numbers, dates), consistent (every part agrees with the positioning), realistic for the budget and time, and measurable.</p>`],
    ['Present it', `<p>Present the plan to your team lead or Amr in 10 minutes: the customer, the offer, the channels, the numbers, the first 30 days. Take feedback, adjust, then run it.</p>`]
  ],
  example:`<p>A strong capstone fits on 3–4 pages, with one table for the numbers and one for the 90-day calendar. A weak one lists every channel and has no numbers.</p>`,
  terms:[['Rubric','A checklist used to judge quality.']],
  playbook:{ t:'Capstone rubric', steps:['Customer section is specific and based on real conversations.','Positioning statement is clear and different from alternatives.','Offer has a clear outcome, price and risk reversal.','Headline and proofs match the positioning.','Channels are few, fit the audience and have weekly actions.','Key assets are drafted.','Reverse funnel math and budget add up.','Tracking and dashboard are defined.','90-day calendar has owners and dates.','5 experiments are scored and ready.'] },
  pad:['Business you are planning for:','Goal (one number) and deadline:','Link to or paste your full plan here:'],
  calc:'funnel',
  exam:[
    ['A strong marketing plan is…', ['Long and general','Specific, consistent, realistic and measurable','Only a list of channels','Only design'], 1, 'The four qualities in the rubric.'],
    ['Every section of the plan should agree with…', ['The competitor','Your positioning','The ad platform','The latest trend'], 1, 'Positioning is the backbone.'],
    ['How many main channels should the plan focus on?', ['1–2 plus 1 long-term','As many as possible','None','Exactly 7'], 0, 'Depth beats breadth.'],
    ['The numbers section should include…', ['Only followers','Goal, reverse funnel math, budget and max CAC','Nothing','Only likes'], 1, 'Numbers make the plan testable.'],
    ['What makes the plan runnable by someone else?', ['Owners, dates and weekly actions','A nice cover','Long paragraphs','Secret notes'], 0, 'Clear owners and actions.'],
    ['After presenting the plan you should…', ['Never change it','Take feedback, adjust, then run it','Delete it','Start a new one'], 1, 'Plans improve with feedback and real results.'],
    ['Experiments in the plan should be…', ['Random','Scored and written as hypotheses','Hidden','Skipped'], 1, 'If X, then Y, because…, scored with ICE.'],
    ['Which is a sign of a weak plan?', ['Clear numbers','Every channel listed and no numbers','A 90-day calendar','A defined ICP'], 1, 'No focus, nothing to measure.']
  ] }
] };
