import { checkPermissions, requestPermissions, getCurrentPosition } from "@tauri-apps/plugin-geolocation";
import type { Gps, TerminalInfo } from "./types";
import { getAmapPosition } from "./amap";
import { getPlatformInfo } from "./platform";

/**
 * 确保定位权限已授予（Android 需要运行时请求）。
 * 返回 true 表示至少获得了粗略定位权限。
 */
async function ensureLocationPermission(): Promise<boolean> {
  try {
    let perms = await checkPermissions();
    if (perms.location === "granted" || perms.coarseLocation === "granted") {
      return true;
    }
    perms = await requestPermissions(["location", "coarseLocation"]);
    return perms.location === "granted" || perms.coarseLocation === "granted";
  } catch {
    return false;
  }
}

/**
 * 获取当前位置：
 * 1. 优先使用高德定位，立即返回结果
 * 2. 后台静默执行 Tauri 原生定位，成功后通过 onNativeGps 回调通知调用方更新数据
 *
 * @param timeoutMs    高德定位超时（毫秒）
 * @param onNativeGps  可选回调，原生定位成功后调用，用于后台静默更新数据
 */
export async function getCurrentGps(
  timeoutMs: number,
  onNativeGps?: (gps: NonNullable<Gps>) => void,
): Promise<Gps> {
  // 1. 优先使用高德定位
  let amapGps: Gps = null;
  try {
    const position = await getAmapPosition(timeoutMs);
    amapGps = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
  } catch {
    // 高德定位失败，静默处理
  }

  // 2. 后台静默尝试 Tauri 原生定位，成功后通过回调通知
  const isTauri = !!(window as Window & { __TAURI__?: unknown }).__TAURI__;
  if (isTauri && onNativeGps) {
    void (async () => {
      try {
        const granted = await ensureLocationPermission();
        if (!granted) return;
        const position = await getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60_000,
        });
        onNativeGps({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      } catch {
        // 原生定位失败，静默忽略
      }
    })();
  }

  return amapGps;
}

// 优先使用 Tauri 后端平台信息，失败时回退 UA 推断。
export async function getPlatformLabel(): Promise<string> {
  const platform = await getPlatformInfo();
  switch (platform.os.toLowerCase()) {
    case "android":
      return "Android";
    case "ios":
      return "iOS";
    case "windows":
      return "Windows";
    case "macos":
      return "macOS";
    case "linux":
      return "Linux";
    default:
      return "Unknown";
  }
}

// 截断过长 UA，作为设备型号描述
export function getDeviceModelLabel(): string {
  const ua = navigator.userAgent;
  return ua.length > 120 ? `${ua.slice(0, 117)}...` : ua;
}

// 组装终端上报数据
export async function buildTerminalInfo(input: {
  terminalId: string;
  status: TerminalInfo["status"];
  gps: Gps;
}): Promise<TerminalInfo> {
  const platformLabel = await getPlatformLabel();
  const cores = typeof navigator.hardwareConcurrency === "number" ? `${navigator.hardwareConcurrency} cores` : "unknown";
  const memory =
    typeof (navigator as Navigator & { deviceMemory?: number }).deviceMemory === "number"
      ? `${(navigator as Navigator & { deviceMemory?: number }).deviceMemory} GB`
      : "unknown";

  return {
    terminal_id: input.terminalId,
    platform: platformLabel,
    device_model: getDeviceModelLabel(),
    cpu: cores,
    memory,
    gps: input.gps,
    status: input.status,
    last_update: new Date().toISOString(),
  };
}
