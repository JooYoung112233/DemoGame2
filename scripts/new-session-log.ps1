param(
    [Parameter(Mandatory = $true)]
    [string]$Title
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$date = Get-Date -Format 'yyyy-MM-dd'
$safeTitle = ($Title -replace '[^a-zA-Z0-9가-힣_-]+', '-').Trim('-')
if ([string]::IsNullOrWhiteSpace($safeTitle)) { $safeTitle = 'session' }

$destination = Join-Path $root "SESSION_LOGS\sessions\$date-$safeTitle.md"
if (Test-Path -LiteralPath $destination) {
    throw "이미 같은 이름의 기록이 있습니다: $destination"
}

$template = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'SESSION_LOGS\templates\session.md')
$template = $template.Replace('{{TITLE}}', $Title).Replace('{{DATE}}', $date)
Set-Content -LiteralPath $destination -Value $template -Encoding UTF8
Write-Host "세션 기록을 만들었습니다: $destination"
