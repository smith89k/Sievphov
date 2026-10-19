using System.Windows;
using System.Windows.Threading;

namespace Sievphov;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        DispatcherUnhandledException += OnUnhandled;

        if (e.Args.Length >= 2 && e.Args[0] == "--selftest")
        {
            Dispatcher.InvokeAsync(async () => Shutdown(await SelfTest.RunAsync(Path.GetFullPath(e.Args[1]), Dispatcher)));
            return;
        }

        // Files given on the command line (or by double-clicking a .svpv job).
        var window = new MainWindow(e.Args.Where(a => File.Exists(a) || Directory.Exists(a)).ToList());
        MainWindow = window;
        window.Show();
    }

    private static void OnUnhandled(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        MessageBox.Show("Something went wrong:\n\n" + e.Exception.Message, "Sievphov", MessageBoxButton.OK, MessageBoxImage.Error);
        e.Handled = true;
    }
}
