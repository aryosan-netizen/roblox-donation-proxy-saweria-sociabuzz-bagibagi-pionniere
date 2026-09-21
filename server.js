// File: server.js - Multi-Platform Donation Server (Saweria, Sociabuzz, BagiBagi)
// Menggunakan Roblox Open Cloud MessagingService API - Direct Send (No Queue)

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();

app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// KONFIGURASI - SESUAIKAN DENGAN SETTING KAMU
// ============================================
const CONFIG = {
    // Roblox Open Cloud API Key (buat di https://create.roblox.com/credentials)
    // Pastikan API Key punya permission: messaging-service:publish
    ROBLOX_API_KEY: process.env.ROBLOX_API_KEY || 'YKkp6BMZjE2YywKBj/2laF/HFVRr6M/MutiUiR1BflvTjwthZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNkluTnBaeTB5TURJeExUQTNMVEV6VkRFNE9qVXhPalE1V2lJc0luUjVjQ0k2SWtwWFZDSjkuZXlKaGRXUWlPaUpTYjJKc2IzaEpiblJsY201aGJDSXNJbWx6Y3lJNklrTnNiM1ZrUVhWMGFHVnVkR2xqWVhScGIyNVRaWEoyYVdObElpd2lZbUZ6WlVGd2FVdGxlU0k2SWxsTGEzQTJRazFhYWtVeVdYbDNTMEpxTHpKc1lVWXZTRVpXVW5JMlRTOU5kWFJwVldsU01VSm1iSFpVYW5kMGFDSXNJbTkzYm1WeVNXUWlPaUk0TnprMk16TTFOVFkySWl3aVpYaHdJam94TnpnNE1URXdPRFF6TENKcFlYUWlPakUzT0RneE1EY3lORE1zSW01aVppSTZNVGM0T0RFd056STBNMzAuZEtKQzVxdFplekVNbFBLdXBpT05KcnczTF9hb1hCWjNnQkR1S29DVFdoNU80Z002ZHJScWROSFJJd0ZXNGk5QTZHMG0wR2k1cVhDYVRXc3pINHMyV3ZPSWtFZ3R1aGdOZ212SzVuc3ZpZXR5bEVSb19YbDlCRDZQUWd6RkNNU1Q2MnM0SkRlTzVxQnY2TmdTSlpHM3RWN0JNaFRyZ2s2Q3RYNGdiaXF3TTZnWGNQNDBhMzdtd0FDZXdOR1k0aUkxaktlYWZzV2dLdWloQXdfUWFOSHJNTmJTYndxZlBERVNSUlRsSjdISzM4cy1zSTFVSk1WN1U1Z1NMR0RBWXQ5c1kwRUJ1Ukh1VDhfeG9ub0hobEc1bjgta2JHVmZFMFc2elBKenlHQ29VY1lsczl0VGhENmc2TkliQ0lWMlRaVzNBcnh2eE9Ed1hNMVpkUGthN2phV0Zn',
    
    // Universe ID dari game kamu (bukan Place ID!)
    UNIVERSE_ID: process.env.UNIVERSE_ID || '10154774780',
    
    // Topic name untuk MessagingService (harus sama dengan di Roblox script)
    MESSAGING_TOPIC: 'DonationNotif',

    // Akun dashboard multi-user. Format: "user1:password1,user2:password2"
    DASHBOARD_USERS: process.env.DASHBOARD_USERS || 'naufal:naufal123',

    // Password akun "admin" bila DASHBOARD_USERS tidak diisi
    DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD || 'admin123',

    // Kunci penanda tangan token login. Set di env agar sesi tetap valid setelah restart
    SESSION_SECRET: process.env.SESSION_SECRET || '',

    // Jumlah maksimum log donasi yang disimpan di memori
    MAX_LOG: Number(process.env.MAX_LOG) || 500,

    // Lokasi file penyimpanan log (agar tidak hilang saat restart)
    LOG_FILE: process.env.LOG_FILE || path.join(__dirname, 'data', 'donations.json')
};

const LIMITS = {
    NAME_MAX: 50,
    MESSAGE_MAX: 200,
    AMOUNT_MIN: 1,
    AMOUNT_MAX: 1000000000
};

