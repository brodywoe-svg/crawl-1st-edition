$name = 'Crawl 1st Edition'
$oldName = 'Crawl Spell Compendium'
Get-Process -Name $name, $oldName -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item (Join-Path $env:LOCALAPPDATA "Programs\$name") -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path ([Environment]::GetFolderPath('Desktop')) "$name.lnk") -ErrorAction SilentlyContinue
Remove-Item (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\$name.lnk") -ErrorAction SilentlyContinue
foreach ($n in @($oldName)) {
  Remove-Item (Join-Path $env:LOCALAPPDATA "Programs\$n") -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item (Join-Path ([Environment]::GetFolderPath('Desktop')) "$n.lnk") -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\$n.lnk") -ErrorAction SilentlyContinue
}
Write-Host "$name was removed. Your saved spells were kept in $env:APPDATA\$oldName"
