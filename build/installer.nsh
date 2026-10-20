; Sievphov - extra installer steps (electron-builder nsis.include): fresh icons after an update.
!macro customInstall
  ; An update keeps the same paths, so Windows would keep showing the old icons from its icon cache
  ; (shortcuts, taskbar, .svpv files): refresh it. The 64-bit ie4uinit sits behind Sysnative for this 32-bit installer.
  ${if} ${FileExists} "$WINDIR\Sysnative\ie4uinit.exe"
    ExecWait '"$WINDIR\Sysnative\ie4uinit.exe" -show'
  ${else}
    ExecWait '"$SYSDIR\ie4uinit.exe" -show'
  ${endif}
  System::Call 'shell32::SHChangeNotify(i, i, i, i) v (0x08000000, 0x1000, 0, 0)'   ; SHCNE_ASSOCCHANGED, SHCNF_FLUSH
!macroend
