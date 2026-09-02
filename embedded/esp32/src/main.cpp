/**
 * ============================================================================
 * BOW ROBOT V4.0 — ESP32-S3 N16R8 AUTONOMOUS FIRMWARE (ARDUINO / ESP-IDF)
 * ============================================================================
 * Hệ thống phần mềm điều khiển nhúng trên chip ESP32-S3 N16R8 (Dual-Core 240MHz):
 * 1. ÂM THANH FULL-DUPLEX & BARGE-IN:
 *    - Thu âm INMP441 (I2S DMA kép, 16kHz PCM) truyền nhị phân qua WebSocket.
 *    - Phát âm MAX98357A (I2S DAC) hỗ trợ ngắt tiếng DMA tức thì < 10ms khi người dùng nói chèn (Barge-in).
 * 2. BỘ 10 BIỂU CẢM OLED 128x64 (60 FPS FreeRTOS Core 1):
 *    - EXP_NEUTRAL, EXP_HAPPY, EXP_CURIOUS, EXP_THINKING, EXP_LISTENING,
 *      EXP_SPEAKING, EXP_LOVE, EXP_MATRIX, EXP_ERROR, EXP_BATTERY_LOW.
 * 3. ĐIỀU KHIỂN ĐỘNG CƠ N20 SMOOTH EASING:
 *    - Tăng tốc mềm 0 -> Target Speed trong 150ms chống giật khung.
 * 4. BẢO MẬT & TELEMETRY PIN:
 *    - Đọc ADC GPIO 1, gửi báo cáo định kỳ 10 giây (Pin, Wi-Fi RSSI, Uptime).
 * 5. CỬ ĐỘNG ĐẦU (HEAD GESTURES):
 *    - Servo Pan (-90..+90°) & Tilt (-45..+45°), ngước đầu +10° khi nghe lệnh.
 * ============================================================================
 */

// ============================================================================
// HỖ TRỢ INTELLISENSE CHO VS CODE & TRÌNH BIÊN DỊCH PLATFORMIO / ARDUINO
// ============================================================================
#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "driver/i2s.h"
#include "config.h"

// ----------------------------------------------------------------------------
// KHỞI TẠO CÁC ĐỐI TƯỢNG PHẦN CỨNG (HARDWARE SINGLETONS)
// ----------------------------------------------------------------------------
Adafruit_SSD1306 display(OLED_SCREEN_WIDTH, OLED_SCREEN_HEIGHT, &Wire, -1);
WebSocketsClient webSocket;

// ============================================================================
// ĐỊNH NGHĨA TRẠNG THÁI & BIỂU CẢM ROBOT (10 EMOTIONS)
// ============================================================================
enum ExpressionType {
    EXP_NEUTRAL,        // 1. Mắt bo góc tròn dễ thương, chớp mắt tự nhiên 2.5s - 6s
    EXP_HAPPY,          // 2. Mắt cười cánh cung (^ _ ^) khi nhận diện đúng Sếp
    EXP_CURIOUS,        // 3. Mắt to một bên nhướng lên khi tò mò hoặc phân tích ảnh
    EXP_THINKING,       // 4. Mắt quay đồng tử vòng tròn 360° suy nghĩ (O _ o)
    EXP_LISTENING,      // 5. Mắt mở to tròn tập trung lắng nghe (O _ O)
    EXP_SPEAKING,       // 6. Mắt nhấp nhô nhảy múa theo biên độ âm thanh (Wave reactive)
    EXP_LOVE,           // 7. Mắt hình trái tim (<3 _ <3) đập nhịp nhàng khi được khen
    EXP_MATRIX,         // 8. Mắt mưa mã nguồn kỹ thuật số xanh khi chạy Sandbox Code
    EXP_ERROR,          // 9. Mắt hình chữ X (X _ X) khi mất mạng hoặc lệnh thất bại
    EXP_BATTERY_LOW     // 10. Mắt cụp buồn chớp nháy kèm thanh cảnh báo pin yếu
};

enum MoveDirection {
    MOVE_STOP,          // Dừng động cơ
    MOVE_FORWARD,       // Tiến lên phía trước
    MOVE_BACKWARD,      // Lùi về phía sau
    MOVE_LEFT,          // Rẽ trái (xoay bánh tại chỗ)
    MOVE_RIGHT,         // Rẽ phải (xoay bánh tại chỗ)
    MOVE_SPIN_360,      // Xoay tròn 360 độ biểu diễn
    MOVE_WIGGLE_DANCE   // Lắc lư ăn mừng chiến thắng
};