// ============================================
// ROBLOX MESSAGING SERVICE API - DIRECT SEND
// ============================================
async function sendToRoblox(donation) {
    const url = `https://apis.roblox.com/messaging-service/v1/universes/${CONFIG.UNIVERSE_ID}/topics/${CONFIG.MESSAGING_TOPIC}`;
    
    const payload = {
        message: JSON.stringify({
            platform: donation.platform,
            donatorName: donation.donatorName,
            amount: donation.amount,
            message: donation.message,
            timestamp: Date.now()
        })
    };
    
    console.log(`[ROBLOX] 📤 Sending to MessagingService...`);
    console.log(`[ROBLOX] URL: ${url}`);
    console.log(`[ROBLOX] Payload:`, JSON.stringify(payload, null, 2));
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'x-api-key': CONFIG.ROBLOX_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            console.log(`[ROBLOX] ✅ SUCCESS - Sent to Roblox:`, donation.donatorName, 'Rp', donation.amount);
            return { success: true, status: response.status };
        } else {
            const errorText = await response.text();
            console.error(`[ROBLOX] ❌ FAILED - Status:`, response.status, errorText);
            return { success: false, status: response.status, error: errorText };
        }
    } catch (error) {
        console.error(`[ROBLOX] ❌ ERROR:`, error.message);
        return { success: false, error: error.message };
    }
}

// ============================================
// DONATION LOG STORE (memori + file)
// ============================================
const donationLog = [];

function loadLog() {
    try {
        const raw = fs.readFileSync(CONFIG.LOG_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            donationLog.push(...parsed.slice(-CONFIG.MAX_LOG));
            console.log(`[LOG] 📂 Loaded ${donationLog.length} donasi dari ${CONFIG.LOG_FILE}`);
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.warn('[LOG] ⚠️ Gagal membaca file log:', error.message);
        }
    }
}

let savePending = false;
function saveLog() {
    if (savePending) return;
    savePending = true;
    setTimeout(() => {
        savePending = false;
        fs.mkdir(path.dirname(CONFIG.LOG_FILE), { recursive: true }, (mkdirErr) => {
            if (mkdirErr) return console.warn('[LOG] ⚠️ Gagal membuat folder log:', mkdirErr.message);
            fs.writeFile(CONFIG.LOG_FILE, JSON.stringify(donationLog, null, 2), (writeErr) => {
                if (writeErr) console.warn('[LOG] ⚠️ Gagal menyimpan log:', writeErr.message);
            });
        });
    }, 500);
}

function sanitizeText(value, maxLength) {
    return String(value ?? '')
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .trim()
        .slice(0, maxLength);
}

// Semua donasi (webhook maupun manual) lewat sini agar tercatat & tersiar ke dashboard
async function processDonation(input) {
    const donation = {
        platform: sanitizeText(input.platform || 'unknown', 20).toLowerCase(),
        donatorName: sanitizeText(input.donatorName, LIMITS.NAME_MAX) || 'Donatur Anonim',
        amount: Math.floor(Number(input.amount) || 0),
        message: sanitizeText(input.message, LIMITS.MESSAGE_MAX)
    };

    const roblox = await sendToRoblox(donation);

    const entry = {
        id: crypto.randomUUID(),
        ...donation,
        source: input.source || 'webhook',
        by: input.by || null,
        status: roblox.success ? 'sent' : 'failed',
        error: roblox.success ? null : (roblox.error || `HTTP ${roblox.status}`),
        timestamp: Date.now()
    };

    donationLog.push(entry);
    if (donationLog.length > CONFIG.MAX_LOG) {
        donationLog.splice(0, donationLog.length - CONFIG.MAX_LOG);
    }
    saveLog();
    broadcast('donation', entry);

    return { ...entry, roblox };
}

// ============================================
// SERVER-SENT EVENTS (live update dashboard)
// ============================================
const sseClients = new Set();

function broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
        try {
            client.write(payload);
        } catch {
            sseClients.delete(client);
        }
    }
}

setInterval(() => broadcast('ping', { t: Date.now() }), 25000).unref();

// ============================================
// AUTENTIKASI DASHBOARD (multi-user)
// ============================================
const revokedTokens = new Map();     // token -> expiry (hasil logout)
const loginAttempts = new Map();     // ip+username -> { count, resetAt }
const SESSION_TTL = 12 * 60 * 60 * 1000;

// "user1:pass1,user2:pass2" -> Map(username -> password)
function parseUsers(raw) {
    const users = new Map();
    for (const pair of String(raw).split(',')) {
        const sep = pair.indexOf(':');
        if (sep < 1) continue;
        const username = pair.slice(0, sep).trim().toLowerCase();
        const password = pair.slice(sep + 1).trim();
        if (username && password) users.set(username, password);
    }
    return users;
}

