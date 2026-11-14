# ⚔️ Focus Quest

App web học tập trung theo kiểu chơi game: focus kiếm XP, lên level, giữ streak, làm quest và đổi XP lấy phần thưởng, kể cả chính thứ hay gây sao nhãng như giờ chơi game hay lướt social.

Project sinh ra từ một vấn đề thật: muốn học nhưng dễ bị game và social media kéo đi. Thay vì chỉ cố gắng chịu đựng, app biến việc tập trung thành thứ có phần thưởng rõ ràng và phản hồi nhanh, giống cách game giữ chân người chơi.

> Trạng thái: MVP đang phát triển, dùng cho một người dùng.

## Điểm nhấn

- **Phiên focus có hậu quả thật.** Đồng hồ đếm ngược, mỗi phút là 1 XP. Rời tab/cửa sổ vài giây thì bị trừ XP, rời quá lâu thì phiên bị huỷ và mất hết.
- **Quest buộc phải hiểu.** Quest loại "học" yêu cầu ghi chú giải thích lại bằng lời của mình mới nhận XP. Mục đích là chống kiểu vibe code xong rồi không bao giờ đọc lại.
- **Server là nguồn sự thật.** Thời gian hoàn thành phiên được kiểm tra ở server nên không thể bấm hoàn thành sớm để gian lận.
- **XP và level được tính ra, không lưu cứng.** Tổng XP suy ra từ lịch sử phiên, quest và lượt đổi thưởng nên số liệu không bị lệch.

## Tech stack

| Tầng           | Công nghệ                                                        |
| -------------- | ---------------------------------------------------------------- |
| Frontend       | React 19, TypeScript, Vite                                       |
| Giao diện      | MUI                                                              |
| Routing        | TanStack Router (code-based routes)                              |
| Dữ liệu từ API | TanStack Query v5                                                |
| Form           | TanStack Form                                                    |
| Backend        | Node.js (ESM), Express 5                                         |
| Database       | SQLite qua `better-sqlite3` (không dùng ORM, viết SQL trực tiếp) |

## Chạy thử

Cần Node.js 20 trở lên.

```bash
npm run setup      # cài dependencies cho root, server, client
npm run dev        # server :3001 + client :5173, mở http://localhost:5173
```

Chạy bản production (Express phục vụ luôn client đã build):

```bash
npm run build
npm start          # http://localhost:3001
```

Dữ liệu lưu ở `server/data.sqlite`, tự tạo ở lần chạy đầu cùng vài quest và phần thưởng mẫu. Muốn reset thì xoá file này.

Biến môi trường (đều tuỳ chọn):

| Biến            | Mặc định             | Ý nghĩa                                   |
| --------------- | -------------------- | ----------------------------------------- |
| `PORT`          | `3001`               | Cổng của Express                          |
| `DB_FILE`       | `server/data.sqlite` | Đường dẫn file SQLite                     |
| `TZ_OFFSET_MIN` | `420` (UTC+7)        | Múi giờ dùng để chia ngày khi tính streak |

## Luật chơi

| Thứ                  | Cách tính                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| XP phiên focus       | 1 XP mỗi phút, phiên từ 45 phút trở lên được cộng thêm 5 XP                                      |
| Phân tâm             | Rời tab hoặc cửa sổ từ 2 đến 15 giây: trừ 10% XP mỗi lần, tối đa trừ 50%                         |
| Huỷ phiên            | Rời quá 15 giây hoặc tự bấm bỏ: mất toàn bộ XP của phiên                                         |
| Quest "học" 🧠       | Cần ghi chú từ 30 ký tự trở lên mới nhận XP                                                      |
| Quest "hằng ngày" 📅 | Bấm hoàn thành là nhận XP                                                                        |
| Level                | Tổng XP cần cho level L là `50 × L × (L − 1)`: level 2 cần 100, level 3 cần 300, level 4 cần 600 |
| Streak               | Số ngày liên tiếp có ít nhất một phiên hoặc một quest hoàn thành                                 |
| Đổi thưởng           | Trừ vào "XP tiêu được", không làm tụt level                                                      |

Server còn chặn hoàn thành phiên khi chưa đủ giờ, chỉ cho một phiên chạy tại một thời điểm, và phiên phải được hoàn thành trong 10 phút sau khi hết giờ.

## Cấu trúc

```
server/src/
  db.js        schema SQLite và dữ liệu mẫu
  game.js      công thức level, XP, streak (hàm thuần, dễ test)
  index.js     Express API và phục vụ client đã build
client/src/
  api.ts       gọi API và định nghĩa type
  router.tsx   route tree và layout
  pages/       Dashboard, Focus, Quests, Rewards
```

## API

Tất cả nằm dưới `/api`.

| Method            | Path                        | Mô tả                              |
| ----------------- | --------------------------- | ---------------------------------- |
| GET               | `/me`                       | Level, XP, streak, thống kê 7 ngày |
| GET, POST         | `/sessions`                 | Lịch sử phiên, bắt đầu phiên mới   |
| GET               | `/sessions/active`          | Phiên đang chạy                    |
| POST              | `/sessions/:id/distraction` | Ghi nhận một lần phân tâm          |
| POST              | `/sessions/:id/complete`    | Hoàn thành phiên và nhận XP        |
| POST              | `/sessions/:id/abandon`     | Huỷ phiên                          |
| GET, POST, DELETE | `/quests`                   | Quản lý quest                      |
| POST              | `/quests/:id/complete`      | Hoàn thành quest kèm ghi chú       |
| GET, POST, DELETE | `/rewards`                  | Quản lý phần thưởng                |
| POST              | `/rewards/:id/redeem`       | Đổi XP lấy phần thưởng             |
| GET               | `/redemptions`              | Lịch sử đổi thưởng                 |

## Giới hạn hiện tại

- Chỉ phát hiện được việc rời tab hoặc cửa sổ trên máy tính. Không chặn được điện thoại hay app khác, nên vẫn cần chế độ Focus của điện thoại hoặc extension chặn site.
- Việc phát hiện sao nhãng chạy ở client, người dùng cố tình vẫn có thể né. Chấp nhận được vì đây là công cụ tự kỷ luật.
- Chưa có xác thực và chỉ phục vụ một người dùng.
- Chưa có test tự động.

## Hướng phát triển

- Quest tự sinh từ ghi chú của phiên focus, quest lặp lại hằng ngày
- Thành tựu (badge) và thống kê theo chủ đề học
- Giới hạn số phút game/social được đổi mỗi ngày
- Test cho `game.js` và các endpoint chính
- Xác thực và nhiều người dùng
- Về lâu dài: tích hợp vào một game độc lập kiểu indie focus game, để thời gian tập trung và XP trở thành tiến trình ngay trong game
