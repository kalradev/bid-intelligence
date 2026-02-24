# Create a PostgreSQL dump file for backup or deployment migration
# Requires: PostgreSQL client tools (pg_dump) in PATH, or run from Docker
# Usage: .\create_dump.ps1   (uses .env or defaults)
#        .\create_dump.ps1 -DbName Bid2 -OutDir .\dumps

param(
    [string]$DbName = "Bid2",
    [string]$DbUser = "postgres",
    [string]$DbHost = "127.0.0.1",
    [string]$DbPort = "5432",
    [string]$OutDir = ".\dumps",
    [switch]$SchemaOnly
)

# Load .env if present (simple key=value)
$envPath = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match "^\s*POSTGRES_DB=(.*)$") { $DbName = $Matches[1].Trim() }
        elseif ($_ -match "^\s*POSTGRES_USER=(.*)$") { $DbUser = $Matches[1].Trim() }
        elseif ($_ -match "^\s*POSTGRES_HOST=(.*)$") { $DbHost = $Matches[1].Trim() }
        elseif ($_ -match "^\s*POSTGRES_PORT=(.*)$") { $DbPort = $Matches[1].Trim() }
        elseif ($_ -match "^\s*POSTGRES_PASSWORD=(.*)$") { $env:PGPASSWORD = $Matches[1].Trim() }
    }
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$fileName = "bid_intelligence_dump_$timestamp.sql"
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }
$outPath = Join-Path $OutDir $fileName

$schemaFlag = if ($SchemaOnly) { "--schema-only" } else { "" }
$env:PGPASSWORD = if ($env:PGPASSWORD) { $env:PGPASSWORD } else { "postgres" }

Write-Host "Dumping database '$DbName' to $outPath ..."
& pg_dump -h $DbHost -p $DbPort -U $DbUser -d $DbName --no-owner --no-acl -f $outPath $schemaFlag
if ($LASTEXITCODE -eq 0) {
    Write-Host "Done. Dump file: $outPath"
} else {
    Write-Host "pg_dump failed. Ensure PostgreSQL client is installed and DB is running."
    exit 1
}
