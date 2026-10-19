# Builds dist\Sievphov\Sievphov.exe: one file, runs on any 64-bit Windows 10/11 PC, no install needed.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
dotnet test "$root\tests\Sievphov.Tests" -c Release
dotnet publish "$root\src\Sievphov" -c Release -r win-x64 -p:PublishProfile=win-x64 -o "$root\dist\Sievphov"
Write-Host "Done: $root\dist\Sievphov\Sievphov.exe"