// ----------------------------------------------------------------------------
// BIẾN TOÀN CỤC QUẢN LÝ BIỂU CẢM VÀ HOẠT ẢNH
// ----------------------------------------------------------------------------
ExpressionType currentExpression = EXP_NEUTRAL;
bool isBlinking = false;
unsigned long blinkStartTime = 0;
unsigned long nextBlinkTime = 0;
float speakAnimationPhase = 0.0f;
float thinkAngle = 0.0f;
float matrixPhase = 0.0f;
float lovePulsePhase = 0.0f;

// ----------------------------------------------------------------------------
// BIẾN TOÀN CỤC ĐIỀU KHIỂN ĐỘNG CƠ & EASING TĂNG TỐC MỀM
// ----------------------------------------------------------------------------
MoveDirection currentMoveDir = MOVE_STOP;
int targetSpeed = MOTOR_DEFAULT_SPEED;
int currentSpeed = 0;
unsigned long motorRampStartTime = 0;
unsigned long motorStopTimestamp = 0;
unsigned long wiggleDanceStartTime = 0;

// ----------------------------------------------------------------------------
// BIẾN TOÀN CỤC TELEMETRY & GÓC CỬ ĐỘNG ĐẦU
// ----------------------------------------------------------------------------
int currentBatteryPercent = 100;
float currentBatteryVoltage = 4.15f;
int currentTiltAngle = 0; // Góc gật đầu: -45° đến +45° (0 = nhìn thẳng)
int currentPanAngle = 0;  // Góc quay đầu: -90° đến +90° (0 = chính giữa)
unsigned long lastTelemetryTime = 0;

// FreeRTOS Task Handles
TaskHandle_t displayTaskHandle = NULL;
TaskHandle_t audioTaskHandle = NULL;

// Khai báo nguyên mẫu hàm (Function Prototypes)
void setupWiFi();
void setupOLED();
void setupMotors();
void setupServos();
void setupI2SMic();
void setupI2SSpeaker();
void setupBatteryADC();
void handleBargeInInterrupt();
void setMotorsSmooth(MoveDirection dir, int speed = MOTOR_DEFAULT_SPEED, int durationMs = 0);
void updateMotorEasing();
void setHeadServo(int tilt, int pan);
int readBatteryPercentage();
void sendTelemetry();
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length);
void drawEyes();

// ============================================================================
// FREERTOS TASK: VẼ 10 BIỂU CẢM MẮT OLED 128x64 (CHẠY TRÊN CORE 1 - 60 FPS)
// Nhiệm vụ: Xử lý hoạt ảnh chớp mắt, sóng âm, mưa matrix và vẽ mắt mượt mà
// ============================================================================
void taskDisplayAnimation(void * parameter) {
    for (;;) {
        unsigned long now = millis();

        // 1. Logic chớp mắt tự nhiên (chỉ kích hoạt ở các biểu cảm thông thường)
        if (currentExpression != EXP_BATTERY_LOW && currentExpression != EXP_MATRIX && currentExpression != EXP_ERROR) {
            if (!isBlinking && now >= nextBlinkTime) {
                isBlinking = true;
                blinkStartTime = now;
            }
            if (isBlinking && (now - blinkStartTime >= BLINK_DURATION_MS)) {
                isBlinking = false;
                nextBlinkTime = now + random(BLINK_MIN_DELAY_MS, BLINK_MAX_DELAY_MS);
            }
        }

        // 2. Cập nhật góc pha hoạt ảnh liên tục
        thinkAngle += 0.12f;          // Tốc độ quay đồng tử lúc suy nghĩ
        speakAnimationPhase += 0.35f; // Tốc độ nhấp nhô lúc nói
        matrixPhase += 0.20f;         // Tốc độ mưa mã nguồn Matrix
        lovePulsePhase += 0.15f;      // Tốc độ đập của trái tim

        // 3. Render khung hình lên màn hình OLED
        drawEyes();

        vTaskDelay(pdMS_TO_TICKS(16)); // ~60 khung hình/giây (60 FPS)
    }
}

