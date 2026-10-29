// Small real PDFs (the JS twin of engine/src/Sievphov.Core/Services/SimplePdf.cs): one page per [width, height] in
// points, a black box top-left (shows which way up a page is) and "Page N" in the middle — or, with big, only N, large.
// Used by the tests, and for the sample paper in Manage presets (sample()).
function pdf(pages, { big = false } = {}) {
  const objects = [];
  const kids = pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ');
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pages.forEach(([w, h], i) => {
    const contentId = objects.length + 2;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    const text = big ? String(i + 1) : `Page ${i + 1}`;
    const size = big ? Math.min(w, h) * 0.5 : Math.min(48, w / 6);
    // Helvetica digits are 0.556 em wide; "Page N" is about 2.8 em
    const x = big ? w / 2 - size * 0.278 * text.length : w / 2 - size * 1.4, y = big ? h / 2 - size * 0.36 : h / 2;
    const stream = `0 0 0 rg 0 ${h - 72} 72 72 re f BT /F1 ${size} Tf ${x} ${y} Td (${text}) Tj ET`;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let out = '%PDF-1.4\n';
  const offsets = objects.map((o, i) => { const at = Buffer.byteLength(out); out += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** The sample for Manage presets: 8 A4 pages numbered 1 … 8, upright or wide. → { pageCount, pageSizes, data } */
function sample({ wide = false } = {}) {
  const pageSizes = Array(8).fill(wide ? [842, 595] : [595, 842]);
  return { pageCount: pageSizes.length, pageSizes, data: pdf(pageSizes, { big: true }) };
}

module.exports = { pdf, sample };
