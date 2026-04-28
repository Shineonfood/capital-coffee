param(
  [int]$Port = 4273
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidPath = Join-Path $Root "data\capital-coffee-hosted.pid"
$PortableNode = Join-Path $Root ".runtime\node\node.exe"

if (Test-Path -LiteralPath $PortableNode) {
  $Node = $PortableNode
} else {
  $NodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if (-not $NodeCommand) {
    throw "Node.js was not found. Install Node.js or add a portable node.exe at .runtime\node\node.exe."
  }
  $Node = $NodeCommand.Source
}

$env:PORT = [string]$Port
$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = $Node
$psi.Arguments = "`"$(Join-Path $Root 'server.js')`""
$psi.WorkingDirectory = $Root
$psi.UseShellExecute = $true
$psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$process = [System.Diagnostics.Process]::Start($psi)
$process.Id | Set-Content -LiteralPath $PidPath -Encoding ASCII

Start-Sleep -Seconds 1
Write-Host "Hosted Capital Coffee started."
Write-Host "Order page: http://localhost:$Port/order"
Write-Host "Dashboard: http://localhost:$Port/dashboard"
Write-Host "Owner portal: http://localhost:$Port/portal"