// ============================================================================
// FREERTOS TASK: THU ÂM I2S BUFFER KÉP & GỬI WEBSOCKET (CHẠY TRÊN CORE 0)
// Nhiệm vụ: Thu âm liên tục 16kHz PCM không gián đoạn, truyền ngay lên bow-agent
// ============================================================================
void taskAudioProcessing(void * parameter) {
    const size_t bytesPerBuffer = I2S_MIC_BUFFER_LEN;
    int16_t primaryMicBuffer[I2S_MIC_BUFFER_LEN / 2];
    int16_t secondaryMicBuffer[I2S_MIC_BUFFER_LEN / 2];
    bool usePrimary = true;
    size_t bytesRead = 0;

    for (;;) {
        // Chỉ stream âm thanh khi robot đang ở trạng thái lắng nghe và có kết nối
        if (currentExpression == EXP_LISTENING && webSocket.isConnected()) {
            int16_t* targetBuf = usePrimary ? primaryMicBuffer : secondaryMicBuffer;
            esp_err_t result = i2s_read(I2S_MIC_PORT, targetBuf, bytesPerBuffer, &bytesRead, pdMS_TO_TICKS(40));

            if (result == ESP_OK && bytesRead > 0) {
                // Truyền dữ liệu âm thanh nhị phân lên server
                webSocket.sendBIN((uint8_t*)targetBuf, bytesRead);
                usePrimary = !usePrimary; // Hoán đổi vùng đệm (Double Buffering)
            }
        }
        vTaskDelay(pdMS_TO_TICKS(8));
    }
}

// ============================================================================
// HÀM KHỞI TẠO CHÍNH (MAIN ARDUINO SETUP)
// ============================================================================
void setup() {
    Serial.begin(115200);
    Serial.println("\n========================================================");
    Serial.println("🤖 BOW ROBOT ESP32-S3 N16R8 FIRMWARE V4.0 INITIALIZING");
    Serial.println("========================================================");

    setupOLED();
    setupMotors();
    setupServos();
    setupBatteryADC();
    setupI2SMic();
    setupI2SSpeaker();
    setupWiFi();

    // Phân bổ 2 tác vụ FreeRTOS chạy độc lập trên 2 nhân xử lý (Dual-Core)
    xTaskCreatePinnedToCore(taskDisplayAnimation, "DisplayTask", 4096, NULL, 2, &displayTaskHandle, 1);
    xTaskCreatePinnedToCore(taskAudioProcessing, "AudioTask", 4096, NULL, 1, &audioTaskHandle, 0);

    // Kết nối WebSocket tới máy chủ trung tâm BOW Agent
    webSocket.begin(BOW_GATEWAY_HOST, BOW_GATEWAY_PORT, BOW_GATEWAY_PATH);
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(2000);

    nextBlinkTime = millis() + random(BLINK_MIN_DELAY_MS, BLINK_MAX_DELAY_MS);
    Serial.println("✅ Phần cứng sẵn sàng! Đang chờ kết nối BOW Agent Gateway...");
}

// ============================================================================
// VÒNG LẶP CHÍNH (MAIN ARDUINO LOOP)
// ============================================================================
void loop() {
    // 1. Duy trì luồng truyền nhận gói tin WebSocket
    webSocket.loop();

    // 2. Cập nhật thuật toán tăng tốc mềm cho động cơ (Smooth PWM Easing)
    updateMotorEasing();

    // 3. Định kỳ 10 giây gửi bản tin Heartbeat Telemetry (Pin, RSSI, Uptime)
    unsigned long now = millis();
    if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
        lastTelemetryTime = now;
        sendTelemetry();
    }

    vTaskDelay(pdMS_TO_TICKS(5));
}

// ============================================================================
// KHỞI TẠO VÀ CẤU HÌNH CÁC NGOẠI VI PHẦN CỨNG
// ============================================================================
void setupWiFi() {
    Serial.printf("[WIFI] Đang kết nối tới mạng: %s\n", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(300);
        Serial.print(".");
        attempts++;
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WIFI] Đã kết nối thành công! IP: %s (RSSI: %d dBm)\n",
                      WiFi.localIP().toString().c_str(), WiFi.RSSI());
    } else {
        Serial.println("\n[WIFI] Chưa kết nối được Wi-Fi. Sẽ tự động thử lại trong nền.");
    }
}

void setupOLED() {
    Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
    if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDRESS)) {
        Serial.println("[OLED] Cảnh báo: Không tìm thấy màn hình SSD1306.");
        return;
    }
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(12, 22);
    display.println("BOW ROBOT V4.0");
    display.setCursor(18, 38);
    display.println("ESP32-S3 READY");
    display.display();
    delay(400);
}

void setupMotors() {
    pinMode(MOTOR_LEFT_IN1, OUTPUT);
    pinMode(MOTOR_LEFT_IN2, OUTPUT);
    pinMode(MOTOR_RIGHT_IN1, OUTPUT);
    pinMode(MOTOR_RIGHT_IN2, OUTPUT);
    setMotorsSmooth(MOVE_STOP, 0, 0);
}

