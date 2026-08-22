import { createAvatar } from "@dicebear/core";
import { adventurer, bigSmile, funEmoji, lorelei, micah } from "@dicebear/collection";

/*
 * 头像系统：基于 DiceBear（开源插画风头像库）本地生成 SVG。
 * 存储格式："db:<style>:<seed>" 字符串，直接存进 profiles.avatar 字段。
 * 旧的 emoji 头像继续兼容（渲染层自动识别）。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const STYLES: Record<string, any> = {
  adventurer,
  "big-smile": bigSmile,
  lorelei,
  micah,
  "fun-emoji": funEmoji,
};

export type AvatarStyle = "adventurer" | "big-smile" | "lorelei" | "micah" | "fun-emoji";

/* 糖果色背景池（与 App 调色板一致），DiceBear 按 seed 确定性挑选 */
const CANDY_BACKGROUNDS = [
  "f6c7dc", // 糖粉
  "d6c4f0", // 薰衣草
  "f7e6a8", // 奶油黄
  "bfe0d9", // 薄荷
  "bcd7f7", // 雾蓝
  "fbc9a8", // 蜜桃
];

export function isDbAvatar(v?: string | null): boolean {
  return !!v && v.startsWith("db:");
}

/* 把 "db:style:seed" 转成 SVG data URI；非法值返回 null */
export function avatarDataUri(v?: string | null): string | null {
  if (!isDbAvatar(v)) return null;
  const [, style, seed] = v!.split(":");
  const def = STYLES[style as AvatarStyle];
  if (!def || !seed) return null;
  try {
    return createAvatar(def, { seed, backgroundColor: CANDY_BACKGROUNDS }).toDataUri();
  } catch {
    return null;
  }
}

/* 挑名字池：好听的中性词作 seed，保证生成结果稳定好看 */
const SEED_WORDS = [
  "Mochi",
  "Luna",
  "Cookie",
  "Sunny",
  "Pudding",
  "Stella",
  "Milo",
  "Coco",
  "Aurora",
  "Bubble",
  "Taro",
  "Peach",
  "Nova",
  "Muffin",
  "Soda",
  "Jupiter",
  "Latte",
  "Willow",
  "Comet",
  "Berry",
  "Cloud",
  "Maple",
  "Dango",
  "Hazel",
  "River",
  "Sakura",
  "Toast",
  "Mango",
  "Felix",
  "Oliver",
  "Leo",
  "Max",
  "Charlie",
  "Jack",
  "Bella",
  "Chloe",
  "Ruby",
  "Zoe",
  "Mia",
  "Lily",
];

const PICKER_STYLES: AvatarStyle[] = ["adventurer", "big-smile", "lorelei", "micah", "fun-emoji"];

/* 生成一批候选头像（选择器用），offset 不同则换一批 */
export function avatarBatch(count = 10, offset = 0): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const style = PICKER_STYLES[(offset + i) % PICKER_STYLES.length]!;
    const seed = SEED_WORDS[(offset * 7 + i * 5) % SEED_WORDS.length]! + (offset + i);
    out.push(`db:${style}:${seed}`);
  }
  return out;
}

export const DEFAULT_AVATAR = "db:lorelei:Luna0";
