Param(
    [string]$OutputName
)

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$out = if ($OutputName) { $OutputName } else { "project_$timestamp.zip" }
$outPath = Join-Path $scriptRoot $out
$tmp = Join-Path $env:TEMP "project_zip_$timestamp"

if (Test-Path $outPath) {
    Write-Host "Removing existing archive: $outPath"
    Remove-Item -Force $outPath
}

New-Item -ItemType Directory -Force -Path $tmp | Out-Null

function Copy-WithoutNodeModules($src, $dst) {
    if (-not (Test-Path $src)) {
        Write-Host "Source not found, skipping: $src"
        return
    }
    New-Item -ItemType Directory -Force -Path $dst | Out-Null
    & robocopy $src $dst /E /XD node_modules > $null
}

Copy-WithoutNodeModules (Join-Path $scriptRoot 'backend') (Join-Path $tmp 'backend')
Copy-WithoutNodeModules (Join-Path $scriptRoot 'frontend') (Join-Path $tmp 'frontend')

Compress-Archive -Path (Join-Path $tmp '*') -DestinationPath $outPath -Force

Remove-Item -Recurse -Force $tmp

Write-Host "Created archive: $outPath"
