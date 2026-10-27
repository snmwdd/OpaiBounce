# 动画优化与测量（1.3.0）

同一台机器的 Headless Chrome，2000×1100、隔离 REST/WebSocket fixture。基线为修改前 1.2.0，最终为本次 1.3.0。以下为单次采样，不是硬件基准或 Windows/macOS CEF 实机帧率。

| 操作 | 布局次数 前→后 | JS 耗时 ms 前→后 | 主线程任务 ms 前→后 | RAF P95 ms 前→后 | >25ms 间隔 前→后 |
| --- | --- | --- | --- | --- | --- |
| menuRoundTrips | 93 → 26 | 48.8 → 53.9 | 242.4 → 236.1 | 16.7 → 16.7 | 0 → 0 |
| clickGuiReopen | 0 → 0 | 9.7 → 3.7 | 46.8 → 37.3 | 16.8 → 16.7 | 0 → 0 |
| moduleExpandCollapse | 122 → 83 | 33.4 → 27.3 | 145.5 → 140.1 | 16.8 → 16.8 | 0 → 0 |
| islandToggleBurst | 150 → 68 | 28.6 → 28.3 | 145.6 → 151.2 | 16.7 → 16.7 | 0 → 0 |

布局次数降低不等于 FPS 按相同比例增加。JS、主线程耗时和长间隔可能随系统负载波动，表中保留所有结果。此环境的 RAF 约为 60 Hz，不能用它证明 120 Hz 或游戏实际更流畅。

## 本次实现

- ClickGUI 使用 WAAPI 的 transform/opacity 关键帧，结束释放合成层提示。
- 主菜单用 transform 移动标题和 Logo，避免逐帧修改 top/left；Logo 不再逐帧触发组件模板更新。
- 灵动岛布局尺寸仅在内容改变时更新，外壳与内层反向缩放，文字和图标保持尺寸。
- 展开区保留必要的高度动画，使用缓存的 ResizeObserver 尺寸，完全展开时为 auto，减少嵌套测量。
- 大图模糊在打包前完成，不在动画中重复计算；减少无用字体预加载。

## 如何在游戏内判断卡顿

按 Ctrl + Shift + F8 打开诊断，操作菜单／ClickGUI，再看 Game FPS、WebGUI RAF 和 P95 interval。关闭会停止采样，面板自身会增加少量测量开销。
120 Hz 对应约 8.33 ms，60 Hz 约 16.67 ms。长间隔频繁，说明页面调度确有波动；Game FPS 高而 WebGUI RAF 低，可能受网页渲染上限或宿主调度影响。两者都高也不能排除 CEF 贴图复制、上传或最终呈现阶段卡顿，因为 RAF 没有测量这些阶段。
上一版的 120 设置是上限迁移，不是稳定输出保证。本版不再重复覆盖已迁移后的用户设置。不要把“上限更高”等同于“更流畅”。

## 官方资料与宿主范围

