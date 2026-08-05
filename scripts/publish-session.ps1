param(
    [Parameter(Mandatory = $true)]
    [string]$Message,
    [string[]]$Include = @()
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

git rev-parse --is-inside-work-tree | Out-Null
git add -- 'SESSION_LOGS'

foreach ($path in $Include) {
    $resolved = Resolve-Path -LiteralPath $path -ErrorAction Stop
    git add -- $resolved.Path
}

$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Host '스테이징된 세션 기록 또는 지정 파일이 없습니다. 커밋하지 않습니다.'
    exit 0
}

git commit -m $Message
git push
