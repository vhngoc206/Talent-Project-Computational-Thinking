# SmartStudy AI – Intelligent Study Planner

Ứng dụng web giúp sinh viên quản lý môn học, bài tập, deadline; tự tính độ ưu tiên; tạo lịch học tối ưu bằng thuật toán Greedy; quản lý sự kiện trên Lịch (kiểu Google Calendar); tư vấn bằng AI (Gemini); trang Focus (Pomodoro toàn màn hình với âm thanh thiên nhiên và nhạc YouTube); theo dõi tiến độ bằng biểu đồ.
Đồ án cá nhân – React + TypeScript + Vite + Tailwind CSS + Lucide + Recharts + LocalStorage + Gemini API. Giao diện phong cách “Ghibli × Notion”.

## Tiến độ

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| 1 | Khởi tạo, layout, Dashboard | Xong |
| 2 | CRUD Môn học/Nhiệm vụ, LocalStorage, Priority Engine | Xong |
| 3 | Thời gian rảnh + Greedy Scheduler + hiển thị lịch, cảnh báo thiếu thời gian | Xong |
| 4 | Gemini API: Task Analyzer, Study Planner, Study Advisor + Demo Mode | Xong |
| 5 | Trang Thống kê (Weekly Hours, Task Completion, Subject Distribution, hiệu suất tuần), Pomodoro | Xong |
| 6 | Unit test, kiểm tra responsive, README | Xong |
| 7 | Giao diện Ghibli × Notion, Lịch sự kiện, trang Focus (âm thanh, YouTube, hình nền, quote), API key chuyển sang server, sẵn sàng deploy | Xong |

## Chạy dự án

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit test (Vitest)
npm run typecheck  # kiểm tra kiểu TypeScript
npm run build      # build production
```

Cần Node.js 18+.

### Bật AI thật (Gemini) và tìm kiếm YouTube

1. Lấy key Gemini miễn phí tại <https://aistudio.google.com/apikey>.
2. Sao chép `.env.example` thành `.env`, điền `GEMINI_API_KEY=...` (tùy chọn `GEMINI_MODEL`, mặc định `gemini-flash-latest`).
3. (Tùy chọn) `YOUTUBE_API_KEY=...` để **tìm kiếm** nhạc trong trang Focus – tạo ở Google Cloud Console → bật “YouTube Data API v3” → Credentials → API key. Không có key vẫn phát nhạc được bằng cách dán link YouTube hoặc chọn video gợi ý.
4. Dừng và chạy lại `npm run dev`.

Không có key Gemini thì ứng dụng chạy **Demo Mode**: banner trên trang AI và nhãn trên mỗi câu trả lời ghi rõ “Demo Mode · logic có sẵn, không phải AI”.

**Bảo mật key:** trình duyệt không bao giờ nhận API key. Mọi lời gọi đi qua API của chính web (`/api/gemini`, `/api/youtube-search`, `/api/config` – mã trong `server/handlers.ts`); server đọc key từ biến môi trường rồi mới gọi Google. Khi `npm run dev`, các API này do plugin trong `vite.config.ts` phục vụ; khi deploy lên Vercel, do các serverless function trong thư mục `api/`. Đã kiểm tra: bản build `dist/` không chứa key. Không commit file `.env` (đã có trong `.gitignore`).

## Đưa web lên mạng (truy cập bằng đường link, không cần mở VS Code)

Dùng **Vercel** (miễn phí):

```bash
npx vercel login          # đăng nhập (mở trình duyệt) – chỉ làm một lần
npx vercel --prod         # deploy, nhận đường link dạng https://smartstudy-xxx.vercel.app
```

Sau đó vào vercel.com → Project → Settings → Environment Variables, thêm `GEMINI_API_KEY` (và `YOUTUBE_API_KEY` nếu có), rồi chạy lại `npx vercel --prod`. Vercel tự nhận dạng Vite (build `npm run build`, thư mục `dist`) và các function trong `api/`.

Mở link trên điện thoại/Chrome có thể chọn **“Cài đặt ứng dụng / Thêm vào màn hình chính”** (đã có `manifest.webmanifest` và icon).

> Dữ liệu (môn học, nhiệm vụ, sự kiện…) lưu trong LocalStorage của từng trình duyệt – mở trên máy khác sẽ là dữ liệu riêng của máy đó.

## Đăng nhập & trang Quản trị (Firebase)

- Có cấu hình Firebase (`VITE_FIREBASE_*`) thì web **bắt buộc đăng nhập**: email + mật khẩu (có Đăng ký, Quên mật khẩu) hoặc **Đăng nhập bằng Google**. Mỗi tài khoản có dữ liệu riêng, lưu trên Firestore (`userData/{uid}`), dùng được trên mọi thiết bị.
- Mỗi lần mở web ghi một lượt truy cập (`visits`) và cập nhật hồ sơ (`users`). Trang **Quản trị** (`#/admin`) chỉ hiện với email quản trị đã xác minh (`src/constants/admin.ts`), và Firestore cũng chỉ cho email đó đọc thống kê (`firestore.rules`).
- Ứng dụng không bao giờ thấy hay lưu mật khẩu – Firebase Authentication lo phần này.
- Không có cấu hình Firebase (ví dụ khi chạy test) thì chạy cục bộ như trước, không cần đăng nhập.

