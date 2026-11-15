param([string]$Blender)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
Set-Location -LiteralPath $projectRoot
if (-not $Blender) {
    $Blender = @('D:\SteamLibrary\steamapps\common\Blender\blender.exe',
        "$env:ProgramFiles\Blender Foundation\Blender 5.3\blender.exe") |
        Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $Blender) { $Blender = (Get-Command blender -ErrorAction SilentlyContinue).Source }
}
if (-not $Blender) { throw 'Pass -Blender with the path to blender.exe.' }
& $Blender -b --disable-autoexec --python-exit-code 1 --python scripts/model-upgrade/build_viking_materials.py
if ($LASTEXITCODE) { throw 'Viking Blender bake failed.' }
npx -y --package=@gltf-transform/cli@4.5.1 node scripts/model-upgrade/pack_viking.mjs
if ($LASTEXITCODE) { throw 'Viking lossless meshopt/geometry verification failed.' }
npx -y '@gltf-transform/cli@4.5.1' validate assets-raw/global-refine/final/viking-lander.glb
if ($LASTEXITCODE) { throw 'Viking GLB validation failed.' }
Copy-Item -LiteralPath assets-raw/global-refine/final/viking-lander.glb -Destination public/models/viking-lander.glb
python scripts/model-upgrade/asset_report.py
if ($LASTEXITCODE) { throw 'Model manifest failed.' }
