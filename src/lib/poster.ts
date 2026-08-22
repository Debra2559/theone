import foxImg from "@/assets/fox.png";
import { avatarDataUri } from "@/lib/avatars";

/*
 * 海报渲染器：把个人说明书 / 关系说明书绘制成一张糖果风 PNG（Canvas2D）。
 * 设计规范与 App 一致：暖白纸底 + 彩色柔雾 + 白卡大圆角 + 墨色文字 + 心动粉强调。
 * 所有 DOM 访问都在函数内部，模块可被 SSR 安全 import。
 */

export type PosterSection = { icon: string; title: string; points: string[] };

export type ManualPosterData = {
  kind: "manual";
  nickname: string;
  avatar: string;
  title: string;
  oneLiner?: string | undefined;
  badges: string[];
  sections: PosterSection[];
};

export type RelPosterData = {
  kind: "relationship";
  meName: string;
  meAvatar: string;
  partnerName: string;
  partnerAvatar: string;
  score: number;
  verdict?: string | undefined;
  chemistry: string[];
  friction: string[];
  playbook: string[];
  dateIdeas: string[];
};

export type PosterData = ManualPosterData | RelPosterData;

const W = 1080;
const M = 84;
const SCRATCH_H = 3800;

const PAPER = "#FAF7F1";
const INK = "#383350";
const MUTED = "#8E88A3";
const PINK = "#D53F77";
const GOLD = "#C47F35";
const CARD_BORDER = "#EEE9F4";

function font(size: number, weight = 400) {
  return `${weight} ${size}px "Fraunces","Noto Serif SC","Noto Sans SC","PingFang SC","Microsoft YaHei",serif`;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const ch of text) {
    if (ch === "\n") {
      lines.push(cur);
      cur = "";
      continue;
    }
    if (cur && ctx.measureText(cur + ch).width > maxW) {
      lines.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function wrapCap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const lines = wrap(ctx, text, maxW);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1] ?? "";
  while (last.length > 0 && ctx.measureText(last + "…").width > maxW) last = last.slice(0, -1);
  kept[maxLines - 1] = last + "…";
  return kept;
}

function loadFox(): Promise<HTMLImageElement | null> {
  return loadImage(foxImg);
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

/* 背景：纸底 + 四角柔雾 + 糖针小点 */
function paintBackground(ctx: CanvasRenderingContext2D, h: number) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, h);
  const blobs = [
    { x: W * 0.08, y: -80, r: 380, c: "rgba(214,180,238,0.45)" },
    { x: W * 0.98, y: 30, r: 330, c: "rgba(246,199,220,0.5)" },
    { x: W * 0.02, y: h * 0.72, r: 320, c: "rgba(247,230,168,0.45)" },
    { x: W * 1.0, y: h * 0.96, r: 300, c: "rgba(191,224,217,0.4)" },
  ];
  for (const b of blobs) {
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    g.addColorStop(0, b.c);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }
  const dotColors = ["rgba(213,63,119,0.35)", "rgba(150,120,210,0.35)", "rgba(196,127,53,0.35)", "rgba(90,170,160,0.35)"];
  for (let i = 0; i < 26; i++) {
    const x = (((i * 197 + 41) % 1000) / 1000) * W;
    const y = (((i * 389 + 77) % 1000) / 1000) * h;
    ctx.fillStyle = dotColors[i % dotColors.length]!;
    ctx.beginPath();
    ctx.arc(x, y, 2 + ((i * 53) % 4), 0, Math.PI * 2);
    ctx.fill();
  }
}

function card(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.shadowColor = "rgba(90,80,140,0.16)";
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = "#FFFFFF";
  rr(ctx, x, y, w, h, 30);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = CARD_BORDER;
  ctx.lineWidth = 2;
  rr(ctx, x, y, w, h, 30);
  ctx.stroke();
}