Thiết lập một lần: tạo project ở <https://console.firebase.google.com> → Authentication: bật **Email/Password** và **Google**, thêm tên miền web vào *Authorized domains* → Firestore Database: tạo database, dán nội dung `firestore.rules` vào tab Rules → Project settings → thêm Web app, chép cấu hình vào `.env` / Vercel.

## Cấu trúc

```
src/
├─ types/          Subject, Task, StudySession, Availability, StudySchedule, AppData
├─ algorithms/     priorityScheduler.ts · greedyScheduler.ts (+ test)   ← thuật toán thuần, không phụ thuộc React
├─ services/       aiService.ts (gọi /api/gemini) · storageService.ts (LocalStorage + validate) · seedData.ts
├─ state/          appReducer.ts (CRUD + lịch học, thuần, có test) · AppStateContext.tsx (Provider + tự lưu)
├─ features/
│  ├─ subjects/ tasks/           form, danh sách, giải thích điểm ưu tiên
│  ├─ scheduler/                 AvailabilityForm, ScheduleSummary, ScheduleView
│  ├─ calendar/                  EventFormModal (tạo/sửa sự kiện)
│  ├─ focus/                     âm thanh thiên nhiên, YouTube, hình nền, các bảng của trang Focus
│  ├─ ai-assistant/              assistantApi (3 chức năng AI) · demoTaskParser · demoAdvisor
│  │                             studyInsights · aiContext · các panel giao diện
│  ├─ analytics/                 stats.ts (thuần, có test) + các biểu đồ Recharts
│  ├─ pomodoro/                  logic thuần + Context (chạy xuyên trang) + widget
│  └─ dashboard/
├─ components/     ui (Button, Modal, Badge, Toast…) · layout (Sidebar, TopBar, AppShell)
├─ pages/          Dashboard · Subjects · Tasks · Calendar · Scheduler · Focus · AiAssistant · Analytics
├─ hooks/ utils/   useNow, useHashRoute, useAsyncAction · date, events, validation, text
├─ constants/      ghibli.ts (danh mục ảnh) · quotes.ts (câu động lực)
server/            handlers.ts – xử lý API phía server (giữ API key)
api/               serverless function cho Vercel (gọi lại server/handlers.ts)
public/ghibli/     ảnh phim Totoro (chính thức) · public/sounds/ âm thanh thiên nhiên
```

Luồng dữ liệu: `LocalStorage → storageService.load (kiểm tra) → useReducer → Context → UI`; mọi thay đổi được lưu lại tự động.

## Module 3 – Smart Priority Engine (`src/algorithms/priorityScheduler.ts`)

```
Priority Score = 0.4 × Deadline Score + 0.3 × Importance Score + 0.3 × Difficulty Score
```

- Deadline Score: còn > 7 ngày = 1 · từ 3 đến 7 ngày = 2 · dưới 3 ngày hoặc quá hạn = 3
- Importance / Difficulty: Low/Easy = 1, Medium = 2, High/Hard = 3
- Sắp xếp giảm dần theo điểm; bằng điểm thì deadline gần hơn trước; task đã hoàn thành bị loại.
- Mỗi task có “lý do ưu tiên” hiển thị trên giao diện. Kết quả được dùng ở trang Nhiệm vụ, Dashboard, Pomodoro, Greedy Scheduler và AI.

