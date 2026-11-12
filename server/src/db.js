import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.DB_FILE ?? path.join(here, '..', 'data.sqlite');

// Mở file SQLite (chưa có thì tự tạo)
export const db = new Database(file);

// WAL: ghi nhanh hơn và đọc không bị chặn khi đang ghi
db.pragma('journal_mode = WAL');

// Thời gian lưu dạng epoch milliseconds (số), tính toán và so sánh rất tiện
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    topic           TEXT    NOT NULL DEFAULT '',
    planned_minutes INTEGER NOT NULL,
    started_at      INTEGER NOT NULL,
    ended_at        INTEGER,
    status          TEXT    NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'completed', 'abandoned')),
    distractions    INTEGER NOT NULL DEFAULT 0,
    xp_earned       INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS quests (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    xp          INTEGER NOT NULL,
    kind        TEXT    NOT NULL CHECK (kind IN ('daily', 'learn')),
    status      TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
    note        TEXT    NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL,
    done_at     INTEGER
  );

  CREATE TABLE IF NOT EXISTS rewards (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    cost_xp    INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  -- Lưu cả title và cost_xp tại lúc đổi, nên xoá reward không làm mất lịch sử
  CREATE TABLE IF NOT EXISTS redemptions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    reward_id   INTEGER,
    title       TEXT    NOT NULL,
    cost_xp     INTEGER NOT NULL,
    redeemed_at INTEGER NOT NULL
  );
`);

// Seed dữ liệu mẫu, chỉ khi bảng còn trống
const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

if (count('quests') === 0) {
  const insert = db.prepare(
    'INSERT INTO quests (title, description, xp, kind, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  const now = Date.now();
  insert.run('Đọc lại code route đầu tiên', 'Giải thích bằng lời của mình', 30, 'learn', now);
  insert.run('Hiểu useQuery làm gì', 'Viết lại queryKey và queryFn là gì', 30, 'learn', now);
  insert.run('Tập thể dục 15 phút', '', 15, 'daily', now);
  insert.run('Dọn bàn học', '', 10, 'daily', now);
}

if (count('rewards') === 0) {
  const insert = db.prepare('INSERT INTO rewards (title, cost_xp, created_at) VALUES (?, ?, ?)');
  const now = Date.now();
  insert.run('30 phút chơi game', 60, now);
  insert.run('30 phút lướt mạng xã hội', 40, now);
  insert.run('Một ly trà sữa', 150, now);
}