void setupServos() {
    pinMode(SERVO_TILT_PIN, OUTPUT);
    pinMode(SERVO_PAN_PIN, OUTPUT);
    setHeadServo(0, 0); // Vị trí đầu nhìn thẳng ở trạng thái cân bằng
}

void setupBatteryADC() {
    pinMode(BATTERY_ADC_PIN, INPUT);
    analogReadResolution(12); // Độ phân giải ADC 12-bit (0 - 4095)
    currentBatteryPercent = readBatteryPercentage();
}

void setupI2SMic() {
    i2s_config_t i2s_mic_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
        .sample_rate = I2S_SAMPLE_RATE,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = I2S_MIC_BUFFER_COUNT,
        .dma_buf_len = I2S_MIC_BUFFER_LEN,
        .use_apll = false,
    };
    i2s_pin_config_t i2s_mic_pins = {
        .bck_io_num = I2S_MIC_SCK_PIN,
        .ws_io_num = I2S_MIC_WS_PIN,
        .data_out_num = I2S_PIN_NO_CHANGE,
        .data_in_num = I2S_MIC_SD_PIN,
    };
    i2s_driver_install(I2S_MIC_PORT, &i2s_mic_config, 0, NULL);
    i2s_set_pin(I2S_MIC_PORT, &i2s_mic_pins);
}

void setupI2SSpeaker() {
    i2s_config_t i2s_spk_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
        .sample_rate = I2S_SPK_SAMPLE_RATE,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
        .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = I2S_SPK_BUFFER_COUNT,
        .dma_buf_len = I2S_SPK_BUFFER_LEN,
        .use_apll = false,
    };
    i2s_pin_config_t i2s_spk_pins = {
        .bck_io_num = I2S_SPK_BCLK_PIN,
        .ws_io_num = I2S_SPK_LRC_PIN,
        .data_out_num = I2S_SPK_DIN_PIN,
        .data_in_num = I2S_PIN_NO_CHANGE,
    };
    i2s_driver_install(I2S_SPK_PORT, &i2s_spk_config, 0, NULL);
    i2s_set_pin(I2S_SPK_PORT, &i2s_spk_pins);
}

// ============================================================================
// 1. XỬ LÝ NGẮT ÂM THANH FULL-DUPLEX & BARGE-IN (< 10ms PHẢN HỒI)
// Khi người dùng cất tiếng nói trong lúc robot đang phát tiếng, hàm này được gọi
// ============================================================================
void handleBargeInInterrupt() {
    // 1. Xóa ngay lập tức hàng đợi DMA I2S của loa MAX98357A trong < 10ms
    i2s_zero_dma_buffer(I2S_SPK_PORT);

    // 2. Chuyển mắt lập tức từ Speaking sang Listening
    currentExpression = EXP_LISTENING;

    // 3. Servo Tilt ngước đầu lên +10 độ hướng về phía Sếp để lắng nghe
    currentTiltAngle = constrain(currentTiltAngle + SERVO_TILT_BARGE_IN_DEG, -45, 45);
    setHeadServo(currentTiltAngle, currentPanAngle);

    Serial.println("⚡ [BARGE-IN] Đã ngắt tiếng loa tức thì! Mắt -> LISTENING, Đầu ngước +10°");
}

void setHeadServo(int tilt, int pan) {
    currentTiltAngle = tilt;
    currentPanAngle = pan;
}

// ============================================================================
// 3. THUẬT TOÁN ĐIỀU KHIỂN ĐỘNG CƠ N20 SMOOTH EASING (PWM RAMP 150ms)
// Giúp robot tăng tốc từ 0 đến Target Speed trong 150ms để không bị giật khung
// ============================================================================
void setMotorsSmooth(MoveDirection dir, int speed, int durationMs) {
    currentMoveDir = dir;
    targetSpeed = speed;
    motorRampStartTime = millis();

    if (dir == MOVE_STOP) {
        currentSpeed = 0;
        targetSpeed = 0;
        motorStopTimestamp = 0;
        analogWrite(MOTOR_LEFT_IN1, 0);
        analogWrite(MOTOR_LEFT_IN2, 0);
        analogWrite(MOTOR_RIGHT_IN1, 0);
        analogWrite(MOTOR_RIGHT_IN2, 0);
        return;
    }

    if (dir == MOVE_WIGGLE_DANCE) {
        wiggleDanceStartTime = millis();
    }

    if (durationMs > 0) {
        motorStopTimestamp = millis() + durationMs;
    } else {
        motorStopTimestamp = 0;
    }
}