## Module 4 – Smart Study Scheduler (`src/algorithms/greedyScheduler.ts`)

Thuật toán **Greedy**: luôn chọn task ưu tiên cao nhất còn lại và đặt vào khung rảnh **sớm nhất** còn trống.

1. Lấy task chưa hoàn thành, thời gian cần = ước tính − đã học.
2. Sắp xếp bằng `rankTasks()` (Priority Score, rồi deadline).
3. Sinh các *khối rảnh* từ hôm nay theo ngày học + khung giờ (gộp khung chồng lấn, bỏ phần đã trôi qua, làm tròn 5 phút). Phạm vi: tới deadline xa nhất, tối đa 28 ngày.
4. Với từng task: cắt thành phiên dài tối đa `sessionMinutes` (25/45/60/90), đặt vào khối sớm nhất; giữa hai phiên trong cùng khối có `breakMinutes` nghỉ. Phần dư < 15 phút được gộp vào phiên trước.
5. Mỗi khối có một **con trỏ** thời gian chỉ tiến lên ⇒ **không bao giờ trùng giờ**.
6. Phiên phải **kết thúc trước deadline** ⇒ không xếp sau deadline; task đã quá hạn không được xếp.
7. Phần không xếp được → `unscheduled` (số phút thiếu + lý do) và `warnings` (ví dụ “khối lượng vượt quá thời gian rảnh”).

Trên trang **Lịch học**: thiết lập thời gian rảnh → “Lưu & tạo lịch”; đánh dấu từng phiên đã học (cộng giờ vào task, có thể hoàn tác); “Học ngay” chọn task trong Pomodoro. Lịch ghi lại “chữ ký” dữ liệu đầu vào; khi task hoặc thời gian rảnh đổi, trang báo **lịch đã cũ** và gợi ý tạo lại. Tạo lại lịch giữ các phiên đã học xong hôm nay.

## Lịch sự kiện (`src/pages/CalendarPage.tsx`, `src/utils/events.ts`)

- Xem theo **Ngày / Tuần / Tháng**; bấm ô trống để tạo sự kiện ở đúng giờ đó, bấm sự kiện để sửa/xóa.
- Sự kiện có: tên, ngày, giờ bắt đầu–kết thúc (bước 15 phút) hoặc cả ngày, lặp lại (không/hằng ngày/hằng tuần, có ngày kết thúc), địa điểm, ghi chú, màu.
- Sự kiện chồng giờ được chia cột cạnh nhau (`layoutOverlaps`), có vạch đỏ “bây giờ”.
- Lịch hiển thị chung phiên học do Greedy Scheduler xếp (nét đứt) và deadline nhiệm vụ.
- **Liên kết với thuật toán:** sự kiện bật “Tôi bận trong thời gian này” được đổi thành khoảng bận (`busyIntervals`) và **trừ khỏi thời gian rảnh** trước khi Greedy xếp lịch ⇒ không xếp phiên học trùng giờ lên lớp/họp nhóm. Thêm/sửa sự kiện làm lịch học được báo “đã cũ”.

## Focus – Pomodoro toàn màn hình (`src/pages/FocusPage.tsx`)

- Đồng hồ lớn ở lớp trên; lớp nền là ảnh phim Totoro, ảnh bạn tự tải lên (lưu bằng IndexedDB) hoặc **video YouTube** (YouTube IFrame Player API, phủ kín màn hình).
- Bảng **Nhiệm vụ**: chọn nhiệm vụ đang học (hết phiên tự cộng giờ), đánh dấu hoàn thành, thêm nhanh.
- Bảng **Âm thanh**: mưa bên cửa sổ, mưa trên lá, nước chảy, gió rừng, chim hót, đêm bên ao – trộn nhiều âm thanh, chỉnh âm lượng từng cái, vẫn phát khi chuyển trang.
- Bảng **Nhạc**: tìm kiếm YouTube (cần `YOUTUBE_API_KEY`), dán link, video gợi ý; phát/dừng, âm lượng, bật/tắt video làm nền.
- Bảng **Hẹn giờ**: chỉnh thời lượng tập trung/nghỉ ngắn/nghỉ dài, số phiên trước nghỉ dài, tự chạy pha tiếp; **chuông** khi hết giờ (chuông/bíp/tắt, âm lượng, nghe thử) + thông báo hệ điều hành.
- Câu động lực tiếng Việt đổi mỗi phút; phím tắt Space = bắt đầu/tạm dừng; nút toàn màn hình.