function drawHeader(ctx: CanvasRenderingContext2D, fox: HTMLImageElement | null, subtitle: string): number {
  const y = 72;
  let tx = M;
  if (fox) {
    ctx.drawImage(fox, M, y, 68, 68);
    tx = M + 84;
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.font = font(40, 600);
  ctx.fillText("心动说明书", tx, y + 42);
  ctx.fillStyle = PINK;
  ctx.font = font(19, 500);
  ctx.fillText("HEART MANUAL", tx + 2, y + 68);
  const d = new Date();
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  ctx.textAlign = "right";
  ctx.fillStyle = MUTED;
  ctx.font = font(24, 400);
  ctx.fillText(date, W - M, y + 42);
  ctx.textAlign = "center";
  ctx.fillStyle = MUTED;
  ctx.font = font(24, 400);
  ctx.fillText(subtitle, W / 2, y + 118);
  return y + 160;
}

function drawFooter(ctx: CanvasRenderingContext2D, y: number): number {
  y += 26;
  ctx.strokeStyle = CARD_BORDER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(M, y);
  ctx.lineTo(W / 2 - 30, y);
  ctx.moveTo(W / 2 + 30, y);
  ctx.lineTo(W - M, y);
  ctx.stroke();
  ctx.fillStyle = PINK;
  ctx.font = font(24, 500);
  ctx.textAlign = "center";
  ctx.fillText("✦", W / 2, y + 8);
  ctx.fillStyle = MUTED;
  ctx.font = font(24, 400);
  ctx.fillText("好玩的测试 × AI 说明书 × 狐军师陪跑", W / 2, y + 62);
  ctx.fillStyle = INK;
  ctx.font = font(26, 500);
  ctx.fillText("写给宇宙的一封自我介绍 ✨", W / 2, y + 106);
  return y + 150;
}

async function drawAvatar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, avatar: string, ring: string) {
  ctx.save();
  ctx.shadowColor = "rgba(90,80,140,0.18)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = ring;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 7, 0, Math.PI * 2);
  ctx.stroke();

  /* DiceBear 插画头像：加载 SVG data URI 并裁剪进圆形 */
  const uri = avatarDataUri(avatar);
  if (uri) {
    const img = await loadImage(uri);
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
      return;
    }
  }
  ctx.font = font(Math.round(r * 0.95), 400);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(avatar, cx, cy + r * 0.06);
  ctx.textBaseline = "alphabetic";
}

function gradientText(ctx: CanvasRenderingContext2D, text: string, cx: number, baseline: number, size: number) {
  ctx.font = font(size, 700);
  const tw = ctx.measureText(text).width;
  const g = ctx.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0);
  g.addColorStop(0, "#D53F77");
  g.addColorStop(1, "#E07B39");
  ctx.fillStyle = g;
  ctx.textAlign = "center";
  ctx.fillText(text, cx, baseline);
}

function drawBadges(ctx: CanvasRenderingContext2D, badges: string[], y: number): number {
  const list = badges.slice(0, 6);
  if (list.length === 0) return y;
  ctx.font = font(25, 500);
  const rows: string[][] = [[]];
  let rowW = 0;
  for (const b of list) {
    const bw = ctx.measureText(b).width + 52;
    if (rowW + bw + 14 > W - 2 * M && rows[rows.length - 1]!.length > 0) {
      rows.push([]);
      rowW = 0;
    }
    rows[rows.length - 1]!.push(b);
    rowW += bw + 14;
  }
  for (const row of rows.slice(0, 2)) {
    const widths = row.map((b) => ctx.measureText(b).width + 52);
    const total = widths.reduce((a, b) => a + b, 0) + (row.length - 1) * 14;
    let x = (W - total) / 2;
    row.forEach((b, i) => {
      const bw = widths[i]!;
      ctx.fillStyle = "rgba(213,63,119,0.1)";
      rr(ctx, x, y, bw, 52, 26);
      ctx.fill();
      ctx.strokeStyle = "rgba(213,63,119,0.3)";
      ctx.lineWidth = 2;
      rr(ctx, x, y, bw, 52, 26);
      ctx.stroke();
      ctx.fillStyle = PINK;
      ctx.textAlign = "center";
      ctx.fillText(b, x + bw / 2, y + 35);
      x += bw + 14;
    });
    y += 66;
  }
  return y + 6;
}

/* 板块白卡：icon + 标题 + 至多 2 条要点（每条至多 2 行），返回结束 y */
function drawSectionCard(ctx: CanvasRenderingContext2D, icon: string, title: string, points: string[], y: number): number {
  const x = M;
  const w = W - 2 * M;
  const pad = 40;
  const bulletIndent = 46;
  const textW = w - pad * 2 - bulletIndent;
  const picked = points.slice(0, 2);
  ctx.font = font(28, 400);
  const wrapped = picked.map((p) => wrapCap(ctx, p, textW, 2));

  let h = pad + 44 + 18;
  for (const lines of wrapped) h += lines.length * 44 + 16;
  h += pad - 16;

  card(ctx, x, y, w, h);

  let cy = y + pad;
  ctx.textAlign = "left";
  ctx.font = font(36, 400);
  ctx.fillText(icon, x + pad, cy + 34);
  ctx.fillStyle = INK;
  ctx.font = font(34, 600);
  ctx.fillText(title, x + pad + 56, cy + 34);
  cy += 44 + 18;

  ctx.font = font(28, 400);
  for (const lines of wrapped) {
    ctx.fillStyle = PINK;
    ctx.fillText("✦", x + pad, cy + 26);
    ctx.fillStyle = "#4A4460";
    lines.forEach((ln, i) => ctx.fillText(ln, x + pad + bulletIndent, cy + 26 + i * 44));
    cy += lines.length * 44 + 16;
  }
  return y + h + 28;
}

