// SievphovStoreUpdate.exe — talks to the Microsoft Store for the Store copy of the app (Electron can't reach
// Windows.Services.Store). Started by main.js (store-update.js) from inside the package, so it has the package's identity.
// Nothing app-specific here: the same program as Sastra PDF's SastraStoreUpdate.exe (E:\_httdocs\SastraPDF\store-update),
// keep the two in step.
//   SievphovStoreUpdate.exe check                  → {"event":"check","count":1,"version":"1.4.0.0","silent":true}
//   SievphovStoreUpdate.exe download [--hwnd=N] [--silent-only]
//                                                → {"event":"progress","done":1,"total":9,"fraction":0.1} … {"event":"done","state":"completed"}
//                                                  (--silent-only: "cancelled" rather than ask, for a download nobody pressed)
//   SievphovStoreUpdate.exe install  [--hwnd=N]    → {"event":"done","state":"completed"} (Windows closes the app on the way)
// Every run starts with {"event":"start","package":"Name_hash"} ("" = not running inside a package). One JSON line per event; any failure → {"event":"error","code":"0x80070005"} and exit code 1. With no permission for a
// quiet download or install (the Store's "Update apps automatically" is off, or a metered network) Windows asks in its own
// box, over the window --hwnd names. Those asking calls must run on a thread with a message loop (Microsoft's reference
// says "on the UI thread"), so they get their own; the quiet calls run on the main thread.
#include <windows.h>
#include <shobjidl_core.h>
#include <winrt/base.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.ApplicationModel.h>
#include <winrt/Windows.Services.Store.h>
#include <cstdio>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <string>
#include <thread>

using namespace winrt;
using namespace Windows::Foundation;
using namespace Windows::Foundation::Collections;
using namespace Windows::Services::Store;

// In one write: progress arrives on another thread, and a mixed-up last line would read as a failure.
static void line(const std::string &s) { const std::string l = s + "\n"; fwrite(l.data(), 1, l.size(), stdout); fflush(stdout); }

static const char *stateName(StorePackageUpdateState s) {
  switch (s) {
    case StorePackageUpdateState::Completed: return "completed";
    case StorePackageUpdateState::Canceled: return "cancelled";
    case StorePackageUpdateState::ErrorLowBattery: return "low-battery";
    case StorePackageUpdateState::ErrorWiFiRecommended:
    case StorePackageUpdateState::ErrorWiFiRequired: return "wifi";
    default: return "failed";
  }
}

// Windows' own boxes need a window to stand on: a desktop app has to say which.
static void attach(const StoreContext &ctx, uint64_t hwnd) {
  if (hwnd) check_hresult(ctx.as<IInitializeWithWindow>()->Initialize(reinterpret_cast<HWND>(static_cast<uintptr_t>(hwnd))));
}

using UpdateOp = IAsyncOperationWithProgress<StorePackageUpdateResult, StorePackageUpdateStatus>;

static void watch(UpdateOp const &op) {
  op.Progress([](auto const &, StorePackageUpdateStatus const &p) {
    char b[160];
    snprintf(b, sizeof b, "{\"event\":\"progress\",\"done\":%llu,\"total\":%llu,\"fraction\":%.4f}",
      static_cast<unsigned long long>(p.PackageBytesDownloaded), static_cast<unsigned long long>(p.PackageDownloadSizeInBytes), p.PackageDownloadProgress);
    line(b);
  });
}
static void said(StorePackageUpdateResult const &result) { line(std::string("{\"event\":\"done\",\"state\":\"") + stateName(result.OverallState()) + "\"}"); }
static int finish(UpdateOp op) { watch(op); said(op.get()); return 0; }
static void sayError(hresult_error const &e) {
  char b[80]; snprintf(b, sizeof b, "{\"event\":\"error\",\"code\":\"0x%08X\"}", static_cast<unsigned>(e.code().value));
  line(b);
}

