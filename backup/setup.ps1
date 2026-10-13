param(
  [string]$Repository = 'sani1415/10-waqful_madinah',
  [string]$ToolsDirectory = (Join-Path $env:LOCALAPPDATA 'WaqfBackupTools'),
  [string]$RecoveryDirectory = (Join-Path $env:USERPROFILE '.config\waqf-backup'),
  [switch]$OAuthOnly,
  [switch]$DatabaseOnly
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Run-PrivateProcess([string]$Binary, [string[]]$Arguments, [string]$InputText = '') {
  $info = [Diagnostics.ProcessStartInfo]::new()
  $info.FileName = $Binary
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardInput = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  foreach ($argument in $Arguments) { $info.ArgumentList.Add($argument) }
  $process = [Diagnostics.Process]::Start($info)
  $outTask = $process.StandardOutput.ReadToEndAsync()
  $errTask = $process.StandardError.ReadToEndAsync()
  $process.StandardInput.Write($InputText)
  $process.StandardInput.Close()
  $process.WaitForExit()
  $outputText = $outTask.GetAwaiter().GetResult()
  $null = $errTask.GetAwaiter().GetResult()
  if ($process.ExitCode -ne 0) { throw 'A setup tool failed. Check sign-in, installed tools and access. Raw output is hidden to protect credentials.' }
  return $outputText
}
function Get-PrivateInput([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secure.Dispose() }
}
function Install-VerifiedRelease([string]$Project, [string]$AssetPattern, [string]$Executable) {
  $found = Get-Command $Executable -ErrorAction SilentlyContinue
  if ($found) { return $found.Source }
  $existing = Join-Path $ToolsDirectory $Executable
  if (Test-Path -LiteralPath $existing) { return $existing }
  New-Item -ItemType Directory -Path $ToolsDirectory -Force | Out-Null
  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Project/releases/latest" -Headers @{'User-Agent'='WaqfBackupSetup'}
  $asset = @($release.assets | Where-Object name -Like $AssetPattern)
  if ($asset.Count -ne 1 -or $asset[0].digest -notmatch '^sha256:([a-f0-9]{64})$') { throw 'Official release checksum unavailable; install rclone and age yourself before setup.' }
  $expectedHash = $Matches[1]
  $zip = Join-Path $ToolsDirectory $asset[0].name
  Invoke-WebRequest -Uri $asset[0].browser_download_url -OutFile $zip
  if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) { throw 'Tool download checksum mismatch.' }
  $unpack = Join-Path $ToolsDirectory $release.tag_name
  Expand-Archive -LiteralPath $zip -DestinationPath $unpack -Force
  $binary = @(Get-ChildItem -LiteralPath $unpack -Recurse -File -Filter $Executable)
  if ($binary.Count -ne 1) { throw 'Unexpected tool archive layout.' }
  # Keep companion age-keygen.exe beside age.exe.
  Get-ChildItem -LiteralPath $binary[0].DirectoryName -File -Filter '*.exe' | Copy-Item -Destination $ToolsDirectory -Force
  return $existing
}
function Set-RepoSecret([string]$Name, [string]$Value) {
  $null = Run-PrivateProcess 'gh' @('secret','set',$Name,'--repo',$Repository) $Value
  Write-Host "Configured secret: $Name"
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'Install/sign in to GitHub CLI first.' }
if ($DatabaseOnly) {
  $poolerPath = Join-Path $PSScriptRoot '..\supabase\.temp\pooler-url'
  if (-not (Test-Path -LiteralPath $poolerPath)) { throw 'Linked Session pooler URL not available.' }
  $password = Get-PrivateInput 'Enter the Supabase DATABASE password (not your app PIN; input is hidden)'
  try {
    $inputData = @{poolerUrl=([IO.File]::ReadAllText($poolerPath).Trim()); password=$password; repository=$Repository} | ConvertTo-Json -Compress
    Write-Host (Run-PrivateProcess 'node' @((Join-Path $PSScriptRoot 'configure-database.mjs')) $inputData)
  } finally { $password=$null; $inputData=$null }
  return
}
$rclone = Install-VerifiedRelease 'rclone/rclone' '*windows-amd64.zip' 'rclone.exe'
$age = Install-VerifiedRelease 'FiloSottile/age' '*windows-amd64.zip' 'age.exe'
New-Item -ItemType Directory -Path $RecoveryDirectory -Force | Out-Null
$account = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$null = & icacls.exe $RecoveryDirectory /inheritance:r /grant:r "${account}:(OI)(CI)F"
if ($LASTEXITCODE -ne 0) { throw 'Cannot protect recovery-key directory.' }
$configPath = Join-Path $RecoveryDirectory 'rclone.conf'
if (-not (Test-Path -LiteralPath $configPath)) {
  Write-Host 'Opening Microsoft sign-in. Authorize your OneDrive in the browser; no password is requested in chat.'
  $authText = Run-PrivateProcess $rclone @('authorize','onedrive')
  $tokenLines = @($authText -split "`n" | Where-Object { $_.Trim().StartsWith('{') -and $_ -match 'access_token' })
  if ($tokenLines.Count -ne 1) { throw 'Microsoft authorization did not return a token.' }
  $token = $tokenLines[0].Trim() | ConvertFrom-Json
  $drive = Invoke-RestMethod -Uri 'https://graph.microsoft.com/v1.0/me/drive' -Headers @{Authorization=('Bearer '+$token.access_token)}
  $tokenJson = $token | ConvertTo-Json -Compress
  $configText = "[onedrive]`ntype = onedrive`ntoken = $tokenJson`ndrive_id = $($drive.id)`ndrive_type = $($drive.driveType)`n"
  [IO.File]::WriteAllText($configPath, $configText, [Text.UTF8Encoding]::new($false))
  $authText = $null; $token = $null; $tokenJson = $null; $configText = $null
}
$null = Run-PrivateProcess $rclone @('--config',$configPath,'mkdir','onedrive:2-Documents/Database Backups/Waqful Madinah')
$null = Run-PrivateProcess $rclone @('--config',$configPath,'mkdir','onedrive:2-Documents/Database Backups/1-idarah')
Write-Host 'OneDrive destination connected; both project folders are ready.'
if ($OAuthOnly) { Write-Host 'OneDrive authentication finished. Run this script again without -OAuthOnly to configure remaining secrets.'; return }

