// 錯題本狀態轉移（純函式）
import { FAMILIAR_STREAK } from "./constants";

export interface WrongState {
  wrong_count: number;
  correct_streak: number;
  status: "ACTIVE" | "FAMILIAR";
}

/**
 * - 答錯：加入（或留在）錯題本，連續答對歸零，狀態回到「待複習」
 * - 答對：若在錯題本中，連續答對 +1；達門檻標記「已熟悉」（保留紀錄，不刪除）
 * - 答對且不在錯題本：不變（回傳 null）
 */
export function nextWrongState(prev: WrongState | null, isCorrect: boolean): WrongState | null {
  if (!isCorrect) {
    return {
      wrong_count: (prev?.wrong_count ?? 0) + 1,
      correct_streak: 0,
      status: "ACTIVE",
    };
  }
  if (!prev) return null;
  const streak = prev.correct_streak + 1;
  return {
    wrong_count: prev.wrong_count,
    correct_streak: streak,
    status: streak >= FAMILIAR_STREAK ? "FAMILIAR" : prev.status,
  };
}
