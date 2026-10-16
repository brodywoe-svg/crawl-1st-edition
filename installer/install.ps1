# Installs (or updates) Crawl 1st Edition for the current Windows user.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$version  = '33.2.1'
$sha256   = 'C325A6D905C67107E166267813EA2151AE7FD316C0A88DE0081DB0B9851A9946'
$name     = 'Crawl 1st Edition'
$oldName  = 'Crawl Spell Compendium'   # the app's earlier name; its saved spells folder is still used
$dest     = Join-Path $env:LOCALAPPDATA "Programs\$name"
$appSrc   = Join-Path $PSScriptRoot 'app'
$zip      = Join-Path $env:TEMP "electron-v$version-win32-x64.zip"
$url      = "https://github.com/electron/electron/releases/download/v$version/electron-v$version-win32-x64.zip"

Write-Host ""
Write-Host "Installing $name..." -ForegroundColor White

$haveZip = (Test-Path $zip) -and ((Get-FileHash $zip -Algorithm SHA256).Hash -eq $sha256)
if (-not $haveZip) {
  Write-Host "Downloading the app engine (about 110 MB, one time only)..."
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
  if ((Get-FileHash $zip -Algorithm SHA256).Hash -ne $sha256) {
    Remove-Item $zip -Force
    throw "The download didn't match the expected file, so nothing was installed. Run the installer again."
  }
}

Get-Process -Name $name, $oldName -ErrorAction SilentlyContinue | Stop-Process -Force
# remove the copy installed under the old name, and its shortcuts
Remove-Item (Join-Path $env:LOCALAPPDATA "Programs\$oldName") -Recurse -Force -ErrorAction SilentlyContinue
foreach ($d in @([Environment]::GetFolderPath('Desktop'), (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'))) { Remove-Item (Join-Path $d "$oldName.lnk") -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 500
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Path $dest | Out-Null

Write-Host "Unpacking..."
Expand-Archive -Path $zip -DestinationPath $dest -Force
Rename-Item (Join-Path $dest 'electron.exe') "$name.exe"
Remove-Item (Join-Path $dest 'resources\default_app.asar') -ErrorAction SilentlyContinue
Copy-Item $appSrc (Join-Path $dest 'resources\app') -Recurse

$exe = Join-Path $dest "$name.exe"
$ico = Join-Path $dest 'resources\app\crawl-logo.ico'
# Give the program file the Crawl icon (rcedit by the Electron team, MIT license)
$rcedit = Join-Path $PSScriptRoot 'tools\rcedit-x64.exe'
if (Test-Path $rcedit) {
  try {
    & $rcedit $exe --set-icon $ico --set-version-string 'ProductName' $name --set-version-string 'FileDescription' $name | Out-Null
  } catch {
    Write-Host "Couldn't change the program's icon. The shortcuts still use the Crawl logo."
  }
}

$shell = New-Object -ComObject WScript.Shell
$places = @([Environment]::GetFolderPath('Desktop'), (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'))
foreach ($dir in $places) {
  $lnkPath = Join-Path $dir "$name.lnk"
  if (Test-Path $lnkPath) { Remove-Item $lnkPath -Force }
  $lnk = $shell.CreateShortcut($lnkPath)
  $lnk.TargetPath = $exe
  $lnk.WorkingDirectory = $dest
  $lnk.IconLocation = $ico
  $lnk.Description = 'Crawl 1st Edition'
  $lnk.Save()
}

# Ask Windows to refresh its icon cache so the new icons show right away
try { Start-Process -FilePath "$env:SystemRoot\System32\ie4uinit.exe" -ArgumentList '-show' -WindowStyle Hidden } catch {}

Write-Host ""
Write-Host "Done! Open $name from your Desktop or Start menu." -ForegroundColor Green
Write-Host "Your spells are saved in: $env:APPDATA\$oldName\spells.json"
Start-Process $exe
