$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $root 'output/runtime'
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

$siteLog = Join-Path $runtimeDir 'site.log'
$siteErr = Join-Path $runtimeDir 'site.err.log'
$serverLog = Join-Path $runtimeDir 'token-server.log'
$serverErr = Join-Path $runtimeDir 'token-server.err.log'
$serverEnvPath = Join-Path $root 'server/.env.local'

if (!(Test-Path $serverEnvPath)) {
    throw "Missing $serverEnvPath"
}

$site = Start-Process -FilePath python.exe `
    -ArgumentList @('-m', 'http.server', '3001') `
    -WorkingDirectory $root `
    -RedirectStandardOutput $siteLog `
    -RedirectStandardError $siteErr `
    -PassThru

$serverLauncher = @'
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envPath = Join-Path $root "server/.env.local"
Get-Content $envPath | ForEach-Object {
    if ($_ -match "^\s*#" -or $_ -match "^\s*$") { return }
    $name, $value = $_ -split "=", 2
    [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), "Process")
}
node server/gemini-token-server.mjs
'@

$serverScriptPath = Join-Path $runtimeDir 'start-token-server.ps1'
Set-Content -Path $serverScriptPath -Value $serverLauncher -Encoding UTF8

$server = Start-Process -FilePath powershell.exe `
    -ArgumentList @('-NoLogo', '-NoProfile', '-File', $serverScriptPath) `
    -WorkingDirectory $root `
    -RedirectStandardOutput $serverLog `
    -RedirectStandardError $serverErr `
    -PassThru

Start-Sleep -Seconds 4

$siteOk = $false
$serverOk = $false

try {
    $siteResp = Invoke-WebRequest -Uri 'http://127.0.0.1:3001' -UseBasicParsing -TimeoutSec 10
    $siteOk = $siteResp.StatusCode -ge 200 -and $siteResp.StatusCode -lt 400
} catch {}

try {
    $body = @{
        source = 'client-simulator-web'
        login = 'smoke@tradicia-k.ru'
        model = 'gemini-3.1-flash-live-preview'
        voice = 'Enceladus'
        instructions = 'Тест'
    } | ConvertTo-Json -Compress
    $serverResp = Invoke-RestMethod -Uri 'http://127.0.0.1:8787/api/gemini-live-token' -Method Post -ContentType 'application/json' -Body $body
    $serverOk = [bool]$serverResp.name
} catch {}

[pscustomobject]@{
    sitePid = $site.Id
    serverPid = $server.Id
    siteOk = $siteOk
    serverOk = $serverOk
    siteUrl = 'http://127.0.0.1:3001'
    tokenEndpoint = 'http://127.0.0.1:8787/api/gemini-live-token'
    siteLog = $siteLog
    serverLog = $serverLog
    serverScript = $serverScriptPath
} | ConvertTo-Json -Compress
