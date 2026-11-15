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
# Pinned local inputs prevent rebuilds from accumulating lossy compression.
foreach ($name in @('mer','pathfinder','phoenix','backshell')) {
    if (-not (Test-Path -LiteralPath "assets-raw/model-upgrade/$name.blend")) {
        throw "Missing editable source: assets-raw/model-upgrade/$name.blend"
    }
}
foreach ($name in @('pathfinder','backshell','ingenuity')) {
    if (-not (Test-Path -LiteralPath "assets-raw/global-refine/originals/$name.glb")) {
        throw "Missing pinned pre-refinement export: assets-raw/global-refine/originals/$name.glb"
    }
}
if (-not (Test-Path -LiteralPath assets-raw/global-refine/insight-source.glb)) {
    throw 'Missing pinned, meshopt-decoded InSight input: assets-raw/global-refine/insight-source.glb'
}
& $Blender -b --disable-autoexec --python-exit-code 1 --python scripts/model-upgrade/refine_assets.py
if ($LASTEXITCODE) { throw 'Static LOD/PBR Blender export failed.' }
& $Blender -b --disable-autoexec --python-exit-code 1 --python scripts/model-upgrade/build_viking_materials.py
if ($LASTEXITCODE) { throw 'Viking Blender bake failed.' }
npx -y --package=@gltf-transform/cli@4.5.1 node scripts/model-upgrade/pack_global.mjs
if ($LASTEXITCODE) { throw 'Fleet compression/contract verification failed.' }
npx -y --package=@gltf-transform/cli@4.5.1 node scripts/model-upgrade/validate_global.mjs
if ($LASTEXITCODE) { throw 'GLB validation failed; public assets were not replaced.' }
Get-ChildItem -LiteralPath assets-raw/global-refine/final -Filter '*.glb' | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path 'public/models' $_.Name)
}
python scripts/model-upgrade/asset_report.py
if ($LASTEXITCODE) { throw 'Model manifest failed.' }
