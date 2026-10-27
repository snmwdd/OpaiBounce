#!/usr/bin/env python3
"""Summarize the captured Chrome counters without claiming native game FPS."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
before=json.loads((ROOT/'reports/performance-1.2.0.json').read_text())
after=json.loads((ROOT/'reports/performance-1.3.0.json').read_text())
lines=['# 动画优化与测量（1.3.0）','','同一台机器的 Headless Chrome，2000×1100、隔离 REST/WebSocket fixture。基线为修改前 1.2.0，最终为本次 1.3.0。以下为单次采样，不是硬件基准或 Windows/macOS CEF 实机帧率。','','| 操作 | 布局次数 前→后 | JS 耗时 ms 前→后 | 主线程任务 ms 前→后 | RAF P95 ms 前→后 | >25ms 间隔 前→后 |','| --- | --- | --- | --- | --- | --- |']
for key,b in before['results'].items():
 a=after['results'][key]
 lines.append(f"| {key} | {b['LayoutCount']} → {a['LayoutCount']} | {b['ScriptDuration']*1000:.1f} → {a['ScriptDuration']*1000:.1f} | {b['TaskDuration']*1000:.1f} → {a['TaskDuration']*1000:.1f} | {b['rafP95Ms']:.1f} → {a['rafP95Ms']:.1f} | {b['gapsOver25ms']} → {a['gapsOver25ms']} |")
lines+=['','布局次数降低不等于 FPS 按相同比例增加。JS、主线程耗时和长间隔可能随系统负载波动，表中保留所有结果。此环境的 RAF 约为 60 Hz，不能用它证明 120 Hz 或游戏实际更流畅。','','## 本次实现','','- ClickGUI 使用 WAAPI 的 transform/opacity 关键帧，结束释放合成层提示。','- 主菜单用 transform 移动标题和 Logo，避免逐帧修改 top/left；Logo 不再逐帧触发组件模板更新。','- 灵动岛布局尺寸仅在内容改变时更新，外壳与内层反向缩放，文字和图标保持尺寸。','- 展开区保留必要的高度动画，使用缓存的 ResizeObserver 尺寸，完全展开时为 auto，减少嵌套测量。','- 大图模糊在打包前完成，不在动画中重复计算；减少无用字体预加载。','','## 如何在游戏内判断卡顿','','按 Ctrl + Shift + F8 打开诊断，操作菜单／ClickGUI，再看 Game FPS、WebGUI RAF 和 P95 interval。关闭会停止采样，面板自身会增加少量测量开销。','120 Hz 对应约 8.33 ms，60 Hz 约 16.67 ms。长间隔频繁，说明页面调度确有波动；Game FPS 高而 WebGUI RAF 低，可能受网页渲染上限或宿主调度影响。两者都高也不能排除 CEF 贴图复制、上传或最终呈现阶段卡顿，因为 RAF 没有测量这些阶段。','上一版的 120 设置是上限迁移，不是稳定输出保证。本版不再重复覆盖已迁移后的用户设置。不要把“上限更高”等同于“更流畅”。','','## 官方资料与宿主范围','','- [Chromium/web.dev 动画指南](https://web.dev/articles/animations-guide)：优先 transform/opacity，避免不必要的布局／绘制；will-change 只按需使用。','- [布局测量与写入](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing)：避免读写交错导致强制同步布局。','- [LiquidBounce FPS 排查](https://liquidbounce.net/docs/troubleshooting/fixing-fps)：网页渲染和纹理上传有成本；该文当前将 Accelerated Paint 标为仅 Windows/Linux 支持，macOS 不应假定可用。提高 Renderer FPS 会增加绘制负担，宿主性能不足时稳定帧率比更高上限重要。','- [LiquidBounce 浏览器后端](https://liquidbounce.net/docs/add-on-api/developers/browser-backends)：浏览器后端是独立宿主层，主题无法自行启用不受支持的 GPU 上传路径。','','## Windows 右键兼容','','旧代码仅通过 contextmenu 切换设置。现增加 mousedown 右键路径，并保留 contextmenu 备用与去重，CEF 动画帧暂停时还有 300 ms 完成保护，避免一次右键打开后立刻关闭。测试模拟缺少 contextmenu 与两个事件同时到达，尚未在 Windows 游戏 CEF 中验证全部故障原因。','','原始 JSON 在源码包 reports/performance-1.2.0.json 与 reports/performance-1.3.0.json；复测命令：OPAI_PROFILE_LABEL=1.3.0 npm test -- tests/performance.spec.ts。']
(ROOT/'PERFORMANCE.md').write_text('\n'.join(lines)+'\n')
print('Wrote PERFORMANCE.md (all measured counters retained).')
