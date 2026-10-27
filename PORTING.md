# 移植对应关系

| Opai 来源 | 主题实现 | 说明 |
| --- | --- | --- |
| `OpaiTitleScreen` | `src/routes/menu/title/Title.svelte` | 六行菜单、140×148.2 逻辑尺寸、25 行高、12 圆角、黑色 0x90 背板；按 Minecraft GUI scale 缩放 |
| `OpaiStyle.LIGHT_PINK` | `src/opai/opai.scss` | #161110 标题、#1a1413b0 面板、#df9d95 启用底、#ffb4aa 强调色 |
| `OpaiLayout` | `Panel.svelte` / `Module.svelte` | 每列 152 逻辑宽、8 间隔、21 标题、19.6 模块行高；框架坐标为这些值的两倍 |
| `OriginalRipple`、`oE`、`oK` | `src/opai/motion.ts` | 800 ms 三次 ease out 水波、释放淡出、可重定向插值、五次 ease out 菜单动效 |
| `fK` / `OriginalLoading` | `src/opai/Intro.svelte` | 转环收缩／扩张、分片合拢、Logo 归位；ready 来自网页资源，顶部进度条为浏览器适配 |
| `OriginalLogo` / `oG` | `src/opai/Logo.svelte` / `SpriteClock` | 1200 ms 线性入场、50 ms 物理步进、0.99 阻尼、0.8 反弹、60 ms 碰撞精灵帧；以 `analysis/menu-original/oG.java` 为准，每次采样最多推进一帧，不用总耗时跳帧；浏览器指针与音频适配 |
| `DynamicIslandState.Morph` | `motion.ts` / `Island.svelte` | 8.7 衰减、8 频率的弹簧方程；最多三条通知、同模块通知合并；Scaffold 使用 blockCountChange 计数与观察最大值；未伪造缺少数据的其他进度 |
| `SharedListScreen` | `src/opai/ListScreen.svelte` / `menuMotion.ts` | 标题、38 起点、36 行高、5 间隔、双排按钮；DOM/CSS 透视替代 GLSL testShader，两页共享 rotation/phase/zoom，路由切换不重置动画 |
| `OpaiConfigPanel` / `OpaiTargetsPanel` | `src/opai/Configurations.svelte` | 配置 CRUD 与实际全局分组；配置存储适配为主题持久化接口，未冒充原生配置文件 |
| `ShellHud` | `src/opai/Inventory.svelte`、`Session.svelte`、主题 HUD 元素 | 实际物品／皮肤／药水／目标事件，显示尺寸适配；统计没有源事件时保留可配置值 |

LiquidBounce 的 Render / Client 分类汇入 Visual，World 汇入 Player，Exploit / Fun / 新分类汇入 Misc。每个模块的后端名称不变，分类变化不会丢模块。模块数量、选项、原生画面和账号流程以实际 LiquidBounce 版本为准。

设置渲染已替换为 `OpaiSetting.svelte`，不是给官方控件改颜色。保留新版设置协议，按 Opai 原始的行高、开关 26×16、滑条与选项字段重画；嵌套 CHOICE、组、范围、颜色、文件和键位等类型仍使用原 API。HUD 编辑器已换成简单拖动，并恢复 `HudEditButton.java` 的铅笔路径；移除了底部工具条。认证表单和游戏原生页面继续使用宿主流程。这份包是可构建的主题移植，不是所有画面／行为已完全等价的证明。现有截图测试使用与 Opai 包一致的模块 fixture 进行布局检查；真实 LiquidBounce 的模块列表自然会不同。

性能适配：移除菜单／面板反复采样的 backdrop-filter，背景只做 transform 缩放；水波固定几何尺寸，仅动画 transform/opacity；灵动岛用 ResizeObserver 测量，弹簧收敛后停用 RAF；模块配置按展开加载。Opai ClickGUI 入场的 320 ms 阻尼缩放使用原始公式。RAF 驱动的高度裁剪展开／控件颜色过渡仍是浏览器实现，未宣称逐帧等价。

对应接口均沿用 `src/integration/rest.ts`：模块 GET/POST/PUT、`/client/global`、`/client/screen`、服务器／世界／账号／代理接口、`/client/localStorage/all`、主题和 HUD 组件接口。WebSocket 协议为 `{name,event}`。认证、宿主端口、会话 cookie 和路由接入继续使用官方基线。

安装包只包含运行主题、许可证、署名和说明。测试 fixture、浏览器报告和源代码单独保留在源码包中。未向游戏服务器连接或登录任何账号进行验证。

