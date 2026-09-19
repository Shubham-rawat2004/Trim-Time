$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot '.env'
if (-not (Test-Path -LiteralPath $envPath)) { throw 'Create .env from .env.example first.' }
$settings = @{}
foreach ($line in Get-Content -LiteralPath $envPath) {
    if ($line -match '^([A-Z_]+)=(.*)$') { $settings[$matches[1]] = $matches[2] }
}
if (-not $settings['MYSQL_PASSWORD']) { throw 'MYSQL_PASSWORD is required in .env.' }
$env:DB_USER = $settings['MYSQL_USER']
$env:DB_PASSWORD = $settings['MYSQL_PASSWORD']
$env:DB_URL = 'jdbc:mysql://localhost:{0}/{1}?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true&allowPublicKeyRetrieval=true&sslMode=DISABLED' -f $settings['MYSQL_PORT'], $settings['MYSQL_DATABASE']
$env:SERVER_ADDRESS = '127.0.0.1'
$env:SERVER_PORT = $settings['APP_PORT']
Push-Location (Join-Path $projectRoot 'backend')
try { & .\mvnw.cmd spring-boot:run } finally { Pop-Location }
