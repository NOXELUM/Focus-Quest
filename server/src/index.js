import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { computeStreak, dayKey, levelProgress, sessionXp } from './game.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const GRACE_AFTER_END_MS = 10 * 60_000; // phải hoàn thành trong 10 phút sau khi hết giờ
const TOLERANCE_MS = 3_000; // dung sai khi kiểm tra "đã đủ giờ chưa"
const NOTE_MIN_LENGTH = 30; // quest học cần ghi chú dài ít nhất chừng này

// Lỗi có kèm mã HTTP. Route chỉ cần `throw`, middleware cuối file sẽ biến nó thành JSON.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Không tin dữ liệu client gửi lên: ép kiểu và cắt gọn trước khi dùng
const toInt = (v) => (typeof v === 'number' || typeof v === 'string' ? Number.parseInt(v, 10) : NaN);
const cleanText = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// ---------- Thống kê ----------

// XP, level, streak không lưu sẵn mà tính ra từ lịch sử mỗi lần gọi, nên không bao giờ lệch.
function getStats() {
  const sum = (sql) => db.prepare(sql).get().s;
  const sessionXpTotal = sum("SELECT COALESCE(SUM(xp_earned), 0) AS s FROM sessions WHERE status = 'completed'");
  const questXpTotal = sum("SELECT COALESCE(SUM(xp), 0) AS s FROM quests WHERE status = 'done'");
  const spentXp = sum('SELECT COALESCE(SUM(cost_xp), 0) AS s FROM redemptions');
  const totalXp = sessionXpTotal + questXpTotal;

  const sessions = db.prepare("SELECT ended_at, planned_minutes FROM sessions WHERE status = 'completed'").all();
  const quests = db.prepare("SELECT done_at FROM quests WHERE status = 'done'").all();

  const activeDays = new Set(); // những ngày có làm gì đó, dùng để tính streak
  const minutesByDay = new Map(); // ngày -> tổng số phút focus
  for (const s of sessions) {
    const key = dayKey(s.ended_at);
    activeDays.add(key);
    minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + s.planned_minutes);
  }
  for (const q of quests) activeDays.add(dayKey(q.done_at));

  const now = Date.now();
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const key = dayKey(now - i * 86_400_000);
    last7.push({ day: key, minutes: minutesByDay.get(key) ?? 0 });
  }

  return {
    totalXp,
    spentXp,
    spendableXp: totalXp - spentXp,
    ...levelProgress(totalXp),
    streak: computeStreak(activeDays, now),
    todayMinutes: minutesByDay.get(dayKey(now)) ?? 0,
    sessionsCompleted: sessions.length,
    questsDone: quests.length,
    last7,
  };
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/me', (_req, res) => res.json(getStats()));

// ---------- Phiên focus ----------

const endOf = (s) => s.started_at + s.planned_minutes * 60_000;

// Phiên 'active' đã quá hạn (hết giờ hơn 10 phút mà chưa hoàn thành) thì bị huỷ
function expireStaleSessions() {
  const now = Date.now();
  const active = db.prepare("SELECT * FROM sessions WHERE status = 'active'").all();
  for (const s of active) {
    if (now > endOf(s) + GRACE_AFTER_END_MS) {
      db.prepare("UPDATE sessions SET status = 'abandoned', ended_at = ? WHERE id = ?").run(now, s.id);
    }
  }
}

function getActiveSession() {
  expireStaleSessions();
  return db.prepare("SELECT * FROM sessions WHERE status = 'active' ORDER BY id DESC LIMIT 1").get() ?? null;
}

function requireActive(id) {
  const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!s) throw new HttpError(404, 'Không tìm thấy phiên');
  if (s.status !== 'active') throw new HttpError(409, 'Phiên này đã kết thúc');
  return s;
}

// serverNow giúp client bù lệch đồng hồ giữa máy mình và server
app.get('/api/sessions/active', (_req, res) => {
  res.json({ session: getActiveSession(), serverNow: Date.now() });
});

app.get('/api/sessions', (_req, res) => {
  res.json(db.prepare("SELECT * FROM sessions WHERE status != 'active' ORDER BY id DESC LIMIT 30").all());
});

