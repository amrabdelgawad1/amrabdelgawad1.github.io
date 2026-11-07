// Lesson Markdown to HTML, for the patterns the course content uses:
// paragraphs, **bold**, *italic*, bullet and numbered lists, tables, backslash escapes,
// links [text](url), images ![alt](url "caption"), bare URLs, and checklists "- [ ] item".
// Two course-specific forms:
//   * a paragraph that is only bold text becomes a subheading
//   * a bullet list where every item starts with a bold term ("- **ARV.** ...") becomes term cards:
//     the term in orange, the plain meaning, then "Example:", "On the job:" (any *Label:*) on their own lines
// Arabic: a block wrapped in U+2067...U+2069, or mostly Arabic letters, gets dir="rtl".
// Everything is escaped first, so content can never inject HTML. Links and images are pulled out
// before escaping and rebuilt here; only http(s) and same-site paths are allowed as URLs.
(function(){
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  // Only web links and same-site paths. Anything else (javascript:, data:, etc.) is dropped.
  function safeUrl(u){
    u = String(u || '').trim();
    if (/^https?:\/\//i.test(u)) return u;
    if (/^\/(?!\/)/.test(u)) return u;
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}\//i.test(u)) return 'https://' + u; // codes.ohio.gov/...
    if (/^[\w\-.%~]+(\/[\w\-.%~]+)*$/.test(u) && !/^\.\./.test(u)) return u;    // relative file, no scheme
    return '';
  }
  const linkHtml = (href, text) => '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + text + '</a>';
  function imgHtml(alt, src, title){
    const s = safeUrl(src);
    if (!s) return esc(alt);
    return '<img src="' + esc(s) + '" alt="' + esc(alt) + '"' + (title ? ' title="' + esc(title) + '"' : '') + ' loading="lazy" decoding="async">';
  }

  // Bare URL: with a scheme, with www., or domain.tld/path. Trailing punctuation stays outside the link.
  const BARE = /\b((?:https?:\/\/|www\.)[^\s<]+|(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s<]*)/gi;
  function autolink(s){
    return s.replace(BARE, (m) => {
      let url = m, tail = '';
      while (/[.,;:!?)\]'"]$/.test(url)) { tail = url.slice(-1) + tail; url = url.slice(0, -1); }
      const raw = url.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'); // text is already escaped here
      const href = safeUrl(/^www\./i.test(raw) ? 'https://' + raw : raw);
      return href ? linkHtml(href, url) + tail : m;
    });
  }

  function inline(s){
    const keep = [], html = [];
    const hold = h => '\u0001' + (html.push(h) - 1) + '\u0001';
    s = String(s);
    s = s.replace(/\\([\\`*_{}\[\]()#+\-.!|~>])/g, (m, c) => '\u0000' + (keep.push(c) - 1) + '\u0000');
    // images, then links, before escaping
    s = s.replace(/!\[([^\]]*)\]\(\s*(\S+?)(?:\s+"([^"]*)")?\s*\)/g, (m, alt, src, title) => hold(imgHtml(alt, src, title)));
    s = s.replace(/\[([^\]]+)\]\(\s*(\S+?)\s*\)/g, (m, text, href) => {
      const h = safeUrl(href);
      return h ? hold(linkHtml(h, inlineText(text))) : m;
    });
    s = esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1<em>$2</em>');
    s = autolinkOutsideTags(s);
    s = s.replace(/\u0001(\d+)\u0001/g, (m, i) => html[+i]);
    return s.replace(/\u0000(\d+)\u0000/g, (m, i) => esc(keep[+i]));
  }
  // link text: bold/italic only, no nested links
  const inlineText = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1<em>$2</em>');
  // run autolink only on text between tags, never inside an attribute
  const autolinkOutsideTags = s => s.split(/(<[^>]+>)/).map(p => p.charAt(0) === '<' ? p : autolink(p)).join('');

  // Arabic detection: isolate-wrapped, or more than half of the letters are Arabic.
  const RLI = /⁧[\s\S]*⁩/;
  function isArabic(t){
    t = String(t || '');
    if (RLI.test(t)) return true;
    const ar = (t.match(/[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g) || []).length;
    const lat = (t.match(/[A-Za-z]/g) || []).length;
    return ar > 0 && ar > lat;
  }
  const dirAttr = t => isArabic(t) ? ' dir="rtl" class="rtl"' : '';

  // "**Term.** Meaning. *Example:* ... *On the job:* ..." -> parts
  const TERM = /^\*\*(.+?)\*\*\s*/;
  function termCard(text){
    const m = text.match(TERM);
    const name = m[1].replace(/\.$/, '').replace(/^"(.*)\."$/, '"$1"').replace(/\."$/, '"');
    const rest = text.slice(m[0].length);
    const parts = rest.split(/\*([A-Z][^*]{0,30}?):\*\s*/);
    let html = '<div class="term"' + dirAttr(text) + '><p class="term-name">' + inline(name) + '</p>';
    if (parts[0].trim()) html += '<p class="term-mean">' + inline(parts[0].trim()) + '</p>';
    for (let i = 1; i < parts.length; i += 2) html += '<p class="term-line"><strong>' + esc(parts[i]) + ':</strong> ' + inline((parts[i + 1] || '').trim()) + '</p>';
    return html + '</div>';
  }

  const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.trim());

  function table(lines, n){
    const head = cells(lines[0]), body = lines.slice(2).map(cells);
    return '<div class="table-wrap" role="region" tabindex="0" aria-label="Table ' + n + ', scrolls sideways"><table' + dirAttr(lines.join(' ')) + '><thead><tr>' +
      head.map(h => '<th scope="col">' + inline(h) + '</th>').join('') + '</tr></thead><tbody>' +
      body.map(r => '<tr>' + head.map((h, i) => '<td>' + inline(r[i] || '') + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div>';
  }

  // A paragraph that is only one image becomes a figure; the title becomes the caption under it.
  const FIG = /^!\[([^\]]*)\]\(\s*(\S+?)(?:\s+"([^"]*)")?\s*\)$/;
  function figure(text){
    const m = text.match(FIG);
    const img = imgHtml(m[1], m[2], '');
    if (img.charAt(0) !== '<') return '<p>' + inline(text) + '</p>';
    return '<figure class="md-fig">' + img + (m[3] ? '<figcaption' + dirAttr(m[3]) + '>' + inline(m[3]) + '</figcaption>' : '') + '</figure>';
  }

  // Two images on one line: a before/after pair shown side by side (stacked on phones)
  const IMG1 = '!\\[[^\\]]*\\]\\(\\s*\\S+?(?:\\s+"[^"]*")?\\s*\\)';
  const PAIR = new RegExp('^(' + IMG1 + ')\\s+(' + IMG1 + ')$');
  const CHECK = /^\[( |x|X)\]\s+/;
  function listItem(t){
    const c = t.match(CHECK);
    if (!c) return '<li' + dirAttr(t) + '>' + inline(t) + '</li>';
    const done = c[1] !== ' ', body = t.slice(c[0].length);
    return '<li class="check"' + dirAttr(body) + '><input type="checkbox" disabled' + (done ? ' checked' : '') + ' aria-hidden="true"><span>' + inline(body) + '</span></li>';
  }

  // Call-out boxes (read.css), matched to the labels the lessons already use. Two kinds:
  // 1. A section whose heading is one of these becomes a box holding everything up to the next heading.
  const SECTIONS = [
    [/^بالعربي/, 'ar'], [/^what to remember$/i, 'sum'], [/^(your work for this lesson|the (four )?drills( for this week)?)$/i, 'work'],
    [/^(common mistakes|when to stop and ask|legal flag|compliance)\.?$/i, 'warn'],
    [/^(linda'?s|on linda'?s|example\b|what it looks like)/i, 'case']
  ];
  const sectionKind = t => { const k = SECTIONS.find(s => s[0].test(t.trim())); return k ? k[1] : null; };
  // 2. A paragraph that opens with a bold label ("**Legal flag.** text", "**Tip:** text") becomes a small box.
  const BOXES = { 'your work for this lesson':'work', 'tip':'tip', 'pro tip':'tip', 'watch out':'warn', 'warning':'warn', 'legal flag':'warn', 'compliance':'warn', 'never':'warn',
    'common mistake':'warn', 'the rule':'key', 'rule':'key', 'key point':'key', 'remember':'key', 'example':'case', 'on linda\'s call':'case', 'on linda\'s deal':'case', 'in short':'sum' };
  const BOX = new RegExp('^\\*\\*(' + Object.keys(BOXES).join('|') + ')([.:])\\*\\*\\s+([\\s\\S]+)$', 'i');
  const LINDA_NOTE = /^\*\*(Linda's [^*]{1,40}?)([.:])\*\*\s+([\s\S]+)$/;
  function render(md){
    const lines = String(md || '').replace(/\r/g, '').split('\n');
    const out = [];
    let i = 0, tables = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) { i++; continue; }
      if (/^\s*\|/.test(l) && lines[i + 1] && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        const block = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) block.push(lines[i++]);
        out.push(table(block, ++tables));
        continue;
      }
      if (/^\s*[-*] /.test(l)) {
        const items = [];
        while (i < lines.length && /^\s*[-*] /.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*] /, ''));
        const all = items.join(' ');
        if (items.every(t => TERM.test(t) && /[.?!]"?$/.test(t.match(TERM)[1]))) out.push('<div class="terms">' + items.map(termCard).join('') + '</div>');
        else out.push('<ul' + (items.some(t => CHECK.test(t)) ? ' class="checklist"' : '') + dirAttr(all) + '>' + items.map(listItem).join('') + '</ul>');
        continue;
      }
      if (/^\s*\d+[.)] /.test(l)) {
        const items = [], start = parseInt(l, 10);
        while (i < lines.length && /^\s*\d+[.)] /.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)] /, ''));
        out.push('<ol' + (start !== 1 ? ' start="' + start + '"' : '') + dirAttr(items.join(' ')) + '>' + items.map(t => '<li>' + inline(t) + '</li>').join('') + '</ol>');
        continue;
      }
      if (/^#{1,6} /.test(l)) { out.push({ h:l.replace(/^#+ /, '') }); i++; continue; }
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^\s*([-*] |\d+[.)] |\||#{1,6} )/.test(lines[i])) para.push(lines[i++].trim());
      const text = para.join(' ');
      if (FIG.test(text)) { out.push(figure(text)); continue; }
      const pair = text.match(PAIR);
      if (pair) { out.push('<div class="md-pair">' + figure(pair[1]) + figure(pair[2]) + '</div>'); continue; }
      const bx = text.match(BOX) || text.match(LINDA_NOTE);
      if (bx) { const kind = BOXES[bx[1].toLowerCase().replace(/\s+/g, ' ')] || 'case'; out.push('<div class="box ' + kind + (isArabic(text) ? ' rtl" dir="rtl"' : '"') + '><span class="bl">' + esc(bx[1]) + '</span><p>' + inline(bx[3].charAt(0).toUpperCase() + bx[3].slice(1)) + '</p></div>'); continue; }
      if (/^\*\*[^*]+\*\*$/.test(text)) { out.push({ h:text.slice(2, -2) }); continue; }
      out.push('<p' + dirAttr(text) + '>' + inline(text) + '</p>');
    }
    // headings: plain ones stay headings, labelled ones open a box that runs to the next heading
    const html = []; let open = false;
    out.forEach(b => {
      if (typeof b === 'string') { html.push(b); return; }
      if (open) { html.push('</section>'); open = false; }
      const kind = sectionKind(b.h.replace(/[.:]$/, ''));
      if (kind) { html.push('<section class="box ' + kind + '"' + (isArabic(b.h) ? ' dir="rtl"' : '') + '><h3 class="bl">' + inline(b.h.replace(/[.:]$/, '')) + '</h3>'); open = true; }
      else html.push('<h2' + dirAttr(b.h) + '>' + inline(b.h) + '</h2>');
    });
    if (open) html.push('</section>');
    return html.join('\n');
  }

  window.CourseMarkdown = { render, inline, esc, isArabic };
})();
