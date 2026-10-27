# Opai Theme Bridge API 1

主题窗口加载后提供 `window.OpaiTheme`，全部功能默认开启。每个原生网页实例单独持有 SDK；跨实例数据由客户端逐键存储交接。

```js
const state = window.OpaiTheme.getState(); // 未连接或超过 4 秒无心跳时为 null
const unsubscribe = window.OpaiTheme.subscribe(state => console.log(state));
// 不需要 UI 模块注册；以下控制是可选的。
await window.OpaiTheme.setFeatures({nametags: true, preview: true, serverInfo: true});
unsubscribe();
```

状态结构：

```ts
{
  protocol: 1, version: '1.2.0', at: number, connected: true,
  inWorld: boolean, singleplayer: boolean,
  worldInfo: {biome: string | null, dimension: string | null} | null, // 1.2.0 新增
  serverAddress: string | null, // 当前连接的输入地址，含可能的端口
  serverIP: string | null,      // 连接解析 IP；无法取得时 null
  ping: number | null,          // 当前玩家的服务端延迟，毫秒；未知时 null
  capabilities: {serverInfo: boolean, nametags: boolean, preview: boolean},
  previewError: string | null, // 模型暂时不可用时提示，后续成功绘制会清空
  errors: string[]
}
```

主题里的 EntityPreview 已自动对 ESP / PlayerESP / Nametags 展开的设置提交预览位置；其他组件也可以调用：

```js
await window.OpaiTheme.requestPreview('ESP', {
  x: 1200, y: 200, width: 250, height: 330
}, {BoxOutline: true, HealthBar: true});
await window.OpaiTheme.clearPreview();
```

矩形是 `getBoundingClientRect()` 的 CSS 像素，SDK 附带完整视口尺寸。脚本按 Minecraft GUI 尺寸换算，处理窗口缩放和高 DPI，不再次套用 GUI scale。每次位置请求续租 1.4 秒；仅当前持有者可以通过 SDK 清理。默认组件在显示时每 250 ms 续租、隐藏时马上清理。模型只在世界已加载且原生 GUI 屏幕打开时绘制。

| 存储键 | 写入方 | 内容 |
|---|---|---|
| `opai.bridge.snapshot` | 脚本 | 心跳、连接与功能状态 |
| `opai.bridge.preview` | 当前主题输入网页 | 预览矩形、模块、选项与到期时间依据 |
| `opai.bridge.features` | 主题 API | 可选功能布尔值，协议版本 1 |

接口使用宿主既有 `GET/PUT /api/v1/client/localStorage`；不使用全量 `/all` 写回。过期、无效版本、非有限坐标和未支持模块的预览请求会被忽略。脚本不对任意客户端字段、命令执行或文件访问提供网页代理。
