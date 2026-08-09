# Packs dist-itch into the single zip itch.io wants: index.html at the root, every path relative.
#
# Written by hand rather than with Compress-Archive because that cmdlet writes Windows separators
# into the entry names ("assets\index-abc.js"). The ZIP spec requires forward slashes, and an
# extractor that takes the name literally serves a file *called* "assets\index-abc.js" while the
# page asks for "assets/index-abc.js" -- every asset 404s and the game loads as a blank white page,
# from a zip that looks perfectly correct in Explorer.

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repoRoot 'dist-itch'
$zipPath = Join-Path $repoRoot 'hot-seat-itch.zip'

if (-not (Test-Path $source)) {
    throw "No dist-itch found. Run 'npm run build:itch' first."
}
if (-not (Test-Path (Join-Path $source 'index.html'))) {
    throw "dist-itch has no index.html at its root -- itch.io needs one to know what to serve."
}

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$sourceRoot = (Resolve-Path $source).Path
$archive = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
try {
    foreach ($file in Get-ChildItem -Path $sourceRoot -Recurse -File) {
        $entryName = $file.FullName.Substring($sourceRoot.Length + 1).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entryName) | Out-Null
    }
}
finally {
    $archive.Dispose()
}

$entryCount = (Get-ChildItem -Path $sourceRoot -Recurse -File).Count
$sizeKb = '{0:N0}' -f ((Get-Item $zipPath).Length / 1KB)
Write-Output "Packed $entryCount files into hot-seat-itch.zip ($sizeKb KB), index.html at the root."
