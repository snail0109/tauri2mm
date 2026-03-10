import { invoke } from "@tauri-apps/api/core";

export type RuntimeKind = "mobile" | "desktop";

export type PlatformInfo = {
  os: string;
  isMobile: boolean;
  isDesktop: boolean;
};

function fromUserAgent(): PlatformInfo {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android")) {
    return { os: "android", isMobile: true, isDesktop: false };
  }
  if (ua.includes("iphone") || ua.includes("ipad")) {
    return { os: "ios", isMobile: true, isDesktop: false };
  }
  if (ua.includes("windows")) {
    return { os: "windows", isMobile: false, isDesktop: true };
  }
  if (ua.includes("mac os")) {
    return { os: "macos", isMobile: false, isDesktop: true };
  }
  if (ua.includes("linux")) {
    return { os: "linux", isMobile: false, isDesktop: true };
  }
  return { os: "unknown", isMobile: false, isDesktop: true };
}

export async function getPlatformInfo(): Promise<PlatformInfo> {
  const isTauri = !!(window as Window & { __TAURI__?: unknown }).__TAURI__;
  if (!isTauri) {
    return fromUserAgent();
  }

  try {
    return await invoke<PlatformInfo>("get_platform_info");
  } catch {
    return fromUserAgent();
  }
}

export async function getRuntimeKind(): Promise<RuntimeKind> {
  const platform = await getPlatformInfo();
  return platform.isMobile ? "mobile" : "desktop";
}

export async function isMobileRuntime(): Promise<boolean> {
  const platform = await getPlatformInfo();
  return platform.isMobile;
}