const USERS = parseUsers(CONFIG.DASHBOARD_USERS);
if (USERS.size === 0) USERS.set('admin', CONFIG.DASHBOARD_PASSWORD);

// Secret disimpan ke disk bila tidak diset, supaya restart biasa tidak mementalkan user yang sedang login
function loadSessionSecret() {
    if (CONFIG.SESSION_SECRET) return CONFIG.SESSION_SECRET;

    const file = path.join(path.dirname(CONFIG.LOG_FILE), 'session-secret');
    try {
        const saved = fs.readFileSync(file, 'utf8').trim();
        if (saved) return saved;
    } catch { /* belum ada, buat baru di bawah */ }

    const secret = crypto.randomBytes(32).toString('hex');
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, secret, { mode: 0o600 });
    } catch (error) {
        console.warn('[AUTH] ⚠️ Gagal menyimpan session secret:', error.message);
    }
    return secret;
}

const SESSION_SECRET = loadSessionSecret();

function safeCompare(a, b) {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

function verifyUser(username, password) {
    const stored = USERS.get(username);
    // Selalu bandingkan agar waktu respons tidak membocorkan username yang valid
    const expected = stored ?? crypto.randomBytes(24).toString('hex');
    const match = safeCompare(password, expected);
    return Boolean(stored) && match;
}

function signPayload(payload) {
    return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
}

function createSession(username) {
    const expiry = Date.now() + SESSION_TTL;
    const payload = `${username}.${expiry}.${crypto.randomBytes(8).toString('hex')}`;
    return `${Buffer.from(payload).toString('base64url')}.${signPayload(payload)}`;
}

function getSession(token) {
    if (typeof token !== 'string' || !token) return null;
    if (revokedTokens.has(token)) return null;

    const sep = token.lastIndexOf('.');
    if (sep < 1) return null;

    let payload;
    try {
        payload = Buffer.from(token.slice(0, sep), 'base64url').toString('utf8');
    } catch {
        return null;
    }
    if (!safeCompare(token.slice(sep + 1), signPayload(payload))) return null;

    const [username, expiry] = payload.split('.');
    if (!USERS.has(username)) return null;
    if (!Number(expiry) || Number(expiry) < Date.now()) return null;

    return { username, expiry: Number(expiry) };
}

function requireAuth(req, res, next) {
    const token = req.get('x-auth-token') || req.query.token;
    const session = getSession(token);
    if (!session) {
        return res.status(401).json({ success: false, error: 'Sesi tidak valid atau sudah berakhir' });
    }
    req.session = session;
    req.sessionToken = token;
    next();
}

function checkRateLimit(map, key, max, windowMs) {
    const now = Date.now();
    const record = map.get(key);
    if (!record || record.resetAt < now) {
        map.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }
    if (record.count >= max) return false;
    record.count += 1;
    return true;
}

setInterval(() => {
    const now = Date.now();
    for (const [token, expiry] of revokedTokens) if (expiry < now) revokedTokens.delete(token);
    for (const [key, record] of loginAttempts) if (record.resetAt < now) loginAttempts.delete(key);
}, 60000).unref();

// ============================================
// WEBHOOK: SAWERIA
// ============================================
app.post('/webhook/saweria', async (req, res) => {
    console.log('\n[SAWERIA] ========== NEW DONATION ==========');
    console.log('[SAWERIA] Raw payload:', JSON.stringify(req.body, null, 2));
    
    const body = req.body;
    
    const donatorName = 
        body.donator_name ||
        body.donatorName ||
        body.name ||
        (body.data && body.data.donator_name) ||
        'Donatur Anonim';
    
    const amount = 
        body.amount_raw ||
        body.amount ||
        body.gross_amount ||
        (body.data && body.data.amount) ||
        0;
    
    const message = 
        body.message ||
        body.note ||
        (body.data && body.data.message) ||
        '';
    
    console.log(`[SAWERIA] Parsed - Name: ${donatorName}, Amount: ${amount}, Message: ${message}`);
    
    if (!isNaN(amount) && amount > 0) {
        const entry = await processDonation({
            platform: 'saweria',
            donatorName,
            amount: Number(amount),
            message
        });
        
        res.json({ success: true, platform: 'saweria', roblox: entry.roblox });
    } else {
        console.log('[SAWERIA] ⚠️ Invalid donation data, skipped');
        res.json({ success: false, platform: 'saweria', error: 'Invalid amount' });
    }
});

// ============================================
// WEBHOOK: SOCIABUZZ
// ============================================
app.post('/webhook/sociabuzz', async (req, res) => {
    console.log('\n[SOCIABUZZ] ========== NEW DONATION ==========');
    console.log('[SOCIABUZZ] Raw payload:', JSON.stringify(req.body, null, 2));
    
    const body = req.body;
    
    const donatorName =
        (typeof body.supporter === 'string' && body.supporter.trim().length > 0
            ? body.supporter.trim()
            : null) ||
        body.supporter_name ||
        body.name ||
        body.donator_name ||
        (body.user && body.user.name) ||
        'Donatur Anonim';
    
    const amount =
        body.amount_raw ||
        body.amount ||
        body.amount_settled ||
        body.total ||
        body.nominal ||
        0;
    
    const message =
        body.message ||
        body.note ||
        body.comment ||
        (body.content && body.content.title) ||
        '';
    
    console.log(`[SOCIABUZZ] Parsed - Name: ${donatorName}, Amount: ${amount}, Message: ${message}`);
    
    if (!isNaN(amount) && amount > 0) {
        const entry = await processDonation({
            platform: 'sociabuzz',
            donatorName,
            amount: Number(amount),
            message
        });
        
        res.json({ success: true, platform: 'sociabuzz', roblox: entry.roblox });
    } else {
        console.log('[SOCIABUZZ] ⚠️ Invalid donation data, skipped');
        res.json({ success: false, platform: 'sociabuzz', error: 'Invalid amount' });
    }
});

// ============================================
// WEBHOOK: BAGIBAGI
// ============================================
app.post('/webhook/bagibagi', async (req, res) => {
    console.log('\n[BAGIBAGI] ========== NEW DONATION ==========');
    console.log('[BAGIBAGI] Raw payload:', JSON.stringify(req.body, null, 2));
    
    const body = req.body;
    
    const donatorName =
        body.donor_name ||
        body.donator_name ||
        body.name ||
        body.supporter_name ||
        'Donatur Anonim';
    
    const amount =
        body.amount ||
        body.donation_amount ||
        body.total ||
        body.nominal ||
        0;
    
    const message =
        body.message ||
        body.note ||
        body.support_message ||
        '';
    
    console.log(`[BAGIBAGI] Parsed - Name: ${donatorName}, Amount: ${amount}, Message: ${message}`);
    
    if (!isNaN(amount) && amount > 0) {
        const entry = await processDonation({
            platform: 'bagibagi',
            donatorName,
            amount: Number(amount),
            message
        });
        
        res.json({ success: true, platform: 'bagibagi', roblox: entry.roblox });
    } else {
        console.log('[BAGIBAGI] ⚠️ Invalid donation data, skipped');
        res.json({ success: false, platform: 'bagibagi', error: 'Invalid amount' });
    }
});

// ============================================
// WEBHOOK: UNIVERSAL (Auto-detect platform)
// ============================================
app.post('/webhook', async (req, res) => {
    console.log('\n[UNIVERSAL] ========== NEW DONATION ==========');
    console.log('[UNIVERSAL] Raw payload:', JSON.stringify(req.body, null, 2));
    
    const body = req.body;
    
    // Auto-detect platform
    let platform = 'unknown';
    if (body.donator_name || (body.data && body.data.donator_name)) {
        platform = 'saweria';
    } else if (body.supporter || body.supporter_name || body.amount_settled) {
        platform = 'sociabuzz';
    } else if (body.donor_name || body.support_message) {
        platform = 'bagibagi';
    }
    
    // Parse universal
    const donatorName =
        body.supporter ||
        body.supporter_name ||
        body.donator_name ||
        body.donor_name ||
        body.name ||
        (body.user && body.user.name) ||
        (body.data && body.data.donator_name) ||
        'Donatur Anonim';
    
    const amount =
        body.amount_raw ||
        body.amount ||
        body.amount_settled ||
        body.gross_amount ||
        body.donation_amount ||
        body.total ||
        body.nominal ||
        (body.data && body.data.amount) ||
        0;
    
    const message =
        body.message ||
        body.note ||
        body.comment ||
        body.support_message ||
        (body.content && body.content.title) ||
        (body.data && body.data.message) ||
        '';
    
    console.log(`[UNIVERSAL] Detected: ${platform} - Name: ${donatorName}, Amount: ${amount}, Message: ${message}`);
    
    if (!isNaN(amount) && amount > 0) {
        const entry = await processDonation({
            platform,
            donatorName: String(donatorName).trim(),
            amount: Number(amount),
            message: String(message)
        });
        
        res.json({ success: true, platform, roblox: entry.roblox });
    } else {
        console.log('[UNIVERSAL] ⚠️ Invalid donation data, skipped');
        res.json({ success: false, platform, error: 'Invalid amount' });
    }
});

// ============================================
// TEST ENDPOINT - Untuk testing manual
// ============================================
app.post('/test', async (req, res) => {
    console.log('\n[TEST] ========== TEST DONATION ==========');
    
    const { donatorName, amount, message, platform } = req.body;
    
    const entry = await processDonation({
        platform: platform || 'test',
        donatorName: donatorName || 'Test User',
        amount: Number(amount) || 10000,
        message: message || 'Test donation',
        source: 'test'
    });
    
    res.json({ success: true, platform: 'test', roblox: entry.roblox });
});

// ============================================
// API DASHBOARD
// ============================================
app.post('/api/login', (req, res) => {
    const ip = req.ip || 'unknown';
    const username = sanitizeText(req.body?.username, 32).toLowerCase();
    const password = String(req.body?.password ?? '');

    if (!checkRateLimit(loginAttempts, `${ip}:${username}`, 10, 5 * 60 * 1000)) {
        return res.status(429).json({ success: false, error: 'Terlalu banyak percobaan login, coba lagi nanti' });
    }

    if (!username || !verifyUser(username, password)) {
        console.warn(`[AUTH] ❌ Login gagal (${username || '-'}) dari ${ip}`);
        return res.status(401).json({ success: false, error: 'Username atau password salah' });
    }

    const token = createSession(username);
    console.log(`[AUTH] ✅ Login berhasil: ${username} dari ${ip}`);
    res.json({ success: true, token, username, expiresIn: SESSION_TTL });
});

app.post('/api/logout', requireAuth, (req, res) => {
    revokedTokens.set(req.sessionToken, req.session.expiry);
    console.log(`[AUTH] 👋 Logout: ${req.session.username}`);
    res.json({ success: true });
});

app.get('/api/session', requireAuth, (req, res) => {
    res.json({ success: true, username: req.session.username });
});

app.get('/api/donations', requireAuth, (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, CONFIG.MAX_LOG);
    res.json({
        success: true,
        total: donationLog.length,
        donations: donationLog.slice(-limit).reverse()
    });
});