app.post('/api/sessions', (req, res) => {
  const minutes = toInt(req.body?.minutes);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
    throw new HttpError(400, 'Số phút phải từ 1 đến 180');
  }
  if (getActiveSession()) throw new HttpError(409, 'Đang có một phiên chạy rồi');

  const topic = cleanText(req.body?.topic, 120);
  const info = db
    .prepare('INSERT INTO sessions (topic, planned_minutes, started_at) VALUES (?, ?, ?)')
    .run(topic, minutes, Date.now());
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ session, serverNow: Date.now() });
});

app.post('/api/sessions/:id/distraction', (req, res) => {
  const s = requireActive(toInt(req.params.id));
  db.prepare('UPDATE sessions SET distractions = distractions + 1 WHERE id = ?').run(s.id);
  res.json({ distractions: s.distractions + 1 });
});

app.post('/api/sessions/:id/abandon', (req, res) => {
  const s = requireActive(toInt(req.params.id));
  db.prepare("UPDATE sessions SET status = 'abandoned', ended_at = ? WHERE id = ?").run(Date.now(), s.id);
  res.json({ ok: true });
});

app.post('/api/sessions/:id/complete', (req, res) => {
  const s = requireActive(toInt(req.params.id));
  const now = Date.now();

  // Server tự so giờ, không tin client: đây là chỗ chống bấm hoàn thành sớm
  if (now < endOf(s) - TOLERANCE_MS) {
    throw new HttpError(400, 'Chưa đủ thời gian, đừng gian lận nha');
  }
  if (now > endOf(s) + GRACE_AFTER_END_MS) {
    db.prepare("UPDATE sessions SET status = 'abandoned', ended_at = ? WHERE id = ?").run(now, s.id);
    throw new HttpError(410, 'Phiên đã quá hạn nên không được tính');
  }

  const xp = sessionXp(s.planned_minutes, s.distractions);
  db.prepare("UPDATE sessions SET status = 'completed', ended_at = ?, xp_earned = ? WHERE id = ?").run(now, xp, s.id);
  res.json({ xpEarned: xp, distractions: s.distractions, stats: getStats() });
});

// ---------- Quest ----------

app.get('/api/quests', (_req, res) => {
  // 'done' < 'open' theo bảng chữ cái, nên DESC đưa quest đang mở lên trước
  res.json(db.prepare('SELECT * FROM quests ORDER BY status DESC, id DESC').all());
});

