# Chatbot sửa lỗi diễn đạt

Module học tiếng Anh cá nhân: chatbot sửa lỗi ngữ pháp/diễn đạt tiếng Anh và dịch Việt–Anh, dùng Gemini API. Chạy local bằng Node.js (Express) + HTML/CSS/JS thuần, lưu lịch sử chat vào file JSON trên máy.

## Bắt đầu nhanh

Cách dễ nhất: double-click **`start.bat`** — script này tự kiểm tra Node.js, tự tạo file `.env` từ `.env.example` nếu chưa có, tự `npm install` lần đầu, rồi mở server + trình duyệt.

Hoặc chạy tay:

```powershell
npm install
copy .env.example .env
# Mở .env, dán GEMINI_API_KEY (lấy miễn phí tại https://aistudio.google.com/apikey)
npm start
```

Mặc định chạy tại `http://localhost:3099` (đổi qua biến `PORT` trong `.env`).

## Tính năng

- **Chatbot**: sửa lỗi / dịch / gợi ý diễn đạt, lưu lịch sử theo cuộc trò chuyện.
- **Writing** (Task 2): 500 đề từ `writing_task2.md`, phân loại topic + question type, lọc/tìm/sắp xếp, thống kê tiến độ theo topic và type, viết bài (tự lưu nháp), bấm **Dùng AI chấm bài** (band + 4 tiêu chí + sửa lỗi + bản viết lại). Mọi lần chấm được lưu lại để xem sau.

Đề bài nằm ở `server/data/writing-task2/questions.json` (sinh bằng `node server/scripts/build-questions.js`; id = số dòng trong `writing_task2.md`, chỉ nên thêm đề mới vào CUỐI file). Bài viết + kết quả chấm lưu ở `server/data/writing-task2/essays/<id>.json` (không đưa lên git).

## Cấu trúc thư mục

```
server/
  index.js                        # Khởi động Express server
  modules/writing-fix/
    routes.js                     # API routes (/api/writing-fix/...)
    gemini.js                     # Gọi Gemini API + system prompt sửa lỗi
    sessionStore.js                # Đọc/ghi session chat dạng file JSON
  modules/writing-task2/           # Đề bài, lưu bài viết, chấm bằng AI, routes /api/writing-task2
  scripts/build-questions.js       # Sinh questions.json từ writing_task2.md
  data/writing-fix/sessions/       # Lịch sử chat (mỗi session 1 file .json)

public/
  index.html
  css/style.css
  index.html                       # Giao diện mới (Chatbot + Writing)
  js/daily.js                      # Logic frontend của index.html
  index-old.html, js/app.js        # Giao diện cũ (không còn dùng)

start.bat                          # Script chạy nhanh cho Windows
.env.example                       # Mẫu cấu hình (copy thành .env)
```

## Lưu ý

- Lịch sử chat nằm trong `server/data/writing-fix/sessions/*.json`, không đưa lên git (xem `.gitignore`).
- `.env` chứa API key thật, cũng không đưa lên git.
- Đây là ứng dụng chạy nội bộ, một người dùng, không có xác thực/đăng nhập.