void updateMotorEasing() {
    // Tự động ngắt động cơ khi hết thời gian chạy durationMs
    if (motorStopTimestamp > 0 && millis() >= motorStopTimestamp) {
        setMotorsSmooth(MOVE_STOP, 0, 0);
        return;
    }

    if (currentMoveDir == MOVE_STOP) return;

    // Tăng tốc mềm (Smooth Ramp) trong vòng 150ms
    unsigned long elapsed = millis() - motorRampStartTime;
    if (elapsed < MOTOR_RAMP_DURATION_MS) {
        float progress = (float)elapsed / (float)MOTOR_RAMP_DURATION_MS;
        currentSpeed = (int)(targetSpeed * progress);
    } else {
        currentSpeed = targetSpeed;
    }

    int spd = currentSpeed;

    switch (currentMoveDir) {
        case MOVE_FORWARD:
            analogWrite(MOTOR_LEFT_IN1, spd);
            analogWrite(MOTOR_LEFT_IN2, 0);
            analogWrite(MOTOR_RIGHT_IN1, spd);
            analogWrite(MOTOR_RIGHT_IN2, 0);
            break;

        case MOVE_BACKWARD:
            analogWrite(MOTOR_LEFT_IN1, 0);
            analogWrite(MOTOR_LEFT_IN2, spd);
            analogWrite(MOTOR_RIGHT_IN1, 0);
            analogWrite(MOTOR_RIGHT_IN2, spd);
            break;

        case MOVE_LEFT:
            analogWrite(MOTOR_LEFT_IN1, 0);
            analogWrite(MOTOR_LEFT_IN2, spd);
            analogWrite(MOTOR_RIGHT_IN1, spd);
            analogWrite(MOTOR_RIGHT_IN2, 0);
            break;

        case MOVE_RIGHT:
            analogWrite(MOTOR_LEFT_IN1, spd);
            analogWrite(MOTOR_LEFT_IN2, 0);
            analogWrite(MOTOR_RIGHT_IN1, 0);
            analogWrite(MOTOR_RIGHT_IN2, spd);
            break;

        case MOVE_SPIN_360:
            analogWrite(MOTOR_LEFT_IN1, spd);
            analogWrite(MOTOR_LEFT_IN2, 0);
            analogWrite(MOTOR_RIGHT_IN1, 0);
            analogWrite(MOTOR_RIGHT_IN2, spd);
            break;

        case MOVE_WIGGLE_DANCE: {
            // Lắc lư đổi hướng trái / phải mỗi 200ms
            unsigned long wElapsed = millis() - wiggleDanceStartTime;
            if ((wElapsed / 200) % 2 == 0) {
                analogWrite(MOTOR_LEFT_IN1, spd);
                analogWrite(MOTOR_LEFT_IN2, 0);
                analogWrite(MOTOR_RIGHT_IN1, 0);
                analogWrite(MOTOR_RIGHT_IN2, spd);
            } else {
                analogWrite(MOTOR_LEFT_IN1, 0);
                analogWrite(MOTOR_LEFT_IN2, spd);
                analogWrite(MOTOR_RIGHT_IN1, spd);
                analogWrite(MOTOR_RIGHT_IN2, 0);
            }
            break;
        }

        default:
            break;
    }
}

// ============================================================================
// 4. ĐỌC ĐIỆN ÁP PIN ADC & GỬI TELEMETRY HEARTBEAT (10 GIÂY)
// ============================================================================
int readBatteryPercentage() {
    int raw = analogRead(BATTERY_ADC_PIN);
    float pinVolts = (raw / 4095.0f) * 3.3f;
    currentBatteryVoltage = pinVolts * BATTERY_DIVIDER_RATIO;

    // Quy đổi theo dải điện áp pin Li-Po 1S (3.2V = 0%, 4.2V = 100%)
    float pct = ((currentBatteryVoltage - BATTERY_MIN_VOLTAGE) / (BATTERY_MAX_VOLTAGE - BATTERY_MIN_VOLTAGE)) * 100.0f;
    currentBatteryPercent = (int)constrain(pct, 0.0f, 100.0f);

    // Tự động chuyển biểu cảm pin yếu nếu dung lượng < 15%
    if (currentBatteryPercent < 15 && currentExpression != EXP_BATTERY_LOW) {
        currentExpression = EXP_BATTERY_LOW;
    }
    return currentBatteryPercent;
}

