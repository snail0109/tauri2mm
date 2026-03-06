import { checkPermissions, requestPermissions, getCurrentPosition } from "@tauri-apps/plugin-geolocation";
import type { Gps, TerminalInfo } from "./types";
import { getAmapPosition } from "./amap";

const PRIMARY_TIMEOUT_MS = 5000;

/**
 * 确保定位权限已授予（Android 需要运行时请求）。
 * 返回 true 表示至少获得了粗略定位权限。
 */
async function ensureLocationPermission(): Promise<boolean> {
  try {
    let perms = await checkPermissions();
    // coarseLocation 或 location 任一为 granted 即可
    if (perms.location === "granted" || perms.coarseLocation === "granted") {
      return true;
    }
    // 尚未授权则请求
    perms = await requestPermissions(["location", "coarseLocation"]);
    return perms.location === "granted" || perms.coarseLocation === "granted";
  } catch {
    return false;
  }
}

// 获取当前位置：优先走 Tauri 原生定位，失败后降级高德 JS 定位
export async function getCurrentGps(timeoutMs: number): Promise<Gps> {
  // 判断是否运行在 Tauri 环境
  const isTauri = !!(window as Window & { __TAURI__?: unknown }).__TAURI__;

  // 1. 优先尝试 Tauri 原生定位（通过系统 GPS / 网络定位）
  if (isTauri) {
    try {
      const granted = await ensureLocationPermission();
      if (granted) {
        const position = await getCurrentPosition({
          enableHighAccuracy: true,
          timeout: Math.min(timeoutMs, PRIMARY_TIMEOUT_MS),
          maximumAge: 60_000,
        });
        return {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
      }
    } catch (e) {
      console.warn("Tauri native geolocation failed, falling back to AMap:", e);
    }
  }

  // 2. 降级：高德 JS API 定位
  try {
    const position = await getAmapPosition(timeoutMs);
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
  } catch (amapError) {
    console.error("AMap geolocation also failed:", amapError);
    return null;
  }
}

// 根据 UA 推断平台名称
export function getPlatformLabel(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipad")) return "iOS";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os")) return "macOS";
  if (ua.includes("linux")) return "Linux";
  return "Unknown";
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
  const cores = typeof navigator.hardwareConcurrency === "number" ? `${navigator.hardwareConcurrency} cores` : "unknown";
  const memory =
    typeof (navigator as Navigator & { deviceMemory?: number }).deviceMemory === "number"
      ? `${(navigator as Navigator & { deviceMemory?: number }).deviceMemory} GB`
      : "unknown";

  return {
    terminal_id: input.terminalId,
    platform: getPlatformLabel(),
    device_model: getDeviceModelLabel(),
    cpu: cores,
    memory,
    gps: input.gps,
    status: input.status,
    last_update: new Date().toISOString(),
  };
}