## Module 5 – AI Study Assistant (`src/services/aiService.ts`, `src/features/ai-assistant/`)

| Chức năng | Gemini (có key) | Demo Mode (không có key) |
|---|---|---|
| **A. Task Analyzer** – câu tự nhiên → nhiệm vụ | JSON theo `responseSchema`, có danh sách môn thật + thời điểm hiện tại | `demoTaskParser.ts`: luật nhận diện môn, “thứ Sáu tuần này/ngày mai/dd-mm”, “3 tiếng/90 phút”, độ khó, mức quan trọng |
| **B. Study Planner** – việc cần làm trước, rủi ro trễ, phân bổ, lời khuyên | JSON theo schema, ngữ cảnh = dữ liệu thật + mô phỏng Greedy | `buildDemoPlan()` từ Priority Engine + Greedy |
| **C. Study Advisor** – chat hỏi đáp | Hội thoại nhiều lượt, ngữ cảnh JSON cập nhật mỗi câu hỏi | `answerDemoQuestion()` nhận diện 5 dạng câu hỏi |

Chống AI “bịa dữ liệu”:
- Prompt yêu cầu chỉ dùng dữ liệu trong ngữ cảnh; ngữ cảnh do `aiContext.ts` dựng từ dữ liệu thật.
- `sanitizeTaskDraft()` loại môn học không tồn tại, chuẩn hóa enum/số phút/deadline.
- `sanitizePlan()` loại mọi mục tham chiếu task không có thật (giao diện báo số mục bị loại).
- Task Analyzer **không tự lưu**: kết quả mở form điền sẵn để người dùng kiểm tra rồi mới lưu.

Trạng thái: Loading · Error (key sai, hết quota 429, model không tồn tại 404, mạng, timeout 45 giây) · nút **Thử lại** · nút “Dùng Demo Mode cho lần này” (kết quả vẫn gắn nhãn Demo).

**Model dự phòng:** nếu model chính bị quá tải (HTTP 503) hoặc không trả lời trong 20 giây, `aiService` tự chuyển sang `gemini-flash-lite-latest`. Nhãn trên câu trả lời ghi đúng model đã trả lời (ví dụ “Gemini AI · gemini-flash-lite-latest”). Lỗi key/quota không chuyển model vì đổi model không giải quyết được.

## Module 6 & 7 – Thống kê, Pomodoro

- Trang **Thống kê**: tổng / đã xong / chưa xong / quá hạn / completion rate / tổng giờ học; biểu đồ hiệu suất 6 tuần (giờ học + task hoàn thành), giờ học 7 ngày, tỷ lệ hoàn thành, phân bố theo môn; bảng tiến độ theo môn; phiên học gần đây. Tất cả tính từ `stats.ts` trên dữ liệu thật.
- **Pomodoro** mặc định 25/5/15 (nghỉ dài sau 4 phiên), chỉnh được trên trang Focus: Start, Pause, Resume, Reset, Bỏ qua, chọn task; hết phiên tập trung thì ghi số phút vào task + tạo `StudySession`. Đồng hồ chạy xuyên trang (hiện trên thanh trên cùng và tiêu đề tab).

## Dữ liệu & LocalStorage

- Key `smartstudy.v1.data`. Lần đầu mở app tự nạp dữ liệu mẫu (mốc thời gian tương đối theo hôm nay nên luôn có task quá hạn / sắp đến hạn / còn xa để demo).
- Dữ liệu hỏng: sao lưu sang `smartstudy.v1.data.corrupt`, khôi phục dữ liệu mẫu và báo người dùng; phần tử sai kiểu bị bỏ qua.
- Nút **Reset Demo Data** ở thanh trên cùng.

