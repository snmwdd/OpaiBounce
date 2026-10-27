# Opai 原生改动，1.7.0

两个安装范围：

- `Opai-LiquidBounce-Theme.zip` 是网页主题：模块说明右置、药水尺寸恢复、键盘 HUD 优化、`.` 形变、ClickGUI 与编辑按钮入场、网页加载动画。
- `Opai-LiquidBounce-Client-0.41.1-26.3.jar` 是基于本地 LiquidBounce Nextgen 0.41.1 源码的独立本地构建：额外替换原生启动加载页和 Nametags。**目标 Minecraft 26.3、Java 25+**，不是截图中 MC 26.2 客户端的主题补丁。原生包没有把网页主题设为内置默认，主题仍需另行安装。

使用原生包时，在对应 MC 26.3 的 Fabric 游戏实例中用它替换 LiquidBounce mod，保留一个 LiquidBounce JAR。Fabric Loader、Fabric Language Kotlin 等依赖使用该源码 `fabric.mod.json` 所列版本。当前包的 Minecraft 依赖明确限制为 26.3。没有修改现有启动器或游戏实例。

Nametags 默认打开 `OpaiStyle`：深色三段圆角胶囊依次为爱心血量、玩家名、距离；颜色随真实血量变化，距离来自实际相机。保留名称保护与已有实体名格式。三段是否出现继续遵循 Text → Parts 的 Health / Name / Distance；Ping / GameMode 等原布局扩展在关闭 OpaiStyle 后显示。装备显示与原距离缩放曲线继续可用。

原生加载页使用原包 Logo 矢量生成的透明纹理图集、暖红圆环、分片合拢和顶部真实资源加载进度；不依赖浏览器初始化。它与网页加载动画各自服务不同启动阶段，不阻塞 Minecraft 加载去强行等待动画。

验证状态：Kotlin／Java 编译、JAR 构建、JAR 内容及 CRC 校验；尚未完成游戏实机视觉验收。浏览器主题另有隔离 API 交互回归，不将其当作原生 CEF、原生启动页或实体标签的实机认证。

## 从源代码重建

`Opai-LiquidBounce-Client-Source.zip` 包含对应原生源码、构建文件、原网页源码和许可证。解压后在 LiquidBounce-nextgen 目录执行：

```sh
bash gradlew jar -Pmod_version=0.41.1-opai.1.7.0 -Pmod_mc_version=26.3 -x generateGitProperties
```

Windows 使用 `gradlew.bat` 和相同参数。源码归档没有 `.git`，因此跳过 Git 信息生成；资源中的 git.properties 只声明真实的本地构建版本，不编造提交哈希。原版源码版本字段仍为 0.41.1。

`opai-theme/native/opai-native.patch` 是相对用户提供的原生源码 ZIP 的文本差异；新增的 PNG 图集及许可证也包含在完整源码 ZIP。图集来自原 Opai logo.svg 与 part2/3/4.svg，仅作栅格化排布。原素材归属见 META-INF/NOTICE-OPAI.md 与 LICENSE-OPAI-SHELL；此构建不是官方 Opai 或 LiquidBounce 发布。