- [Chromium/web.dev 动画指南](https://web.dev/articles/animations-guide)：优先 transform/opacity，避免不必要的布局／绘制；will-change 只按需使用。
- [布局测量与写入](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing)：避免读写交错导致强制同步布局。
- [LiquidBounce FPS 排查](https://liquidbounce.net/docs/troubleshooting/fixing-fps)：网页渲染和纹理上传有成本；该文当前将 Accelerated Paint 标为仅 Windows/Linux 支持，macOS 不应假定可用。提高 Renderer FPS 会增加绘制负担，宿主性能不足时稳定帧率比更高上限重要。
- [LiquidBounce 浏览器后端](https://liquidbounce.net/docs/add-on-api/developers/browser-backends)：浏览器后端是独立宿主层，主题无法自行启用不受支持的 GPU 上传路径。

## Windows 右键兼容

旧代码仅通过 contextmenu 切换设置。现增加 mousedown 右键路径，并保留 contextmenu 备用与去重，CEF 动画帧暂停时还有 300 ms 完成保护，避免一次右键打开后立刻关闭。测试模拟缺少 contextmenu 与两个事件同时到达，尚未在 Windows 游戏 CEF 中验证全部故障原因。

原始 JSON 在源码包 reports/performance-1.2.0.json 与 reports/performance-1.3.0.json；复测命令：OPAI_PROFILE_LABEL=1.3.0 npm test -- tests/performance.spec.ts。


## 1.4.0 增量复核

48 项完整回归通过。沿用同一 Chrome 隔离 API fixture，当前环境 RAF 中位约 16.7 ms（约 60 Hz）；四个采样阶段均未观察到 >25 ms 间隔。这不能证明游戏 CEF 有 120 FPS，也不能测到纹理上传／最终呈现。

| 阶段 | Layout 次数 | P95 RAF 间隔 |
| --- | ---: | ---: |
| 菜单往返 | 28 | 16.8 ms |
| ClickGUI 重开 | 0 | 16.7 ms |
| 模块展开／折叠 | 82 | 16.7 ms |
| 灵动岛开关通知 | 68 | 16.8 ms |

完整数据保留在 `reports/performance-1.4.0.json`。新增 Scaffold 计数与鼠标 CPS 使用后端事件；进度、隐藏恢复与标签过渡按浏览器帧率插值，数据事件频率不作为动画帧率。没有引入每帧背景模糊。保留此前 1.2.0／1.3.0 的原始报告，不以单次测量的细小差异宣称稳定加速。


## 1.5.0 复核

53 项完整回归通过。本轮测试环境四个阶段 RAF 中位约 33.3 ms；另开全新 Chrome 的空白页对照同样约 33.3 ms（P95 33.4 ms）。不把这一结果解释成主题达到 120 FPS，也不把低采样频率下较少的 Layout 次数当作稳定提速。完整原始数据在 reports/performance-1.5.0.json。

命令面板短暂交接通过宿主存储，HUD 仅在交接期间轮询、就绪后停止；缩放与位移复用 Morph，反向缩放文字。新增 HUD 阴影使用形状阴影，不叠加实时背景模糊。原生游戏的鼠标捕获、输入延迟、纹理呈现与帧率仍需实机测量。


## 1.6.0 命令面板优化

列表改为可见窗口加少量缓冲行：回归 fixture 的 372 个命令在 400px 列表视口中只挂载约 17 行。搜索和方向键仍针对完整结果，返回绑定后恢复滚动。加载时预留列表高度，减少首次数据抵达引发的第二次扩张。

外壳动画不再逐帧写 left/top/border-radius，改为 transform；圆角只做一次 CSS 过渡。内容尺寸不变时忽略重复观察回调，弹簧接近目标后停帧。颜色拖动只更新本地值，释放时提交 API。没有新增实时背景模糊。

完整采样见 reports/performance-1.6.0.json；以上减少工作量，不等于已在游戏 CEF 稳定达到 120 FPS。


## 1.7.0 复核

键盘 HUD 固定 7 个波纹节点，点击仅重新播放对应合成动画，不增加节点或清理定时器；按键软阴影改在静态键帽上绘制，避免对整个动态键盘做过滤。CPS 仅在点击和最早记录到期时更新，没有轮询。

命令面板尺寸弹簧一次采样，播放交给 WAAPI，仍保留反向文字缩放。回归中绑定切换 110 ms 的形变期间，外壳 style 变更数为 0，同时屏幕宽度存在中间变化。ClickGUI 的 .58→1 弹簧关键帧、HUD 编辑按钮缓存重开与 100 次连续点击的波纹复用均纳入回归。

原始帧间隔测量见 reports/performance-1.7.0.json。采样是 Chrome/API fixture，不代表原生游戏 CEF 的贴图上传与最终呈现，也不承诺稳定 120 FPS。


## 1.8.0 LiquidScript 桥接

原生遥测每 10 tick 更新，当前 HUD 或输入网页每秒读取；预览位置只在卡片显示时每 400 ms 提交，关闭立即撤销。没有逐帧网络传输，Nametags 直接使用原生世界投影与字体。脚本目标对象上限 128、距离 128 米，来源遵循原生视觉 Targets。

脚本夹具与 JVM 符号检查不是 GraalJS 性能认证。框线与血条预览不等同于完整世界 Glow 管线重放。新网页性能报告在 reports/performance-1.8.0.json，原生游戏的实际开销仍需实机测量。


## 1.12.1 音乐与共享动画调度

同一 Headless Chrome、2000×1100、隔离 API，分别模拟 Windows/macOS UA；每次 2400ms，100ms 改一次真实频谱接口夹具数据。下表为一次前后对比，不是 Windows 或 macOS 的 CEF 实机测量，也不代表游戏 FPS。任务时间会受测试机负载波动影响。

| 模拟平台 | 频谱绘图属性写入 | Script ms | Task ms | Layout 次数 |
| --- | ---: | ---: | ---: | ---: |
| windows | 4600 → 137 | 55.9 → 34.0 | 253.3 → 157.9 | 144 → 137 |
| macos | 4600 → 137 | 65.2 → 38.6 | 285.9 → 171.2 | 144 → 137 |

- 32 个逐帧 SVG transform 改为一个批量路径；同数据不再重启动画。保持 115ms 插值、32 个真实 PCM 频带及共享 HUD 阴影。
- 音乐时间仅让小型进度控件更新；歌词索引二分定位，仅 cue 变化时构建最多五行，保留换句平滑滚动；播放器元信息排除 position，避免整个歌单跟随时钟更新。
- 长列表使用 content-visibility:auto 与内在行高，封面 lazy/async。旧浏览器不支持时会自然回退普通列表，数据与收藏仍可使用。
- 所有脚本动画共用一对 RAF/备用定时器，取消后立即释放；Windows 暂停 RAF、非 Windows 正常 WAAPI、macOS 系统减少动画偏好均保留。
- 页面不可见时停频谱轮询、停本地进度定时器，状态发现降为5秒；恢复可见立即拉取。未减少可见时频谱采样率。
- Bridge 1.4.1 在普通 HUD 模式跳过 worldLyrics 的 Java/Gson 调用；3D 退出场景只清理一次，不再每帧重置。

回归额外覆盖两平台稳定数据零绘图写入、隐藏/恢复、500 行歌曲列表、并发按键/灵动岛共享帧队列、RAF 暂停后备及拖动进度保护。没有升级或修改 Java 音频解码器，也未强制更改 Renderer FPS / GPU / VSync。封面背景继续用放大封面模糊，独立静态图层与前景隔离。

原始音乐采样位于 reports/music-performance-1.12.{0,1}-{windows,macos}.json。复测：OPAI_MUSIC_PROFILE=1.12.1 npm test -- tests/music.spec.ts -g 'music performance sample'。Minecraft Windows/macOS 最终画面、音频设备和 CEF 贴图上传性能仍待实际运行验收。


## 1.12.2 与1.9.0对照：掉帧排查

用户报告Windows10新版约60FPS、回退1.9.0约500FPS；没有该Windows机器的CPU/GPU、加速状态或同场景火焰图，不能确认为单一根因。

### 归档与代码审查

对照本地1.9.0源码：后续增加了整组HUD的drop-shadow及音乐/3D路径。1.9.0已有动画代码，系统减少动画偏好可能让Windows当时不播放；可见“没有动画”不等于源码完全无动画。自动提升网页120也早已存在，不能独立解释回退差异。

本版落实以下可确认的减少工作量：

- 网页Renderer独立最高60并关闭SyncGameFps；不跟随500FPS游戏反复刷新，也不修改Minecraft游戏帧率。保留低于60的值和后续手动选择；原值写入迁移标记。原生缓存HUD也应用，浏览器preview不修改宿主。
- 世界3D监听只在Dango3D注册，切回HUD直接卸载。1.12.1只跳过回调内部计算，仍每帧进入脚本；本版默认路径没有该回调。
- 原生标签按tick快照缓存文本宽度，每frame解析一次字体。模拟120帧同快照的宽度查询从360次降到3次；仍保留三段真实数据和像素爱心。这是调用次数，不是GraalVM耗时。
- Taco使用transform移动；只改变动画合成位置，不每帧修改left参与布局。

### 阴影实验：未证明稳定收益，已撤回

最初软件绘制测试观察Paint次数约下降四成；复核发现前后采样的浏览器RAF节奏不同，不能据此归因于阴影或宣称提速。为排除干扰，用同一次Chrome --disable-gpu运行、同一套API夹具、2000×1100，在相同约33.3ms RAF中位数下复测1.12.1原包与候选阴影重写：

| 模拟平台 | 原包→候选 Paint次数 | Paint ms | 主线程Task ms |
| --- | ---: | ---: | ---: |
| Windows UA | 255→252 | 25.438→29.408 | 226.988→261.196 |
| macOS UA | 249→248 | 30.135→31.084 | 268.522→264.564 |

该结果没有证明稳定收益，Windows样本耗时还更高。因此最终包撤回了阴影重写，保留1.12.1的阴影范围、滤镜和外观。不能将“去掉阴影后一定提速”作为结论。原始试验标为candidate_only；不是最终包性能数据。这个Chrome实验也不是Windows/macOS原生CEF贴图上传测量。

macOS执行同样的网页与脚本代码，因此收到独立限帧、监听卸载、标签缓存与Taco布局修复。没有两平台原生游戏帧率的前后测量，不承诺恢复到500FPS。

### 官方来源与适用范围

- [LiquidBounce FPS排查](https://liquidbounce.net/docs/troubleshooting/fixing-fps/)：网页Renderer可占过多资源，建议限制FPS；Accelerated Paint仅Windows/Linux支持，并有显卡/驱动限制。本版未强制切换GPU路径、驱动或插件。
- [Script API安装](https://liquidbounce.net/docs/script-api/installation)：GraalVM可改善脚本性能。目前没有该Windows机器的运行时证据，不能将其JRE认定为原因。
- [Chromium动画指南](https://web.dev/articles/animations-guide)：分别测量布局、绘制与合成，优先transform/opacity。
- [LiquidBounce Renderer设置](https://liquidbounce.net/docs/modules/shared-settings/renderer/)：网页FPS/SyncGameFps控制界面刷新，不是Minecraft游戏帧率限制。

### 可恢复的游戏内对照

Ctrl+Shift+F8打开诊断；Ctrl+Shift+F6轮换正常/关网页阴影滤镜/隐藏网页HUD；Ctrl+Shift+F7暂停或恢复本脚本绘制。原生HUD不需要呼出鼠标，关闭面板恢复。脚本暂停探针每500ms续租、2秒到期，异常退出也会自动恢复。该暂停保留脚本本身、音乐与遥测，不等价于卸载所有脚本。网页探针只影响当前WebView。

对比Game FPS即可判断网页绘制或自定义绘制是否为主要影响项；无明显变化不能完全排除CEF宿主、其他脚本或音频解码。完整确诊仍需Windows原机实测。

软件绘制复测：OPAI_PAINT_COMPARE=1 npm test -- --config playwright.paint.config.ts（需在4174提供旧包，4173提供本机preview）；代码与原始候选数据随源码包提供。测量环境变化和负面结果保留，不以较少的Paint次数冒充FPS提升。
