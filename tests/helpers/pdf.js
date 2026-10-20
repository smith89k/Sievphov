// Small real PDFs for tests (the JS twin of engine/src/Sievphov.Core/Services/SimplePdf.cs):
// one page per [width, height] in points, a black box top-left and "Page N" in the middle.
function pdf(pages) {
  const objects = [];
  const kids = pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ');
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pages.forEach(([w, h], i) => {
    const contentId = objects.length + 2;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    const size = Math.min(48, w / 6);
    const stream = `0 0 0 rg 0 ${h - 72} 72 72 re f BT /F1 ${size} Tf ${w / 2 - size * 1.4} ${h / 2} Td (Page ${i + 1}) Tj ET`;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let out = '%PDF-1.4\n';
  const offsets = objects.map((o, i) => { const at = Buffer.byteLength(out); out += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
module.exports = { pdf };
