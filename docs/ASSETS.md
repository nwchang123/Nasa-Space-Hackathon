# 素材清单：NASA 3D 模型和火星地图（等你确认后才下载）

调研日期：2026-11-14。**到目前为止没有下载任何素材文件。** 文件大小来自 HTTP HEAD 的 `Content-Length`。图片分辨率和模型的三角形数、贴图数，是只读文件开头（HTTP Range，前 64–256 KB，读完即丢、没有存盘）得到的。

## 结论

- 9 站里有 6 站能用 NASA 官方模型：Viking 1、Viking 2、Spirit、Opportunity、InSight、Ingenuity。用到 4 个文件，因为两台 Viking 是同一型号，Spirit 和 Opportunity 也是同一型号。
- 有 3 站 NASA 没有模型，继续用代码画的剪影，并标"示意"：Pathfinder + Sojourner、Phoenix、Perseverance 的降落伞和后盖。
- 火星地图推荐用 NASA Mars Trek 的 Viking 彩色拼接图（MDIM 2.1）。下载 128 张瓦片，在本地拼成 4096×2048、以 0° 经线为中心的等距圆柱图。NASA 3D Resources 自带的 `Mars.jpg` 只有 1440×720，留作备选。
- MOLA 高程图找到了合适的来源，但要改代码才能用上，放在"可选"里。
- 推荐清单下载总量约 **14.6 MB**。压缩后放进网站的总量约 **3.7–6.1 MB**。打开页面时只加载地图和 Ingenuity，约 1.3–2.5 MB；其他模型到站时再加载。

## 每一站对应的素材

| 站（`MachineId`） | 用什么 | 说明 |
|---|---|---|
| `viking-1` | Viking Lander.glb | 两台 Viking 着陆器是同一型号 |
| `viking-2` | Viking Lander.glb（同一个文件） | 同上 |
| `pathfinder-sojourner` | 程序化剪影 | NASA 3D Resources 没有 Pathfinder 和 Sojourner |
| `spirit` | MER-B .glb（同一个文件） | Spirit 和 Opportunity 是同型号的双胞胎；这个模型很简化 |
| `opportunity` | MER-B .glb | 同上 |
| `phoenix` | 程序化剪影 | 没有 Phoenix 模型 |
| `insight` | InSight Cruise Lander (arm deployed).glb | 着陆后的形态，太阳能板和机械臂展开 |
| `mars2020-edl` | 程序化剪影 | 没有降落伞和后盖的模型（Perseverance 车体模型有，但它不是这一站） |
| `ingenuity` | Ingenuity Mars Helicopter.glb | 也可以当飞行途中的向导模型，一个文件用三处 |

## A. 3D 模型

所有模型都来自 NASA 3D Resources。网站页面在 science.nasa.gov/3d-resources，文件放在 assets.science.nasa.gov 上，GitHub 仓库 `nasa/NASA-3D-Resources` 里也有同样的文件。