app.post('/api/quests', (req, res) => {
  const title = cleanText(req.body?.title, 120);
  const description = cleanText(req.body?.description, 500);
  const xp = toInt(req.body?.xp);
  const kind = req.body?.kind === 'learn' ? 'learn' : 'daily';
  if (!title) throw new HttpError(400, 'Cần có tiêu đề');
  if (!Number.isInteger(xp) || xp < 1 || xp > 500) throw new HttpError(400, 'XP phải từ 1 đến 500');

  const info = db
    .prepare('INSERT INTO quests (title, description, xp, kind, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(title, description, xp, kind, Date.now());
  res.status(201).json(db.prepare('SELECT * FROM quests WHERE id = ?').get(info.lastInsertRowid));
});

app.post('/api/quests/:id/complete', (req, res) => {
  const id = toInt(req.params.id);
  const quest = db.prepare('SELECT * FROM quests WHERE id = ?').get(id);
  if (!quest) throw new HttpError(404, 'Không tìm thấy quest');
  if (quest.status === 'done') throw new HttpError(409, 'Quest này xong rồi');

  // Quest "học" bắt buộc giải thích lại bằng lời của mình: XP tính theo hiểu, không theo bấm nút
  const note = cleanText(req.body?.note, 2000);
  if (quest.kind === 'learn' && note.length < NOTE_MIN_LENGTH) {
    throw new HttpError(400, `Quest học cần ghi chú ít nhất ${NOTE_MIN_LENGTH} ký tự: giải thích lại bằng lời của mày`);
  }

  db.prepare("UPDATE quests SET status = 'done', note = ?, done_at = ? WHERE id = ?").run(note, Date.now(), id);
  res.json({ xpEarned: quest.xp, stats: getStats() });
});

app.delete('/api/quests/:id', (req, res) => {
  const info = db.prepare('DELETE FROM quests WHERE id = ?').run(toInt(req.params.id));
  if (info.changes === 0) throw new HttpError(404, 'Không tìm thấy quest');
  res.json({ ok: true });
});

// ---------- Phần thưởng ----------

app.get('/api/rewards', (_req, res) => {
  res.json(db.prepare('SELECT * FROM rewards ORDER BY cost_xp ASC, id ASC').all());
});

app.post('/api/rewards', (req, res) => {
  const title = cleanText(req.body?.title, 120);
  const cost = toInt(req.body?.cost_xp);
  if (!title) throw new HttpError(400, 'Cần có tên phần thưởng');
  if (!Number.isInteger(cost) || cost < 1 || cost > 100_000) throw new HttpError(400, 'Giá XP phải từ 1 đến 100000');

  const info = db
    .prepare('INSERT INTO rewards (title, cost_xp, created_at) VALUES (?, ?, ?)')
    .run(title, cost, Date.now());
  res.status(201).json(db.prepare('SELECT * FROM rewards WHERE id = ?').get(info.lastInsertRowid));
});

// TODO(bạn) Bài 2: viết route DELETE /api/rewards/:id
// - Xoá reward có id = req.params.id (nhớ ép kiểu bằng toInt).
// - Không có dòng nào bị xoá (info.changes === 0) thì throw new HttpError(404, 'Không tìm thấy phần thưởng').
// - Thành công thì trả { ok: true }.
// Gợi ý: gần như giống hệt route DELETE /api/quests/:id ở trên.
// Thử: curl -X DELETE http://localhost:3001/api/rewards/1

app.post('/api/rewards/:id/redeem', (req, res) => {
  const reward = db.prepare('SELECT * FROM rewards WHERE id = ?').get(toInt(req.params.id));
  if (!reward) throw new HttpError(404, 'Không tìm thấy phần thưởng');

  const { spendableXp } = getStats();
  if (spendableXp < reward.cost_xp) {
    throw new HttpError(400, `Chưa đủ XP: cần ${reward.cost_xp}, đang có ${spendableXp}`);
  }

  // Chép title và cost_xp vào lịch sử, để sau này xoá hay đổi giá reward thì lịch sử vẫn đúng
  db.prepare('INSERT INTO redemptions (reward_id, title, cost_xp, redeemed_at) VALUES (?, ?, ?, ?)').run(
    reward.id,
    reward.title,
    reward.cost_xp,
    Date.now(),
  );
  res.json({ ok: true, stats: getStats() });
});

// TODO(bạn) Bài 1: viết route GET /api/redemptions
// - Trả về 30 lượt đổi thưởng gần nhất, mới nhất đứng trước (mảng JSON).
// Gợi ý: db.prepare('SELECT ... FROM redemptions ORDER BY ... LIMIT ...').all() rồi res.json(...).
// Xem route GET /api/sessions ở trên để bắt chước.
// Thử: curl http://localhost:3001/api/redemptions

// ---------- Production: Express phục vụ luôn client đã build ----------

app.use('/api', (_req, res) => res.status(404).json({ error: 'Không có endpoint này' }));

const dist = path.join(here, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  // Các đường dẫn như /focus, /quests do router phía client xử lý, nên luôn trả index.html
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

// ---------- Xử lý lỗi (phải đặt cuối cùng) ----------

// Middleware có 4 tham số là middleware lỗi: mọi `throw` trong route đều rơi vào đây
app.use((err, _req, res, _next) => {
  // Body JSON hỏng thì express.json() ném lỗi có sẵn status 400
  const status = err instanceof HttpError ? err.status : err.status === 400 ? 400 : 500;
  if (status === 500) console.error(err);
  const message = err instanceof HttpError ? err.message : status === 400 ? 'Dữ liệu gửi lên không hợp lệ' : 'Lỗi server';
  res.status(status).json({ error: message });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`Focus Quest server: http://localhost:${port}`));