app.get('/api/stats', requireAuth, (req, res) => {
    res.json({ success: true, stats: buildStats() });
});

app.delete('/api/donations', requireAuth, (req, res) => {
    donationLog.length = 0;
    saveLog();
    broadcast('cleared', { t: Date.now() });
    console.log(`[LOG] 🧹 Log dibersihkan oleh ${req.session.username}`);
    res.json({ success: true });
});

// Manual donate dari dashboard → langsung ke Roblox
app.post('/api/manual-donate', requireAuth, async (req, res) => {
    const donatorName = sanitizeText(req.body?.donatorName, LIMITS.NAME_MAX);
    const message = sanitizeText(req.body?.message, LIMITS.MESSAGE_MAX);
    const amount = Math.floor(Number(req.body?.amount));

    if (!donatorName) {
        return res.status(400).json({ success: false, error: 'Username wajib diisi' });
    }
    if (!Number.isFinite(amount) || amount < LIMITS.AMOUNT_MIN || amount > LIMITS.AMOUNT_MAX) {
        return res.status(400).json({
            success: false,
            error: `Amount harus angka antara ${LIMITS.AMOUNT_MIN} - ${LIMITS.AMOUNT_MAX}`
        });
    }

    console.log(`\n[MANUAL] ========== MANUAL DONATION ==========`);
    console.log(`[MANUAL] Oleh: ${req.session.username} | Name: ${donatorName}, Amount: ${amount}, Message: ${message}`);

    const entry = await processDonation({
        platform: 'manual',
        donatorName,
        amount,
        message,
        source: 'manual',
        by: req.session.username
    });

    if (!entry.roblox.success) {
        return res.status(502).json({ success: false, error: entry.error, donation: entry });
    }

    res.json({ success: true, donation: entry });
});