async function drawManual(ctx: CanvasRenderingContext2D, fox: HTMLImageElement | null, d: ManualPosterData): Promise<number> {
  let y = drawHeader(ctx, fox, "我的专属使用说明书");

  await drawAvatar(ctx, W / 2, y + 72, 64, d.avatar || "✨", "rgba(213,63,119,0.45)");
  y += 176;

  ctx.fillStyle = INK;
  ctx.font = font(38, 600);
  ctx.textAlign = "center";
  ctx.fillText(d.nickname, W / 2, y);
  y += 30;

  ctx.font = font(64, 700);
  for (const ln of wrapCap(ctx, d.title, W - 2 * M, 2)) {
    y += 84;
    gradientText(ctx, ln, W / 2, y, 64);
  }
  y += 26;

  if (d.oneLiner) {
    ctx.font = font(30, 400);
    ctx.fillStyle = MUTED;
    for (const ln of wrapCap(ctx, `「${d.oneLiner}」`, W - 2 * M - 40, 3)) {
      y += 48;
      ctx.fillText(ln, W / 2, y);
    }
    y += 20;
  }

  y += 14;
  y = drawBadges(ctx, d.badges, y);
  y += 26;

  const shown = d.sections.slice(0, 3);
  for (const sec of shown) y = drawSectionCard(ctx, sec.icon, sec.title, sec.points, y);

  const rest = d.sections.length - shown.length;
  if (rest > 0) {
    ctx.fillStyle = MUTED;
    ctx.font = font(24, 400);
    ctx.textAlign = "center";
    ctx.fillText(`还有 ${rest} 个板块 · 打开 App 查看完整说明书`, W / 2, y + 22);
    y += 56;
  }
  return drawFooter(ctx, y);
}

async function drawRelationship(ctx: CanvasRenderingContext2D, fox: HTMLImageElement | null, d: RelPosterData): Promise<number> {
  let y = drawHeader(ctx, fox, "我们的关系说明书");

  // 双方头像 + 合拍指数
  const ay = y + 64;
  await drawAvatar(ctx, W / 2 - 260, ay, 56, d.meAvatar || "✨", "rgba(150,120,210,0.5)");
  await drawAvatar(ctx, W / 2 + 260, ay, 56, d.partnerAvatar || "✨", "rgba(213,63,119,0.45)");
  ctx.fillStyle = INK;
  ctx.font = font(30, 600);
  ctx.textAlign = "center";
  ctx.fillText(d.meName, W / 2 - 260, ay + 108);
  ctx.fillText(d.partnerName, W / 2 + 260, ay + 108);

  ctx.font = font(38, 400);
  ctx.fillText("💞", W / 2, y + 26);
  gradientText(ctx, `${d.score}%`, W / 2, y + 118, 96);
  ctx.fillStyle = MUTED;
  ctx.font = font(22, 400);
  ctx.fillText("合拍指数", W / 2, y + 152);
  y += 196;

  if (d.verdict) {
    ctx.font = font(30, 400);
    ctx.fillStyle = MUTED;
    for (const ln of wrapCap(ctx, `「${d.verdict}」`, W - 2 * M - 40, 3)) {
      y += 48;
      ctx.fillText(ln, W / 2, y);
    }
    y += 26;
  } else {
    y += 10;
  }

  y = drawSectionCard(ctx, "🧪", "化学反应", d.chemistry, y);
  y = drawSectionCard(ctx, "⚡", "潜在摩擦", d.friction, y);
  y = drawSectionCard(ctx, "📜", "相处攻略", d.playbook, y);

  if (d.dateIdeas.length > 0) {
    y = drawBadges(ctx, d.dateIdeas.slice(0, 3).map((s) => `🎡 ${s}`), y + 6);
  }
  return drawFooter(ctx, y);
}

export async function renderPoster(data: PosterData): Promise<HTMLCanvasElement> {
  try {
    await document.fonts.ready;
  } catch {
    /* 字体未就绪则用系统字体兜底 */
  }
  const fox = await loadFox();

  const scratch = document.createElement("canvas");
  scratch.width = W;
  scratch.height = SCRATCH_H;
  const sctx = scratch.getContext("2d");
  if (!sctx) throw new Error("无法创建画布");

  const bottom =
    data.kind === "manual"
      ? await drawManual(sctx, fox, data)
      : await drawRelationship(sctx, fox, data);
  const H = Math.min(Math.ceil(bottom) + 24, SCRATCH_H);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");
  paintBackground(ctx, H);
  ctx.drawImage(scratch, 0, 0, W, H, 0, 0, W, H);
  return canvas;
}
