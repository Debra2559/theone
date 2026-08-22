import { useMemo } from "react";
import { avatarDataUri } from "@/lib/avatars";

/*
 * 统一头像渲染：支持 DiceBear 插画头像（db:...）和旧的 emoji 头像。
 * 尺寸由 className 控制（img 用 h-/w-，emoji 用 text-*）。
 */
export function UserAvatar({
  avatar,
  className = "",
  alt = "",
}: {
  avatar?: string | null | undefined;
  className?: string;
  alt?: string;
}) {
  const uri = useMemo(() => avatarDataUri(avatar), [avatar]);
  if (uri) {
    return (
      <img
        src={uri}
        alt={alt}
        draggable={false}
        className={`select-none rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <span className={`inline-flex select-none items-center justify-center leading-none ${className}`}>
      {avatar || "🦊"}
    </span>
  );
}
