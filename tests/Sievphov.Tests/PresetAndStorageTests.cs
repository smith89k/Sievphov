using Sievphov.Models;
using Sievphov.Services;

namespace Sievphov.Tests;

public class PresetAndStorageTests
{
    private static string TempDir()
    {
        var dir = Path.Combine(Path.GetTempPath(), "sievphov-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        return dir;
    }

    private static (PresetLibrary Lib, Preset A, Preset B) TwoPresets()
    {
        var a = new Preset { Name = "A", Settings = new PrintSettings { PrinterName = "HP 4303", Tray = "Tray 2", Copies = 2 } };
        var b = new Preset { Name = "B", Settings = new PrintSettings { PrinterName = "Tally 1330", Copies = 5 } };
        return (new PresetLibrary { Presets = { a, b }, DefaultPresetId = a.Id }, a, b);
    }

    [Fact]
    public void ApplyEditAndModifiedFlow()
    {
        var (lib, a, _) = TwoPresets();
        var items = Enumerable.Range(1, 5).Select(i => new JobItem { FilePath = $"/x/{i}.pdf" }).ToList();

        // Select 3 of 5 and apply preset A.
        PresetSync.Apply(items.Take(3), a);
        Assert.All(items.Take(3), i => Assert.Equal("A", i.PresetDisplay));
        Assert.All(items.Take(3), i => Assert.Equal("HP 4303", i.Settings.PrinterName));
        Assert.All(items.Take(3), i => Assert.Equal("Tray 2", i.TrayDisplay));
        Assert.All(items.Skip(3), i => Assert.Equal("—", i.PresetDisplay));

        // Each item has its own copy.
        Assert.NotSame(items[0].Settings, items[1].Settings);

        // Change one by hand → shows *.
        var changed = items[2].Settings.Clone();
        changed.Copies = 9;
        PresetSync.SetByHand(items[2], changed, lib);
        Assert.Equal("A *", items[2].PresetDisplay);

        // Edit preset A → the 2 unchanged items follow, the * one does not.
        var edited = lib.Clone();
        edited.Find(a.Id)!.Settings.Copies = 3;
        edited.Find(a.Id)!.Settings.Tray = "Tray 1";
        edited.Find(a.Id)!.Name = "A renamed";
        PresetSync.LibraryChanged(items, edited);
        Assert.Equal(3, items[0].Copies);
        Assert.Equal("Tray 1", items[1].Settings.Tray);
        Assert.Equal(9, items[2].Copies);
        Assert.Equal("A renamed *", items[2].PresetDisplay);
        Assert.Equal("A renamed", items[0].PresetDisplay);

        // Reset to preset clears the *.
        PresetSync.ResetToPreset(items[2], edited);
        Assert.Equal("A renamed", items[2].PresetDisplay);
        Assert.Equal(3, items[2].Copies);

        // Changing back by hand to the same values is not "changed".
        PresetSync.SetByHand(items[1], edited.Find(a.Id)!.Settings, edited);
        Assert.False(items[1].IsModified);

        // Delete the preset → items keep settings but lose the link.
        edited.Presets.RemoveAll(p => p.Id == a.Id);
        PresetSync.LibraryChanged(items, edited);
        Assert.Null(items[0].PresetId);
        Assert.Equal(3, items[0].Copies);
        Assert.Equal("(own settings)", items[0].PresetDisplay);
    }

    [Fact]
    public void PresetsSurviveRestart()
    {
        var dir = TempDir();
        var store = new Storage(dir);
        var lib = store.LoadPresets(); // first run: starter presets
        Assert.NotEmpty(lib.Presets);
        Assert.NotNull(lib.Default);

        lib.Presets.Add(new Preset { Name = "Label – Tally 5 copies", Settings = new PrintSettings { Copies = 5, Tray = "Manual feed" } });
        store.SavePresets(lib);

        var again = new Storage(dir).LoadPresets();
        var label = again.FindByName("label – tally 5 copies");
        Assert.NotNull(label);
        Assert.Equal("Manual feed", label!.Settings.Tray);
        Assert.Equal(lib.DefaultPresetId, again.DefaultPresetId);
    }

    [Fact]
    public void BrokenPresetsFileIsKept()
    {
        var dir = TempDir();
        File.WriteAllText(Path.Combine(dir, "presets.json"), "{ not json");
        new Storage(dir).LoadPresets();
        Assert.Single(Directory.GetFiles(dir, "presets.unreadable-*.json"));
    }

    [Fact]
    public void ExportImportRenamesDuplicates()
    {
        var (lib, a, b) = TwoPresets();
        var path = Path.Combine(TempDir(), "mine" + Storage.PresetExtension);
        Storage.ExportPresets(path, new[] { a, b });

        int n = Storage.ImportPresets(path, lib);
        Assert.Equal(2, n);
        Assert.Equal(new[] { "A", "B", "A (2)", "B (2)" }, lib.Presets.Select(p => p.Name));
        Assert.Equal(4, lib.Presets.Select(p => p.Id).Distinct().Count());
    }

    [Fact]
    public void JobSaveOpenKeepsEveryFilesSettings()
    {
        var dir = TempDir();
        var pdf1 = Path.Combine(dir, "សៀវភៅ ១.pdf");
        var pdf2 = Path.Combine(dir, "Invoice.pdf");
        File.WriteAllBytes(pdf1, SimplePdf.Create((595, 842)));
        File.WriteAllBytes(pdf2, SimplePdf.Create((595, 842)));

        var items = new[]
        {
            new JobItem { FilePath = pdf1, PresetId = "p1", PresetName = "Book", Settings = new PrintSettings { Layout = LayoutMode.Booklet, Tray = "Tray 3" } },
            new JobItem { FilePath = pdf2, IsChecked = false, IsModified = true, Settings = new PrintSettings { Copies = 4, PageRange = "1-last", Pages = PageSelection.Range } },
        };
        var jobPath = Path.Combine(dir, "today" + JobFile.Extension);
        Storage.SaveJob(jobPath, items);

        var job = Storage.LoadJob(jobPath);
        Assert.Equal(2, job.Items.Count);
        Assert.Equal(pdf1, job.Items[0].FilePath);
        Assert.Equal(LayoutMode.Booklet, job.Items[0].Settings.Layout);
        Assert.Equal("Tray 3", job.Items[0].Settings.Tray);
        Assert.Equal("Book", job.Items[0].PresetName);
        Assert.False(job.Items[1].Checked);
        Assert.True(job.Items[1].Modified);
        Assert.Equal(4, job.Items[1].Settings.Copies);
        Assert.Contains("\"Booklet\"", File.ReadAllText(jobPath)); // enums saved as words
    }

    [Fact]
    public void JobFindsFilesAfterFolderMoved()
    {
        var dir = TempDir();
        var pdf = Path.Combine(dir, "a.pdf");
        File.WriteAllBytes(pdf, SimplePdf.Create((595, 842)));
        Storage.SaveJob(Path.Combine(dir, "j.svpv"), new[] { new JobItem { FilePath = pdf } });

        var moved = dir + "-moved";
        Directory.Move(dir, moved);
        var job = Storage.LoadJob(Path.Combine(moved, "j.svpv"));
        Assert.Equal(Path.Combine(moved, "a.pdf"), job.Items[0].FilePath);
    }

    [Fact]
    public void ReportCsvQuotesAndHasBom()
    {
        var path = Path.Combine(TempDir(), "r.csv");
        Storage.WriteReportCsv(path, new[] { new ReportRow { FileName = "a, b.pdf", Status = "Printed", Pages = 3 } });
        var bytes = File.ReadAllBytes(path);
        Assert.Equal(new byte[] { 0xEF, 0xBB, 0xBF }, bytes[..3]);
        Assert.Contains("\"a, b.pdf\"", File.ReadAllText(path));
    }

    [Fact]
    public void MacrosAndKhmerDigits()
    {
        var now = new DateTime(2026, 10, 19, 14, 5, 0);
        Assert.Equal("Book.pdf – 3/10 – 19/10/2026", Macros.Expand("{filename} – {page}/{pages} – {date}", "/x/Book.pdf", 3, 10, now: now));
        Assert.Equal("ទំព័រ ១២", Macros.Expand("ទំព័រ {page}", "/x/a.pdf", 12, 20, DigitStyle.Khmer));

        var p = new PageNumberSettings { StartAt = -1, Format = "{page} / {pages}" };
        Assert.Null(Macros.PageNumberText(p, "a.pdf", 2, 10));        // cover pages: no number
        Assert.Equal("1 / 8", Macros.PageNumberText(p, "a.pdf", 3, 10));
    }

    [Fact]
    public void SettingsCloneIsDeep()
    {
        var s = new PrintSettings { Tray = "Tray 2" };
        s.Watermark.Text = "សាកល្បង";
        var c = s.Clone();
        c.Watermark.Text = "other";
        Assert.Equal("សាកល្បង", s.Watermark.Text);
        Assert.True(s.ContentEquals(s.Clone()));
        Assert.False(s.ContentEquals(c));
    }
}
