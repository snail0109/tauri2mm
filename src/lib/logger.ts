type LogDetails = Record<string, unknown> | string | number | boolean | null | undefined;

const LOG_TEXTS: Record<string, string> = {
  "app.init.start": "应用启动：开始初始化",
  "app.init.terminal-id.ready": "应用启动：终端 ID 已就绪",
  "app.init.terminal-id.failed": "应用启动：终端 ID 初始化失败",
  "store.pull.on-config-change": "配置变更：触发拉取远程数据",
  "store.pull.start": "开始拉取远程终端数据",
  "store.pull.success": "拉取远程终端数据成功",
  "store.pull.failed": "拉取远程终端数据失败",
  "store.pull.end": "拉取远程终端数据结束",
  "store.pull.skip.inflight": "跳过拉取：已有请求进行中",
  "store.pull.local-status.synced": "已同步本机在线状态",
  "store.merge.start": "开始执行远程合并写入",
  "store.merge.success": "远程合并写入成功",
  "store.merge.failed": "远程合并写入失败",
  "join.start": "开始加入在线列表",
  "join.success": "加入在线列表成功",
  "join.failed": "加入在线列表失败",
  "join.skip.no-terminal-id": "跳过加入：缺少终端 ID",
  "exit.start": "开始退出在线列表",
  "exit.success.primary": "退出在线列表成功（主流程）",
  "exit.primary.failed.fallback": "退出主流程失败，进入降级流程",
  "exit.success.fallback": "退出在线列表成功（降级流程）",
  "exit.fallback.failed": "退出在线列表失败（降级流程）",
  "exit.end": "退出流程结束",
  "exit.skip.no-terminal-id": "跳过退出：缺少终端 ID",
  "heartbeat.start": "开始心跳上报",
  "heartbeat.success": "心跳上报成功",
  "heartbeat.failed": "心跳上报失败",
  "heartbeat.end": "心跳上报结束",
  "heartbeat.skip.no-terminal-id": "跳过心跳：缺少终端 ID",
  "heartbeat.skip.inflight": "跳过心跳：已有请求进行中",
  "gps.native.update": "收到原生定位更新",
  "refresh-all.start": "开始手动刷新（拉取+心跳）",
  "refresh-all.end": "手动刷新结束",
  "window.unload.triggered": "页面卸载：触发离线写入检查",
  "tauri.close-hook.setup": "Tauri 关闭钩子已注册",
  "tauri.close-hook.received": "Tauri 收到关闭事件",
  "tauri.close-hook.allow-close": "Tauri 已允许窗口关闭",
  "settings.open": "点击：打开设置页",
  "settings.back": "设置页返回主页面",
  "settings.back.click": "点击：设置页返回",
  "settings.save.click": "点击：保存设置",
  "settings.cancel.click": "点击：取消设置",
  "settings.page.enter": "进入设置页",
  "settings.gitee.clear.click": "点击：清空 Gitee 配置",
  "settings.amap.clear.click": "点击：清空高德配置",
  "settings.test-gitee.click": "点击：测试 Gitee 连接",
  "settings.test-gitee.success": "Gitee 连接测试成功",
  "settings.test-gitee.failed": "Gitee 连接测试失败",
  "settings.test-gitee.skip.missing-config": "跳过测试 Gitee：配置不完整",
  "settings.test-amap.click": "点击：测试高德连接",
  "settings.test-amap.success": "高德连接测试成功",
  "settings.test-amap.failed": "高德连接测试失败",
  "settings.test-amap.skip.missing-config": "跳过测试高德：配置不完整",
  "click.join": "点击：加入（Join）",
  "click.exit": "点击：退出（Exit）",
  "click.refresh": "点击：刷新",
};

function isDebugEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("app.debug.logs") === "1";
  } catch {
    return false;
  }
}

function nowLabel(): string {
  return new Date().toISOString();
}

function textOf(event: string): string {
  return LOG_TEXTS[event] ?? event;
}

export function logAction(action: string, details?: LogDetails): void {
  if (!isDebugEnabled()) return;
  console.info(`[UI][ACTION][${nowLabel()}] ${textOf(action)}`, details ?? "");
}

export function logTask(task: string, details?: LogDetails): void {
  if (!isDebugEnabled()) return;
  console.info(`[UI][TASK][${nowLabel()}] ${textOf(task)}`, details ?? "");
}

export function logWarn(task: string, details?: LogDetails): void {
  if (!isDebugEnabled()) return;
  console.warn(`[UI][WARN][${nowLabel()}] ${textOf(task)}`, details ?? "");
}

export function logError(task: string, error: unknown, details?: LogDetails): void {
  if (!isDebugEnabled()) return;
  console.error(`[UI][ERROR][${nowLabel()}] ${textOf(task)}`, { error, details });
}
