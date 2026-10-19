using Sievphov.Models;

namespace Sievphov.Services;

/// <summary>Keeps files in the list in step with the presets they use.</summary>
public static class PresetSync
{
    /// <summary>Gives every item a copy of the preset's settings and links it to the preset.</summary>
    public static void Apply(IEnumerable<JobItem> items, Preset preset)
    {
        foreach (var item in items)
        {
            item.PresetId = preset.Id;
            item.PresetName = preset.Name;
            item.IsModified = false;
            item.Settings = preset.Settings.Clone();
        }
    }

    /// <summary>Settings changed by hand: the item keeps its preset link and is marked * if it now differs.</summary>
    public static void SetByHand(JobItem item, PrintSettings settings, PresetLibrary library)
    {
        item.Settings = settings.Clone();
        var preset = library.Find(item.PresetId);
        if (preset is null)
        {
            item.PresetId = null;
            item.PresetName = null;
            item.IsModified = true;
        }
        else
        {
            item.IsModified = !settings.ContentEquals(preset.Settings);
        }
    }

    /// <summary>Puts the item back to exactly its preset's settings.</summary>
    public static void ResetToPreset(JobItem item, PresetLibrary library)
    {
        var preset = library.Find(item.PresetId);
        if (preset is not null) Apply(new[] { item }, preset);
    }

    /// <summary>
    /// After presets were edited, renamed or deleted: unchanged items (no *) take the new settings,
    /// changed items keep theirs, renamed presets show their new name, deleted ones are unlinked.
    /// </summary>
    public static void LibraryChanged(IEnumerable<JobItem> items, PresetLibrary library)
    {
        foreach (var item in items)
        {
            if (item.PresetId is null) continue;
            var preset = library.Find(item.PresetId);
            if (preset is null)
            {
                item.PresetId = null;
                item.PresetName = null;
                item.IsModified = true;
                continue;
            }
            item.PresetName = preset.Name;
            if (!item.IsModified)
            {
                if (!item.Settings.ContentEquals(preset.Settings)) item.Settings = preset.Settings.Clone();
            }
            else
            {
                item.IsModified = !item.Settings.ContentEquals(preset.Settings);
            }
        }
    }
}