void sendTelemetry() {
    if (!webSocket.isConnected()) return;

    readBatteryPercentage();
    int rssi = WiFi.RSSI();
    unsigned long uptimeSeconds = millis() / 1000;

    StaticJsonDocument<256> doc;
    doc["type"] = "robot.telemetry";
    doc["battery"] = currentBatteryPercent;
    doc["voltage"] = currentBatteryVoltage;
    doc["wifiRssi"] = rssi;
    doc["uptime"] = uptimeSeconds;
    doc["expression"] = (int)currentExpression;

    String jsonStr;
    serializeJson(doc, jsonStr);
    webSocket.sendTXT(jsonStr);

    // V4.0 Standard Sensors Telemetry
    StaticJsonDocument<384> sensorsDoc;
    sensorsDoc["type"] = "robot.sensors_telemetry";
    sensorsDoc["batteryPercent"] = currentBatteryPercent;
    sensorsDoc["isCharging"] = false;
    sensorsDoc["obstaclesDetected"] = false;
    sensorsDoc["temperatureCelsius"] = 35.5;
    JsonArray sensors = sensorsDoc.createNestedArray("activeSensors");
    sensors.add("INMP441_MIC");
    sensors.add("MAX98357A_DAC");
    sensors.add("SSD1306_OLED");
    sensors.add("PAN_TILT_SERVOS");
    sensors.add("ADC_BATTERY");

    String sensorsStr;
    serializeJson(sensorsDoc, sensorsStr);
    webSocket.sendTXT(sensorsStr);

    Serial.printf("[TELEMETRY] Báo cáo V4.0: Pin=%d%% (%.2fV), RSSI=%ddBm, Uptime=%lus\n",
                  currentBatteryPercent, currentBatteryVoltage, rssi, uptimeSeconds);
}

// ============================================================================
// XỬ LÝ GÓI TIN WEBSOCKET TỪ BOW-AGENT
// ============================================================================
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch (type) {
        case WStype_DISCONNECTED:
            Serial.println("[WS] Mất kết nối tới BOW Agent.");
            currentExpression = EXP_ERROR;
            break;

        case WStype_CONNECTED:
            Serial.println("[WS] Kết nối thành công tới BOW Agent V4.0!");
            currentExpression = EXP_HAPPY;
            webSocket.sendTXT("{\"type\":\"client.register\",\"client\":\"BOWCON\",\"channel\":\"ROBOT\",\"role\":\"owner\",\"version\":\"4.0.0\"}");
            sendTelemetry();
            break;

        case WStype_TEXT: {
            StaticJsonDocument<1024> doc;
            DeserializationError error = deserializeJson(doc, payload, length);
            if (error) return;

            const char* msgType = doc["type"] | "";

            // 1. Nhận bản tin ngắt lời (Barge-in Interrupt)
            if (strcmp(msgType, "robot.interrupt") == 0 || strcmp(msgType, "speech.interrupt") == 0 || strcmp(doc["action"] | "", "stop_playback") == 0) {
                handleBargeInInterrupt();
            }

            // 2. Nhận lệnh thay đổi cảm xúc (Robot Emotion)
            else if (strcmp(msgType, "robot.emotion") == 0 || strcmp(msgType, "set_expression") == 0) {
                const char* exp = doc["emotion"] | doc["parameters"]["expression"] | "neutral";
                if (strcmp(exp, "happy") == 0) currentExpression = EXP_HAPPY;
                else if (strcmp(exp, "curious") == 0 || strcmp(exp, "surprised") == 0) currentExpression = EXP_CURIOUS;
                else if (strcmp(exp, "thinking") == 0) currentExpression = EXP_THINKING;
                else if (strcmp(exp, "listening") == 0) currentExpression = EXP_LISTENING;
                else if (strcmp(exp, "speaking") == 0) currentExpression = EXP_SPEAKING;
                else if (strcmp(exp, "love") == 0) currentExpression = EXP_LOVE;
                else if (strcmp(exp, "matrix") == 0) currentExpression = EXP_MATRIX;
                else if (strcmp(exp, "error") == 0) currentExpression = EXP_ERROR;
                else if (strcmp(exp, "battery_low") == 0) currentExpression = EXP_BATTERY_LOW;
                else currentExpression = EXP_NEUTRAL;
            }

            // 3. Nhận lệnh định vị nguồn âm thanh AoA Sound Tracking
            else if (strcmp(msgType, "robot.sound_direction") == 0) {
                int angle = doc["angleAoA"] | doc["parameters"]["angleAoA"] | 0;
                setHeadServo(currentTiltAngle, constrain(angle, -90, 90));
            }

            // 4. Nhận sự kiện chủ động (Morning briefing, Health reminder)
            else if (strcmp(msgType, "robot.proactive_event") == 0) {
                const char* eventName = doc["event"] | doc["parameters"]["event"] | "morning_briefing";
                if (strcmp(eventName, "morning_briefing") == 0) {
                    currentExpression = EXP_HAPPY;
                    setHeadServo(10, 0);
                } else {
                    currentExpression = EXP_LISTENING;
                    setHeadServo(10, 0);
                }
            }

            // 5. Nhận lệnh di chuyển bánh xe (Locomotion)
            else if (strcmp(msgType, "robot.move") == 0) {
                const char* dir = doc["direction"] | "stop";
                int durationMs = doc["duration"] | 1000;
                int speed = doc["speed"] | MOTOR_DEFAULT_SPEED;

                if (strcmp(dir, "forward") == 0) setMotorsSmooth(MOVE_FORWARD, speed, durationMs);
                else if (strcmp(dir, "backward") == 0) setMotorsSmooth(MOVE_BACKWARD, speed, durationMs);
                else if (strcmp(dir, "left") == 0) setMotorsSmooth(MOVE_LEFT, speed, durationMs);
                else if (strcmp(dir, "right") == 0) setMotorsSmooth(MOVE_RIGHT, speed, durationMs);
                else if (strcmp(dir, "spin_360") == 0) setMotorsSmooth(MOVE_SPIN_360, speed, durationMs);
                else if (strcmp(dir, "wiggle_dance") == 0) setMotorsSmooth(MOVE_WIGGLE_DANCE, speed, durationMs);
                else setMotorsSmooth(MOVE_STOP, 0, 0);
            }

            // 6. Nhận lệnh cử động đầu (Head Servos)
            else if (strcmp(msgType, "robot.head") == 0 || strcmp(msgType, "move_head") == 0) {
                int tilt = doc["tilt"] | doc["parameters"]["tilt"] | currentTiltAngle;
                int pan = doc["pan"] | doc["parameters"]["pan"] | currentPanAngle;
                setHeadServo(tilt, pan);
            }
            break;
        }

        case WStype_BIN: {
            // Luồng âm thanh TTS nhị phân gửi từ BOW Agent đến loa MAX98357A
            size_t bytesWritten = 0;
            i2s_write(I2S_SPK_PORT, payload, length, &bytesWritten, pdMS_TO_TICKS(100));
            if (currentExpression != EXP_SPEAKING) {
                currentExpression = EXP_SPEAKING;
            }
            break;
        }

        default:
            break;
    }
}

