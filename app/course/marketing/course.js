// Marketing course (v2): outline, sources, the case files and the module plan.
// Each module's content lives in m01.js, m02.js… and fills COURSE.modules[i] when it's built.
// Numbers about Kestrel and BrightLine come only from CASE below, so every module tells the same story.
window.COURSE = {
  id:'mkt2', title:'Marketing', pass:80,
  sub:'Learn marketing from the first idea to running a full growth system, on one real-feeling business.',
  stages:['Foundations and language', 'Core skills', 'Advanced and edge cases', 'Becoming a pro'],

  // Where each point comes from. Every lesson section carries one or more of these tags.
  sources:{
    H:   { t:'House method', d:'How we teach and do it in this course, built from practice.' },
    AMA: { t:'American Marketing Association', d:'Definition of marketing, approved 2017.' },
    DRU: { t:'Peter Drucker', d:'Management: Tasks, Responsibilities, Practices (1973).' },
    KOT: { t:'Philip Kotler', d:'Marketing Management (segmentation, targeting, positioning).' },
    MCC: { t:'E. Jerome McCarthy', d:'Basic Marketing (1960): the 4 Ps.' },
    BB:  { t:'Booms and Bitner', d:'The 3 extra Ps for services (1981).' },
    SCH: { t:'Eugene Schwartz', d:'Breakthrough Advertising (1966): levels of awareness.' },
    LEW: { t:'E. St. Elmo Lewis', d:'The AIDA model of how people buy (around 1898).' },
    AAR: { t:'Dave McClure', d:'Startup Metrics for Pirates (2007): AARRR.' },
    EBI: { t:'Ehrenberg-Bass Institute', d:'John Dawes, the 95-5 rule for B2B buyers (2021).' },
    FTC: { t:'US Federal Trade Commission', d:'Rule on Consumer Reviews and Testimonials (in force since October 2024).' },
    BEZ: { t:'Commonly credited to Jeff Bezos', d:'Widely quoted as said by Amazon’s founder. No verified original source has been found, so treat it as a saying, not a quote.' },
    FST: { t:'Five-second test (UX research)', d:'Usability method popularised by Christine Perfetti of User Interface Engineering (around 2005). The ten-second test here is adapted from it.' },
    CWK: { t:'Chris Walker, Refine Labs', d:'Popularised the split between demand capture and demand creation in B2B marketing (around 2020).' },
    FOR: { t:'Forrester Research', d:'Owned, earned and paid media, defined by Sean Corcoran (2009).' },
    SIR: { t:'SiriusDecisions', d:'The Demand Waterfall (2006), which made MQL and SQL standard lead stages.' },
    RIE: { t:'Eric Ries', d:'The Lean Startup (2011): vanity metrics vs actionable metrics.' },
    PTW: { t:'A.G. Lafley and Roger Martin', d:'Playing to Win (2013): strategy as where to play and how to win.' },
    GOO: { t:'Google', d:'Google Maps user-contributed content policy: no rewards or incentives for reviews.' }
  },

  // The running cases. Kestrel is the main one; BrightLine shows how B2B differs.
  case:{
    main:{ name:'Kestrel Heating & Air', short:'Kestrel',
      about:'A family-owned heating and air conditioning company in Ashford, a made-up mid-size US city, serving homes within 25 miles. Founded in 2011 by Dana Kestrel, who still runs it. You join as its first marketing coordinator.',
      facts:[
        ['Team', 'Dana (owner), 8 technicians, 2 office staff (calls and dispatch), and you'],
        ['Revenue last year', 'About $1.9 million: repairs $640k, replacements $1.06M, Comfort Club plans $180k'],
        ['Average repair job', '$420, about 60% gross margin'],
        ['Diagnostic visit', '$89, waived if the customer goes ahead with the repair'],
        ['Average system replacement', '$11,000, about 35% gross margin'],
        ['Comfort Club plan', '$15 a month ($180 a year), about 70% margin, 1,000 members, 75% renew each year'],
        ['Marketing spend', '$6,000 a month: $4,800 Google Ads plus $1,200 agency fee (about 3.8% of revenue)'],
        ['Reputation', '4.6 stars from 310 Google reviews'],
        ['A typical month (May)', '200 leads (calls and forms) → 140 booked (70%) → 126 jobs run (90%); 24 replacement quotes → 8 sold (33%)'],
        ['Google Ads in May', '$4,800 spend, 1,600 clicks, 80 leads, 56 booked, 50 jobs run'],
        ['Competition', 'A national franchise brand and two other local companies']
      ] },
    b2b:{ name:'BrightLine Calls', short:'BrightLine',
      about:'A made-up B2B company: a managed cold-calling team that books seller appointments for US land investors. Used where business-to-business marketing works differently.',
      facts:[
        ['Main plan', '$1,800 a month per client, about 50% gross margin'],
        ['Capacity', 'Up to 6 new clients a month'],
        ['Client life', 'Clients stay about 8 months on average (12.5% leave each month)'],
        ['Sales cycle', 'About 3 weeks from first call to signed client']
      ] }
  },

  // The full plan. Modules with content are filled in by their own file; ready:true marks the ones published
  // (the Learning Hub card counts these, and the player checks they match the files it loaded).
  plan:[
    { id:'m01', stage:0, t:'Foundations and the language of marketing', ready:true },
    { id:'m02', stage:0, t:'Know your customer' },
    { id:'m03', stage:0, t:'Positioning, offer and pricing' },
    { id:'m04', stage:0, t:'Messaging and copywriting' },
    { id:'m05', stage:1, t:'Brand' },
    { id:'m06', stage:1, t:'Content marketing' },
    { id:'m07', stage:1, t:'Social media' },
    { id:'m08', stage:1, t:'Email and text marketing' },
    { id:'m09', stage:1, t:'Websites, landing pages and funnels' },
    { id:'m10', stage:1, t:'SEO and local search' },
    { id:'m11', stage:1, t:'Paid ads' },
    { id:'m12', stage:1, t:'Outbound and partnerships' },
    { id:'m13', stage:2, t:'Analytics, tracking and testing' },
    { id:'m14', stage:2, t:'Planning and running the growth system' },
    { id:'m15', stage:2, t:'Rules, risk and edge cases' },
    { id:'m16', stage:3, t:'Becoming a pro' }
  ],
  modules:{}
};