$identityPath = Join-Path $RecoveryDirectory 'recovery-key.txt'
$keygen = Join-Path (Split-Path -Parent $age) 'age-keygen.exe'
if (-not (Test-Path -LiteralPath $identityPath)) { $null = Run-PrivateProcess $keygen @('-o',$identityPath) }
$recipient = (Run-PrivateProcess $keygen @('-y',$identityPath)).Trim()
Write-Host "Recovery key saved privately at $identityPath. Keep an offline copy separately from OneDrive backups."

# Values are entered in a local masked prompt and passed to gh through stdin,
# never in arguments, committed files, logs or chat.
$databaseUrl = Get-PrivateInput 'Paste the Supabase Session pooler connection URL (port 5432, including database password)'
if ($databaseUrl -notmatch '^postgres(?:ql)?://') { throw 'Invalid PostgreSQL connection URL.' }
$storageKey = Get-PrivateInput 'Paste the Supabase server secret/service-role key for Storage downloads'
$tokenKeyPath = Join-Path $RecoveryDirectory 'token-encryption-key.txt'
if (-not (Test-Path -LiteralPath $tokenKeyPath)) {
  $tokenKey = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
  [IO.File]::WriteAllText($tokenKeyPath, $tokenKey, [Text.UTF8Encoding]::new($false))
}
try {
  Set-RepoSecret 'BACKUP_DATABASE_URL' $databaseUrl
  Set-RepoSecret 'BACKUP_SUPABASE_SERVICE_ROLE_KEY' $storageKey
  Set-RepoSecret 'BACKUP_AGE_RECIPIENT' $recipient
  Set-RepoSecret 'BACKUP_TOKEN_ENCRYPTION_KEY' ([IO.File]::ReadAllText($tokenKeyPath).Trim())
  Set-RepoSecret 'RCLONE_CONFIG_B64' ([Convert]::ToBase64String([IO.File]::ReadAllBytes($configPath)))
} finally { $databaseUrl = $null; $storageKey = $null; $tokenKey = $null }
Write-Host 'Secrets configured. Once the reviewed workflow is on main, run: gh workflow run database-backup.yml --repo sani1415/10-waqful_madinah -f force=true'
