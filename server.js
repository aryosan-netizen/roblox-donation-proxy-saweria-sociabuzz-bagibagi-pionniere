// File: server.js - Multi-Platform Donation Server (Saweria, Sociabuzz, BagiBagi)
// Menggunakan Roblox Open Cloud MessagingService API - Direct Send (No Queue)

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ExcelJS = require('exceljs');

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
    SESSION_SECRET: process.env.SESSION_SECRET || '8f3c1d9a5e7b204c6a1f8d3e9b5c7a2048e6f1b3d9c5a7e2b4f6081d3a5c7e9b',

    // Jumlah maksimum log donasi yang disimpan di memori
    MAX_LOG: Number(process.env.MAX_LOG) || 500,

    // Lokasi file penyimpanan log (agar tidak hilang saat restart)
    LOG_FILE: process.env.LOG_FILE || path.join(__dirname, 'data', 'donations.json'),

    // Lokasi file daftar akun bila memakai penyimpanan file lokal
    USERS_FILE: process.env.USERS_FILE || path.join(__dirname, 'data', 'users.json'),

    // Zona waktu untuk pengelompokan tanggal pada export Excel
    TIMEZONE: process.env.TIMEZONE || 'Asia/Jakarta'
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
// DONATION LOG STORE (file lokal / Upstash Redis / JSONBin)
// ============================================
const donationLog = [];
let seqCounter = 0;

// Nilai di-trim karena spasi/slash ikut tersalin membuat URL & header penyimpanan tidak valid
const STORAGE = {
    upstashUrl: (process.env.UPSTASH_REDIS_REST_URL || 'https://complete-mosquito-289057.upstash.io').trim().replace(/\/+$/, ''),
    upstashToken: (process.env.UPSTASH_REDIS_REST_TOKEN || 'gQAAAAAABGkhAAIgcDFlYTMyOTM0ZTIzYTU0NjI0YjZjZmM3Yzc5YmVkNDZjYQ').trim(),
    upstashKey: (process.env.UPSTASH_KEY || 'lemansion:donations').trim(),
    jsonbinKey: (process.env.JSONBIN_KEY || '').trim(),
    jsonbinId: (process.env.JSONBIN_BIN_ID || '').trim(),
    jsonbinUsersId: (process.env.JSONBIN_USERS_BIN_ID || '').trim()
};

const USERS_KEY = (process.env.UPSTASH_USERS_KEY || 'lemansion:users').trim();

// Driver ditentukan dari env yang tersedia; file lokal jadi cadangan terakhir
const STORAGE_DRIVER =
    (STORAGE.upstashUrl && STORAGE.upstashToken) ? 'upstash' :
    (STORAGE.jsonbinKey && STORAGE.jsonbinId) ? 'jsonbin' :
    'file';

const storageState = {
    driver: STORAGE_DRIVER,
    ready: false,          // true setelah minimal satu kali berhasil membaca
    lastError: null,
    lastSavedAt: null,
    saves: 0
};

async function withRetry(label, fn, attempts = 3) {
    let lastError;
    for (let i = 1; i <= attempts; i += 1) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            console.warn(`[LOG] ⚠️ ${label} gagal (percobaan ${i}/${attempts}): ${error.message}`);
            if (i < attempts) await new Promise((resolve) => setTimeout(resolve, i * 700));
        }
    }
    throw lastError;
}

async function upstashCommand(command) {
    const res = await fetch(STORAGE.upstashUrl, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${STORAGE.upstashToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(command)
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`Upstash ${command[0]} HTTP ${res.status}: ${text.slice(0, 200)}`);

    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(`Upstash ${command[0]}: respons bukan JSON — ${text.slice(0, 200)}`);
    }
    if (data.error) throw new Error(`Upstash ${command[0]}: ${data.error}`);

    return data.result;
}

