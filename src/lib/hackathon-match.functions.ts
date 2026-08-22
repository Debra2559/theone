import { createServerFn } from "@tanstack/react-start";

export type HackathonPerson = {
  nickname: string;
  gender: string;
  profile: string;
  memories_self: string[];
  memories_ideal: string[];
};

export type HackathonMessage = {
  from: "a" | "b" | string;
  type: string;
  content: string;
  sent_at: string;
};

export type HackathonMatch = {
  match_id: string;
  match_status: string;
  message_count: number;
  user_a: HackathonPerson;
  user_b: HackathonPerson;
  messages: HackathonMessage[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePerson(value: unknown): HackathonPerson {
  if (!isRecord(value) || typeof value.nickname !== "string" || typeof value.profile !== "string") {
    throw new Error("匹配接口返回的用户资料格式无效");
  }
  return {
    nickname: value.nickname,
    gender: typeof value.gender === "string" ? value.gender : "未知",
    profile: value.profile,
    memories_self: Array.isArray(value.memories_self)
      ? value.memories_self.filter((item): item is string => typeof item === "string")
      : [],
    memories_ideal: Array.isArray(value.memories_ideal)
      ? value.memories_ideal.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function parseMatch(value: unknown): HackathonMatch {
  if (!isRecord(value) || !value.user_a || !value.user_b || !Array.isArray(value.messages)) {
    throw new Error("匹配接口返回的数据格式无效");
  }
  return {
    match_id: typeof value.match_id === "string" ? value.match_id : "unknown",
    match_status: typeof value.match_status === "string" ? value.match_status : "UNKNOWN",
    message_count:
      typeof value.message_count === "number" ? value.message_count : value.messages.length,
    user_a: parsePerson(value.user_a),
    user_b: parsePerson(value.user_b),
    messages: value.messages.flatMap((item) => {
      if (!isRecord(item) || typeof item.content !== "string") return [];
      return [
        {
          from: typeof item.from === "string" ? item.from : "unknown",
          type: typeof item.type === "string" ? item.type : "text",
          content: item.content,
          sent_at: typeof item.sent_at === "string" ? item.sent_at : "",
        },
      ];
    }),
  };
}

export async function fetchHackathonMatchData(): Promise<HackathonMatch> {
  const url = process.env["HACKATHON_MATCH_URL"];
  const token = process.env["HACKATHON_MATCH_TOKEN"];
  if (!url || !token) throw new Error("未配置黑客松匹配接口");

  const response = await fetch(url, {
    headers: { Accept: "application/json", "X-Token": token },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`匹配接口请求失败：${response.status}`);

  return parseMatch(await response.json());
}

export const getHackathonMatch = createServerFn({ method: "GET" }).handler(fetchHackathonMatchData);
