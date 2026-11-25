param(
  [string]$ReportDirectory = (Join-Path $PSScriptRoot '.local'),
  [switch]$ReuseSchema
)

$ErrorActionPreference = 'Stop'
$psqlPath = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$sqlPath = Join-Path $PSScriptRoot 'be02_1.sql'
$runId = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfff')
$logPath = Join-Path $ReportDirectory "be02_1-$runId.log"
$consolePath = Join-Path $ReportDirectory "console-$runId.log"
$resultPath = Join-Path $ReportDirectory 'result.json'
$startedAt = [DateTime]::UtcNow.ToString('o')

New-Item -ItemType Directory -Path $ReportDirectory -Force | Out-Null
$env:PGCLIENTENCODING = 'UTF8'
$env:PGCONNECT_TIMEOUT = '10'

Write-Host 'Novely BE02.1 - LOCAL PostgreSQL test only'
Write-Host 'Target: 127.0.0.1:5432 / novely_test / postgres'
Write-Host 'Enter the password at the psql prompt. It is not saved in this script or the report.'
Write-Host 'The SQL runner verifies the target and an empty database before loading the schema.'

try {
  # Capture PostgreSQL errors as well as query results. Password input stays on
  # the console: psql disables its echo and never emits its value to this pipe.
  $ErrorActionPreference = 'Continue'
  & $psqlPath -X -W -h 127.0.0.1 -p 5432 -U postgres -d novely_test `
    -v ON_ERROR_STOP=1 -v "reuse_schema=$($ReuseSchema.IsPresent)" -P pager=off -L $logPath -f $sqlPath 2>&1 |
    Tee-Object -FilePath $consolePath
  $testExitCode = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
} catch {
  Write-Host 'Unable to launch psql. Check the executable and report paths.'
  $testExitCode = 1
}

[ordered]@{
  database = 'novely_test'
  host = '127.0.0.1'
  port = 5432
  exitCode = $testExitCode
  startedAt = $startedAt
  completedAt = [DateTime]::UtcNow.ToString('o')
  logPath = $logPath
  consolePath = $consolePath
} | ConvertTo-Json | Set-Content -LiteralPath $resultPath -Encoding UTF8

Write-Host "Test process exit code: $testExitCode"
Write-Host "Report: $logPath"
Write-Host 'The password was entered directly into psql and was not written to the report.'
Read-Host 'Press Enter to close this window' | Out-Null
exit $testExitCode