// Live stream log donasi (Server-Sent Events)
app.get('/api/stream', requireAuth, (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });
    res.write(`event: connected\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);

    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
});

function buildStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const stats = {
        totalDonations: donationLog.length,
        totalAmount: 0,
        todayAmount: 0,
        todayCount: 0,
        failed: 0,
        byPlatform: {}
    };

    for (const entry of donationLog) {
        stats.totalAmount += entry.amount;
        if (entry.status === 'failed') stats.failed += 1;
        if (entry.timestamp >= startOfToday.getTime()) {
            stats.todayAmount += entry.amount;
            stats.todayCount += 1;
        }
        stats.byPlatform[entry.platform] = (stats.byPlatform[entry.platform] || 0) + 1;
    }

    return stats;
}

// ============================================
// STATUS ENDPOINTS
// ============================================
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Status ringkas untuk lobby (tanpa data donatur)
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        platforms: ['saweria', 'sociabuzz', 'bagibagi', 'manual'],
        universeId: CONFIG.UNIVERSE_ID,
        topic: CONFIG.MESSAGING_TOPIC,
        uptime: Math.floor(process.uptime())
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        platforms: ['saweria', 'sociabuzz', 'bagibagi', 'manual'],
        mode: 'direct-send (no queue)',
        logged: donationLog.length
    });
});

app.get('/api/info', (req, res) => {
    res.json({
        name: 'Multi-Platform Donation Server',
        version: '3.0.0',
        description: 'Saweria, Sociabuzz, BagiBagi & Manual → Roblox MessagingService (Direct Send)',
        endpoints: {
            webhooks: {
                saweria: 'POST /webhook/saweria',
                sociabuzz: 'POST /webhook/sociabuzz',
                bagibagi: 'POST /webhook/bagibagi',
                universal: 'POST /webhook (auto-detect)'
            },
            dashboard: {
                login: 'POST /api/login',
                donations: 'GET /api/donations',
                stats: 'GET /api/stats',
                manual: 'POST /api/manual-donate',
                stream: 'GET /api/stream'
            },
            test: 'POST /test',
            health: 'GET /health'
        },
        config: {
            topic: CONFIG.MESSAGING_TOPIC,
            universeId: CONFIG.UNIVERSE_ID
        }
    });
});

// ============================================
// START SERVER
// ============================================
loadLog();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('');
    console.log('🚀 ===============================================');
    console.log('🚀 Multi-Platform Donation Server v3.0');
    console.log('🚀 Mode: Direct Send + Web Dashboard');
    console.log('🚀 ===============================================');
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🏛️  Lobby:     http://localhost:${PORT}`);
    console.log(`🖥️  Dashboard: http://localhost:${PORT}/dashboard`);
    console.log('');
    console.log('📋 Webhook Endpoints:');
    console.log('   • Saweria:    POST /webhook/saweria');
    console.log('   • Sociabuzz:  POST /webhook/sociabuzz');
    console.log('   • BagiBagi:   POST /webhook/bagibagi');
    console.log('   • Universal:  POST /webhook');
    console.log('   • Manual:     POST /api/manual-donate (butuh login)');
    console.log('');
    console.log('🎮 Roblox MessagingService:');
    console.log(`   • Topic: ${CONFIG.MESSAGING_TOPIC}`);
    console.log(`   • Universe ID: ${CONFIG.UNIVERSE_ID}`);
    console.log('');
    console.log(`👥 Akun dashboard (${USERS.size}): ${[...USERS.keys()].join(', ')}`);
    if (!CONFIG.SESSION_SECRET) {
        console.log('ℹ️  SESSION_SECRET belum diset, memakai secret dari file data/session-secret.');
        console.log('ℹ️  Di hosting dengan disk sementara (Railway/Render), set SESSION_SECRET agar sesi tidak putus tiap deploy.');
    }
    if (!CONFIG.DASHBOARD_USERS) {
        console.log('⚠️  PERINGATAN: Belum ada DASHBOARD_USERS, memakai akun default "admin".');
        console.log('⚠️  Set DASHBOARD_USERS="user1:pass1,user2:pass2" agar tiap orang punya akun sendiri.');
    }
    if (USERS.get('admin') === 'admin123') {
        console.log('⚠️  PERINGATAN: Password masih default (admin123). Ganti sebelum deploy!');
    }
    console.log('');
    console.log('✅ Ready to receive donations!');
    console.log('🚀 ===============================================');
});