1.2.0 补充：认证弹窗也改用 Opai 式描边输入框与文本页脚，但账户类型仍按 LiquidBounce 可用接口提供，没有伪造原 Opai 独有的文件夹或 refresh-token 接口。Via 保留原卡片布局，原版本图不改，新增对应宣发图并离线模糊；新增资源有独立来源与哈希清单。

帧率以本地原生源码为依据：`BrowserSettings.kt` 中 Fps=0 跟随刷新率，最大范围来自显示器；`ScreenManager.kt` 菜单初始为 0；`ModuleHud.kt` HUD 初始为 60。`highRefresh.ts` 通过现有模块设置 PUT 做一次高刷新率迁移，持久化标记后再修改渲染器，后续尊重用户设置。主题无法保证宿主和硬件的实际帧率。

1.3.0：按用户新反馈统一使用原包粗体；默认 CSS 的 400/700 字重都映射至同一原始 Bold 字形，避免个别显式 400 的组件退回细体，中文使用 NotoSansSC-Bold。保留普通字体文件供 HUD 自定义字体等原功能选择。

灵动岛保留原图标路径，通过 group 变换放大 12%，闲置图标为 12 逻辑尺寸；模块名移到通知第二行，第一行固定 Module Toggled。外壳使用 scale，内层使用反向 scale 保持文字和图标尺寸；布局宽高只在内容改变时更新。ClickGUI 的 320 ms 原弹簧采样为 WAAPI transform/opacity 关键帧，结束后释放 will-change。展开区域仍须推动后续设置，保留高度动画，仅在转换期间测量／布局；完全展开后 height:auto。

右键操作由 secondaryClick.ts 统一处理 mousedown 和 contextmenu 的平台差异；真实 Windows 故障的宿主事件／日志尚未取得，当前是兼容性修复与浏览器模拟回归。

1.4.0：`profiles.ts` 共用配置捕获／加载；核对 ModuleFunctions.kt 后使用 PUT／DELETE 设定开关，POST 不再用于恢复状态。旧回归 fixture 已改成后端的真实反转／403 语义。新增 `blockStats.ts`、`CommandPalette.svelte`、`keyboard.ts` 与 MouseKey.svelte；`.` 使用实际输入屏幕，跨 HUD／屏幕的临时请求有五秒有效期，不作为永久偏好。进度／CPS 来自真实事件；消耗速率是计数下降的估算，补货不算消耗。没有原生 `.cfg` 或 AI 后端时不伪造对应搜索结果。

1.4.1：CPS 仅绘制数字；命令图标的 folder/load 使用 OpaiIcons 路径，开关使用 DynamicIslandPainter，keyboard.svg 与 eye-off.svg 为原包 SVG 的适配，记录在 reports/command-icon-sources.json；不将 Icon.ttf 的 A–J 分类字形误用于命令。绑定键盘按参考截图比例调整，Scaffold 面板按内容测宽。

1.5.0：PaletteIsland.svelte 复用 Island 的 Morph，从 HUD 屏幕坐标与尺寸扩张，内容反向缩放以保持字形。static 是宿主锁定路由，不是预览。结合 CustomOverlay.kt／ThemeManager.kt／LocalStorageFunctions.kt，原生 HUD 呼出走 openScreen 与逐项存储交接，短暂轮询后由实际输入网页接收操作，缓存 ClickGUI 不消费请求；补屏幕就绪确认。逐键写入差异防止 /all 清空其他网页新状态。隔离浏览器上下文验证此路径，不代表游戏鼠标抓取或 CEF 已实测。

Tritium Music 1.11.0：`MusicPanel.svelte` 对应原插件侧栏/歌单/播放栏，`MusicHud.svelte` 分别对应 MusicInfoWidget（230×56 逻辑大小）、MusicLyricsWidget 与 MusicSpectrumWidget。真实频谱从 Java 解码 PCM 计算，不含随机生产数据；编辑器无播放时才显示位置预览。拖动沿用主题组件 alignment。音乐服务新增本地收藏和独立 HUD 持久化，Bridge 装载协议沿用 1.3.0。

1.12.0: `musicMotion.ts` provides shared spectrum interpolation and persistent-line lyric movement. `DangoLyrics.java` ports world spawn, char/word timing, wiggle/pop and fade from Dango; `OpaiBridge.js` registers TritiumMusic settings and submits world glyphs using WorldFeatureSubmitEvent / Render3DKt.submitTextAlwaysOnTop. Module values use the standard ScriptSetting API and the theme GenericSetting renderer. No custom MusicEntry remains.
