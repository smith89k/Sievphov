using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using Microsoft.Win32;
using Sievphov.Models;
using Sievphov.Printing;
using Sievphov.Services;
using Sievphov.Views;

namespace Sievphov;

public partial class MainWindow : Window
{
    public const string AppTitle = "Sievphov – សៀវភៅ";

    private readonly Storage _storage = Storage.ForCurrentUser();
    private readonly ObservableCollection<JobItem> _items = new();
    private readonly PrintEngine _engine;
    private PresetLibrary _library;
    private readonly AppSettings _app;
    private PrintSettings? _clipboard;
    private string? _jobPath;
    private bool _printing;
    private bool _busyAdding;

    public MainWindow(IReadOnlyList<string> startupFiles)
    {
        InitializeComponent();
        _library = _storage.LoadPresets();
        _app = _storage.LoadSettings();
        _engine = new PrintEngine(Dispatcher);
        _engine.Progress += (text, fraction) => Dispatcher.BeginInvoke(() =>
        {
            ProgressText.Text = text;
            Progress.Value = fraction;
        });

        Grid.ItemsSource = _items;
        _items.CollectionChanged += (_, e) =>
        {
            if (e.NewItems is not null)
                foreach (JobItem i in e.NewItems) i.PropertyChanged += Item_PropertyChanged;
            if (e.OldItems is not null)
                foreach (JobItem i in e.OldItems) i.PropertyChanged -= Item_PropertyChanged;
            UpdateSummary();
            RenumberRows();
        };

        RefreshPresetBox(_library.Default);
        AfterPrintBox.SelectedIndex = (int)_app.AfterPrint;
        AfterPrintFolderBox.Text = _app.AfterPrintFolder;
        UpdateAfterPrintControls();

        Grid.Drop += Window_Drop;
        Drop += Window_Drop;
        DragOver += Window_DragOver;
        Grid.DragOver += Window_DragOver;
        PreviewKeyDown += Window_PreviewKeyDown;
        Closing += Window_Closing;

        UpdateSummary();
        UpdateTitle();
        if (startupFiles.Count > 0)
            Loaded += async (_, _) => await OpenPathsAsync(startupFiles);
    }

    // ------------------------------------------------------------------ helpers

    private List<JobItem> SelectedItems() =>
        Grid.Items.Cast<JobItem>().Where(i => Grid.SelectedItems.Contains(i)).ToList(); // in the order shown

    private List<JobItem> ItemsInShownOrder() => Grid.Items.Cast<JobItem>().ToList();

    private bool NeedSelection(out List<JobItem> selected)
    {
        selected = SelectedItems();
        if (selected.Count > 0) return true;
        MessageBox.Show(this, "Select one or more files in the list first.\n(Click, Ctrl+click, Shift+click or Ctrl+A.)", AppTitle);
        return false;
    }

    private bool NotWhilePrinting()
    {
        if (!_printing) return true;
        MessageBox.Show(this, "Please wait until printing has finished (or press Stop).", AppTitle);
        return false;
    }

