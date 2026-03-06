# tauri2mm

基于 Tauri + React 的“多终端在线管理”应用，使用 Gitee Gist 作为远程存储来同步各终端在线状态。

## 当前功能（参考 `src/App.tsx`）

1. 多终端在线管理：通过 Gitee Gist 统一存储 `TerminalStore`，实现多设备在线状态共享；本地缓存远程数据，启动优先从缓存恢复，拉取成功后写回缓存。

2. 终端加入/退出与心跳：`Join` 获取当前 GPS 并写入远程；`Exit` 将当前终端标记为离线并更新 `last_update`；在线状态下每 30 秒更新 GPS 与 `last_update` 作为心跳续约。

3. 定时拉取与在线判定：启动立即拉取一次，随后按 `refreshSeconds` 周期轮询远程仓库；在线判定规则为 `status === "online"` 且 `now - last_update <= onlineTimeoutMinutes`。

4. 可视化与状态提示：在线终端列表展示平台、型号、CPU、内存、GPS 与最后更新时间；地图分布仅展示“在线且有 GPS”的终端（高德地图）；顶部横幅提示同步成功或错误信息。

5. 设置页：支持配置 Gitee 凭证、Gist 信息、刷新频率、在线超时、高德地图 Key 等；默认值为 `refreshSeconds = 10`（秒）、`onlineTimeoutMinutes = 60`（分钟）。

## 本地编译

1. 环境变量
本地创建 `.env`，字段参考 `.env.example`。

2. 安装依赖

```bash
npm install
```

3. 运行开发环境或打包
开发：`npm run tauri android dev`；打包：`npm run tauri android build`。

4. Android 签名说明
`src-tauri/gen/android/app/build.gradle.kts` 中引用了 `keystore.properties`。

若本地无签名文件，可先生成 keystore（示例）：

```bash
keytool -genkey -v -keystore ~/usermgr-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias usermgr
```

`keystore.properties` 示例（与上面的 `keytool` 对应）：

```properties
storeFile=/Users/yourname/usermgr-keystore.jks
keyAlias=usermgr
password=your_keystore_password
```
