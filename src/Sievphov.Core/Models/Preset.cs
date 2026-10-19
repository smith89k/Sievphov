namespace Sievphov.Models;

/// <summary>A saved, named set of print settings.</summary>
public sealed class Preset
{
    /// <summary>Stays the same when the preset is renamed, so files keep their link to it.</summary>
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = "";
    public PrintSettings Settings { get; set; } = new();

    public Preset Clone() => new() { Id = Id, Name = Name, Settings = Settings.Clone() };
}

public sealed class PresetLibrary
{
    public string? DefaultPresetId { get; set; }
    public List<Preset> Presets { get; set; } = new();

    public Preset? Find(string? id) => id is null ? null : Presets.FirstOrDefault(p => p.Id == id);

    public Preset? FindByName(string? name) =>
        name is null ? null : Presets.FirstOrDefault(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase));

    public Preset? Default => Find(DefaultPresetId);

    public PresetLibrary Clone() => new()
    {
        DefaultPresetId = DefaultPresetId,
        Presets = Presets.Select(p => p.Clone()).ToList(),
    };

    /// <summary>Returns <paramref name="name"/>, or "name (2)", "name (3)"… if it is taken.</summary>
    public string UniqueName(string name, Preset? except = null)
    {
        bool Taken(string n) => Presets.Any(p => p != except && string.Equals(p.Name, n, StringComparison.OrdinalIgnoreCase));
        if (!Taken(name)) return name;
        for (int i = 2; ; i++)
        {
            var candidate = $"{name} ({i})";
            if (!Taken(candidate)) return candidate;
        }
    }

    /// <summary>Presets a new installation starts with.</summary>
    public static PresetLibrary CreateStarter()
    {
        var normal = new Preset { Name = "Normal – 1 side" };
        var duplex = new Preset { Name = "Both sides (long edge)", Settings = new PrintSettings { Sides = SidesMode.LongEdge } };
        var booklet = new Preset
        {
            Name = "Book – booklet 2-sided",
            Settings = new PrintSettings
            {
                Layout = LayoutMode.Booklet,
                Sides = SidesMode.ShortEdge,
                Orientation = OrientationMode.Landscape,
            },
        };
        return new PresetLibrary { DefaultPresetId = normal.Id, Presets = { normal, duplex, booklet } };
    }
}