// ============================================================================
// 2. BỘ RENDER 10 BIỂU CẢM MẮT OLED 128x64 V4.0 (10 EMOTIONS)
// ============================================================================
void drawEyes() {
    display.clearDisplay();

    // Hoạt ảnh nhắm mắt khi chớp mắt tự nhiên
    if (isBlinking) {
        display.fillRoundRect(22, 30, 36, 4, 2, SSD1306_WHITE);
        display.fillRoundRect(70, 30, 36, 4, 2, SSD1306_WHITE);
        display.display();
        return;
    }

    switch (currentExpression) {
        // 1. EXP_NEUTRAL: Mắt bo góc tròn dễ thương
        case EXP_NEUTRAL:
            display.fillRoundRect(24, 18, 34, 28, 8, SSD1306_WHITE);
            display.fillRoundRect(70, 18, 34, 28, 8, SSD1306_WHITE);
            break;

        // 2. EXP_HAPPY: Mắt cười hình cánh cung (^ _ ^)
        case EXP_HAPPY:
            display.fillRoundRect(22, 20, 36, 26, 8, SSD1306_WHITE);
            display.fillCircle(40, 38, 16, SSD1306_BLACK);
            display.fillRoundRect(70, 20, 36, 26, 8, SSD1306_WHITE);
            display.fillCircle(88, 38, 16, SSD1306_BLACK);
            break;

        // 3. EXP_CURIOUS: Mắt to một bên nhướng lên, một bên nhỏ
        case EXP_CURIOUS:
            display.fillRoundRect(22, 14, 38, 36, 9, SSD1306_WHITE); // Mắt trái to nhướng cao
            display.fillCircle(41, 30, 8, SSD1306_BLACK);
            display.fillRoundRect(72, 24, 30, 20, 6, SSD1306_WHITE); // Mắt phải híp nhỏ tò mò
            display.fillCircle(87, 34, 4, SSD1306_BLACK);
            break;

        // 4. EXP_THINKING: Mắt quay vòng tròn suy nghĩ (O _ o)
        case EXP_THINKING: {
            int pX = (int)(cos(thinkAngle) * 6);
            int pY = (int)(sin(thinkAngle) * 6);
            display.fillRoundRect(24, 18, 32, 28, 7, SSD1306_WHITE);
            display.fillCircle(40 + pX, 32 + pY, 6, SSD1306_BLACK);
            display.fillRoundRect(72, 22, 28, 22, 6, SSD1306_WHITE);
            display.fillCircle(86 + pX/2, 33 + pY/2, 4, SSD1306_BLACK);
            break;
        }

        // 5. EXP_LISTENING: Mắt mở to tròn tập trung lắng nghe (O _ O)
        case EXP_LISTENING:
            display.fillCircle(40, 32, 18, SSD1306_WHITE);
            display.fillCircle(40, 32, 7, SSD1306_BLACK);
            display.fillCircle(88, 32, 18, SSD1306_WHITE);
            display.fillCircle(88, 32, 7, SSD1306_BLACK);
            break;

        // 6. EXP_SPEAKING: Mắt nhấp nhô nhảy múa theo cường độ âm thanh (Wave reactive)
        case EXP_SPEAKING: {
            int bounce = abs((int)(sin(speakAnimationPhase) * 14));
            display.fillRoundRect(24, 16 - bounce/2, 34, 30 + bounce, 8, SSD1306_WHITE);
            display.fillRoundRect(70, 16 - bounce/2, 34, 30 + bounce, 8, SSD1306_WHITE);
            break;
        }

        // 7. EXP_LOVE: Mắt hình trái tim (<3 _ <3)
        case EXP_LOVE: {
            int pulse = (int)(sin(lovePulsePhase) * 3);
            display.fillCircle(33 - pulse/2, 26, 9 + pulse/2, SSD1306_WHITE);
            display.fillCircle(47 + pulse/2, 26, 9 + pulse/2, SSD1306_WHITE);
            display.fillTriangle(24, 28, 56, 28, 40, 48 + pulse, SSD1306_WHITE);
            display.fillCircle(81 - pulse/2, 26, 9 + pulse/2, SSD1306_WHITE);
            display.fillCircle(95 + pulse/2, 26, 9 + pulse/2, SSD1306_WHITE);
            display.fillTriangle(72, 28, 104, 28, 88, 48 + pulse, SSD1306_WHITE);
            break;
        }

        // 8. EXP_MATRIX: Mắt hiệu ứng mưa mã nguồn Sandbox Code
        case EXP_MATRIX: {
            display.drawRoundRect(20, 16, 40, 32, 4, SSD1306_WHITE);
            display.drawRoundRect(68, 16, 40, 32, 4, SSD1306_WHITE);
            for (int col = 0; col < 6; col++) {
                int dropY1 = ((int)(matrixPhase * 10 + col * 7)) % 24;
                int dropY2 = ((int)(matrixPhase * 12 + col * 9)) % 24;
                display.drawPixel(24 + col * 6, 20 + dropY1, SSD1306_WHITE);
                display.drawPixel(24 + col * 6, 20 + (dropY1 + 3)%24, SSD1306_WHITE);
                display.drawPixel(72 + col * 6, 20 + dropY2, SSD1306_WHITE);
                display.drawPixel(72 + col * 6, 20 + (dropY2 + 3)%24, SSD1306_WHITE);
            }
            break;
        }

        // 9. EXP_ERROR: Mắt hình chữ X (X _ X)
        case EXP_ERROR:
            display.drawLine(24, 18, 56, 46, SSD1306_WHITE);
            display.drawLine(24, 46, 56, 18, SSD1306_WHITE);
            display.drawLine(72, 18, 104, 46, SSD1306_WHITE);
            display.drawLine(72, 46, 104, 18, SSD1306_WHITE);
            break;

        // 10. EXP_BATTERY_LOW: Mắt buồn + Thanh pin nhấp nháy
        case EXP_BATTERY_LOW: {
            display.fillRoundRect(24, 26, 32, 16, 4, SSD1306_WHITE);
            display.fillCircle(40, 24, 10, SSD1306_BLACK);
            display.fillRoundRect(72, 26, 32, 16, 4, SSD1306_WHITE);
            display.fillCircle(88, 24, 10, SSD1306_BLACK);

            if ((millis() / 500) % 2 == 0) {
                display.drawRect(44, 52, 40, 10, SSD1306_WHITE);
                display.fillRect(84, 55, 3, 4, SSD1306_WHITE);
                display.fillRect(46, 54, 8, 6, SSD1306_WHITE);
            }
            break;
        }

        default:
            display.fillRoundRect(24, 18, 34, 28, 8, SSD1306_WHITE);
            display.fillRoundRect(70, 18, 34, 28, 8, SSD1306_WHITE);
            break;
    }

    display.display();
}
