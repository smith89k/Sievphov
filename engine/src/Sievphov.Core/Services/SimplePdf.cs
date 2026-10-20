using System.Text;

namespace Sievphov.Services;

/// <summary>Writes small real PDF files (for tests and the self-test).</summary>
public static class SimplePdf
{
    /// <summary>
    /// A PDF with one page per size (in points). Each page has a black box in its top-left corner
    /// and its page number written large in the middle.
    /// </summary>
    public static byte[] Create(params (float W, float H)[] pages)
    {
        var objects = new List<string>();
        // 1 = catalog, 2 = pages, 3 = font, then per page: page object + content stream.
        var kids = string.Join(" ", pages.Select((_, i) => $"{4 + i * 2} 0 R"));
        objects.Add("<< /Type /Catalog /Pages 2 0 R >>");
        objects.Add($"<< /Type /Pages /Kids [{kids}] /Count {pages.Length} >>");
        objects.Add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
        for (int i = 0; i < pages.Length; i++)
        {
            var (w, h) = pages[i];
            int contentId = objects.Count + 2; // page object is objects.Count + 1
            objects.Add($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {F(w)} {F(h)}] /Resources << /Font << /F1 3 0 R >> >> /Contents {contentId} 0 R >>");
            float size = Math.Min(48, w / 6);
            var stream = $"0 0 0 rg 0 {F(h - 72)} 72 72 re f BT /F1 {F(size)} Tf {F(w / 2 - size * 1.4f)} {F(h / 2)} Td (Page {i + 1}) Tj ET";
            objects.Add($"<< /Length {stream.Length} >>\nstream\n{stream}\nendstream");
        }

        var sb = new StringBuilder("%PDF-1.4\n");
        var offsets = new List<int>();
        for (int i = 0; i < objects.Count; i++)
        {
            offsets.Add(Encoding.ASCII.GetByteCount(sb.ToString()));
            sb.Append($"{i + 1} 0 obj\n{objects[i]}\nendobj\n");
        }
        int xref = Encoding.ASCII.GetByteCount(sb.ToString());
        sb.Append($"xref\n0 {objects.Count + 1}\n0000000000 65535 f \n");
        foreach (var o in offsets) sb.Append($"{o:D10} 00000 n \n");
        sb.Append($"trailer\n<< /Size {objects.Count + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");
        return Encoding.ASCII.GetBytes(sb.ToString());
    }

    private static string F(float v) => v.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture);

    public static string WriteTemp(byte[] pdf, string name = "test.pdf")
    {
        var dir = Path.Combine(Path.GetTempPath(), "sievphov-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, name);
        File.WriteAllBytes(path, pdf);
        return path;
    }
}
