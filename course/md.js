// Lesson Markdown to HTML, for the patterns the course content uses:
// paragraphs, **bold**, *italic*, bullet and numbered lists, tables, backslash escapes.
// Two course-specific forms:
//   * a paragraph that is only bold text becomes a subheading
//   * a bullet list where every item starts with a bold term ("- **ARV.** ...") becomes term cards:
//     the term in orange, the plain meaning, then "Example:", "On the job:" (any *Label:*) on their own lines
// Everything is escaped first, so content can never inject HTML.
(function(){
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  function inline(s){
    const keep = [];
    s = s.replace(/\\([\\`*_{}\[\]()#+\-.!|~>])/g, (m, c) => '\u0000' + (keep.push(c) - 1) + '\u0000');
    s = esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1<em>$2</em>');
    return s.replace(/\u0000(\d+)\u0000/g, (m, i) => esc(keep[+i]));
  }

  // "**Term.** Meaning. *Example:* ... *On the job:* ..." -> parts
  const TERM = /^\*\*(.+?)\*\*\s*/;
  function termCard(text){
    const m = text.match(TERM);
    const name = m[1].replace(/\.$/, '').replace(/^"(.*)\."$/, '"$1"').replace(/\."$/, '"');
    const rest = text.slice(m[0].length);
    const parts = rest.split(/\*([A-Z][^*]{0,30}?):\*\s*/);
    let html = '<div class="term"><p class="term-name">' + inline(name) + '</p>';
    if (parts[0].trim()) html += '<p class="term-mean">' + inline(parts[0].trim()) + '</p>';
    for (let i = 1; i < parts.length; i += 2) html += '<p class="term-line"><strong>' + esc(parts[i]) + ':</strong> ' + inline((parts[i + 1] || '').trim()) + '</p>';
    return html + '</div>';
  }

  const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.trim());

  function table(lines, n){
    const head = cells(lines[0]), body = lines.slice(2).map(cells);
    return '<div class="table-wrap" role="region" tabindex="0" aria-label="Table ' + n + ', scrolls sideways"><table><thead><tr>' +
      head.map(h => '<th scope="col">' + inline(h) + '</th>').join('') + '</tr></thead><tbody>' +
      body.map(r => '<tr>' + head.map((h, i) => '<td>' + inline(r[i] || '') + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div>';
  }

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
        out.push(items.every(t => TERM.test(t) && /[.?!]"?$/.test(t.match(TERM)[1]))
          ? '<div class="terms">' + items.map(termCard).join('') + '</div>'
          : '<ul>' + items.map(t => '<li>' + inline(t) + '</li>').join('') + '</ul>');
        continue;
      }
      if (/^\s*\d+[.)] /.test(l)) {
        const items = [], start = parseInt(l, 10);
        while (i < lines.length && /^\s*\d+[.)] /.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)] /, ''));
        out.push('<ol' + (start !== 1 ? ' start="' + start + '"' : '') + '>' + items.map(t => '<li>' + inline(t) + '</li>').join('') + '</ol>');
        continue;
      }
      if (/^#{1,6} /.test(l)) { out.push('<h2>' + inline(l.replace(/^#+ /, '')) + '</h2>'); i++; continue; }
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^\s*([-*] |\d+[.)] |\||#{1,6} )/.test(lines[i])) para.push(lines[i++].trim());
      const text = para.join(' ');
      out.push(/^\*\*[^*]+\*\*$/.test(text) ? '<h2>' + inline(text.slice(2, -2)) + '</h2>' : '<p>' + inline(text) + '</p>');
    }
    return out.join('\n');
  }

  window.CourseMarkdown = { render, inline, esc };
})();
