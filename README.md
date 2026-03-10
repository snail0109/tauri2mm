# tauri2mm

基于 Tauri + React 的“多终端在线管理”应用，使用 Gitee Gist 作为远程存储来同步各终端在线状态。

## 当前功能（参考 `src/App.tsx`）

1. 多终端在线管理：通过 Gitee Gist 统一存储 `TerminalStore`，实现多设备在线状态共享；本地缓存远程数据，启动优先从缓存恢复，拉取成功后写回缓存。

2. 终端加入/退出与刷新：`Join` 获取当前 GPS 并写入远程；`Exit` 将当前终端标记为离线并更新 `last_update`；在线状态下刷新会更新 GPS 与 `last_update` 作为心跳续约。

3. 可视化与状态提示：在线终端列表展示平台、型号、CPU、内存、GPS 与最后更新时间；地图分布仅展示“在线且有 GPS”的终端（高德地图）；顶部横幅提示同步成功或错误信息。

4. 设置页：支持配置 Gitee 凭证、Gist 信息、高德地图 Key 等；

## 本地桌面端开发

### mac

`./dev-mac.sh`

### linux

`./dev-linux.sh`

### windows

`.\dev-windows.bat`

## 本地安卓移动端开发

1. 安装依赖
`pnpm install`

2. 初始化安卓环境
`pnpm tauri android init`
`src-tauri/gen/android/app/build.gradle.kts`  文件需要获取 git 仓库上的替换本地自动生成的

3. 运行开发环境或打包
开发：`pnpm run tauri android dev`；打包：`pnpm run tauri android build`。

4. Android 签名说明
新建文件 `src-tauri/gen/android/keystore.properties`

```properties
keyAlias=mytest
password=your_keystore_password
storeFile=/Users/yourname/mytest-keystore.jks
```

生成 keystore（示例）：

```bash
keytool -genkey -v -keystore ~/mytest-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias mytest
```

`keyAlias` 就是 `mytest`
生成过程会需要输入密码，生成完成替换 `your_keystore_password`
`storeFile` 替换成生成的文件地址

## github action

### Repository secrets

对应本地的 keystore.properties 配置文件

- ANDROID_KEY_ALIAS - keyAlias
- ANDROID_KEY_PASSWORD - password
- ANDROID_KEY_BASE64 -  `base64 -i storeFile`
- VITE_GITEE_ACCESS_TOKEN
- VITE_GITEE_GIST_ID
- VITE_AMAP_KEY
- VITE_AMAP_SECURITY_CODE
