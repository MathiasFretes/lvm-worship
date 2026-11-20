param(
  [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9_.-]*$')][string]$SshHost = 'hostinger-vps',
  [string]$Directory = (Join-Path $env:USERPROFILE 'Backups/LaVozMisionera')
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security.Cryptography.ProtectedData
$remoteFile = (& ssh -o BatchMode=yes $SshHost 'find /srv/backups/la-voz-misionera -maxdepth 1 -name "lvm_worship_*.dump" | sort | tail -1').Trim()
if ($LASTEXITCODE -ne 0 -or $remoteFile -notmatch '^/srv/backups/la-voz-misionera/lvm_worship_[0-9]{8}T[0-9]{6}Z\.dump$') {
  throw 'No verified database backup was found on the VPS.'
}
$digestLine = (& ssh -o BatchMode=yes $SshHost "sha256sum $remoteFile").Trim()
if ($LASTEXITCODE -ne 0 -or $digestLine -notmatch '^([0-9a-f]{64})\s') { throw 'Cannot verify the remote backup checksum.' }
$expectedHash = $Matches[1].ToUpperInvariant()
$backupDirectory = [IO.Path]::GetFullPath($Directory)
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
$name = [IO.Path]::GetFileName($remoteFile)
$encryptedFile = Join-Path $backupDirectory "$name.dpapi"
if (Test-Path -LiteralPath $encryptedFile) { throw 'This backup already exists locally; keep the existing copy.' }
$plainFile = Join-Path $backupDirectory "$name.$([guid]::NewGuid().ToString('N')).partial"
try {
  & scp "${SshHost}:$remoteFile" $plainFile
  if ($LASTEXITCODE -ne 0) { throw 'Backup download failed.' }
  if ((Get-FileHash -LiteralPath $plainFile -Algorithm SHA256).Hash -ne $expectedHash) { throw 'The backup checksum does not match.' }
  $entropy = [Text.Encoding]::UTF8.GetBytes('LVM PostgreSQL backup v1')
  $scope = [Security.Cryptography.DataProtectionScope]::CurrentUser
  $encrypted = [Security.Cryptography.ProtectedData]::Protect([IO.File]::ReadAllBytes($plainFile), $entropy, $scope)
  [IO.File]::WriteAllBytes($encryptedFile, $encrypted)
  $roundtrip = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($encryptedFile), $entropy, $scope)
  $sha = [Security.Cryptography.SHA256]::Create()
  try { $actualHash = [BitConverter]::ToString($sha.ComputeHash($roundtrip)).Replace('-', '') }
  finally { $sha.Dispose() }
  if ($actualHash -ne $expectedHash -or [Text.Encoding]::ASCII.GetString($roundtrip, 0, 5) -ne 'PGDMP') { throw 'Encrypted backup recovery verification failed.' }
  @{
    version = 1; source = $name; sha256 = $expectedHash
    protectedBy = 'Windows DPAPI CurrentUser'; entropy = 'LVM PostgreSQL backup v1'
    copiedAtUtc = [DateTime]::UtcNow.ToString('o')
  } | ConvertTo-Json | Set-Content -LiteralPath "$encryptedFile.json" -Encoding utf8
  Write-Output "Encrypted backup verified: $encryptedFile"
}
finally {
  # Only remove the exact plaintext file created by this invocation.
  if (Test-Path -LiteralPath $plainFile) { Remove-Item -LiteralPath $plainFile -Force }
}
