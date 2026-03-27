$ErrorActionPreference = 'Continue'

$root = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $root 'output/runtime'

$candidateLogs = @(
    (Join-Path $runtimeDir 'site.log'),
    (Join-Path $runtimeDir 'token-server.log')
)

$ports = 3001, 8787
foreach ($port in $ports) {
    try {
        Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop |
            Select-Object -ExpandProperty OwningProcess -Unique |
            ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
    } catch {}
}

foreach ($logPath in $candidateLogs) {
    if (Test-Path $logPath) {
        Get-Content $logPath -Tail 20 -ErrorAction SilentlyContinue | Out-Null
    }
}

Write-Output 'stopped'
