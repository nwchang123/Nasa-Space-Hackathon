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
npx -y '@gltf-transform/cli@4.5.1' tangents assets-raw/viking-material-upgrade/viking-materials-raw.glb assets-raw/viking-material-upgrade/viking-tangents.glb --overwrite true
if ($LASTEXITCODE) { throw 'Viking tangents failed.' }
npx -y '@gltf-transform/cli@4.5.1' resize assets-raw/viking-material-upgrade/viking-tangents.glb assets-raw/viking-material-upgrade/viking-data-512.glb --pattern '{*micro-normal*,*roughness-metallic*}' --width 512 --height 512
if ($LASTEXITCODE) { throw 'Viking data texture resize failed.' }
npx -y '@gltf-transform/cli@4.5.1' webp assets-raw/viking-material-upgrade/viking-data-512.glb assets-raw/viking-material-upgrade/viking-color-webp.glb --slots baseColorTexture --quality 88 --effort 75
if ($LASTEXITCODE) { throw 'Viking colour compression failed.' }
npx -y '@gltf-transform/cli@4.5.1' webp assets-raw/viking-material-upgrade/viking-color-webp.glb assets-raw/viking-material-upgrade/viking-textures.glb --slots '{normalTexture,metallicRoughnessTexture}' --quality 90 --near-lossless true --effort 75
if ($LASTEXITCODE) { throw 'Viking data texture compression failed.' }
npx -y --package=@gltf-transform/cli@4.5.1 node scripts/model-upgrade/pack_viking.mjs
if ($LASTEXITCODE) { throw 'Viking lossless meshopt/geometry verification failed.' }
npx -y '@gltf-transform/cli@4.5.1' validate assets-raw/viking-material-upgrade/viking-lander-final.glb
if ($LASTEXITCODE) { throw 'Viking GLB validation failed.' }
Copy-Item -LiteralPath assets-raw/viking-material-upgrade/viking-lander-final.glb -Destination public/models/viking-lander.glb