    private void Item_PropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName is nameof(JobItem.IsChecked) or nameof(JobItem.Settings) or nameof(JobItem.Copies) or null or "")
            UpdateSummary();
    }

    private void UpdateSummary()
    {
        var ticked = _items.Where(i => i.IsChecked && i.PageCount > 0).ToList();
        int pages = 0, sheets = 0;
        foreach (var i in ticked)
        {
            var e = Estimator.ForItem(i.Settings, i.PageCount);
            pages += e.PagesPrinted;
            sheets += e.Sheets;
        }
        SummaryText.Text = $"{ticked.Count} files · {pages} pages · about {sheets} sheets";
        EmptyHint.Visibility = _items.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
    }

    private void RenumberRows()
    {
        for (int i = 0; i < Grid.Items.Count; i++)
            if (Grid.ItemContainerGenerator.ContainerFromIndex(i) is DataGridRow row)
                row.Header = (i + 1).ToString();
    }

    private void Grid_LoadingRow(object? sender, DataGridRowEventArgs e) => e.Row.Header = (e.Row.GetIndex() + 1).ToString();

    private void Grid_Sorting(object sender, DataGridSortingEventArgs e)
    {
        if (_printing) { e.Handled = true; return; }
        Dispatcher.BeginInvoke(RenumberRows, System.Windows.Threading.DispatcherPriority.Background);
    }

    private void UpdateTitle() =>
        Title = _jobPath is null ? AppTitle : $"{Path.GetFileNameWithoutExtension(_jobPath)} – {AppTitle}";

    private void RefreshPresetBox(Preset? select)
    {
        var id = (select ?? PresetBox.SelectedItem as Preset)?.Id;
        PresetBox.ItemsSource = null;
        PresetBox.ItemsSource = _library.Presets;
        PresetBox.SelectedItem = _library.Find(id) ?? _library.Default ?? _library.Presets.FirstOrDefault();
    }

    private void SavePresets()
    {
        try
        {
            _storage.SavePresets(_library);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, "Could not save presets: " + ex.Message, AppTitle, MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void SaveAppSettings()
    {
        try
        {
            _storage.SaveSettings(_app);
        }
        catch
        {
            // Not worth bothering the user about.
        }
    }

    // ------------------------------------------------------------------ adding files

    private void AddFiles_Click(object sender, RoutedEventArgs e)
    {
        if (!NotWhilePrinting()) return;
        var dlg = new OpenFileDialog
        {
            Filter = "PDF files|*.pdf",
            Multiselect = true,
            InitialDirectory = Directory.Exists(_app.LastFolder) ? _app.LastFolder : "",
        };
        if (dlg.ShowDialog(this) != true) return;
        _app.LastFolder = Path.GetDirectoryName(dlg.FileNames[0]);
        _ = AddPdfsAsync(dlg.FileNames, null);
    }

    private void AddFolder_Click(object sender, RoutedEventArgs e)
    {
        if (!NotWhilePrinting()) return;
        var dlg = new OpenFolderDialog { InitialDirectory = Directory.Exists(_app.LastFolder) ? _app.LastFolder : "" };
        if (dlg.ShowDialog(this) != true) return;
        _app.LastFolder = dlg.FolderName;

        var options = AddFolderOptions.Ask(this, dlg.FolderName, _app.IncludeSubfolders, _library, PresetBox.SelectedItem as Preset ?? _library.Default);
        if (options is null) return;
        _app.IncludeSubfolders = options.Value.Subfolders;
        _ = AddPdfsAsync(FindPdfs(dlg.FolderName, options.Value.Subfolders), options.Value.Preset);
    }

    private static IEnumerable<string> FindPdfs(string folder, bool subfolders)
    {
        try
        {
            return Directory.EnumerateFiles(folder, "*.pdf", new EnumerationOptions
            {
                RecurseSubdirectories = subfolders,
                IgnoreInaccessible = true,
                MatchCasing = MatchCasing.CaseInsensitive,
            }).OrderBy(p => p, StringComparer.CurrentCultureIgnoreCase).ToList();
        }
        catch
        {
            return Array.Empty<string>();
        }
    }

    /// <summary>Opens .svpv jobs and adds PDFs/folders (drag &amp; drop, command line).</summary>
    private async Task OpenPathsAsync(IEnumerable<string> paths)
    {
        var list = paths.ToList();
        var job = list.FirstOrDefault(p => p.EndsWith(JobFile.Extension, StringComparison.OrdinalIgnoreCase) && File.Exists(p));
        if (job is not null) await OpenJobAsync(job);

        var pdfs = new List<string>();
        foreach (var p in list)
        {
            if (Directory.Exists(p)) pdfs.AddRange(FindPdfs(p, _app.IncludeSubfolders));
            else if (p.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)) pdfs.Add(p);
        }
        if (pdfs.Count > 0) await AddPdfsAsync(pdfs, null);
    }

    private Task AddPdfsAsync(IEnumerable<string> paths, Preset? preset) =>
        AddAsync(paths.Select(p => (p, (Action<JobItem>)(item =>
        {
            var use = preset ?? _library.Default;
            if (use is not null) PresetSync.Apply(new[] { item }, use);
        }))).ToList());

    /// <summary>Reads each PDF (page count, sizes, password) in the background and adds it to the list.</summary>
    private async Task AddAsync(IReadOnlyList<(string Path, Action<JobItem> Init)> files)
    {
        if (_busyAdding) return;
        _busyAdding = true;
        try
        {
            var known = new HashSet<string>(_items.Select(i => i.FilePath), StringComparer.OrdinalIgnoreCase);
            int skipped = 0, n = 0;
            foreach (var (path, init) in files)
            {
                n++;
                var full = Path.GetFullPath(path);
                if (!known.Add(full)) { skipped++; continue; }
                ProgressText.Text = $"Reading {n} of {files.Count}: {Path.GetFileName(full)}";

                var item = new JobItem { FilePath = full };
                init(item);
                try
                {
                    var info = await Task.Run(() => PdfFile.Open(full, _app.Passwords));
                    Fill(item, info);
                }
                catch (PdfPasswordNeededException)
                {
                    if (!await AskPasswordAsync(item))
                    {
                        item.Status = ItemStatus.Locked;
                        item.Message = "Locked with a password";
                        item.IsChecked = false;
                    }
                }
                catch (Exception ex)
                {
                    item.Status = ItemStatus.Error;
                    item.Message = PdfFile.Describe(ex);
                    item.IsChecked = false;
                }
                _items.Add(item);
            }
            ProgressText.Text = skipped > 0 ? $"{skipped} file(s) were already in the list and were not added again." : "";
        }
        finally
        {
            _busyAdding = false;
        }
    }

    private static void Fill(JobItem item, PdfFile.Info info)
    {
        item.PageCount = info.PageCount;
        item.PageSizes = info.PageSizes;
        item.Password = info.Password;
    }

    private async Task<bool> AskPasswordAsync(JobItem item)
    {
        while (true)
        {
            var (pw, remember) = TextPrompt.AskWithCheck(this, "Locked PDF",
                $"\"{item.FileName}\" is locked. Type its password:", password: true, checkText: "Remember this password (try it on other locked files)");
            if (pw is null) return false;
            try
            {
                var info = await Task.Run(() => PdfFile.Open(item.FilePath, new[] { pw }));
                Fill(item, info);
                if (remember && !_app.Passwords.Contains(pw))
                {
                    _app.Passwords.Add(pw);
                    SaveAppSettings();
                }
                return true;
            }
            catch (PdfPasswordNeededException)
            {
                MessageBox.Show(this, "That password is not right. Please try again.", AppTitle, MessageBoxButton.OK, MessageBoxImage.Warning);
            }
            catch (Exception ex)
            {
                item.Status = ItemStatus.Error;
                item.Message = PdfFile.Describe(ex);
                return true;
            }
        }
    }

    private void Window_DragOver(object sender, DragEventArgs e)
    {
        e.Effects = e.Data.GetDataPresent(DataFormats.FileDrop) && !_printing ? DragDropEffects.Copy : DragDropEffects.None;
        e.Handled = true;
    }

    private async void Window_Drop(object sender, DragEventArgs e)
    {
        e.Handled = true;
        if (_printing || e.Data.GetData(DataFormats.FileDrop) is not string[] paths) return;
        await OpenPathsAsync(paths);
    }

    // ------------------------------------------------------------------ list commands

    private void Remove_Click(object sender, RoutedEventArgs e)
    {
        if (!NotWhilePrinting()) return;
        foreach (var i in SelectedItems()) _items.Remove(i);
    }

    private void Clear_Click(object sender, RoutedEventArgs e)
    {
        if (!NotWhilePrinting() || _items.Count == 0) return;
        if (MessageBox.Show(this, "Remove all files from the list?", AppTitle, MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes) return;
        _items.Clear();
        _jobPath = null;
        UpdateTitle();
    }

    private void RemovePrinted_Click(object sender, RoutedEventArgs e)
    {
        if (!NotWhilePrinting()) return;
        foreach (var i in _items.Where(i => i.Status == ItemStatus.Printed).ToList()) _items.Remove(i);
    }

    private void Up_Click(object sender, RoutedEventArgs e) => MoveSelected(-1);
    private void Down_Click(object sender, RoutedEventArgs e) => MoveSelected(+1);

    private void MoveSelected(int delta)
    {
        if (!NotWhilePrinting()) return;
        var selected = SelectedItems();
        if (selected.Count == 0) return;

        // Moving by hand replaces column sorting: make the shown order the real order first.
        if (Grid.Items.SortDescriptions.Count > 0)
        {
            var shown = ItemsInShownOrder();
            Grid.Items.SortDescriptions.Clear();
            foreach (var c in Grid.Columns) c.SortDirection = null;
            for (int i = 0; i < shown.Count; i++) _items.Move(_items.IndexOf(shown[i]), i);
        }

        var order = delta < 0 ? selected : Enumerable.Reverse(selected).ToList();
        foreach (var item in order)
        {
            int from = _items.IndexOf(item), to = from + delta;
            if (to < 0 || to >= _items.Count || selected.Contains(_items[to])) continue;
            _items.Move(from, to);
        }
        foreach (var item in selected) Grid.SelectedItems.Add(item);
        Grid.ScrollIntoView(selected[0]);
    }

    private void OpenFolder_Click(object sender, RoutedEventArgs e)
    {
        var item = SelectedItems().FirstOrDefault();
        if (item is null) return;
        try
        {
            Process.Start("explorer.exe", $"/select,\"{item.FilePath}\"");
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, AppTitle);
        }
    }

    private void Check_Click(object sender, RoutedEventArgs e)
    {
        // Ticking one of several selected files ticks them all.
        if (sender is CheckBox { DataContext: JobItem clicked } box && Grid.SelectedItems.Contains(clicked))
            foreach (var i in SelectedItems()) i.IsChecked = box.IsChecked == true;
    }

    private void TickSelected_Click(object sender, RoutedEventArgs e) { foreach (var i in SelectedItems()) i.IsChecked = true; }
    private void UntickSelected_Click(object sender, RoutedEventArgs e) { foreach (var i in SelectedItems()) i.IsChecked = false; }

    // ------------------------------------------------------------------ presets

    private void ApplyPreset_Click(object sender, RoutedEventArgs e)
    {
        if (PresetBox.SelectedItem is Preset p) ApplyPreset(p);
    }

    private void ApplyPreset(Preset preset)
    {
        if (!NotWhilePrinting() || !NeedSelection(out var selected)) return;
        PresetSync.Apply(selected, preset);
        ProgressText.Text = $"Preset \"{preset.Name}\" applied to {selected.Count} file(s).";
        UpdateSummary();
    }

    private void ManagePresets_Click(object sender, RoutedEventArgs e) => ManagePresets((PresetBox.SelectedItem as Preset)?.Id);

    private void ManagePresets(string? selectId)
    {
        if (!NotWhilePrinting()) return;
        var win = new PresetManagerWindow(_library, selectId) { Owner = this };
        if (win.ShowDialog() != true || win.Result is null) return;
        _library = win.Result;
        SavePresets();
        PresetSync.LibraryChanged(_items, _library);
        RefreshPresetBox(null);
        UpdateSummary();
    }

    private void SaveAsPreset_Click(object sender, RoutedEventArgs e)
    {
        if (!NotWhilePrinting() || !NeedSelection(out var selected)) return;
        var source = selected[0];
        var name = TextPrompt.Ask(this, "Save as preset", $"Save the settings of \"{source.FileName}\" as a new preset named:", source.PresetName ?? "My preset");
        if (name is null) return;
        var preset = new Preset { Name = _library.UniqueName(name), Settings = source.Settings.Clone() };
        _library.Presets.Add(preset);
        SavePresets();
        PresetSync.Apply(new[] { source }, preset);
        RefreshPresetBox(preset);
    }

    private void ResetToPreset_Click(object sender, RoutedEventArgs e)
    {
        if (!NotWhilePrinting()) return;
        foreach (var i in SelectedItems()) PresetSync.ResetToPreset(i, _library);
        UpdateSummary();
    }

    private void CopySettings_Click(object sender, RoutedEventArgs e)
    {
        var item = SelectedItems().FirstOrDefault();
        if (item is null) return;
        _clipboard = item.Settings.Clone();
        ProgressText.Text = $"Settings of \"{item.FileName}\" copied. Select files and use Paste settings.";
    }

    private void PasteSettings_Click(object sender, RoutedEventArgs e)
    {
        if (_clipboard is null || !NotWhilePrinting() || !NeedSelection(out var selected)) return;
        foreach (var i in selected) PresetSync.SetByHand(i, _clipboard, _library);
        UpdateSummary();
    }

    private void Grid_ContextMenuOpening(object sender, ContextMenuEventArgs e)
    {
        ApplyPresetMenu.Items.Clear();
        for (int n = 0; n < _library.Presets.Count; n++)
        {
            var p = _library.Presets[n];
            var mi = new MenuItem { Header = p.Name, InputGestureText = n < 9 ? $"Ctrl+{n + 1}" : "" };
            mi.Click += (_, _) => ApplyPreset(p);
            ApplyPresetMenu.Items.Add(mi);
        }
        if (_library.Presets.Count == 0) ApplyPresetMenu.Items.Add(new MenuItem { Header = "(no presets yet)", IsEnabled = false });
        ApplyPresetMenu.Items.Add(new Separator());
        var manage = new MenuItem { Header = "Manage presets…" };
        manage.Click += (_, _) => ManagePresets(null);
        ApplyPresetMenu.Items.Add(manage);
        PasteMenu.IsEnabled = _clipboard is not null;
    }

    // ------------------------------------------------------------------ settings, preview, estimate

    private void FileSettings_Click(object sender, RoutedEventArgs e) => OpenFileSettings();

    private void Grid_MouseDoubleClick(object sender, MouseButtonEventArgs e)
    {
        // Only rows, not the column headers or the scroll bar.
        if (e.OriginalSource is DependencyObject d && FindParent<DataGridRow>(d) is not null) OpenFileSettings();
    }

    private void OpenFileSettings()
    {
        if (!NotWhilePrinting() || !NeedSelection(out var selected)) return;
        var usable = selected.Where(i => i.PageCount > 0 || i.Status != ItemStatus.Error).ToList();
        if (usable.Count == 0) return;
        int start = Math.Max(0, usable.IndexOf(Grid.CurrentItem as JobItem ?? usable[0]));
        var win = new FileSettingsWindow(usable, start, _library) { Owner = this };
        win.ShowDialog();
        UpdateSummary();
    }

    private void Preview_Click(object sender, RoutedEventArgs e)
    {
        if (!NeedSelection(out var selected)) return;
        var item = selected[0];
        if (item.PageCount == 0)
        {
            MessageBox.Show(this, $"\"{item.FileName}\" cannot be read: {item.Message}", AppTitle);
            return;
        }
        new PreviewWindow(item) { Owner = this }.Show();
    }

    private void Estimate_Click(object sender, RoutedEventArgs e)
    {
        var ticked = ItemsInShownOrder().Where(i => i.IsChecked && i.PageCount > 0).ToList();
        if (ticked.Count == 0)
        {
            MessageBox.Show(this, "No ticked files to print.", AppTitle);
            return;
        }
        MessageBox.Show(this, EstimateText(ticked), "Estimate", MessageBoxButton.OK, MessageBoxImage.Information);
    }

    private static string EstimateText(IReadOnlyList<JobItem> items)
    {
        var lines = new List<string>();
        foreach (var p in Estimator.ByPrinter(items, PrinterCatalog.DefaultPrinter()))
            lines.Add($"{p.Printer}:  {p.Files} file(s), {p.Pages} pages, about {p.Sheets} sheets of paper");
        var problems = items.Select(i => (i, Estimator.ForItem(i.Settings, i.PageCount))).Where(x => x.Item2.Error is not null).ToList();
        if (problems.Count > 0)
        {
            lines.Add("");
            lines.Add("Problems:");
            lines.AddRange(problems.Select(x => $"  {x.i.FileName}: {x.Item2.Error}"));
        }
        lines.Add("");
        lines.Add($"Total: {items.Count} files, {items.Sum(i => Estimator.ForItem(i.Settings, i.PageCount).Sheets)} sheets.");
        return string.Join(Environment.NewLine, lines);
    }

    // ------------------------------------------------------------------ printing

    private async void Print_Click(object sender, RoutedEventArgs e)
    {
        if (_printing) return;
        var ticked = ItemsInShownOrder().Where(i => i.IsChecked).ToList();
        if (ticked.Count == 0)
        {
            MessageBox.Show(this, "No files are ticked. Tick the files you want to print.", AppTitle);
            return;
        }
        var printable = ticked.Where(i => i.PageCount > 0 && i.Status != ItemStatus.Locked).ToList();
        var unreadable = ticked.Except(printable).ToList();
        if (printable.Count == 0)
        {
            MessageBox.Show(this, "None of the ticked files can be read.", AppTitle);
            return;
        }
        if (MessageBox.Show(this, "Print now?" + Environment.NewLine + Environment.NewLine + EstimateText(printable), AppTitle,
                MessageBoxButton.OKCancel, MessageBoxImage.Question) != MessageBoxResult.OK) return;

        SetPrinting(true);
        foreach (var i in printable) { i.Status = ItemStatus.Waiting; i.Message = ""; }
        Progress.Value = 0;
        List<ReportRow> report;
        try
        {
            report = await _engine.RunAsync(printable, _app);
        }
        catch (Exception ex)
        {
            report = new List<ReportRow>();
            MessageBox.Show(this, "Printing failed: " + ex.Message, AppTitle, MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally
        {
            SetPrinting(false);
        }

        report.AddRange(unreadable.Select(i => new ReportRow
        {
            FileName = i.FileName,
            Folder = i.Folder,
            Printer = i.PrinterDisplay,
            Preset = i.PresetDisplay,
            Status = "Error",
            Message = string.IsNullOrEmpty(i.Message) ? "Cannot read the file" : i.Message,
        }));
        new ReportWindow(report) { Owner = this }.Show();
    }

    private void SetPrinting(bool printing)
    {
        _printing = printing;
        FileBar.IsEnabled = PresetBar.IsEnabled = !printing;
        AfterPrintBox.IsEnabled = AfterPrintFolderBox.IsEnabled = AfterPrintBrowse.IsEnabled = !printing;
        PrintButton.IsEnabled = !printing;
        PauseButton.IsEnabled = StopButton.IsEnabled = printing;
        PauseButton.Content = "Pause";
        if (!printing) UpdateAfterPrintControls();
    }

    private void Pause_Click(object sender, RoutedEventArgs e)
    {
        if (_engine.IsPaused)
        {
            _engine.Resume();
            PauseButton.Content = "Pause";
        }
        else
        {
            _engine.Pause();
            PauseButton.Content = "Resume";
            ProgressText.Text = "Paused (after the current page)";
        }
    }

    private void Stop_Click(object sender, RoutedEventArgs e)
    {
        if (MessageBox.Show(this, "Stop printing? The current file is cancelled and the rest are not printed.", AppTitle,
                MessageBoxButton.YesNo, MessageBoxImage.Question) == MessageBoxResult.Yes)
            _engine.Stop();
    }

    // ------------------------------------------------------------------ after printing

    private void AfterPrint_Changed(object sender, SelectionChangedEventArgs e)
    {
        if (_app is null) return; // during InitializeComponent
        _app.AfterPrint = (AfterPrintAction)Math.Max(0, AfterPrintBox.SelectedIndex);
        UpdateAfterPrintControls();
        SaveAppSettings();
    }

    private void UpdateAfterPrintControls()
    {
        bool on = _app.AfterPrint != AfterPrintAction.Nothing;
        AfterPrintFolderBox.IsEnabled = AfterPrintBrowse.IsEnabled = on && !_printing;
    }

    private void AfterPrintFolder_LostFocus(object sender, RoutedEventArgs e)
    {
        _app.AfterPrintFolder = AfterPrintFolderBox.Text.Trim();
        SaveAppSettings();
    }

    private void AfterPrintBrowse_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new OpenFolderDialog { InitialDirectory = Directory.Exists(_app.AfterPrintFolder) ? _app.AfterPrintFolder : "" };
        if (dlg.ShowDialog(this) != true) return;
        AfterPrintFolderBox.Text = _app.AfterPrintFolder = dlg.FolderName;
        SaveAppSettings();
    }

    // ------------------------------------------------------------------ jobs

    private async void OpenJob_Click(object sender, RoutedEventArgs e)
    {
        if (!NotWhilePrinting()) return;
        var dlg = new OpenFileDialog { Filter = $"Sievphov job|*{JobFile.Extension}" };
        if (dlg.ShowDialog(this) == true) await OpenJobAsync(dlg.FileName);
    }

    private async Task OpenJobAsync(string path)
    {
        JobFile job;
        try
        {
            job = Storage.LoadJob(path);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, "Could not open the job: " + ex.Message, AppTitle, MessageBoxButton.OK, MessageBoxImage.Error);
            return;
        }
        if (_items.Count > 0)
        {
            var answer = MessageBox.Show(this, "Replace the current list with this job?\n(No = add the job's files to the list)", AppTitle,
                MessageBoxButton.YesNoCancel, MessageBoxImage.Question);
            if (answer == MessageBoxResult.Cancel) return;
            if (answer == MessageBoxResult.Yes) _items.Clear();
        }

        await AddAsync(job.Items.Select(entry => (entry.FilePath, (Action<JobItem>)(item =>
        {
            item.Settings = entry.Settings;
            item.IsChecked = entry.Checked;
            // Link back to the preset by id, or by name if the job came from another PC.
            var preset = _library.Find(entry.PresetId) ?? _library.FindByName(entry.PresetName);
            item.PresetId = preset?.Id;
            item.PresetName = preset?.Name;
            item.IsModified = preset is null ? entry.PresetId is not null || entry.Modified : !entry.Settings.ContentEquals(preset.Settings);
        }))).ToList());

        foreach (var missing in _items.Where(i => i.Status == ItemStatus.Error && !File.Exists(i.FilePath)))
            missing.Message = "File not found";

        _jobPath = path;
        UpdateTitle();
    }

    private void SaveJob_Click(object sender, RoutedEventArgs e) => SaveJob(_jobPath);
    private void SaveJobAs_Click(object sender, RoutedEventArgs e) => SaveJob(null);

    private void SaveJob(string? path)
    {
        if (_items.Count == 0)
        {
            MessageBox.Show(this, "The list is empty.", AppTitle);
            return;
        }
        if (path is null)
        {
            var dlg = new SaveFileDialog { Filter = $"Sievphov job|*{JobFile.Extension}", FileName = "Print job" + JobFile.Extension };
            if (dlg.ShowDialog(this) != true) return;
            path = dlg.FileName;
        }
        try
        {
            Storage.SaveJob(path, ItemsInShownOrder());
            _jobPath = path;
            UpdateTitle();
            ProgressText.Text = "Job saved: " + path;
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, "Could not save the job: " + ex.Message, AppTitle, MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    // ------------------------------------------------------------------ More menu

    private void More_Click(object sender, RoutedEventArgs e)
    {
        MoreButton.ContextMenu.PlacementTarget = MoreButton;
        MoreButton.ContextMenu.IsOpen = true;
    }

    private void Passwords_Click(object sender, RoutedEventArgs e)
    {
        var text = TextPrompt.Ask(this, "Saved passwords",
            "Passwords tried automatically on locked PDFs, separated by spaces.\nThey are saved on this PC (not encrypted).",
            string.Join(" ", _app.Passwords));
        if (text is null && _app.Passwords.Count == 0) return;
        _app.Passwords = (text ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries).Distinct().ToList();
        SaveAppSettings();
    }

    private void Associate_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            FileAssociation.Register();
            MessageBox.Show(this, "Done. Double-clicking a .svpv job file now opens it in Sievphov.", AppTitle);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, "Could not set this up: " + ex.Message, AppTitle, MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void SettingsFolder_Click(object sender, RoutedEventArgs e)
    {
        Directory.CreateDirectory(_storage.Folder);
        Process.Start("explorer.exe", $"\"{_storage.Folder}\"");
    }

    private void About_Click(object sender, RoutedEventArgs e)
    {
        var version = typeof(MainWindow).Assembly.GetName().Version?.ToString(3);
        MessageBox.Show(this,
            $"{AppTitle}\nVersion {version}\n\nPrint many PDF files in one go, each with its own printer settings.\n" +
            $"Presets and settings: {_storage.Folder}\n\nPDF engine: PDFium (via PDFtoImage).",
            "About Sievphov");
    }

    // ------------------------------------------------------------------ keyboard, closing

    private void Window_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        var mods = Keyboard.Modifiers;
        if (mods == ModifierKeys.Control && e.Key is >= Key.D1 and <= Key.D9 or >= Key.NumPad1 and <= Key.NumPad9)
        {
            int n = e.Key >= Key.NumPad1 ? e.Key - Key.NumPad1 : e.Key - Key.D1;
            if (n < _library.Presets.Count) ApplyPreset(_library.Presets[n]);
            e.Handled = true;
            return;
        }
        if (Keyboard.FocusedElement is TextBox or PasswordBox or ComboBox) return;

        switch (e.Key)
        {
            case Key.Delete when mods == ModifierKeys.None && Grid.IsKeyboardFocusWithin:
                Remove_Click(this, e);
                e.Handled = true;
                break;
            case Key.Enter when mods == ModifierKeys.None && Grid.IsKeyboardFocusWithin:
                OpenFileSettings();
                e.Handled = true;
                break;
            case Key.O when mods == ModifierKeys.Control:
                OpenJob_Click(this, e);
                e.Handled = true;
                break;
            case Key.S when mods == ModifierKeys.Control:
                SaveJob(_jobPath);
                e.Handled = true;
                break;
            case Key.P when mods == ModifierKeys.Control:
                Print_Click(this, e);
                e.Handled = true;
                break;
            case Key.C when mods == (ModifierKeys.Control | ModifierKeys.Shift):
                CopySettings_Click(this, e);
                e.Handled = true;
                break;
            case Key.V when mods == (ModifierKeys.Control | ModifierKeys.Shift):
                PasteSettings_Click(this, e);
                e.Handled = true;
                break;
        }
    }

    private void Window_Closing(object? sender, CancelEventArgs e)
    {
        if (_printing &&
            MessageBox.Show(this, "Printing is still running. Stop and close?", AppTitle, MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes)
        {
            e.Cancel = true;
            return;
        }
        if (_printing) _engine.Stop();
        _app.AfterPrintFolder = AfterPrintFolderBox.Text.Trim();
        SaveAppSettings();
    }

    private static T? FindParent<T>(DependencyObject d) where T : DependencyObject
    {
        while (d is not null and not T)
            d = d is System.Windows.Media.Visual or System.Windows.Media.Media3D.Visual3D
                ? System.Windows.Media.VisualTreeHelper.GetParent(d)
                : LogicalTreeHelper.GetParent(d);
        return d as T;
    }
}
