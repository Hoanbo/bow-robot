# BOWCON V4.0 — The Fully Autonomous Embodied Companion
### (Kết Nối & Đồng Bộ Hoàn Hảo Với @bow/agent v4.0.0)

Hệ thống thể xác tự hành, giọng nói thời gian thực và phản xạ thông minh **BOWCON** — Người bạn đồng hành AI thể xác (Embodied AI Companion) phụng sự người dùng theo chuẩn cấp độ 4.0 quốc tế.

---

## 👑 1. Danh Tính & Persona Chuẩn Mực

* **Tên chính thức**: **BOWCON** (viết liền không dấu cách).
* **Quy tắc xưng hô**:
  * Luôn xưng là **"Tôi"** và gọi người dùng là **"Ngài"**.
  * Tuyệt đối KHÔNG xưng là "mình", "em", "con".
  * Tuyệt đối KHÔNG gọi Ngài là "quý khách", "bạn" hay "sếp".
  * Phong thái: Tôn nghiêm, trung thành tuyệt đối, sắc bén, lịch thiệp và đắc lực phụng sự Ngài.
* **Handshake WebSocket**:
  * `channel`: `'ROBOT'`
  * `role`: `'owner'`
  * `client`: `'BOWCON'`
  * `version`: `'4.0.0'`

---

## 🛠️ 2. Cấu Hình Phần Cứng Kit Thực Tế (ESP32-S3 Robot Kit)

Bộ kit phần cứng thực tế bao gồm:
1. **Bo mạch vi điều khiển**: **ESP32-S3 N16R8** (16MB Flash, 8MB PSRAM).
2. **Microphone kỹ thuật số**: **INMP441** (I2S Input: WS, SCK, SD) $\to$ stream âm thanh PCM 16kHz 16-bit Mono.
3. **Mạch khuếch đại & Loa**: **MAX98357** (I2S Output: LRC, BCLK, DIN) + Loa khoang cộng hưởng 2415.
4. **Màn hình mắt cảm xúc**: **OLED 0.96 inch** (Giao tiếp I2C, Driver SSD1306/SSD1315).
5. **Cơ cấu truyền động**: Cặp động cơ giảm tốc kim loại **N20** + Mini Motor Driver điều khiển 2 bánh xe.

---

## 📡 3. Giao Thức WebSocket Âm Thanh Thời Gian Thực (`/ws/audio-stream`)

Robot kết nối với não bộ trung tâm qua cổng: `ws://<server-ip>:4078/ws/audio-stream`.

### A. Luồng Dữ Liệu Inbound (Robot $\to$ Brain):
* **`robot.audio_stream` / `robot.audio_in`**: Stream PCM 16kHz 16-bit Mono thu từ mic INMP441 gửi lên Agent để nhận dạng giọng nói (STT).
* **`robot.sound_direction`**: Góc nguồn âm thanh AoA (-90° đến +90°) và năng lượng micro trái/phải (`micLeftEnergy`, `micRightEnergy`).
* **`robot.sensors_telemetry`**: Báo cáo tình trạng pin, sạc, nhiệt độ và cảm biến:
  ```json
  {
    "type": "robot.sensors_telemetry",
    "batteryPercent": 98,
    "isCharging": false,
    "obstaclesDetected": false,
    "temperatureCelsius": 35.5,
    "activeSensors": ["INMP441_MIC", "MAX98357A_DAC", "SSD1306_OLED", "PAN_TILT_SERVOS", "ADC_BATTERY"]
  }
  ```

### B. Luồng Lệnh Outbound (Brain $\to$ Robot):
* **`robot.response`**: Âm thanh TTS phát qua loa MAX98357, biểu cảm OLED và điều khiển động cơ N20 xoay hướng mặt về phía Ngài.
* **`robot.interrupt` (Barge-In Reflex < 80ms)**:
  * Khi Ngài cất tiếng nói trong lúc robot đang phát âm thanh $\to$ Agent gửi lệnh `action: 'stop_playback'`, `reason: 'barge_in'`.
  * **Phản xạ của Robot trong < 80ms**:
    - Lập tức ngắt loa MAX98357 (Mute I2S).
    - Mắt OLED lập tức đổi sang `listening` (mắt mở to chú ý lắng nghe).
    - Động cơ N20 dừng hoặc xoay thẳng hướng nhìn Ngài.
* **`robot.proactive_event` (Sự kiện chủ động)**:
  * **Bản tin sáng 8:00 AM**: Robot cất tiếng: *"Kính chào Ngài! Tôi là BOWCON đây ạ..."*, mắt OLED `happy`, phối hợp kích hoạt đèn bàn làm việc (`desk_light: 'on'`).
  * **Nhắc nhở sức khỏe**: Khi Ngài ngồi code liên tục > 45 phút, robot cất giọng nhắc: *"Thưa Ngài, Ngài đã ngồi lập trình liên tục hơn 45 phút. Kính mong Ngài đứng dậy vươn vai và dùng chút nước để bảo vệ sức khỏe."*, mắt OLED `listening`.

---

## 🏗️ 4. Cấu Trúc Dự Án (Monorepo Workspaces)

```
c:\BOW\bow-robot\
├── shared/               # 📦 Kiểu dữ liệu, hằng số, ROBOT_PERSONA, HARDWARE_KIT (V4.0.0)
├── bow-server/           # 🧠 Máy chủ trung gian kết nối Brain 4078, Robot Gateway & Tools (V4.0.0)
├── bow-remote-agent/     # 🖱️ Điều khiển chuột, bàn phím, màn hình Windows (V4.0.0)
├── simulator/            # 🤖 Trình giả lập Robot Web Dashboard & OLED SSD1306 Canvas (Port 3002)
├── embedded/esp32/       # ⚡ Firmware C++ ESP32-S3 N16R8 (I2S Mic/DAC, OLED, N20)
└── tests/                # ✅ Bộ kiểm thử tích hợp chuẩn V4.0 (v4.0-ecosystem.test.ts)
```

---

## 🚀 5. Khởi Chạy Hệ Thống

### 1. Cài đặt và biên dịch:
```bash
npm install
npm run build
```

### 2. Chạy bộ kiểm thử tích hợp:
```bash
npm test
```

### 3. Chạy Virtual Simulator Dashboard (Port 3002):
```bash
npm run simulator
# Truy cập: http://localhost:3002
```

### 4. Chạy BOW Server kết nối Brain:
```bash
npm run server
```

---

## 📄 Bản Quyền & Phát Triển
Phát triển bởi đội ngũ Kỹ sư BOW Ecosystem. Đồng bộ và phụng sự tối ưu cho `@bow/agent v4.0.0`.