| 资源 | 来源页面 | 文件 | 格式 | 大小 | 授权与署名 | 是否适合网页 | 建议 |
|---|---|---|---|---|---|---|---|
| Viking Lander | [viking-lander](https://science.nasa.gov/3d-resources/viking-lander/) | [Viking Lander.glb](https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/viking-lander/Viking%20Lander.glb) | GLB；99.5k 三角形，9 种材质，**无贴图、无压缩** | 1,849,384 B（1.76 MB） | 无版权（见下文）；署名 NASA/Michael D. Carbajal | 适合。压缩后约 0.5–0.8 MB | **推荐**，Viking 1 和 Viking 2 共用 |
| InSight Cruise Lander（arm deployed） | [insight-cruise-lander](https://science.nasa.gov/3d-resources/insight-cruise-lander/) | [InSight Cruise Lander (arm deployed).glb](<https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/insight-cruise-lander/InSight%20Cruise%20Lander%20(arm%20deployed).glb>) | GLB；147k 三角形，100 个网格，已用 Draco；22 张贴图，是 11 张 WebP 加上 11 张重复的 JPEG 备用图 | 3,949,036 B（3.77 MB） | 无版权；署名 NASA/Brian E. Kumanchik | 原文件偏大。去掉备用图、把贴图缩到 1024 后约 1.9–2.8 MB | **推荐**。页面说明是"着陆形态，太阳能板和机械臂已展开，地震仪和热流探针还没放下" |
| InSight（panels deployed） | 同上 | InSight Cruise Lander (panels deployed).glb | GLB | 3,948,936 B | 同上 | 同上 | 不推荐，机械臂收着 |
| InSight（panels stowed） | 同上 | InSight Cruise Lander (panels stowed).glb | GLB | 约 3.55 MB（页面标注） | 同上 | 同上 | 不推荐，不是着陆后的样子 |
| InSight（stowed） | 同上 | InSight Cruise Lander (stowed).glb | GLB | 3,990,572 B | 同上 | 同上 | 不推荐，巡航形态 |
| Ingenuity Mars Helicopter | [ingenuity-mars-helicopter](https://science.nasa.gov/3d-resources/ingenuity-mars-helicopter/) | [Ingenuity Mars Helicopter.glb](https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/ingenuity-mars-helicopter/Ingenuity%20Mars%20Helicopter.glb) | GLB；9.1k 三角形，已用 Draco；16 张贴图，是 8 张 WebP 加上 8 张 JPEG/PNG 备用图 | 2,019,408 B（1.93 MB） | 无版权；署名 NASA/Brian E. Kumanchik | 很适合。去掉备用图后约 0.3–0.45 MB | **推荐**，用作开场、向导和终点 |
| Mars Exploration Rover – Opportunity（MER-B） | [mars-exploration-rover-opportunity-mer-b](https://science.nasa.gov/3d-resources/mars-exploration-rover-opportunity-mer-b/) | [Mars Exploration Rover - Opportunity (MER-B).glb](<https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/mars-exploration-rover---opportunity-(mer-b)/Mars%20Exploration%20Rover%20-%20Opportunity%20(MER-B).glb>) | GLB；3.8k 三角形，已用 Draco，无贴图，**很简化** | 36,668 B（36 KB） | 无版权；署名 NASA/Ames Research Center | 适合，几乎不占体积 | **推荐**，Spirit 和 Opportunity 共用。远看可以，近看比较粗糙 |
| Mars Exploration Rover – Spirit and Opportunity（精细版） | [mars-exploration-rover-spirit-and-opportunity](https://science.nasa.gov/3d-resources/mars-exploration-rover-spirit-and-opportunity/) | [Mars Exploration Rover - Spirit and Opportunity.zip](https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/mars-exploration-rover---spirit-and-opportunity/Mars%20Exploration%20Rover%20-%20Spirit%20and%20Opportunity.zip) | ZIP，里面只有 .blend | 9,527,620 B（9.09 MB）；GitHub 里的 .blend 是 12,243,528 B | 无版权；署名 NASA | 不适合直接用，要先用 Blender 转成 GLB，本机没装 Blender | 不推荐，截止前不值得再装 Blender |
| Opportunity Landing Site（地形） | GitHub 仓库 `3D Printing/` 文件夹 | Opportunity Landing Site.stl | STL（3D 打印用，无贴图） | 2,756,784 B | 无版权；署名 NASA | 要转换，没有颜色 | 不推荐 |
| Mars – Spirit Landing Site（地形） | 同上 | Mars - Spirit Landing Site.stl | STL | 24,444,584 B | 同上 | 太大 | 不推荐 |

另外，Mars 2020 Perseverance Rover 有 GLB（4,987,176 B），但 Perseverance 还在工作，不是本作的一站，所以不列入。

## B. 火星彩色地图

代码要求的地图格式见 `src/scene/maps/README.md`：宽高比 2:1，0° 经线在中间（左边缘是 180°W），北在上，文件放在 `src/scene/maps/mars.jpg`（也可以是 `.png` 或 `.webp`）。

| 资源 | 来源页面 | 文件 | 格式 | 大小 | 授权与署名 | 是否适合网页 | 建议 |
|---|---|---|---|---|---|---|---|
| Viking MDIM 2.1 彩色全球拼接图（NASA Mars Trek 瓦片服务） | [Mars Trek](https://trek.nasa.gov/mars/)；[WMTS 说明文件](https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/WMTSCapabilities.xml) | 瓦片地址：`…/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0//default/default028mm/{层级}/{行}/{列}.jpg` | 256×256 JPEG 瓦片。第 3 层是 16×8 张，拼成 **4096×2048**；第 2 层是 8×4 张，拼成 2048×1024 | 抽样 3 张，每张 51–56 KB。第 3 层估计 ≈ 6.8 MB（128 张），第 2 层估计 ≈ 1.8 MB（32 张） | NASA/JPL-Caltech/USGS 的 Viking 数据，由 NASA Solar System Treks 提供。Trek 没有单独写授权，按 NASA 媒体指南署名 | 适合。范围是 −180°..180°、−90°..90°，左上角是 (−180°, 90°)，拼出来正好是 0° 在中间、北在上 | **推荐**：下载第 3 层，本地拼成 4096×2048，再按需要缩到 2048 |
| NASA 3D Resources「Mars」贴图 | [mars](https://science.nasa.gov/3d-resources/mars/) | [Mars.jpg](https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/image/mars/Mars.jpg)（GitHub 里也有） | JPEG，**1440×720** | 972,896 B（950 KB）；同页的 Mars.tif 是 3,137,136 B | 署名 NASA/Jet Propulsion Laboratory & Caltech；页面说明是 USGS 处理的 Viking 图像 | 可以用，但低于你要求的 2K | 备选：只要一个文件、最省事的方案。0° 是否在中间，下载后还要确认 |
| USGS Astrogeology Viking 彩色拼接图预览 | [astrogeology.usgs.gov](https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m) | mars_viking_clrmosaic_global_1024.jpg | JPEG，1024×512 | 60,229 B | USGS / NASA | 太小 | 不推荐 |
| 同上，512 版 | 同上 | mars_viking_clrmosaic_global_512.jpg | JPEG | 18,060 B | 同上 | 太小 | 不推荐 |
| USGS 全分辨率 GeoTIFF（MDIM 2.1 232 m、MOLA 463 m） | USGS Astropedia | 多 GB 的 GeoTIFF | GeoTIFF | 数 GB | USGS / NASA | 不适合，要用 GDAL 处理 | 不推荐 |

## C. MOLA 高程图（可选）

NASA 3D Resources 没有 MOLA 贴图。Mars Trek 上有两种可以直接拼的瓦片：

| 资源 | 来源页面 | 文件 | 格式 | 大小 | 授权与署名 | 是否适合网页 | 建议 |
|---|---|---|---|---|---|---|---|
| MGS MOLA 全球高程（Global DEM） | [WMTS 说明文件](https://trek.nasa.gov/tiles/Mars/EQ/mola128_mola64_merge_90Nto90S_SimpleC_clon0/1.0.0/WMTSCapabilities.xml) | `…/mola128_mola64_merge_90Nto90S_SimpleC_clon0/1.0.0//default/default028mm/{层级}/{行}/{列}.png` | 256×256 PNG，8 位灰度加透明通道。数值是拉伸后的灰度，**读不出真实海拔（米）** | 每张约 34 KB。第 2 层（2048×1024）估计 ≈ 1.1 MB | NASA/GSFC MOLA Science Team；由 NASA Solar System Treks 提供 | 适合当凹凸贴图（bump map） | 可选。要改 `surfaceMaps.ts` 和 `globeMaterial.ts` 才能用上，目前代码只读颜色图 |
| MGS MOLA 彩色晕渲图（Global Color Hillshade） | [WMTS 说明文件](https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/WMTSCapabilities.xml) | `…/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0//default/default028mm/{层级}/{行}/{列}.jpg` | 256×256 JPEG | 每张 46–79 KB。第 2 层估计 ≈ 2.1 MB | 同上 | 适合，可以做"地形视图"开关 | 可选，不推荐现在做 |

## 推荐下载清单（等你同意）

| # | 文件 | 来源 | 大小 |
|---|---|---|---|
| 1 | Viking Lander.glb | NASA 3D Resources | 1,849,384 B |
| 2 | InSight Cruise Lander (arm deployed).glb | NASA 3D Resources | 3,949,036 B |
| 3 | Ingenuity Mars Helicopter.glb | NASA 3D Resources | 2,019,408 B |
| 4 | Mars Exploration Rover - Opportunity (MER-B).glb | NASA 3D Resources | 36,668 B |
| 5 | Viking MDIM 2.1 彩色拼接图，第 3 层，128 张瓦片 | NASA Mars Trek | 约 6.8 MB（按抽样估算） |
| | **合计** | | **约 14.6 MB**（4 个模型共 7,854,496 B，加上约 6.8 MB 瓦片） |

可选，不在上面的合计里：

- MOLA 高程第 2 层瓦片，约 1.1 MB（要改代码）。
- NASA 3D Resources 的 `Mars.jpg`，972,896 B（只有 Mars Trek 拿不到时才用）。

不推荐：MER 精细版 ZIP（9.5 MB，还要装 Blender）、两个着陆点 STL、Perseverance 车体模型。

## 转换和压缩方案

### 1. 下载（你同意后才执行）

原始文件放在 `assets-raw/`，这个文件夹要加进 `.gitignore`，不进仓库。只有压缩后的文件进仓库。

```bash
mkdir -p assets-raw
```

```bash
curl -L -o "assets-raw/Viking Lander.glb" "https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/viking-lander/Viking%20Lander.glb"
```

```bash
curl -L -o "assets-raw/InSight Cruise Lander (arm deployed).glb" "https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/insight-cruise-lander/InSight%20Cruise%20Lander%20(arm%20deployed).glb"
```

```bash
curl -L -o "assets-raw/Ingenuity Mars Helicopter.glb" "https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/ingenuity-mars-helicopter/Ingenuity%20Mars%20Helicopter.glb"
```

```bash
curl -L -o "assets-raw/MER-B.glb" "https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/mars-exploration-rover---opportunity-(mer-b)/Mars%20Exploration%20Rover%20-%20Opportunity%20(MER-B).glb"
```

### 2. 模型压缩：glTF-Transform

工具通过 `npx` 临时运行，当前版本是 4.5.1。第一次运行会从 npm 下载这个工具和它依赖的图像库 sharp，这一步也要你同意。参数以 `--help` 的输出为准。

```bash
npx -y @gltf-transform/cli@4.5.1 inspect "assets-raw/Viking Lander.glb"
```

```bash
npx -y @gltf-transform/cli@4.5.1 optimize "assets-raw/Viking Lander.glb" public/models/viking-lander.glb --compress meshopt --texture-compress webp --texture-size 1024
```

其余三个模型用同一条命令，只换输入和输出文件名：`insight.glb`、`ingenuity.glb`、`mer.glb`。

- **用 meshopt，不用 Draco。** 原文件里有 3 个用了 Draco。three.js 读 Draco 要额外的解码器，drei 的 `useGLTF` 默认从 Google 的 CDN 去拿。meshopt 的解码器很小，已经打包在 three-stdlib 里，不需要访问外部网站。加载时写 `useGLTF(url, false, true)`。
- **去掉重复贴图。** InSight 和 Ingenuity 里，每张 WebP 贴图都带一张 JPEG/PNG 备用图，备用图占了文件的大头（Ingenuity 1.93 MB 里有 1.66 MB 是备用图）。转换后只保留 WebP。转完用 `inspect` 确认备用图确实没了。
- **贴图最大 1024 px。** InSight 的环境光遮蔽（AO）贴图较大，缩到 1024 后体积会明显变小。
- **每个模型不超过 3 MB。** 如果 InSight 用 meshopt 后还超过 3 MB，有两个办法：
  - 加 `--simplify-ratio 0.5 --simplify-error 0.001` 减少三角形；
  - 或者改用 `--compress draco`，把 `node_modules/three/examples/jsm/libs/draco/gltf/` 复制到 `public/draco/`，再调用 `useGLTF.setDecoderPath('/draco/')`，不走外部 CDN。
- 转换后用 `inspect` 看包围盒，确认单位是米，在场景里统一缩放。
- 模型只在到站时加载，开场只加载 Ingenuity。

### 3. 地图拼接：Python + Pillow

本机已经装了 Pillow 11.2.1。下面的脚本按顺序抓取瓦片，每张间隔 0.1 秒，在内存里拼好后存成一张大图，不保留单张瓦片。

```python
# 用法：python -I stitch_trek.py <图层> <层级> <扩展名 jpg|png> <输出文件> [RGB|L]
import io, sys, time, urllib.request
from PIL import Image

layer, z, ext, out = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
mode = sys.argv[5] if len(sys.argv) > 5 else "RGB"
cols, rows = 2 ** (z + 1), 2 ** z          # 第 3 层：16 × 8；第 2 层：8 × 4
base = f"https://trek.nasa.gov/tiles/Mars/EQ/{layer}/1.0.0//default/default028mm/{z}"
canvas = Image.new(mode, (cols * 256, rows * 256))
for r in range(rows):                       # 第 0 行是北极
    for c in range(cols):                   # 第 0 列从 180°W 开始
        req = urllib.request.Request(f"{base}/{r}/{c}.{ext}", headers={"User-Agent": "asset-fetch/1.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            canvas.paste(Image.open(io.BytesIO(resp.read())).convert(mode), (c * 256, r * 256))
        time.sleep(0.1)
canvas.save(out)
```

```bash
python -I stitch_trek.py Mars_Viking_MDIM21_ClrMosaic_global_232m 3 jpg assets-raw/mars-viking-4096.png
```

```bash
python -I -c "from PIL import Image; im=Image.open('assets-raw/mars-viking-4096.png'); im.save('src/scene/maps/mars.webp', quality=85, method=6)"
```

- 如果 `mars.webp` 超过 2 MB，就改成 2048×1024：先 `im.resize((2048, 1024), Image.LANCZOS)`，再存成 `src/scene/maps/mars.jpg`（quality 88）。
- 放进去后，`surfaceMaps.ts` 会在构建时自动换成真实地图，不用改代码。
- 拼完要检查一下：Jezero 在 18.4°N、77.5°E 附近，应该在图的右半边、赤道略偏北。

### 4. 预计最终大小（都是估算，转换后以实际为准）

| 文件 | 原始 | 压缩后 |
|---|---|---|
| viking-lander.glb | 1.85 MB | 0.5–0.8 MB |
| insight.glb | 3.95 MB | 1.9–2.8 MB |
| ingenuity.glb | 2.02 MB | 0.3–0.45 MB |
| mer.glb | 0.04 MB | 约 0.05 MB |
| mars.webp（4096×2048） | 约 6.8 MB 瓦片 | 1.0–2.0 MB（如果改用 2048 的 JPG，是 0.4–0.7 MB） |
| **合计** | **约 14.6 MB** | **约 3.7–6.1 MB** |

网站托管平台通常会对文件再做 gzip 或 brotli 压缩，meshopt 的几何数据会更小一些。

## 没有 NASA 模型的站

以下 3 站保留现在代码画的剪影，标"示意"：

- **Pathfinder + Sojourner**（`pathfinder-sojourner`）
- **Phoenix**（`phoenix`）
- **Perseverance 的降落伞和后盖**（`mars2020-edl`）

查找范围：GitHub 仓库 `nasa/NASA-3D-Resources` 的 `3D Models/` 文件夹，一共 227 个模型，逐个看了名字；也用 science.nasa.gov 的站内搜索接口搜过，都没有这 3 个。Smithsonian 3D 的接口返回 403，没有继续查。

## 授权与署名

- NASA 3D Resources 的 README 原话是 "These assets are free and without copyright."，并指向 NASA 媒体使用指南：<https://www.nasa.gov/nasa-brand-center/images-and-media>。仓库的 meta.json 写的授权是 "NASA Open Source Agreement Version 1.3"。
- NASA 媒体指南的常见要求（以原文为准）：
  - 署名 NASA；
  - 不暗示 NASA 认可或背书本作品；
  - 不使用 NASA 的标志和徽章。
- Mars Trek 没有单独写授权。数据来自 NASA 任务和 USGS，按同样的方式署名。

以后写进 `CREDITS.md` 的草稿（这个文件不归我改，由负责的人加）：

```text
3D models from NASA 3D Resources (science.nasa.gov/3d-resources), converted and compressed with glTF-Transform; otherwise unmodified:
- "Viking Lander" — NASA/Michael D. Carbajal (used for Viking 1 and Viking 2)
- "InSight Cruise Lander (arm deployed)" — NASA/Brian E. Kumanchik
- "Ingenuity Mars Helicopter" — NASA/Brian E. Kumanchik
- "Mars Exploration Rover – Opportunity (MER-B)" — NASA/Ames Research Center (used for Spirit and Opportunity)
Mars globe: Viking MDIM 2.1 colorized global mosaic, NASA/JPL-Caltech/USGS, tiles from NASA Solar System Treks (Mars Trek), stitched to 4096×2048.
No NASA endorsement is implied.
```

## 模型和真实情况的差别（要写进 FACT_CHECK.md 或在画面上标"示意"）

- **InSight**：模型里地震仪和热流探针还在甲板上。实际上地震仪在 2018 年 12 月、热流探针在 2019 年 2 月就放到了地面上，最后的状态是仪器在地上，太阳能板盖满灰尘。
- **Ingenuity**：模型里的旋翼是完好的。实际上 2024 年 1 月第 72 次飞行后，旋翼已经断了。开场要表现"断掉的桨叶"，需要在场景里另外处理，例如缩短一片桨叶，或者用镜头避开。
- **Spirit 和 Opportunity**：共用 MER-B 模型，很简化。远处看可以，近景要标"示意"。
- **Viking 1 和 Viking 2**：共用同一个模型，两台确实是同型号。

## 补充下载（2026-11-14 下午，你确认后下载）

为了让火星表面更清楚，补了两份 NASA Mars Trek 的地图。下载前列了清单，你选了"两个都下载"。

| 文件 | 来源 | 实际下载量 | 放进网站的文件 |
|---|---|---|---|
| MGS MOLA 全球高程，第 3 层，128 张 PNG 瓦片，拼成 4096×2048 | NASA Mars Trek，`mola128_mola64_merge_90Nto90S_SimpleC_clon0` | 2,924,785 B | `src/scene/maps/mars-height.jpg`（轻微模糊去掉 8 位阶梯，JPEG q92，648,143 B） |
| Viking MDIM 2.1 彩色拼接图，第 4 层，512 张 JPEG 瓦片，拼成 8192×4096 | NASA Mars Trek，`Mars_Viking_MDIM21_ClrMosaic_global_232m` | 26,076,267 B | `src/scene/maps/mars-8k.webp`（8192×4096 WebP，5,971,858 B） |

- 高程图核对过：Olympus Mons 和 Arsia Mons 最亮（灰度 255，山顶被拉伸截平），Hellas 盆地最暗（19），位置和彩色图一致。
- 高程用来算坡度、按真实太阳方向打明暗，起伏有夸张，不代表真实海拔（米）。
- 8192 地图在开场后约 2.5 秒才在后台加载，显卡不支持 8192 贴图时不加载，继续用 4096 版。
