// Luật chơi: toàn hàm thuần (không đụng DB, không tự gọi Date.now()) nên test rất dễ.

const TZ_OFFSET_MIN = Number(process.env.TZ_OFFSET_MIN ?? 420); // mặc định UTC+7
const DAY_MS = 86_400_000;

// '2026-11-14': ngày của một mốc thời gian, theo múi giờ cố định ở trên
export function dayKey(ms) {
  return new Date(ms + TZ_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

// XP một phiên: 1 XP/phút, phiên >= 45 phút +5. Mỗi lần phân tâm trừ 10%, tối đa trừ 50%.
export function sessionXp(minutes, distractions) {
  const base = minutes + (minutes >= 45 ? 5 : 0);
  const keep = Math.max(0.5, 1 - 0.1 * distractions);
  return Math.max(1, Math.round(base * keep));
}

// Tổng XP cần có để đạt level L: 50 * L * (L - 1) -> L2 = 100, L3 = 300, L4 = 600
const xpToReach = (level) => 50 * level * (level - 1);

export function levelProgress(totalXp) {
  let level = 1;
  while (totalXp >= xpToReach(level + 1)) level++;
  return {
    level,
    xpIntoLevel: totalXp - xpToReach(level), // đã có bao nhiêu XP trong level này
    xpForNext: xpToReach(level + 1) - xpToReach(level), // cần tổng cộng bao nhiêu để lên level sau
  };
}

// activeDays: Set các dayKey có ít nhất 1 phiên/quest hoàn thành.
// Đếm lùi từ hôm nay; nếu hôm nay chưa làm gì thì đếm từ hôm qua (streak chưa đứt tới hết ngày).
export function computeStreak(activeDays, now) {
  let cursor = activeDays.has(dayKey(now)) ? now : now - DAY_MS;
  let streak = 0;
  while (activeDays.has(dayKey(cursor))) {
    streak++;
    cursor -= DAY_MS;
  }
  return streak;
}
