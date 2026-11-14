param([string]$Blender, [string[]]$Models = @('mer', 'pathfinder', 'phoenix', 'backshell'))
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
Set-Location -LiteralPath $projectRoot
$work = Join-Path $projectRoot 'assets-raw\model-upgrade'
New-Item -ItemType Directory -Path $work -Force | Out-Null
if (-not $Blender) {
    $candidates = @(
        'D:\SteamLibrary\steamapps\common\Blender\blender.exe',
        "$env:ProgramFiles\Blender Foundation\Blender 5.3\blender.exe"
    )
    $onPath = Get-Command blender -ErrorAction SilentlyContinue
    if ($onPath) { $candidates = @($onPath.Source) + $candidates }
    $Blender = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $Blender) { throw 'Pass -Blender with the full path to blender.exe.' }
$archive = Join-Path $work 'mer-official.zip'
$source = Join-Path $work 'mer-official.blend'
if (-not (Test-Path -LiteralPath $source)) {
    if (-not (Test-Path -LiteralPath $archive)) {
        Invoke-WebRequest -Uri 'https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/mars-exploration-rover---spirit-and-opportunity/Mars%20Exploration%20Rover%20-%20Spirit%20and%20Opportunity.zip' -OutFile $archive
    }
    @'
from pathlib import Path
import zipfile
work=Path('assets-raw/model-upgrade')
with zipfile.ZipFile(work/'mer-official.zip') as archive:
    name=next(n for n in archive.namelist() if n.lower().endswith('.blend'))
    (work/'mer-official.blend').write_bytes(archive.read(name))
'@ | python -
    if ($LASTEXITCODE) { throw 'Could not extract the NASA source.' }
}
npx -y '@gltf-transform/cli@4.5.1' copy public/models/insight.glb assets-raw/model-upgrade/insight-decoded.glb
if ($LASTEXITCODE) { throw 'Could not decode the existing InSight platform.' }
& $Blender -b --disable-autoexec --python-exit-code 1 --python scripts/model-upgrade/build_assets.py -- @Models
if ($LASTEXITCODE) { throw 'Blender asset generation failed.' }
foreach ($model in $Models) {
    npx -y '@gltf-transform/cli@4.5.1' tangents "assets-raw/model-upgrade/$model-raw.glb" "assets-raw/model-upgrade/$model-tangents.glb" --overwrite true
    if ($LASTEXITCODE) { throw "Tangent generation failed for $model." }
    # Flatten/join/instance would destroy the transform contracts used by signature actions.
    npx -y '@gltf-transform/cli@4.5.1' optimize "assets-raw/model-upgrade/$model-tangents.glb" "public/models/$model.glb" --compress meshopt --texture-compress webp --texture-size 1024 --flatten false --join false --instance false --palette false --simplify false --prune false
    if ($LASTEXITCODE) { throw "Compression failed for $model." }
    npx -y '@gltf-transform/cli@4.5.1' validate "public/models/$model.glb"
    if ($LASTEXITCODE) { throw "glTF validation failed for $model." }
}
python scripts/model-upgrade/asset_report.py
if ($LASTEXITCODE) { throw 'Final asset report failed (system Python needs Pillow).' }
