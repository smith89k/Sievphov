using System.Text;
using System.Text.Json;
using Sievphov.Models;

namespace Sievphov.Services;

/// <summary>Reads and writes the app's JSON files.</summary>
public sealed class Storage
{
    public const string PresetExtension = ".svpreset";

    public Storage(string folder)
    {
        Folder = folder;
    }

    /// <summary>%AppData%\Sievphov</summary>
    public static Storage ForCurrentUser() =>
        new(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Sievphov"));

    public string Folder { get; }
    private string PresetsPath => Path.Combine(Folder, "presets.json");
    private string SettingsPath => Path.Combine(Folder, "settings.json");

    public PresetLibrary LoadPresets()
    {
        var lib = Read<PresetLibrary>(PresetsPath);
        if (lib is null)
        {
            // Keep an unreadable file instead of overwriting the user's presets.
            if (File.Exists(PresetsPath))
                File.Copy(PresetsPath, Path.Combine(Folder, $"presets.unreadable-{DateTime.Now:yyyyMMdd-HHmmss}.json"), overwrite: true);
            lib = PresetLibrary.CreateStarter();
            SavePresets(lib);
        }
        return lib;
    }

    public void SavePresets(PresetLibrary library) => Write(PresetsPath, library);

    public AppSettings LoadSettings() => Read<AppSettings>(SettingsPath) ?? new AppSettings();
    public void SaveSettings(AppSettings settings) => Write(SettingsPath, settings);

    public static void ExportPresets(string path, IEnumerable<Preset> presets) =>
        Write(path, new PresetLibrary { Presets = presets.Select(p => p.Clone()).ToList() });

    /// <summary>Adds the presets in <paramref name="path"/> to <paramref name="library"/>; returns how many.</summary>
    public static int ImportPresets(string path, PresetLibrary library)
    {
        var imported = Read<PresetLibrary>(path) ?? throw new InvalidDataException("This is not a presets file.");
        foreach (var p in imported.Presets)
        {
            var copy = p.Clone();
            if (library.Find(copy.Id) is not null) copy.Id = Guid.NewGuid().ToString("N");
            copy.Name = library.UniqueName(string.IsNullOrWhiteSpace(copy.Name) ? "Imported" : copy.Name);
            library.Presets.Add(copy);
        }
        return imported.Presets.Count;
    }

    public static void SaveJob(string path, IEnumerable<JobItem> items)
    {
        var dir = Path.GetDirectoryName(Path.GetFullPath(path))!;
        var job = new JobFile
        {
            Items = items.Select(i => new JobEntry
            {
                FilePath = i.FilePath,
                RelativePath = Path.GetRelativePath(dir, i.FilePath),
                Checked = i.IsChecked,
                PresetId = i.PresetId,
                PresetName = i.PresetName,
                Modified = i.IsModified,
                Settings = i.Settings.Clone(),
            }).ToList(),
        };
        Write(path, job);
    }

    /// <summary>Reads a job file. File paths are fixed up when the job was moved with its PDFs.</summary>
    public static JobFile LoadJob(string path)
    {
        var job = Read<JobFile>(path) ?? throw new InvalidDataException("This is not a Sievphov job file.");
        var dir = Path.GetDirectoryName(Path.GetFullPath(path))!;
        foreach (var e in job.Items)
        {
            if (!File.Exists(e.FilePath) && e.RelativePath is not null)
            {
                var rel = Path.GetFullPath(Path.Combine(dir, e.RelativePath));
                if (File.Exists(rel)) e.FilePath = rel;
            }
        }
        return job;
    }

    /// <summary>CSV that opens in Excel (UTF-8 with BOM so Khmer names show correctly).</summary>
    public static void WriteReportCsv(string path, IEnumerable<ReportRow> rows)
    {
        var sb = new StringBuilder();
        sb.AppendLine("File,Folder,Printer,Preset,Status,Message,Pages,Sheets,Copies,Started,Finished");
        foreach (var r in rows)
        {
            sb.AppendLine(string.Join(",", new[]
            {
                r.FileName, r.Folder, r.Printer, r.Preset, r.Status, r.Message,
                r.Pages.ToString(), r.Sheets.ToString(), r.Copies.ToString(),
                r.Started == default ? "" : r.Started.ToString("yyyy-MM-dd HH:mm:ss"),
                r.Finished == default ? "" : r.Finished.ToString("yyyy-MM-dd HH:mm:ss"),
            }.Select(Csv)));
        }
        File.WriteAllText(path, sb.ToString(), new UTF8Encoding(true));
    }

    private static string Csv(string v) =>
        v.IndexOfAny(new[] { ',', '"', '\n', '\r' }) >= 0 ? "\"" + v.Replace("\"", "\"\"") + "\"" : v;

    private static T? Read<T>(string path) where T : class
    {
        if (!File.Exists(path)) return null;
        try
        {
            return JsonSerializer.Deserialize<T>(File.ReadAllText(path), Json.Options);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static void Write<T>(string path, T value)
    {
        var dir = Path.GetDirectoryName(Path.GetFullPath(path));
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
        // Write to a temp file first so a crash never leaves a half-written file.
        var tmp = path + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(value, Json.Options), new UTF8Encoding(false));
        File.Move(tmp, path, overwrite: true);
    }
}
