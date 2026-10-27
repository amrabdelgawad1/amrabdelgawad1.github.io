// Marketing course, level 3: Websites, search and ads (modules 9–11). See course-marketing.js for the format.
window.LH_COURSES.mkt.modules.push(

// ================================================================ 9
{ lvl:2, t:'Websites, landing pages and funnels', d:'Website essentials, landing pages and forms, funnel types, and conversion rate optimisation with proper testing.',
  outcomes:['Plan a website that explains, builds trust and converts.','Build landing pages and forms with minimal friction.','Pick and map the right funnel for an offer.','Improve conversion with research and A/B tests you can trust.'],
  lessons:[
  { t:'Website essentials', mins:14, s:[
    ['What a site must do', `<p>In seconds, a visitor should know <b>what you do, who it’s for, why you, and what to do next</b>. Everything else supports those four.</p>`],
    ['Key pages', `<ul><li><b>Home:</b> outcome headline, who it’s for, proof, how it works, offer summary, CTA.</li><li><b>Service pages:</b> one per service or audience; each can rank on Google and match an ad.</li><li><b>About:</b> origin story, team faces, values — people check this before buying.</li><li><b>Proof:</b> case studies, reviews, results.</li><li><b>Pricing or “how to work with us”.</b></li><li><b>Contact / booking:</b> simple and fast.</li><li><b>Blog / resources:</b> for SEO and nurture.</li></ul>`],
    ['Navigation and structure', `<p>Keep menus short (5–7 items), use words visitors use (“Pricing”, not “Investment philosophy”), make the main CTA a button in the header, and put contact details and key links in the footer.</p>`],
    ['Speed, mobile, security', `<p>Most visits are on phones. Pages should load in about 2–3 seconds, be easy to read and tap on a small screen, and run on https. Compress images, avoid heavy scripts and auto-playing video.</p>`],
    ['Platforms', `<p>WordPress (flexible), Webflow (design control), Squarespace/Wix (simple), Shopify (e-commerce), funnel builders in CRMs like GoHighLevel or ClickFunnels, or a hand-built site like this one. Choose what you can update yourself.</p>`]],
    ex:`<p>BrightLine’s old homepage opened with “About our company”. The new one opens with “Seller appointments on your calendar, without managing callers”, three proofs and a “Book a 15-minute call” button. Bookings from the site doubled.</p>`,
    terms:[['Above the fold','What is visible before scrolling.'],['Service page','A page dedicated to one service or audience.']] },

  { t:'Landing pages and forms', mins:14, s:[
    ['Website vs landing page', `<p>A website serves many visitors with many goals. A <b>landing page</b> has one audience, one offer and one goal. Send ad and campaign traffic to landing pages, and match the page headline to the ad (“message match”).</p>`],
    ['Landing page structure', `<ol><li>Headline: the outcome, for whom.</li><li>Sub-line: how it works in one sentence.</li><li>CTA above the fold.</li><li>Proof: logos, numbers, testimonials.</li><li>How it works: 3 steps.</li><li>Benefits and what’s included.</li><li>Objections and FAQ.</li><li>Final CTA with risk reversal.</li></ol>`],
    ['Forms and friction', `<p>Every extra field lowers sign-ups. Ask only what you need now; collect the rest later. Use multi-step forms for longer ones (start with an easy question). Button text should say the result (“Get my script”, not “Submit”). Show what happens next and a privacy note.</p>`],
    ['Thank-you page', `<p>Don’t waste it: confirm what happens next, offer a next step (book a call, watch a video, join the community), and fire your conversion tracking here.</p>`]],
    ex:`<p>BrightLine sent ads to its homepage: 0.8% booked. A landing page matching the ad, with a 3-step “how it works”, two testimonials and a 2-field form converted 4.1% — 5× more calls for the same budget.</p>`,
    terms:[['Landing page','A single-goal page for one audience and offer.'],['Message match','The page repeats the promise of the ad or link that brought people.'],['Friction','Anything that makes taking action harder.']] },

  { t:'Funnels', mins:14, s:[
    ['What a funnel is', `<p>The path from first touch to sale, e.g. ad → landing page → form → call booked → call held → client. Each step has a conversion rate; total results = traffic × each rate. Improve the weakest step first.</p>`],
    ['Common funnel types', `<ul><li><b>Lead magnet funnel:</b> free resource → email nurture → offer.</li><li><b>Booking funnel:</b> landing page → calendar → reminders → sales call (most service businesses).</li><li><b>Webinar / workshop funnel:</b> registration → live or recorded training → offer.</li><li><b>Low-ticket (tripwire) funnel:</b> a small paid product → upsell to the main offer.</li><li><b>Application funnel:</b> for high-ticket offers; a short application qualifies leads before calls.</li></ul>`],
    ['Make the booking funnel work', `<ul><li>Calendar on the page (Calendly, GoHighLevel, HubSpot).</li><li>Instant confirmation plus reminders by email and SMS (with consent): 24 hours and 1 hour before.</li><li>A short video or checklist on “what to expect”.</li><li>Qualifying questions to filter poor fits.</li><li>Fast follow-up on no-shows.</li></ul>`],
    ['Map it before you build it', `<p>Draw each step, what the person sees, what they must believe to move on, and the number you expect. Gaps in the map show what to build or fix.</p>`]],
    ex:`<p>BrightLine’s show rate was 55%. Adding a confirmation email with a 90-second “what we’ll cover” video and SMS reminders lifted it to 82% — 50% more held calls from the same bookings.</p>`,
    terms:[['Show rate','Share of booked calls that actually happen.'],['Tripwire','A low-priced first purchase that leads to bigger ones.'],['Application funnel','Leads apply before getting a call.']] },

  { t:'Conversion rate optimisation (CRO) and A/B testing', mins:16, s:[
    ['Research before you test', `<p>Find out <i>why</i> people don’t convert: analytics (where they drop), heatmaps and session recordings (Microsoft Clarity and Hotjar show clicks and scrolling), on-page polls (“What stopped you booking today?”), sales-call notes and customer interviews.</p>`],
    ['Hypotheses', `<p>Write: <i>“Because we saw [evidence], we believe changing [X] for [audience] will improve [metric]. We’ll know when [measure].”</i> Prioritise by impact, confidence and ease.</p>`],
    ['A/B testing done right', `<ul><li>Change one meaningful thing at a time (headline, offer, form length, proof).</li><li>Split traffic randomly between version A and B.</li><li>Decide the sample size and duration <i>before</i> starting, and run full weeks (at least 1–2) to cover weekday differences.</li><li>Don’t stop the test the moment one version looks ahead — early results swing a lot.</li><li>Use a significance calculator; 95% confidence is the usual bar.</li><li>Small sites with little traffic: test bigger changes, or use qualitative research instead.</li></ul>`],
    ['What usually moves the needle', `<p>Clearer headline and offer, stronger proof near the CTA, fewer form fields, faster pages, better message match, answering the main objection, and risk reversal. Button colours rarely matter much.</p>`]],
    ex:`<p>On-page polls showed visitors feared “offshore-sounding callers”. BrightLine added 3 real call recordings above the form. Test ran 3 weeks with ~1,200 visitors per version: bookings rose from 4.1% to 5.6%.</p>`,
    terms:[['CRO','Conversion rate optimisation.'],['Heatmap','A visual of where people click and scroll.'],['Statistical significance','Confidence that a difference is not chance.']] }
  ],
  playbook:{ t:'Page and funnel checklist', steps:['Home passes the 4-question test (what, who, why you, next step).','Every campaign has its own landing page with message match.','CTA visible without scrolling; proof near the top.','FAQ answers the top objections.','Form has the fewest fields possible; button says the result.','Thank-you page has a next step and fires tracking.','Booking funnel has confirmations and reminders.','Pages load fast on a phone.','Heatmaps or recordings installed; one on-page poll running.','One A/B test planned with sample size decided first.'] },
  pad:['Your landing page headline and sub-line:','Your 3 “how it works” steps:','Top 5 objections for your FAQ:','Your funnel map with expected numbers per step:','One A/B test hypothesis:'],
  calc:'funnel',
  exam:[
    ['In seconds, a homepage should tell visitors…', ['Company history','What, who for, why you, what next','Every service detail','Team hobbies'], 1, 'Those four answers decide if they stay.'],
    ['Where should paid ad traffic usually go?', ['Homepage','A dedicated landing page','Your LinkedIn','A blog post'], 1, 'One goal per page converts better.'],
    ['Message match means…', ['Matching fonts','The page repeats the ad’s promise','Same colours as competitors','Replying to messages'], 1, 'Mismatch makes people bounce.'],
    ['Adding more form fields usually…', ['Raises sign-ups','Lowers sign-ups','Has no effect','Is required'], 1, 'More friction, fewer conversions.'],
    ['Which button text is better?', ['Submit','Get my call script','Click here','Send'], 1, 'Say the result they get.'],
    ['A booking funnel’s show rate is improved by…', ['Fewer reminders','Confirmations and reminders','Removing the calendar','Longer forms'], 1, 'Reminders and expectations cut no-shows.'],
    ['An application funnel suits…', ['Free downloads','High-ticket offers','Impulse buys','Newsletters'], 1, 'It qualifies leads before costly calls.'],
    ['In a funnel, what should you improve first?', ['The strongest step','The weakest step','The logo','Nothing'], 1, 'The biggest leak gives the biggest gain.'],
    ['Heatmaps show…', ['Revenue','Where people click and scroll','Ad spend','Email opens'], 1, 'They reveal what people notice and ignore.'],
    ['When should you stop an A/B test?', ['As soon as one looks ahead','After the planned sample size and duration','After one day','Never'], 1, 'Stopping early gives false winners.'],
    ['An A/B test should change…', ['Everything at once','One meaningful thing','Only colours','Nothing'], 1, 'Otherwise you can’t know what caused the result.'],
    ['100 visitors, 5 book a call. Conversion rate?', ['0.5%','5%','20%','50%'], 1, '5 ÷ 100 = 5%.']
  ] },

// ================================================================ 10
{ lvl:2, t:'SEO and local search', d:'How search works and keyword research, on-page and content SEO, technical SEO, local SEO and links.',
  outcomes:['Do keyword research and match pages to search intent.','Write pages that rank: on-page SEO, E-E-A-T and topic clusters.','Check the technical basics: crawling, indexing, speed, schema.','Win local search and earn quality links.'],
  lessons:[
  { t:'How search works and keyword research', mins:15, s:[
    ['How search works', `<p>Search engines <b>crawl</b> the web (follow links), <b>index</b> pages (store and understand them) and <b>rank</b> them for each search by relevance, quality and trust. SEO is making it easy for them to see your page is the best answer. It’s slow (months) but compounds for years.</p>`],
    ['Search intent', `<ul><li><b>Informational:</b> “how to sell land fast”.</li><li><b>Commercial:</b> “best cold calling service for investors”.</li><li><b>Transactional:</b> “hire cold callers”.</li><li><b>Navigational:</b> “BrightLine Calls login”.</li><li><b>Local:</b> “sell my house fast Atlanta”.</li></ul><p>Look at what already ranks: if the top results are guides, write a guide; if they’re service pages, build a service page.</p>`],
    ['Keyword research process', `<ol><li>Brainstorm what customers type (from interviews and sales calls).</li><li>Expand with Google autocomplete, “People also ask”, related searches, and tools (Google Keyword Planner, Search Console, Ahrefs, Semrush, Ubersuggest).</li><li>Note monthly volume, difficulty and intent.</li><li>Prioritise <b>long-tail</b> phrases (specific, lower competition, clearer intent).</li><li>Group similar keywords: one page per group.</li></ol>`],
    ['Zero-volume isn’t zero value', `<p>Very specific B2B phrases may show “0” volume in tools but bring exactly the right buyers. If customers ask it, it’s worth a page.</p>`]],
    ex:`<p>BrightLine targeted “cold calling scripts for land investors” (low volume, low difficulty, perfect fit) instead of “cold calling” (huge volume, impossible to rank, mostly job seekers).</p>`,
    terms:[['Crawl / index / rank','How search engines find, store and order pages.'],['Search intent','What the searcher really wants.'],['Long-tail keyword','A specific, longer, less competitive phrase.'],['Keyword difficulty','How hard it is to rank for a keyword.']] },

  { t:'On-page and content SEO', mins:15, s:[
    ['On-page basics', `<ul><li>One main topic per page.</li><li>Keyword in the <b>title tag</b>, <b>H1</b>, URL and early in the text — naturally.</li><li>Clear H2/H3 headings, short paragraphs, lists.</li><li>A <b>meta description</b> that earns the click (it doesn’t rank, but it sells).</li><li>Images compressed with descriptive alt text.</li><li>Internal links to related pages with descriptive anchor text.</li></ul>`],
    ['Helpful content and E-E-A-T', `<p>Google rewards content written for people: <b>Experience, Expertise, Authoritativeness and Trustworthiness</b>. Show first-hand experience (real examples, screenshots, data), name the author with credentials, cite sources, keep it up to date. Thin, copied or mass-produced AI text without real value tends to do poorly.</p>`],
    ['Topic clusters', `<p>A <b>pillar page</b> covers a broad topic (“Cold calling for real estate investors”); <b>cluster pages</b> cover sub-topics (scripts, objections, compliance, hiring callers) and all link to and from the pillar. This shows depth and spreads authority.</p>`],
    ['Beat what ranks', `<p>Read the top 5 results. Cover what they cover, then add what they miss: examples, templates, data, a clearer structure, a video. Update important pages regularly.</p>`]],
    ex:`<p>BrightLine’s guide “Cold calling scripts for land investors (with objections)” includes real anonymised call snippets and a downloadable script. Six months later it ranks on page one, brings 900 visits a month and 20 sign-ups.</p>`,
    terms:[['Title tag','The page title shown in search results.'],['H1','The main heading on a page.'],['E-E-A-T','Experience, expertise, authoritativeness, trustworthiness.'],['Topic cluster','A pillar page linked with related sub-topic pages.']] },

  { t:'Technical SEO basics', mins:13, s:[
    ['Can Google find and index you?', `<ul><li>Set up <b>Google Search Console</b>: see indexing, searches, clicks and errors.</li><li>Submit an <b>XML sitemap</b>.</li><li>Check <b>robots.txt</b> isn’t blocking important pages; use “noindex” only for pages that shouldn’t appear (thank-you pages, private areas).</li><li>Avoid duplicate pages; use canonical tags when similar pages exist.</li><li>Fix broken links and use 301 redirects when URLs change.</li></ul>`],
    ['Speed and Core Web Vitals', `<p>Google measures page experience with Core Web Vitals: <b>LCP</b> (how fast the main content loads; good ≤ 2.5s), <b>INP</b> (how fast the page responds to taps and clicks; good ≤ 200ms) and <b>CLS</b> (how much the layout jumps; good ≤ 0.1). Check with PageSpeed Insights.</p>`],
    ['Mobile and https', `<p>Google indexes the mobile version of your site first. It must work fully on phones. Use https everywhere.</p>`],
    ['Structured data', `<p><b>Schema markup</b> tells search engines what things are (LocalBusiness, FAQ, Review, Article, Product) and can earn richer results. Add it with plugins or JSON-LD and test with Google’s Rich Results Test.</p>`]],
    ex:`<p>BrightLine found their blog was set to “noindex” by mistake after a redesign. Removing it brought 40 pages back into Google within weeks — a reminder to check Search Console after every site change.</p>`,
    terms:[['Sitemap','A file listing the pages you want indexed.'],['Canonical tag','Tells search engines the main version of similar pages.'],['Core Web Vitals','LCP, INP and CLS page-experience metrics.'],['Schema','Structured data describing page content.']] },

  { t:'Local SEO and link building', mins:14, s:[
    ['Google Business Profile', `<p>For local searches (and the map pack), your <b>Google Business Profile</b> is often more important than your website: correct name, address, phone, primary category, service areas, hours, photos, services, products and regular posts. Answer Q&amp;As.</p>`],
    ['Reviews and NAP', `<p>Reviews — number, rating, recency and replies — are a major local ranking and conversion factor. Ask every happy customer. Keep your <b>NAP</b> (name, address, phone) identical on your site, directories (Yelp, BBB, industry listings) and social profiles.</p>`],
    ['Local pages', `<p>Create a genuinely useful page per city or area you serve (local examples, photos, testimonials), not copy-paste pages with only the city name changed.</p>`],
    ['Links and authority', `<p>Links from relevant, trusted sites act as votes. Earn them with: genuinely useful resources and data, guest articles and podcasts, partners and suppliers, local press, sponsorships, directories, and digital PR (a survey or study journalists want to cite). Avoid buying links or link schemes — they can get you penalised.</p>`]],
    ex:`<p>A cash home-buyer in one city asked every seller for a review and posted weekly on their Google Business Profile with photos of bought houses. In 6 months they reached the map pack for “sell my house fast [city]” — their cheapest lead source.</p>`,
    terms:[['Google Business Profile','Your free listing on Google Search and Maps.'],['Map pack','The top local results with a map.'],['NAP','Name, address, phone.'],['Backlink','A link from another site to yours.']] }
  ],
  playbook:{ t:'SEO starter checklist', steps:['Set up Google Search Console and submit a sitemap.','List 50 phrases customers search; group by intent.','Pick 5 long-tail targets.','Write one excellent page per target, better than what ranks.','Plan one topic cluster around a pillar page.','Check title, H1, URL, meta description and internal links.','Run PageSpeed Insights on key pages; fix the worst issue.','Add schema (LocalBusiness or FAQ).','Complete Google Business Profile (if local); ask for reviews.','Earn 2–3 relevant links a month.','Review rankings and clicks monthly.'] },
  pad:['20 phrases your customers would search:','5 long-tail targets with intent:','Outline your pillar page and 5 cluster pages:','3 link-building ideas for your niche:'],
  exam:[
    ['The three steps of search engines are…', ['Write, post, share','Crawl, index, rank','Click, buy, review','Plan, test, scale'], 1, 'Find, store, order.'],
    ['“Sell my house fast Atlanta” has which intent?', ['Informational','Local / transactional','Navigational','None'], 1, 'Location + action.'],
    ['A long-tail keyword is…', ['A short popular word','A specific longer phrase','A paid keyword','A hashtag'], 1, 'Less competition, clearer intent.'],
    ['How do you check which kind of page to build?', ['Guess','Look at what already ranks','Ask a competitor','Use the longest page'], 1, 'Match the format Google already rewards.'],
    ['Where should your main keyword appear?', ['Only the footer','Title, H1, URL and early text','Hidden text','Nowhere'], 1, 'Standard on-page basics.'],
    ['E-E-A-T stands for…', ['Easy, early, active, timely','Experience, expertise, authoritativeness, trustworthiness','Email, engagement, ads, traffic','None'], 1, 'Signals of helpful, reliable content.'],
    ['A topic cluster is…', ['One giant page','A pillar page linked with sub-topic pages','A group of ads','A keyword tool'], 1, 'It shows depth on a subject.'],
    ['Which tool shows how Google indexes your site?', ['Google Search Console','Photoshop','Excel','Zoom'], 0, 'It shows searches, clicks and errors.'],
    ['LCP measures…', ['Layout shifts','How fast the main content loads','Clicks','Links'], 1, 'Good is about 2.5 seconds or less.'],
    ['For local businesses, a key free tool is…', ['Google Business Profile','A fax line','Paid links','Pop-ups'], 0, 'It drives Maps and local results.'],
    ['NAP consistency means…', ['Same name, address and phone everywhere','Nap time','New ad pages','No ads please'], 0, 'Inconsistent details confuse search engines and customers.'],
    ['Buying backlinks is…', ['Recommended','Risky; it can get you penalised','Required','Free'], 1, 'Earn links, don’t buy them.']
  ] },

// ================================================================ 11
{ lvl:2, t:'Paid ads', d:'Ad fundamentals, Google Ads, Meta Ads, and creative testing, scaling and reading the numbers.',
  outcomes:['Understand auctions, objectives, budgets and bidding.','Build a Google Search campaign with tight keywords and Quality Score in mind.','Build Meta campaigns with proper tracking, audiences and creative tests.','Read CTR, CPC, CPL, CAC and ROAS and scale winners safely.'],
  lessons:[
  { t:'Ad fundamentals', mins:14, s:[
    ['Before you spend', `<p>Ads amplify what already works. Have a clear offer, a converting landing page and tracking in place first. Know your <b>maximum cost per lead and per customer</b> from your margins (Module 12). Start with a test budget you can afford to lose while learning.</p>`],
    ['Search vs social', `<p><b>Search ads</b> (Google, Bing) catch people already looking — high intent, often higher cost per click. <b>Social ads</b> (Meta, LinkedIn, TikTok) interrupt people who fit a profile — lower intent, great for awareness, lead magnets and retargeting. <b>LinkedIn ads</b> target by job title and company but cost much more per click; use for high-value B2B offers.</p>`],
    ['Auctions and objectives', `<p>Every time an ad can show, an auction runs. Platforms weigh your <b>bid</b> and your ad’s <b>quality/expected results</b>, so better ads pay less. Choose the campaign objective that matches the goal (leads, sales, traffic, awareness); the platform optimises for exactly what you pick.</p>`],
    ['Budgets and bidding', `<p>Daily or lifetime budgets. Automated bidding (maximise conversions, target cost per acquisition) works well once there is enough conversion data; manual or click-based bidding helps at the start. Platforms need a “learning phase” — avoid big changes during it.</p>`],
    ['The core numbers', `<ul><li><b>CTR</b> = clicks ÷ impressions.</li><li><b>CPC</b> = spend ÷ clicks.</li><li><b>CPM</b> = cost per 1,000 impressions.</li><li><b>CVR</b> = conversions ÷ clicks.</li><li><b>CPL</b> = spend ÷ leads; <b>CAC/CPA</b> = spend ÷ customers.</li><li><b>ROAS</b> = revenue ÷ ad spend.</li></ul>`]],
    ex:`<p>BrightLine’s numbers: client worth $1,800/month × 8 months × 50% margin = $7,200 gross profit. They allow up to $1,500 CAC. With a 25% close rate and 80% show rate, that’s a max of about $300 per booked call.</p>`,
    terms:[['Objective','What you tell the platform to optimise for.'],['Learning phase','The period an ad system needs data to optimise.'],['CPM','Cost per thousand impressions.'],['CVR','Conversion rate.']] },

  { t:'Google Ads', mins:16, s:[
    ['Structure', `<p>Account → <b>campaigns</b> (budget, location, goal) → <b>ad groups</b> (one tight theme each) → <b>keywords</b> and <b>ads</b>. Keep each ad group to closely related keywords so the ad and landing page match the search exactly.</p>`],
    ['Keywords and match types', `<ul><li><b>Exact match</b> [hire cold callers]: that search and close variants.</li><li><b>Phrase match</b> "cold callers for real estate": searches containing that meaning.</li><li><b>Broad match</b>: related searches — needs strong conversion data and smart bidding.</li></ul><p>Add <b>negative keywords</b> (jobs, free, salary, course, training…) and review the <b>search terms report</b> weekly to block waste.</p>`],
    ['Quality Score and ad rank', `<p>Quality Score (1–10) reflects <b>expected CTR</b>, <b>ad relevance</b> and <b>landing page experience</b>. Higher quality lowers your cost and improves position. Tight ad groups and matching landing pages are the main levers.</p>`],
    ['Ads and assets', `<p><b>Responsive search ads</b>: up to 15 headlines and 4 descriptions that Google mixes. Include the keyword, the outcome, proof and a CTA. Add <b>assets</b> (sitelinks, callouts, call, location, structured snippets) — they make ads bigger and more clickable.</p>`],
    ['Other campaign types', `<p><b>Performance Max</b> runs across all Google surfaces automatically — powerful with good conversion data and creative, but less control; start with Search. <b>Local Services Ads</b> (pay per lead, “Google Guaranteed”) exist for many local service categories. <b>Display</b> and <b>YouTube</b> suit retargeting and awareness.</p>`],
    ['Conversion tracking', `<p>Track form submits, calls and booked appointments as conversions (Google tag or Tag Manager, plus offline conversion imports from your CRM so Google learns which leads became customers).</p>`]],
    ex:`<p>BrightLine’s first search campaign wasted 40% of spend on “cold calling jobs” searches. Adding 60 negative keywords and splitting into 3 tight ad groups dropped CPL from $140 to $70.</p>`,
    terms:[['Match type','How closely a search must match your keyword.'],['Negative keyword','A term you block your ads from.'],['Quality Score','Google’s 1–10 rating of keyword, ad and page quality.'],['Search terms report','The actual searches that triggered your ads.']] },

  { t:'Meta Ads (Facebook and Instagram)', mins:16, s:[
    ['Structure', `<p><b>Campaign</b> (objective: leads, sales, traffic, awareness, engagement) → <b>ad sets</b> (audience, placements, budget, schedule) → <b>ads</b> (creative and copy).</p>`],
    ['Tracking: Pixel and Conversions API', `<p>Install the <b>Meta Pixel</b> on your site and set up the <b>Conversions API</b> (server-side) so Meta receives conversion events even when browsers block tracking. Mark the events that matter (Lead, Schedule, Purchase). Better data = better optimisation.</p>`],
    ['Audiences', `<ul><li><b>Core:</b> location, age, interests, behaviours.</li><li><b>Custom:</b> website visitors, video viewers, page engagers, your customer list.</li><li><b>Lookalikes:</b> people similar to a custom audience (e.g. customers).</li><li><b>Broad / Advantage+ audience:</b> let the system find buyers; often works well when creative is strong and tracking is good.</li></ul>`],
    ['Lead forms vs landing pages', `<p><b>Instant forms</b> (on Facebook/Instagram) give cheaper, more numerous leads but often lower quality. Add qualifying questions or a “higher intent” review step. Landing pages cost more per lead but usually give better leads. Test both and judge by cost per <i>customer</i>.</p>`],
    ['Special ad categories', `<p>Ads about <b>housing</b>, employment, credit and social/political issues must use a special ad category with limited targeting (no age, gender or narrow location targeting, for example). Real estate ads usually fall into the housing category — plan for broader targeting.</p>`]],
    ex:`<p>BrightLine tested $600 on Meta: 3 angles to land investors. “Your callers quit again?” got a $38 CPL; the others were above $90. They moved the budget to the winner and retargeted page visitors with a case study.</p>`,
    terms:[['Pixel','Code that reports site actions to Meta.'],['Conversions API','Server-side event sending to Meta.'],['Lookalike audience','People similar to a source audience.'],['Special ad category','Restricted targeting for housing, jobs, credit and social issues.']] },

  { t:'Creative, testing, scaling and retargeting', mins:15, s:[
    ['Creative is the targeting', `<p>On social, the hook decides who stops. Test 3–5 different <b>angles</b> (pain, result, proof, story, objection), then formats (UGC-style video, static image, carousel, testimonial). Refresh creative when frequency rises and results drop (“creative fatigue”).</p>`],
    ['Testing discipline', `<p>Change one variable at a time. Give each ad enough spend to judge — a common rule is to let it reach at least the cost of 2–3 target conversions before deciding. Kill clear losers, keep winners, iterate on the winning angle.</p>`],
    ['Scaling', `<p><b>Vertical:</b> raise budget gradually (around 20% every few days) to avoid resetting learning. <b>Horizontal:</b> new audiences, new angles, new platforms. Watch CPL and lead quality as you scale — costs usually rise.</p>`],
    ['Retargeting', `<p>Show ads to people who visited, watched or engaged: usually your best-performing audience. Use proof (case studies, testimonials), objection handling and a direct CTA. Cap frequency so you don’t annoy.</p>`],
    ['Reading the numbers', `<ul><li>Low CTR → weak hook or wrong audience.</li><li>High CTR, low conversion → page or offer problem, or message mismatch.</li><li>Good CPL, few customers → lead quality or sales follow-up problem.</li></ul><p>Report weekly: spend, CPL, cost per booked call, CAC, ROAS.</p>`]],
    ex:`<p>BrightLine’s winning video ran 6 weeks before CPL climbed from $38 to $65 with frequency at 4. Three new videos on the same angle brought CPL back to $41.</p>`,
    terms:[['Angle','The core idea or reason an ad uses to persuade.'],['Creative fatigue','Results fall as the same audience sees an ad too often.'],['Frequency','Average times each person has seen the ad.'],['Retargeting','Ads to people who already visited or engaged.']] }
  ],
  playbook:{ t:'First ad campaign', steps:['Confirm offer, landing page and tracking work end to end.','Calculate max cost per lead, per booked call and per customer.','Pick one platform that fits intent.','Google: tight ad groups, exact/phrase match, 50+ negative keywords, assets.','Meta: Pixel + Conversions API, the right objective, special ad category if housing.','Create 3–5 angles.','Run long enough to judge (2–3× target CPA per ad).','Kill losers, scale winners ~20% at a time.','Add retargeting with proof.','Report weekly: spend, CPL, CAC, ROAS, lead quality.'] },
  pad:['Your max CPL, cost per call and CAC:','10 negative keywords for your search ads:','3 ad angles (hook + visual idea):','Retargeting ad idea with proof:'],
  calc:'ads',
  exam:[
    ['When should you start paid ads?', ['Before you have an offer','When the offer, page and tracking are ready','Never','Only with a big budget'], 1, 'Ads amplify what already works.'],
    ['In ad auctions, a better-quality ad usually…', ['Pays more','Pays less for the same position','Can’t win','Is ignored'], 1, 'Quality lowers cost.'],
    ['Search ads are best for…', ['People already looking','Brand colours','Recruiting only','Free traffic'], 0, 'They catch existing intent.'],
    ['Quality Score is based on expected CTR, ad relevance and…', ['Budget','Landing page experience','Logo','Account age'], 1, 'All three are levers you control.'],
    ['A negative keyword…', ['Is a rude word','Blocks your ad from irrelevant searches','Lowers your rank','Is required'], 1, 'It stops wasted clicks.'],
    ['What does the Conversions API do?', ['Designs ads','Sends conversion events server-side to Meta','Writes copy','Sets budgets'], 1, 'It keeps data flowing when browsers block tracking.'],
    ['Real estate ads on Meta usually need…', ['No changes','The housing special ad category','A bigger budget','TikTok'], 1, 'Housing ads have limited targeting.'],
    ['Instant lead forms on Meta usually give…', ['Fewer, better leads','Cheaper but often lower-quality leads','No leads','Only sales'], 1, 'Add qualifying questions and judge by cost per customer.'],
    ['$500 spent, 20 leads. CPL?', ['$10','$25','$50','$100'], 1, '500 ÷ 20 = $25.'],
    ['$1,000 spend, $4,000 revenue. ROAS?', ['0.25','4','40','1,000'], 1, '4,000 ÷ 1,000 = 4×.'],
    ['High CTR but few conversions points to…', ['A weak hook','A page or offer problem','Low budget','Too many keywords'], 1, 'People are interested but the next step fails.'],
    ['How should you scale a winning ad?', ['10× overnight','Gradually, about 20% at a time','Never','Pause it'], 1, 'Big jumps can reset learning and raise costs.']
  ] }
);
