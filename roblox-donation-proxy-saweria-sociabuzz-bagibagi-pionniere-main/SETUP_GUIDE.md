# 🎮 Multi-Platform Donation Server v2.0

Server untuk mengintegrasikan **Saweria**, **Sociabuzz**, dan **BagiBagi** dengan Roblox game menggunakan **MessagingService** (Real-time Push Notification).

## ✨ Fitur Baru

- ✅ Support 3 platform donasi (Saweria, Sociabuzz, BagiBagi)
- ✅ **Push notification** ke Roblox via MessagingService API (tidak perlu polling!)
- ✅ Auto-detect platform dari webhook payload
- ✅ Queue system untuk handle multiple donations
- ✅ Legacy polling endpoint (backwards compatible)

## 📋 Setup

### 1. Konfigurasi Roblox Open Cloud API

1. Buka https://create.roblox.com/credentials
2. Klik **Create API Key**
3. Beri nama: `DonationServer`
4. Tambahkan permission:
   - **Access Permission**: Pilih Experience kamu
   - **API System**: `universe-messaging-service` → centang `publish`
5. Klik **Create** dan catat API Key
6. Catat juga **Universe ID** dari game kamu (Game Settings > Security)

### 2. Environment Variables di Railway/Vercel

```env
ROBLOX_API_KEY=your_api_key_here
UNIVERSE_ID=your_universe_id_here
```

### 3. Deploy & Set Webhook URLs

Deploy server lalu set webhook URL di masing-masing platform:

| Platform | Webhook URL |
|----------|-------------|
| Saweria | `https://your-server.com/webhook/saweria` |
| Sociabuzz | `https://your-server.com/webhook/sociabuzz` |
| BagiBagi | `https://your-server.com/webhook/bagibagi` |
| Universal | `https://your-server.com/webhook` (auto-detect) |

## 🔧 API Endpoints

### Webhooks (POST)
- `/webhook/saweria` - Saweria donations
- `/webhook/sociabuzz` - Sociabuzz donations
- `/webhook/bagibagi` - BagiBagi donations
- `/webhook` - Universal (auto-detect platform)

### Status (GET)
- `/health` - Health check
- `/queue-status` - Queue status
- `/check-donations` - Legacy polling

## 🎮 Roblox Script

Gunakan `MessagingService:SubscribeAsync` untuk menerima notifikasi:

```lua
local MessagingService = game:GetService("MessagingService")
local HttpService = game:GetService("HttpService")

MessagingService:SubscribeAsync("DonationNotif", function(message)
    local data = HttpService:JSONDecode(message.Data)
    
    print("Platform:", data.platform)    -- saweria/sociabuzz/bagibagi
    print("Donator:", data.donatorName)
    print("Amount:", data.amount)
    print("Message:", data.message)
    
    -- Process donation...
end)
```

## 📦 Data Format

```json
{
    "platform": "saweria|sociabuzz|bagibagi",
    "donatorName": "Nama Donatur",
    "amount": 50000,
    "message": "Pesan donasi",
    "timestamp": 1706612400000
}
```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run locally
npm start

# Server akan berjalan di http://localhost:3000
```

## 📝 Files

```
backend/
├── server.js      # Main server (multi-platform + MessagingService)
├── package.json
└── README.md

ServerScriptService/BagiBagi/
└── DonationHandler.lua  # Roblox script dengan MessagingService
```

---

**Versi sebelumnya** menggunakan polling (Roblox request ke server setiap X detik).
**Versi baru** menggunakan push notification (Server kirim langsung ke Roblox saat ada donasi).
