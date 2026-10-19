using System.Text;

namespace Sievphov.Tests;

/// <summary>Writes small real PDF files for tests.</summary>
public static class TestPdf
{
    /// <summary>A PDF with one page per size (in points); each page shows a black box in its top-left corner.</summary>
    public static byte[] Create(params (float W, float H)[] pages)
    {
        var objects = new List<string>();
        // 1 = catalog, 2 = pages, then per page: page object + content stream.
        var kids = string.Join(" ", pages.Select((_, i) => $"{3 + i * 2} 0 R"));
        objects.Add("<< /Type /Catalog /Pages 2 0 R >>");
        objects.Add($"<< /Type /Pages /Kids [{kids}] /Count {pages.Length} >>");
        foreach (var (w, h) in pages)
        {
            int contentId = objects.Count + 2; // page object is objects.Count + 1
            objects.Add($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {w} {h}] /Contents {contentId} 0 R >>");
            var stream = $"0 0 0 rg 0 {h - 72} 72 72 re f";
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

    public static string WriteTemp(byte[] pdf, string name = "test.pdf")
    {
        var dir = Path.Combine(Path.GetTempPath(), "sievphov-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, name);
        File.WriteAllBytes(path, pdf);
        return path;
    }
}
