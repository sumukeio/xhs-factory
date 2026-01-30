// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 获取图片代理URL（解决CORS问题）
export function getProxyImageUrl(imageUrl: string): string {
  if (!imageUrl) return "";
  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
  // 如果已经是代理URL，直接返回
  if (imageUrl.startsWith(backendBase)) return imageUrl;
  // 否则通过后端代理
  return `${backendBase}/api/proxy_image?url=${encodeURIComponent(imageUrl)}`;
}