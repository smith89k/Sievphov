using System.Runtime.InteropServices;
using Microsoft.Win32;
using Sievphov.Models;

namespace Sievphov;

/// <summary>Makes double-clicking a .svpv file open it in Sievphov (current Windows user only, no admin needed).</summary>
public static class FileAssociation
{
    private const string ProgId = "Sievphov.Job";

    public static void Register()
    {
        var exe = Environment.ProcessPath ?? throw new InvalidOperationException("Cannot find Sievphov.exe");
        using (var ext = Registry.CurrentUser.CreateSubKey($@"Software\Classes\{JobFile.Extension}"))
            ext.SetValue("", ProgId);
        using (var type = Registry.CurrentUser.CreateSubKey($@"Software\Classes\{ProgId}"))
        {
            type.SetValue("", "Sievphov print job");
            using (var icon = type.CreateSubKey("DefaultIcon")) icon.SetValue("", $"\"{exe}\",0");
            using (var cmd = type.CreateSubKey(@"shell\open\command")) cmd.SetValue("", $"\"{exe}\" \"%1\"");
        }
        SHChangeNotify(0x08000000 /* SHCNE_ASSOCCHANGED */, 0, IntPtr.Zero, IntPtr.Zero);
    }

    [DllImport("shell32.dll")]
    private static extern void SHChangeNotify(int eventId, uint flags, IntPtr item1, IntPtr item2);
}
