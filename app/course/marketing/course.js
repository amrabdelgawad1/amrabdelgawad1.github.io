// Marketing course: the small public part only (title, pass mark, the team switch and the module plan).
// The lessons, questions, recaps, sources and case files are NOT on this website. They live in the private
// Supabase storage bucket "course-content" (mkt/content.json) and download only after the access check in
// player.js: Amr, or team members with both "Learning Hub" and "Marketing course" switched on in Invite and access.
// To change content: edit the source files, then run tools/marketing-course/build-content.js (see its README).
window.COURSE = {
  id:"mkt2", title:"Marketing", pass:80,
  team:true,   // false: only the owner sees the course (the Hub card and /app/course/); true: people given access
  access:"mkt", // the course switch in Invite and access, and its folder in the course-content bucket
  sub:"Learn marketing from the first idea to running a full growth system, on one real-feeling business.",
  stages:["Foundations and language","Core skills","Advanced and edge cases","Becoming a pro"],
  plan:[
    {id:"m01",stage:0,t:"Foundations and the language of marketing",ready:true},
    {id:"m02",stage:0,t:"Know your customer",ready:true},
    {id:"m03",stage:0,t:"Positioning, offer and pricing",ready:true},
    {id:"m04",stage:0,t:"Messaging and copywriting",ready:true},
    {id:"m05",stage:1,t:"Brand",ready:true},
    {id:"m06",stage:1,t:"Content marketing",ready:true},
    {id:"m07",stage:1,t:"Social media",ready:true},
    {id:"m08",stage:1,t:"Email and text marketing",ready:true},
    {id:"m09",stage:1,t:"Websites, landing pages and funnels",ready:true},
    {id:"m10",stage:1,t:"SEO and local search",ready:true},
    {id:"m11",stage:1,t:"Paid ads",ready:true},
    {id:"m12",stage:1,t:"Outbound and partnerships",ready:true},
    {id:"m13",stage:2,t:"Analytics, tracking and testing",ready:true},
    {id:"m14",stage:2,t:"Planning and running the growth system",ready:true},
    {id:"m15",stage:2,t:"Rules, risk and edge cases",ready:true},
    {id:"m16",stage:3,t:"Becoming a pro",ready:true}
  ],
  modules:{}
};
