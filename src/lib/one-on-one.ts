export type OneOnOneLock = {
  candidateId: string | null;
  candidateNickname: string;
  wish: string;
  startedAt: string;
};

const STORAGE_KEY = "spark-connect:one-on-one-lock";
const LOCK_EVENT = "spark-connect:one-on-one-lock-change";

export function getOneOnOneLock(): OneOnOneLock | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<OneOnOneLock>;
    if (!value.candidateNickname || typeof value.wish !== "string") return null;
    return {
      candidateId: typeof value.candidateId === "string" ? value.candidateId : null,
      candidateNickname: value.candidateNickname,
      wish: value.wish,
      startedAt: typeof value.startedAt === "string" ? value.startedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function setOneOnOneLock(lock: OneOnOneLock) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lock));
  window.dispatchEvent(new Event(LOCK_EVENT));
}

export function clearOneOnOneLock() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(LOCK_EVENT));
}

export function subscribeToOneOnOneLock(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(LOCK_EVENT, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LOCK_EVENT, listener);
  };
}
