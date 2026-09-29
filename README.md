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

## Cấu trúc thư mục

```
server/
  index.js                        # Khởi động Express server
  modules/writing-fix/
    routes.js                     # API routes (/api/writing-fix/...)
    gemini.js                     # Gọi Gemini API + system prompt sửa lỗi
    sessionStore.js                # Đọc/ghi session chat dạng file JSON
  data/writing-fix/sessions/       # Lịch sử chat (mỗi session 1 file .json)

public/
  index.html
  css/style.css
  js/app.js                        # Toàn bộ logic frontend (sidebar, chat, theme)

start.bat                          # Script chạy nhanh cho Windows
.env.example                       # Mẫu cấu hình (copy thành .env)
```

## Lưu ý

- Lịch sử chat nằm trong `server/data/writing-fix/sessions/*.json`, không đưa lên git (xem `.gitignore`).
- `.env` chứa API key thật, cũng không đưa lên git.
- Đây là ứng dụng chạy nội bộ, một người dùng, không có xác thực/đăng nhập.
