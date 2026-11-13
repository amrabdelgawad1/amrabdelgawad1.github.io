// Fills {fields} in a Word (.docx) file in the browser and gives back a new .docx with the layout untouched.
// No library: a .docx is a zip, read and written here with the browser's own (De)CompressionStream.
//   const doc = await DocxFill.read(arrayBuffer)
//   DocxFill.fields(doc)            -> { fields:['seller_name', ...], odd:['{Seller Name!}', ...] }  in order of first use
//   await DocxFill.fill(doc, fn)    -> Blob (.docx). fn(key) returns the text for {key}
// Word often splits one {field} over several runs (spell check, autocorrect, formatting), so fields are found per
// paragraph across runs, and the value goes into the run where the field starts. Formatting of that run is kept.
// Field names: letters, numbers, spaces and underscores, any case. {Seller Name} and {seller_name} are the same field.
(function (root) {
  'use strict';
  const te = new TextEncoder(), td = new TextDecoder();
  const PARTS = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;
  const FIELD = /\{\s*([A-Za-z][A-Za-z0-9_ ]{0,58}?)\s*\}/g;
  const keyOf = s => s.trim().toLowerCase().replace(/\s+/g, '_');

  // ---------- zip ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  async function pipe(u8, stream){ const r = new Blob([u8]).stream().pipeThrough(stream); return new Uint8Array(await new Response(r).arrayBuffer()); }
  const inflate = u8 => pipe(u8, new DecompressionStream('deflate-raw'));
  const deflate = u8 => pipe(u8, new CompressionStream('deflate-raw'));

  async function read(buf){
    const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('not a Word file');
    const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
    if (p === 0xFFFFFFFF) throw new Error('this Word file is too large');
    const entries = [];
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('damaged Word file');
      const flag = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true), time = dv.getUint16(p + 12, true), date = dv.getUint16(p + 14, true);
      const csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true), name = td.decode(u8.subarray(p + 46, p + 46 + nlen));
      if (flag & 1) throw new Error('this Word file is password protected');
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), raw = u8.subarray(start, start + csize);
      if (method !== 0 && method !== 8) throw new Error('unsupported Word file');
      entries.push({ name, flag:flag & 0x0800, time, date, data:method === 8 ? await inflate(raw) : raw.slice() });
      p += 46 + nlen + xlen + clen;
    }
    if (!entries.some(e => e.name === 'word/document.xml')) throw new Error('not a Word file (no document inside)');
    return { entries };
  }

  async function write(doc){
    const files = [], central = []; let off = 0;
    for (const e of doc.entries) {
      const name = te.encode(e.name), data = e.data, crc = crc32(data), z = data.length > 64 ? await deflate(data) : null;
      const method = z && z.length < data.length ? 8 : 0, body = method ? z : data;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, e.flag, true); h.setUint16(8, method, true);
      h.setUint16(10, e.time, true); h.setUint16(12, e.date, true); h.setUint32(14, crc, true); h.setUint32(18, body.length, true);
      h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, e.flag, true); c.setUint16(10, method, true);
      c.setUint16(12, e.time, true); c.setUint16(14, e.date, true); c.setUint32(16, crc, true); c.setUint32(20, body.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      files.push(new Uint8Array(h.buffer), name, body); central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + body.length;
    }
    const csize = central.reduce((a, x) => a + x.length, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, doc.entries.length, true); end.setUint16(10, doc.entries.length, true);
    end.setUint32(12, csize, true); end.setUint32(16, off, true);
    return new Blob(files.concat(central, [new Uint8Array(end.buffer)]), { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  // ---------- text runs ----------
  // Splits a part into paragraph segments of <w:t> nodes. Any paragraph start or end closes a segment, so text in a
  // text box (a paragraph inside a paragraph) never joins the text around it.
  const TOKEN = /<w:t(\s[^>]*)?>([^<]*)<\/w:t>|<w:p[\s>]|<\/w:p>/g;
  function segments(xml){
    const out = []; let cur = [];
    for (const m of xml.matchAll(TOKEN)) {
      if (m[0][1] !== 'w' || m[0].slice(0, 4) !== '<w:t') { if (cur.length) out.push(cur); cur = []; continue; }
      const open = m[0].indexOf('>') + 1;
      cur.push({ at:m.index, open:m[0].slice(0, open), text:m[2], len:m[0].length });
    }
    if (cur.length) out.push(cur);
    return out;
  }
  const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function fields(doc){
    const seen = [], odd = [];
    doc.entries.filter(e => PARTS.test(e.name)).forEach(e => {
      segments(td.decode(e.data)).forEach(seg => {
        const s = unesc(seg.map(n => n.text).join(''));
        for (const m of s.matchAll(FIELD)) { const k = keyOf(m[1]); if (!seen.includes(k)) seen.push(k); }
        for (const m of s.matchAll(/\{[^{}]{1,60}\}/g)) if (!new RegExp('^' + FIELD.source + '$').test(m[0]) && !odd.includes(m[0])) odd.push(m[0]);
      });
    });
    return { fields:seen, odd };
  }

  // The new text for one segment: every {field} replaced, the value placed in the node where the field starts.
  function fillSegment(seg, fn){
    const texts = seg.map(n => n.text), S = texts.join('');
    // Matching runs on the escaped text: field names and braces never contain & or <, so positions stay exact.
    const ms = [...S.matchAll(FIELD)].map(m => ({ a:m.index, b:m.index + m[0].length, v:fn(keyOf(m[1])) }));
    if (!ms.length) return null;
    const out = texts.map(() => ''); let g = 0, mi = 0;
    texts.forEach((t, i) => {
      for (let j = 0; j < t.length; j++, g++) {
        while (mi < ms.length && g >= ms[mi].b) mi++;
        const m = ms[mi];
        if (m && g >= m.a && g < m.b) { if (g === m.a) out[i] += m.v == null ? '' : esc(m.v).replace(/\r?\n/g, '</w:t><w:br/><w:t xml:space="preserve">'); }
        else out[i] += t[j];
      }
    });
    return out;
  }

  async function fill(doc, fn){
    const entries = doc.entries.map(e => {
      if (!PARTS.test(e.name)) return e;
      let xml = td.decode(e.data); const edits = [];
      segments(xml).forEach(seg => { const out = fillSegment(seg, fn); if (out) seg.forEach((n, i) => { if (out[i] !== n.text) edits.push({ n, text:out[i] }); }); });
      if (!edits.length) return e;
      edits.sort((x, y) => y.n.at - x.n.at).forEach(({ n, text }) => {
        const open = /xml:space=/.test(n.open) ? n.open : n.open.replace(/^<w:t/, '<w:t xml:space="preserve"');
        xml = xml.slice(0, n.at) + open + text + '</w:t>' + xml.slice(n.at + n.len);
      });
      return Object.assign({}, e, { data:te.encode(xml) });
    });
    return write({ entries });
  }

  root.DocxFill = { read, fields, fill, keyOf };
})(typeof window !== 'undefined' ? window : globalThis);