// Waits while keeping this thread's messages moving: Windows' box needs them.
template <typename Op> static auto pumped(Op op) {
  const DWORD me = GetCurrentThreadId();
  op.Completed([me](auto const &, auto) { PostThreadMessageW(me, WM_APP, 0, 0); });
  MSG m;
  while (op.Status() == AsyncStatus::Started && GetMessageW(&m, nullptr, 0, 0) > 0) { TranslateMessage(&m); DispatchMessageW(&m); }
  return op.GetResults();
}
// The asking calls, when Windows has to ask first.
static int asking(bool install, uint64_t hwnd) {
  int code = 0;
  std::thread t([&] {
    try {
      init_apartment(apartment_type::single_threaded);
      MSG m; PeekMessageW(&m, nullptr, WM_USER, WM_USER, PM_NOREMOVE);   // makes this thread's message queue
      const StoreContext ctx = StoreContext::GetDefault();
      attach(ctx, hwnd);
      const auto updates = pumped(ctx.GetAppAndOptionalStorePackageUpdatesAsync());
      if (updates.Size() == 0) { line("{\"event\":\"done\",\"state\":\"nothing\"}"); return; }
      UpdateOp op = install ? ctx.RequestDownloadAndInstallStorePackageUpdatesAsync(updates) : ctx.RequestDownloadStorePackageUpdatesAsync(updates);
      watch(op);
      said(pumped(op));
    } catch (hresult_error const &e) { sayError(e); code = 1; }
    catch (...) { line("{\"event\":\"error\",\"code\":\"unknown\"}"); code = 1; }
  });
  t.join();
  return code;
}

int main(int argc, char **argv) {
  const std::string cmd = argc > 1 ? argv[1] : "";
  uint64_t hwnd = 0;
  bool silentOnly = false;
  for (int i = 2; i < argc; i++) {
    if (!strncmp(argv[i], "--hwnd=", 7)) hwnd = _strtoui64(argv[i] + 7, nullptr, 10);
    else if (!strcmp(argv[i], "--silent-only")) silentOnly = true;
  }
  try {
    init_apartment();
    std::string package;
    try { package = to_string(Windows::ApplicationModel::Package::Current().Id().FamilyName()); } catch (...) {}
    line("{\"event\":\"start\",\"package\":\"" + package + "\"}");
    const StoreContext ctx = StoreContext::GetDefault();
    const auto updates = ctx.GetAppAndOptionalStorePackageUpdatesAsync().get();
    const bool silent = ctx.CanSilentlyDownloadStorePackageUpdates();
    if (cmd == "check") {
      std::string version;
      if (updates.Size() > 0) {
        const auto v = updates.GetAt(0).Package().Id().Version();
        version = std::to_string(v.Major) + "." + std::to_string(v.Minor) + "." + std::to_string(v.Build) + "." + std::to_string(v.Revision);
      }
      line("{\"event\":\"check\",\"count\":" + std::to_string(updates.Size()) + ",\"version\":\"" + version + "\",\"silent\":" + (silent ? "true" : "false") + "}");
      return 0;
    }
    if (updates.Size() == 0) { line("{\"event\":\"done\",\"state\":\"nothing\"}"); return 0; }
    if (cmd == "download") {
      if (silent) return finish(ctx.TrySilentDownloadStorePackageUpdatesAsync(updates));
      if (silentOnly) { line("{\"event\":\"done\",\"state\":\"cancelled\"}"); return 0; }
      return asking(false, hwnd);
    }
    if (cmd == "install") return silent ? finish(ctx.TrySilentDownloadAndInstallStorePackageUpdatesAsync(updates)) : asking(true, hwnd);
    line("{\"event\":\"error\",\"code\":\"usage\"}");
    return 2;
  } catch (hresult_error const &e) {
    sayError(e);
    return 1;
  } catch (...) {
    line("{\"event\":\"error\",\"code\":\"unknown\"}");
    return 1;
  }
}
