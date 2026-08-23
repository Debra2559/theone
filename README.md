# theone · 心动说明书

一款「理解自己，再遇见对的人」的恋爱人格 Web App：做轻测试、玩沉浸式剧情、生成专属《个人说明书》，并以此驱动 1v1 匹配与 AI 恋爱军师。

## 功能一览

| 模块                              | 说明                                                                    |
| --------------------------------- | ----------------------------------------------------------------------- |
| 🏠 理解页（`/home`）              | 测试进度总览、说明书入口、狐军师入口                                    |
| 🧪 轻测试乐园                     | MBTI 速测、依恋类型、爱的语言、高低需求、四元素气质、星座档案、八字速览 |
| 🎭 **恋爱人格剧场（本分支新增）** | 30 幕沉浸式对话剧情小游戏，玩着玩着就画出你的爱情人格画像               |
| 📖 我的说明书（`/manual`）        | 汇总所有测试与剧场画像，AI 生成翻页式个人说明书                         |
| 💞 匹配（`/match`）               | 基于画像的缘分匹配                                                      |
| 🦊 狐军师（`/counselor`）         | AI 情感顾问，开场白 / 见面时机 / 吵架救场随时问                         |

## 恋爱人格剧场（Love Dialogue Game）

原独立 demo 的互动剧情游戏，现已集成为第 8 个「测试」，**用户可自主选择是否游玩**：

- **入口**：理解页「轻测试乐园」中的「🎭 恋爱人格剧场」卡片（也可直达 `/game`）
- **玩法**：30 幕场景对话（凌晨初聊 → 心动 → 热恋 → 摩擦 → 冲突 → 深谈），每幕 3 选 1，选择即画像
- **表现层**：零图片、全程序化的「UI 即场景」——Canvas 色彩场 + 环境粒子 + 场景符号线稿 + 打字节奏拟情绪（详见 `public/game/`）
- **数据流**：通关后游戏通过 `postMessage` 上报画像 JSON → 写入 `test_results`（`test_id = love-dialogue`）→ 一键「更新我的说明书」，AI 会把这份画像与其它测试结果融合，生成更丰富的人格说明书

### 集成架构

```
src/routes/_authenticated/game.tsx   # /game 路由：全屏 iframe 宿主 + 结果监听与落库
src/lib/tests.ts                     # 注册 kind: "game" 测试项（首页卡片自动出现）
src/routes/_authenticated/home.tsx   # 游戏卡片链接分流到 /game
public/game/                         # 游戏本体（vanilla JS，独立运行、样式零冲突）
  ├── index.html / css/ / assets/
  └── js/  app.js（结局 postMessage 上报）· scenarios.js（30 幕剧本）
           engine.js（计分引擎）· portrait.js（画像生成）· dialogue.js / scene-backdrop.js / motifs.js（表现层）
```

游戏在 iframe 内完全独立运行，与宿主 App 仅通过一条 `love-game:result` 消息通信，可随时整体替换或独立演进。

## 本地开发

```sh
git clone https://github.com/Debra2559/theone.git
cd theone
bun i        # 或 npm i
bun run dev  # 或 npm run dev
```

需要配置 Supabase 环境变量（见 `src/integrations/supabase/client.ts`），数据库迁移脚本在 `supabase/migrations/`。

游戏本体亦可脱离 App 独立预览：直接打开 `public/game/index.html`。

## 技术栈

TanStack Start · React 19 · TypeScript · Tailwind CSS 4 · Supabase · Vite（Lovable 生成项目）