## Kiểm thử

`npm test` – 102 unit test, gồm các yêu cầu trong đề:

| Yêu cầu | Test |
|---|---|
| Thêm/sửa/xóa task, đánh dấu hoàn thành | `state/appReducer.test.ts` |
| Điểm ưu tiên đúng, sắp xếp đúng thứ tự | `algorithms/priorityScheduler.test.ts` |
| Lịch không trùng giờ, không sau deadline, cảnh báo thiếu thời gian, chia phiên, giữ phiên cũ | `algorithms/greedyScheduler.test.ts` |
| Sự kiện lặp lại, chia cột khi chồng giờ, lịch học tránh giờ bận | `utils/events.test.ts` |
| Lưu/đọc lại dữ liệu & lịch sau refresh | `services/storageService.test.ts`, `state/scheduleState.test.ts` |
| Pomodoro chuyển pha đúng | `features/pomodoro/pomodoroLogic.test.ts` |
| Demo Mode khi không có key; kiểm tra kết quả AI; phân tích câu tiếng Việt | `features/ai-assistant/aiAssistant.test.ts` |
| Thống kê / dashboard tính từ dữ liệu | `features/analytics/stats.test.ts`, `state/scheduleState.test.ts` |

Kiểm thử thủ công nên làm khi demo: (1) Lịch học → Lưu & tạo lịch → đánh dấu một phiên → Dashboard/Thống kê tăng giờ học; (2) sửa deadline một task → trang Lịch báo “đã cũ”; (3) AI Assistant → Ví dụ 1 → Phân tích → Kiểm tra & lưu; (4) có key: Gemini trả lời, nhãn “Gemini AI”; đổi key sai → thấy lỗi + Thử lại.

## Giới hạn đã biết

- API `/api/gemini` không có đăng nhập: ai biết link web đều dùng được quota Gemini của bạn – phù hợp đồ án/demo.
- Nhạc YouTube chỉ phát khi đang ở trang Focus (rời trang thì dừng); âm thanh thiên nhiên thì vẫn phát.
- Không có ảnh động (GIF) nhân vật: GIF Totoro trên mạng đều cắt từ phim mà không được cấp phép, nên ứng dụng dùng ảnh tĩnh chính thức + hiệu ứng chuyển động CSS (ảnh trôi chậm, lá rơi, nhân vật nhún). Bạn có thể tự tải GIF của mình lên làm hình nền Focus.
- Demo Mode là luật đơn giản: câu mô tả quá tự do có thể không nhận ra môn/deadline (khi đó form yêu cầu chọn tay).
- Khung giờ rảnh áp dụng giống nhau cho mọi ngày đã chọn.
- Lịch sử chat Advisor không được lưu khi rời trang.

## Nguồn ảnh & âm thanh

Không có ảnh hay âm thanh nào do AI tạo ra.

- **Ảnh:** 16 cảnh trong phim *Hàng xóm của tôi là Totoro* (1988), lấy từ trang chính thức của Studio Ghibli <https://www.ghibli.jp/works/totoro/>. Ghibli cho phép dùng các ảnh này “trong phạm vi thông thường” (常識の範囲でご自由にお使いください). Bản quyền © 1988 Studio Ghibli. Ảnh được nén lại trong `public/ghibli/`.
- **Âm thanh** (Wikimedia Commons, `public/sounds/`):
  - “Rain against the window” – cori – Public domain
  - “Rain on leaves (Gravity Sound)” – Gravity Sound – CC BY 4.0
  - “Water flowing pouring trickling” – stephan – Public domain
  - “Wind in forest (Gravity Sound)” – Gravity Sound – CC BY 4.0
  - “Birds forest” – Barracuda1983 – Public domain
  - “Nature sounds ambience in a Dordogne pond” – Glaneur de sons – CC BY 3.0
  - “Bells (Gravity Sound)” (chuông hết giờ) – Gravity Sound – CC BY 4.0
- **Video gợi ý** trong trang Focus là video công khai trên YouTube, phát qua trình nhúng chính thức của YouTube (không tải về).
- **Câu động lực:** tục ngữ, ca dao Việt Nam và các câu tự viết.