async function storageRead() {
    if (STORAGE_DRIVER === 'upstash') {
        const result = await upstashCommand(['GET', STORAGE.upstashKey]);
        return result ? JSON.parse(result) : [];
    }

    if (STORAGE_DRIVER === 'jsonbin') {
        const res = await fetch(`https://api.jsonbin.io/v3/b/${STORAGE.jsonbinId}/latest`, {
            headers: { 'X-Master-Key': STORAGE.jsonbinKey, 'X-Bin-Meta': 'false' }
        });
        const text = await res.text();
        if (!res.ok) throw new Error(`JSONBin GET HTTP ${res.status}: ${text.slice(0, 200)}`);

        const data = JSON.parse(text);
        return Array.isArray(data) ? data : (Array.isArray(data.record) ? data.record : []);
    }

    try {
        return JSON.parse(fs.readFileSync(CONFIG.LOG_FILE, 'utf8'));
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
}

async function storageWrite(entries) {
    const payload = JSON.stringify(entries);

    if (STORAGE_DRIVER === 'upstash') {
        await upstashCommand(['SET', STORAGE.upstashKey, payload]);
        return;
    }

    if (STORAGE_DRIVER === 'jsonbin') {
        const res = await fetch(`https://api.jsonbin.io/v3/b/${STORAGE.jsonbinId}`, {
            method: 'PUT',
            headers: {
                'X-Master-Key': STORAGE.jsonbinKey,
                'Content-Type': 'application/json'
            },
            body: payload
        });
        if (!res.ok) throw new Error(`JSONBin PUT HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return;
    }

    writeFileLog(payload);
}

// Tulis lewat file sementara agar isi lama tidak rusak bila proses mati di tengah penulisan
function writeFileLog(payload) {
    fs.mkdirSync(path.dirname(CONFIG.LOG_FILE), { recursive: true });
    const tmp = `${CONFIG.LOG_FILE}.tmp`;
    fs.writeFileSync(tmp, payload);
    fs.renameSync(tmp, CONFIG.LOG_FILE);
}

async function loadLog() {
    try {
        const parsed = await withRetry('Baca log', storageRead);
        if (!Array.isArray(parsed)) return;

        donationLog.push(...parsed.slice(-CONFIG.MAX_LOG));

        // Entri lama belum punya seq; beri nomor urut agar sinkronisasi dashboard tetap jalan
        for (const entry of donationLog) {
            if (Number.isFinite(entry.seq)) seqCounter = Math.max(seqCounter, entry.seq);
            else entry.seq = ++seqCounter;
        }

        storageState.ready = true;
        storageState.lastError = null;
        console.log(`[LOG] 📂 Memuat ${donationLog.length} donasi dari penyimpanan "${STORAGE_DRIVER}"`);
    } catch (error) {
        storageState.ready = false;
        storageState.lastError = error.message;
        console.error('[LOG] ❌ GAGAL membaca penyimpanan:', error.message);
        console.error('[LOG] ❌ Penulisan ditahan agar data lama tidak tertimpa data kosong.');
    }
}

let saveTimer = null;
let flushing = false;
let dirty = false;

function saveLog() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        flushLog();
    }, 800);
}

async function flushLog() {
    if (flushing) {
        dirty = true;
        return;
    }

    flushing = true;
    try {
        do {
            dirty = false;

            // Jangan menimpa penyimpanan sebelum isinya pernah terbaca dengan sukses
            if (!storageState.ready) {
                const remote = await withRetry('Pemulihan baca penyimpanan', storageRead);
                if (Array.isArray(remote)) {
                    const known = new Set(donationLog.map((d) => d.id));
                    const restored = remote.filter((d) => d && d.id && !known.has(d.id));
                    if (restored.length > 0) {
                        donationLog.unshift(...restored);
                        console.log(`[LOG] ♻️ Memulihkan ${restored.length} entri dari penyimpanan`);
                    }
                }
                storageState.ready = true;
            }

            await withRetry('Tulis penyimpanan', storageWrite.bind(null, donationLog));
            storageState.saves += 1;
            storageState.lastSavedAt = Date.now();
            storageState.lastError = null;
        } while (dirty);
    } catch (error) {
        storageState.lastError = error.message;
        console.error('[LOG] ❌ GAGAL menyimpan log:', error.message);
    } finally {
        flushing = false;
    }
}

// Pastikan donasi terakhir ikut tersimpan saat server dimatikan/di-deploy ulang
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
        console.log(`\n[LOG] 💾 Menyimpan ${donationLog.length} donasi sebelum keluar (${signal})...`);
        clearTimeout(saveTimer);
        await flushLog();
        process.exit(0);
    });
}

function dateKey(timestamp) {
    return new Date(timestamp).toLocaleDateString('sv-SE', { timeZone: CONFIG.TIMEZONE });
}

function dateTimeText(timestamp) {
    return new Date(timestamp).toLocaleString('sv-SE', { timeZone: CONFIG.TIMEZONE });
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
        seq: ++seqCounter,
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
    console.log(`[LOG] 📝 Tercatat #${entry.seq} (${entry.platform}) — total ${donationLog.length} entri`);

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
// AKUN DASHBOARD (tersimpan di penyimpanan eksternal)
// ============================================
const revokedTokens = new Map();     // token -> expiry (hasil logout)
const loginAttempts = new Map();     // ip+username -> { count, resetAt }
const SESSION_TTL = 12 * 60 * 60 * 1000;

const USER_RULES = {
    USERNAME: /^[a-z0-9._-]{3,20}$/,
    PASSWORD_MIN: 8,
    ROLES: ['admin', 'staff']
};

let users = [];                      // { username, role, salt, hash, createdAt, createdBy, lastLoginAt, credVersion }
let USERS_SEED_WARNING = false;

// Akun darurat dari env; selalu valid dan tidak bisa dihapus lewat panel
const ROOT_USER = (() => {
    const raw = (process.env.ROOT_USER || '').trim();
    const sep = raw.indexOf(':');
    if (sep < 1) return null;

    const username = raw.slice(0, sep).trim().toLowerCase();
    const password = raw.slice(sep + 1).trim();
    return username && password ? { username, password } : null;
})();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return { salt, hash };
}

function safeCompare(a, b) {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

function findUser(username) {
    return users.find((u) => u.username === username) || null;
}

function publicUser(user) {
    return {
        username: user.username,
        role: user.role,
        createdAt: user.createdAt || null,
        createdBy: user.createdBy || null,
        lastLoginAt: user.lastLoginAt || null,
        root: Boolean(ROOT_USER && ROOT_USER.username === user.username)
    };
}

async function readUsersFromStorage() {
    if (STORAGE_DRIVER === 'upstash') {
        const result = await upstashCommand(['GET', USERS_KEY]);
        return result ? JSON.parse(result) : [];
    }

    if (STORAGE_DRIVER === 'jsonbin') {
        if (!STORAGE.jsonbinUsersId) return [];
        const res = await fetch(`https://api.jsonbin.io/v3/b/${STORAGE.jsonbinUsersId}/latest`, {
            headers: { 'X-Master-Key': STORAGE.jsonbinKey, 'X-Bin-Meta': 'false' }
        });
        const text = await res.text();
        if (!res.ok) throw new Error(`JSONBin users GET HTTP ${res.status}: ${text.slice(0, 200)}`);

        const data = JSON.parse(text);
        return Array.isArray(data) ? data : (Array.isArray(data.record) ? data.record : []);
    }

    try {
        return JSON.parse(fs.readFileSync(CONFIG.USERS_FILE, 'utf8'));
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
}

async function writeUsersToStorage() {
    const payload = JSON.stringify(users);

    if (STORAGE_DRIVER === 'upstash') {
        await upstashCommand(['SET', USERS_KEY, payload]);
        return;
    }

    if (STORAGE_DRIVER === 'jsonbin') {
        if (!STORAGE.jsonbinUsersId) throw new Error('JSONBIN_USERS_BIN_ID belum diisi');
        const res = await fetch(`https://api.jsonbin.io/v3/b/${STORAGE.jsonbinUsersId}`, {
            method: 'PUT',
            headers: { 'X-Master-Key': STORAGE.jsonbinKey, 'Content-Type': 'application/json' },
            body: payload
        });
        if (!res.ok) throw new Error(`JSONBin users PUT HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return;
    }

    fs.mkdirSync(path.dirname(CONFIG.USERS_FILE), { recursive: true });
    const tmp = `${CONFIG.USERS_FILE}.tmp`;
    fs.writeFileSync(tmp, payload);
    fs.renameSync(tmp, CONFIG.USERS_FILE);
}

async function saveUsers() {
    await withRetry('Tulis akun', writeUsersToStorage);
}

async function loadUsers() {
    try {
        const stored = await withRetry('Baca akun', readUsersFromStorage);
        users = Array.isArray(stored) ? stored.filter((u) => u && u.username && u.hash && u.salt) : [];
        console.log(`[AUTH] 👥 Memuat ${users.length} akun dari penyimpanan "${STORAGE_DRIVER}"`);
    } catch (error) {
        console.error('[AUTH] ❌ GAGAL membaca daftar akun:', error.message);
        users = [];
        return;
    }

    if (users.length > 0) return;

    // Seed pertama kali: ambil dari DASHBOARD_USERS agar tidak terkunci di luar panel
    const seed = [];
    for (const pair of String(CONFIG.DASHBOARD_USERS).split(',')) {
        const sep = pair.indexOf(':');
        if (sep < 1) continue;
        const username = pair.slice(0, sep).trim().toLowerCase();
        const password = pair.slice(sep + 1).trim();
        if (username && password) seed.push({ username, password });
    }
    if (seed.length === 0) seed.push({ username: 'admin', password: CONFIG.DASHBOARD_PASSWORD });
    USERS_SEED_WARNING = seed.some(({ password }) => password === 'admin123' || password.length < USER_RULES.PASSWORD_MIN);

    users = seed.map(({ username, password }) => ({
        username,
        role: 'admin',
        ...hashPassword(password),
        createdAt: Date.now(),
        createdBy: 'seed',
        lastLoginAt: null,
        credVersion: 1
    }));

    try {
        await saveUsers();
        console.log(`[AUTH] 🌱 Membuat ${users.length} akun awal: ${users.map((u) => u.username).join(', ')}`);
    } catch (error) {
        console.error('[AUTH] ❌ Gagal menyimpan akun awal:', error.message);
    }
}

// Kunci sesi tidak lagi bergantung daftar akun, agar menambah/menghapus user tidak mengeluarkan semua orang
function resolveSessionSecret() {
    if (CONFIG.SESSION_SECRET) return CONFIG.SESSION_SECRET;

    return crypto.createHash('sha256')
        .update(`${CONFIG.ROBLOX_API_KEY}|${CONFIG.UNIVERSE_ID}|lemansion-session`)
        .digest('hex');
}

const SESSION_SECRET = resolveSessionSecret();

function verifyCredentials(username, password) {
    if (ROOT_USER && username === ROOT_USER.username && safeCompare(password, ROOT_USER.password)) {
        return { username: ROOT_USER.username, role: 'admin', credVersion: 0, root: true };
    }

    const user = findUser(username);
    // Tetap lakukan hashing walau user tidak ada, agar lama respons tidak membocorkan username valid
    const salt = user ? user.salt : 'dummy-salt';
    const { hash } = hashPassword(password, salt);
    if (!user || !safeCompare(hash, user.hash)) return null;

    return user;
}

function signPayload(payload) {
    return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
}

function createSession(user) {
    const expiry = Date.now() + SESSION_TTL;
    const payload = `${user.username}.${expiry}.${user.credVersion || 1}.${crypto.randomBytes(8).toString('hex')}`;
    return `${Buffer.from(payload).toString('base64url')}.${signPayload(payload)}`;
}

function readSession(token) {
    if (typeof token !== 'string' || !token) return { error: 'token tidak dikirim' };
    if (revokedTokens.has(token)) return { error: 'token sudah di-logout' };

    const sep = token.lastIndexOf('.');
    if (sep < 1) return { error: 'format token tidak dikenal (token lama?)' };

    let payload;
    try {
        payload = Buffer.from(token.slice(0, sep), 'base64url').toString('utf8');
    } catch {
        return { error: 'payload token rusak' };
    }
    if (!safeCompare(token.slice(sep + 1), signPayload(payload))) {
        return { error: 'signature tidak cocok (SESSION_SECRET berubah?)' };
    }

    const [username, expiry, credVersion] = payload.split('.');
    if (!Number(expiry) || Number(expiry) < Date.now()) return { error: 'token kedaluwarsa' };

    if (ROOT_USER && username === ROOT_USER.username) {
        return { session: { username, role: 'admin', expiry: Number(expiry) } };
    }

    const user = findUser(username);
    if (!user) return { error: `akun "${username}" sudah dihapus` };
    if (Number(credVersion || 1) !== (user.credVersion || 1)) {
        return { error: 'password akun diubah, sesi lama tidak berlaku' };
    }

    return { session: { username, role: user.role, expiry: Number(expiry) } };
}

function requireAuth(req, res, next) {
    const token = req.get('x-auth-token') || req.query.token;
    const { session, error } = readSession(token);
    if (!session) {
        console.warn(`[AUTH] ⚠️ 401 ${req.method} ${req.path} — ${error}`);
        return res.status(401).json({ success: false, error: 'Sesi tidak valid atau sudah berakhir' });
    }
    req.session = session;
    req.sessionToken = token;
    next();
}

function requireAdmin(req, res, next) {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Hanya admin yang boleh mengelola akun' });
    }
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
app.post('/api/login', async (req, res) => {
    const ip = req.ip || 'unknown';
    const username = sanitizeText(req.body?.username, 32).toLowerCase();
    const password = String(req.body?.password ?? '');

    if (!checkRateLimit(loginAttempts, `${ip}:${username}`, 10, 5 * 60 * 1000)) {
        return res.status(429).json({ success: false, error: 'Terlalu banyak percobaan login, coba lagi nanti' });
    }

    const user = username ? verifyCredentials(username, password) : null;
    if (!user) {
        console.warn(`[AUTH] ❌ Login gagal (${username || '-'}) dari ${ip}`);
        return res.status(401).json({ success: false, error: 'Username atau password salah' });
    }

    if (!user.root) {
        user.lastLoginAt = Date.now();
        saveUsers().catch((err) => console.warn('[AUTH] ⚠️ Gagal menyimpan waktu login:', err.message));
    }

    const token = createSession(user);
    console.log(`[AUTH] ✅ Login berhasil: ${username} (${user.role}) dari ${ip}`);
    res.json({ success: true, token, username, role: user.role, expiresIn: SESSION_TTL });
});

app.post('/api/logout', requireAuth, (req, res) => {
    revokedTokens.set(req.sessionToken, req.session.expiry);
    console.log(`[AUTH] 👋 Logout: ${req.session.username}`);
    res.json({ success: true });
});

app.get('/api/session', requireAuth, (req, res) => {
    res.json({ success: true, username: req.session.username, role: req.session.role });
});

// ============================================
// API KELOLA AKUN (khusus admin)
// ============================================
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
    const list = users.map(publicUser);
    if (ROOT_USER && !findUser(ROOT_USER.username)) {
        list.push({
            username: ROOT_USER.username,
            role: 'admin',
            createdAt: null,
            createdBy: 'env',
            lastLoginAt: null,
            root: true
        });
    }
    res.json({ success: true, users: list, currentUser: req.session.username });
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
    const username = sanitizeText(req.body?.username, 20).toLowerCase();
    const password = String(req.body?.password ?? '');
    const role = USER_RULES.ROLES.includes(req.body?.role) ? req.body.role : 'staff';

    if (!USER_RULES.USERNAME.test(username)) {
        return res.status(400).json({
            success: false,
            error: 'Username 3-20 karakter, hanya huruf kecil, angka, titik, garis bawah, atau strip'
        });
    }
    if (password.length < USER_RULES.PASSWORD_MIN) {
        return res.status(400).json({ success: false, error: `Password minimal ${USER_RULES.PASSWORD_MIN} karakter` });
    }
    if (findUser(username) || (ROOT_USER && ROOT_USER.username === username)) {
        return res.status(409).json({ success: false, error: 'Username sudah dipakai' });
    }

    const user = {
        username,
        role,
        ...hashPassword(password),
        createdAt: Date.now(),
        createdBy: req.session.username,
        lastLoginAt: null,
        credVersion: 1
    };
    users.push(user);

    try {
        await saveUsers();
    } catch (error) {
        users = users.filter((u) => u.username !== username);
        return res.status(502).json({ success: false, error: `Gagal menyimpan akun: ${error.message}` });
    }

    console.log(`[AUTH] ➕ Akun "${username}" (${role}) dibuat oleh ${req.session.username}`);
    res.json({ success: true, user: publicUser(user) });
});

app.patch('/api/users/:username', requireAuth, requireAdmin, async (req, res) => {
    const username = sanitizeText(req.params.username, 20).toLowerCase();
    const user = findUser(username);
    if (!user) return res.status(404).json({ success: false, error: 'Akun tidak ditemukan' });

    const password = req.body?.password === undefined ? null : String(req.body.password);
    const role = req.body?.role === undefined ? null : String(req.body.role);
    const snapshot = { ...user };

    if (password !== null) {
        if (password.length < USER_RULES.PASSWORD_MIN) {
            return res.status(400).json({ success: false, error: `Password minimal ${USER_RULES.PASSWORD_MIN} karakter` });
        }
        Object.assign(user, hashPassword(password));
        user.credVersion = (user.credVersion || 1) + 1;
    }

    if (role !== null) {
        if (!USER_RULES.ROLES.includes(role)) {
            return res.status(400).json({ success: false, error: 'Peran tidak dikenal' });
        }
        if (user.role === 'admin' && role !== 'admin' && countAdmins() <= 1) {
            return res.status(400).json({ success: false, error: 'Tidak boleh menurunkan peran admin terakhir' });
        }
        user.role = role;
    }

    try {
        await saveUsers();
    } catch (error) {
        Object.assign(user, snapshot);
        return res.status(502).json({ success: false, error: `Gagal menyimpan perubahan: ${error.message}` });
    }

    console.log(`[AUTH] ✏️ Akun "${username}" diubah oleh ${req.session.username}` +
        `${password !== null ? ' (password direset)' : ''}${role !== null ? ` (peran: ${role})` : ''}`);
    res.json({ success: true, user: publicUser(user) });
});

app.delete('/api/users/:username', requireAuth, requireAdmin, async (req, res) => {
    const username = sanitizeText(req.params.username, 20).toLowerCase();

    if (username === req.session.username) {
        return res.status(400).json({ success: false, error: 'Tidak bisa menghapus akun sendiri' });
    }
    if (ROOT_USER && ROOT_USER.username === username) {
        return res.status(400).json({ success: false, error: 'Akun darurat tidak bisa dihapus dari panel' });
    }

    const user = findUser(username);
    if (!user) return res.status(404).json({ success: false, error: 'Akun tidak ditemukan' });
    if (user.role === 'admin' && countAdmins() <= 1) {
        return res.status(400).json({ success: false, error: 'Tidak boleh menghapus admin terakhir' });
    }

    const backup = [...users];
    users = users.filter((u) => u.username !== username);

    try {
        await saveUsers();
    } catch (error) {
        users = backup;
        return res.status(502).json({ success: false, error: `Gagal menghapus akun: ${error.message}` });
    }

    console.log(`[AUTH] 🗑️ Akun "${username}" dihapus oleh ${req.session.username}`);
    res.json({ success: true });
});

function countAdmins() {
    return users.filter((u) => u.role === 'admin').length;
}

app.get('/api/donations', requireAuth, (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, CONFIG.MAX_LOG);
    res.json({
        success: true,
        total: donationLog.length,
        lastSeq: seqCounter,
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

// Export log ke Excel, satu tab per tanggal
app.get('/api/export.xlsx', requireAuth, async (req, res) => {
    const groups = new Map();
    for (const entry of donationLog) {
        const day = dateKey(entry.timestamp);
        if (!groups.has(day)) groups.set(day, []);
        groups.get(day).push(entry);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Lemansion';
    workbook.created = new Date();

    const days = [...groups.keys()].sort().reverse();
    if (days.length === 0) days.push(dateKey(Date.now()));

    for (const day of days) {
        const sheet = workbook.addWorksheet(day);
        sheet.columns = [
            { header: 'Waktu', key: 'waktu', width: 20 },
            { header: 'Platform', key: 'platform', width: 14 },
            { header: 'Nama Donatur', key: 'nama', width: 26 },
            { header: 'Nominal (Rp)', key: 'nominal', width: 16, style: { numFmt: '#,##0' } },
            { header: 'Pesan', key: 'pesan', width: 46 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Sumber', key: 'sumber', width: 12 },
            { header: 'Dikirim Oleh', key: 'oleh', width: 16 },
            { header: 'Keterangan Error', key: 'error', width: 34 }
        ];
        sheet.getRow(1).font = { bold: true };
        sheet.views = [{ state: 'frozen', ySplit: 1 }];

        for (const entry of groups.get(day) || []) {
            sheet.addRow({
                waktu: dateTimeText(entry.timestamp),
                platform: entry.platform,
                nama: entry.donatorName,
                nominal: entry.amount,
                pesan: entry.message,
                status: entry.status === 'sent' ? 'Terkirim' : 'Gagal',
                sumber: entry.source,
                oleh: entry.by || '-',
                error: entry.error || ''
            });
        }
    }

    console.log(`[EXPORT] 📊 ${req.session.username} mengunduh ${donationLog.length} donasi (${days.length} tab)`);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="donasi-${dateKey(Date.now())}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
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
    // Pakai CONFIG.TIMEZONE agar "hari ini" tidak mengikuti zona waktu server (hosting umumnya UTC)
    const today = dateKey(Date.now());

    const stats = {
        totalDonations: donationLog.length,
        totalAmount: 0,
        todayAmount: 0,
        todayCount: 0,
        failed: 0,
        byPlatform: {}
    };

    for (const entry of donationLog) {
        const amount = Number(entry.amount) || 0;
        stats.totalAmount += amount;
        if (entry.status === 'failed') stats.failed += 1;
        if (dateKey(entry.timestamp) === today) {
            stats.todayAmount += amount;
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
        storage: STORAGE_DRIVER,
        logged: donationLog.length,
        lastSeq: seqCounter
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
                export: 'GET /api/export.xlsx',
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
const PORT = process.env.PORT || 3000;

const STORAGE_LABEL = {
    upstash: `Upstash Redis (persisten) — key ${STORAGE.upstashKey}`,
    jsonbin: `JSONBin.io (persisten) — bin ${STORAGE.jsonbinId}`,
    file: `File lokal — ${CONFIG.LOG_FILE}`
};

async function bootstrap() {
    await loadLog();
    await loadUsers();
}

bootstrap().then(() => {
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
        console.log(`💾 Penyimpanan log: ${STORAGE_LABEL[STORAGE_DRIVER]}`);
        console.log(`   • Status: ${storageState.ready ? `OK (${donationLog.length} entri)` : 'GAGAL — ' + storageState.lastError}`);
        if (STORAGE_DRIVER === 'file') {
            console.log('⚠️  File lokal HILANG setiap deploy ulang di Railway/Render.');
            console.log('⚠️  Pakai volume persisten (set LOG_FILE ke path volume) atau isi');
            console.log('⚠️  UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN agar data aman.');
        }
        console.log('');
        console.log(`👥 Akun dashboard (${users.length}): ${users.map((u) => `${u.username}[${u.role}]`).join(', ') || '-'}`);
        if (ROOT_USER) {
            console.log(`🔑 Akun darurat aktif: ${ROOT_USER.username} (dari env ROOT_USER, tidak bisa dihapus)`);
        } else {
            console.log('ℹ️  Set ROOT_USER="nama:password" sebagai akun cadangan agar tidak terkunci dari panel.');
        }
        if (!CONFIG.SESSION_SECRET) {
            console.log('ℹ️  SESSION_SECRET belum diset, kunci sesi diturunkan dari API key & Universe ID.');
        }
        if (USERS_SEED_WARNING) {
            console.log('⚠️  PERINGATAN: Akun awal memakai password default. Segera ganti lewat menu Kelola Akun!');
        }
        console.log('');
        console.log('✅ Ready to receive donations!');
        console.log('🚀 ===============================================');
    });
});
