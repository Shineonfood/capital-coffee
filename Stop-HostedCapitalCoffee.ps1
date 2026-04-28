param(
  [int]$Port = 4273
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidPath = Join-Path $Root "data\capital-coffee-hosted.pid"
$stopped = $false

if (Test-Path -LiteralPath $PidPath) {
  $rawPid = Get-Content -LiteralPath $PidPath -Raw
  $processId = 0
  if ([int]::TryParse($rawPid.Trim(), [ref]$processId)) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
      Stop-Process -Id $processId
      $stopped = $true
    }
  }
}

if (-not $stopped) {
  $connections = netstat -ano | Select-String ":$Port"
  foreach ($connection in $connections) {
    $parts = ($connection.ToString() -split "\s+") | Where-Object { $_ }
    $processId = 0
    if ($parts.Count -gt 4 -and [int]::TryParse($parts[-1], [ref]$processId) -and $processId -gt 0) {
      $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
      if ($process) {
        Stop-Process -Id $process.Id
        $stopped = $true
      }
    }
  }
}

if (Test-Path -LiteralPath $PidPath) {
  Remove-Item -LiteralPath $PidPath -Force
}

if ($stopped) {
  Write-Host "Hosted Capital Coffee stopped."
} else {
  Write-Host "Hosted Capital Coffee was not running on port $Port."
}

