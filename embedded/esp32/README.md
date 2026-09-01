# 🤖 BOW ROBOT — ESP32 HARDWARE FIRMWARE (V3.3)

Firmware Native C++ / FreeRTOS dành cho Robot phần cứng thật trong Hệ sinh thái BOW V3.3.

---

## 1. Sơ đồ Đấu Dây Phần Cứng (Hardware Pinout Diagram)

### 📌 1. Màn hình OLED SSD1306 (128x64 I2C)
| Chân OLED | Chân ESP32 | Chức năng | Ghi chú |
|---|---|---|---|
| **VCC** | 3V3 / 5V | Nguồn | Khuyến nghị 3.3V |
| **GND** | GND | Mass | |
| **SDA** | **GPIO 21** | I2C Data | Có pull-up nội |
| **SCL** | **GPIO 22** | I2C Clock | |

---

### 📌 2. Động cơ Servo 2 Trục (Pan/Tilt Đầu Robot)
| Servo | Chân Tín Hiệu (Signal) | Nguồn (VCC) | GND | Góc hoạt động |
|---|---|---|---|---|
| **Servo Pan (Quay ngang)** | **GPIO 18** | 5V (Nguồn ngoài) | GND chung | -90° đến +90° (0° - 180°) |
| **Servo Tilt (Gật lên/xuống)** | **GPIO 19** | 5V (Nguồn ngoài) | GND chung | -45° đến +45° (45° - 135°) |

> ⚠️ **LƯU Ý QUAN TRỌNG:** Cấp nguồn 5V ngoài cho Servo (dòng tối thiểu 2A) và nối chung GND với ESP32 để tránh sụt áp gây reset ESP32.

---

### 📌 3. Microphone I2S (INMP441)
| Chân INMP441 | Chân ESP32 | Chức năng |
|---|---|---|
| **VDD** | 3V3 | Nguồn 3.3V |
| **GND** | GND | Mass |
| **SD** | **GPIO 32** | Serial Data (DIN) |
| **WS** | **GPIO 15** | Word Select (LRCL) |
| **SCK** | **GPIO 14** | Serial Clock (BCLK) |
| **L/R** | GND | Kênh Trái (Left Channel) |

---

### 📌 4. Mạch Khuếch Đại Âm Thanh I2S (MAX98357A + Loa 3W)
| Chân MAX98357A | Chân ESP32 | Chức năng |
|---|---|---|
| **VIN** | 5V | Nguồn 5V cho âm lượng lớn |
| **GND** | GND | Mass |
| **DIN** | **GPIO 33** | Digital Audio In |
| **BCLK** | **GPIO 26** | Bit Clock |
| **LRC** | **GPIO 25** | Left/Right Clock |
| **SD / GAIN** | Để trống / 3V3 | Mặc định 9dB gain |

---

## 2. Cài Đặt & Nạp Firmware (PlatformIO)

### Yêu cầu:
- VSCode + Tiện ích **PlatformIO IDE** (hoặc CLI `pio run`).
- Cáp nạp Micro-USB / Type-C kết nối ESP32 vào PC.

### Cấu hình WiFi & Server:
Chỉnh sửa file `include/config.h`:
```cpp
#define WIFI_SSID           "Tên_WiFi_Của_Bạn"
#define WIFI_PASSWORD       "Mật_Khẩu_WiFi"

#define BOW_GATEWAY_HOST    "192.168.1.100"  // Địa chỉ IP của PC chạy bow-server
#define BOW_GATEWAY_PORT    3000
```

### Lệnh Biên Dịch & Nạp:
```bash
# Biên dịch
pio run

# Nạp vào mạch ESP32
pio run --target upload

# Mở Serial Monitor xem log 115200 baud
pio device monitor -b 115200
```

---

## 3. Kiến Trúc Đa Nhiệm FreeRTOS
- **Task 1 (`DisplayTask` - Core 1):** Vẽ biểu cảm mắt Animated Eyes 60 FPS (Blink ngẫu nhiên, Happy, Thinking, Surprised, Sleeping, Listening, Speaking).
- **Task 2 (`ServoTask` - Core 1):** Easing chuyển động mượt mà của 2 servo Pan/Tilt.
- **Loop Chính (`Core 0`):** Xử lý WebSocket client giữ kết nối liên tục với `bow-server`.
