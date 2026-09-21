// Dashboard donasi — log realtime + manual donate
const TOKEN_KEY = 'donation_dashboard_token';

const el = (id) => document.getElementById(id);

// Token versi lama (hex tanpa titik) sudah tidak dipakai, buang agar tidak memicu 401 saat boot
function readStoredToken() {
    const saved = localStorage.getItem(TOKEN_KEY) || '';
    if (saved && !saved.includes('.')) {
        localStorage.removeItem(TOKEN_KEY);
        return '';
    }
    return saved;
}

const state = {
    token: readStoredToken(),
    username: '',
    donations: [],
    filter: 'all',
    stream: null,
    live: false,
    connectedOnce: false
};

const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const timeText = (ts) => new Date(ts).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' });

async function api(path, options = {}) {
    const tokenUsed = state.token;

    const res = await fetch(path, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'x-auth-token': tokenUsed,
            ...(options.headers || {})
        }
    });

    if (res.status === 401) {
        // Abaikan respons basi dari sesi sebelumnya agar tidak mementalkan login yang baru
        if (state.token === tokenUsed) {
            logout('Sesi berakhir, silakan login lagi');
        }
        throw new Error('Sesi berakhir, silakan login lagi');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
        throw new Error(data.error || `Request gagal (${res.status})`);
    }
    return data;
}

function toast(message, isError = false) {
    const node = el('toast');
    node.textContent = message;
    node.classList.toggle('error', isError);
    node.classList.remove('hidden');
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.add('hidden'), 3500);
}

// ---------- AUTH ----------
async function boot() {
    if (!state.token) return showLogin();

    const tokenUsed = state.token;
    try {
        const data = await api('/api/session');
        state.username = data.username;
        showApp();
    } catch {
        if (state.token === tokenUsed) showLogin();
    }
}

function showLogin(message = '') {
    el('appView').classList.add('hidden');
    el('loginView').classList.remove('hidden');
    el('loginError').textContent = message;
    el('loginUsername').focus();
}

function showApp() {
    el('loginView').classList.add('hidden');
    el('appView').classList.remove('hidden');
    el('currentUser').textContent = state.username ? `@${state.username}` : '';
    loadDonations();
    connectStream();
}

function logout(message = '') {
    if (state.stream) state.stream.close();
    state.stream = null;
    state.token = '';
    state.username = '';
    state.connectedOnce = false;
    localStorage.removeItem(TOKEN_KEY);
    setConnection(false);
    showLogin(message);
}

el('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorNode = el('loginError');
    errorNode.textContent = '';

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: el('loginUsername').value,
                password: el('loginPassword').value
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.token) throw new Error(data.error || 'Login gagal');

        state.token = data.token;
        state.username = data.username;
        localStorage.setItem(TOKEN_KEY, data.token);
        el('loginPassword').value = '';
        showApp();
    } catch (err) {
        errorNode.textContent = err.message;
    }
});

el('logoutBtn').addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch { /* token sudah tidak valid */ }
    logout();
});

// ---------- LIVE STREAM ----------
function setConnection(online) {
    state.live = online;
    const node = el('connStatus');
    node.classList.toggle('online', online);
    node.classList.toggle('offline', !online);
    node.lastChild.textContent = online ? ' Live' : ' Offline';
}

function connectStream() {
    if (state.stream) state.stream.close();

    const stream = new EventSource(`/api/stream?token=${encodeURIComponent(state.token)}`);
    state.stream = stream;

    stream.addEventListener('connected', () => {
        setConnection(true);
        // Ambil ulang log agar donasi yang masuk saat koneksi putus tidak terlewat
        if (state.connectedOnce) loadDonations();
        state.connectedOnce = true;
    });
    stream.addEventListener('donation', (e) => {
        const entry = JSON.parse(e.data);
        if (state.donations.some((d) => d.id === entry.id)) return;

        state.donations.unshift(entry);
        renderLog();
        renderStats();
        if (!(entry.source === 'manual' && entry.by === state.username)) {
            toast(`Donasi baru: ${entry.donatorName} — ${rupiah(entry.amount)}`);
        }
    });
    stream.addEventListener('cleared', () => {
        state.donations = [];
        renderLog();
        renderStats();
    });
    stream.onerror = () => {
        setConnection(false);
        // EventSource otomatis reconnect; tutup jika token sudah tidak valid
        if (stream.readyState === EventSource.CLOSED) {
            setTimeout(() => { if (state.token) connectStream(); }, 5000);
        }
    };
}

// Cadangan bila SSE terputus (proxy/hosting kadang memutus koneksi panjang)
setInterval(() => {
    if (state.token && !state.live && !document.hidden) loadDonations();
}, 30000);

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.token) loadDonations();
});

// ---------- TAB ----------
const TAB_KEY = 'donation_dashboard_tab';

function showTab(name, focusInput = false) {
    const active = name === 'log' ? 'log' : 'manual';
    localStorage.setItem(TAB_KEY, active);

    document.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === active);
    });
    el('tabManual').classList.toggle('hidden', active !== 'manual');
    el('tabLog').classList.toggle('hidden', active !== 'log');

    if (active === 'manual' && focusInput) el('mName').focus();
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab, true));
});

showTab(localStorage.getItem(TAB_KEY) || 'manual');

// ---------- DATA ----------
async function loadDonations() {
    const requestedAt = Date.now();
    try {
        const data = await api('/api/donations?limit=500');
        mergeDonations(data.donations, requestedAt);
    } catch (err) {
        toast(err.message, true);
    }
}

// Snapshot server jadi acuan, tapi donasi yang masuk saat request berjalan tetap dipertahankan
function mergeDonations(list, requestedAt) {
    const serverIds = new Set(list.map((d) => d.id));
    const pending = state.donations.filter(
        (d) => !serverIds.has(d.id) && d.timestamp >= requestedAt - 5000
    );

    state.donations = [...pending, ...list].sort((a, b) => b.timestamp - a.timestamp);
    renderLog();
    renderStats();
}

function renderStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startTs = startOfToday.getTime();

    let totalAmount = 0;
    let todayAmount = 0;
    let todayCount = 0;
    let failed = 0;

    for (const entry of state.donations) {
        const amount = Number(entry.amount) || 0;
        totalAmount += amount;
        if (entry.status === 'failed') failed += 1;
        if (entry.timestamp >= startTs) {
            todayAmount += amount;
            todayCount += 1;
        }
    }

    el('statTotalCount').textContent = state.donations.length;
    el('statTotalAmount').textContent = rupiah(totalAmount);
    el('statTodayAmount').textContent = rupiah(todayAmount);
    el('statTodayCount').textContent = `${todayCount} donasi`;
    el('statFailed').textContent = failed;
    el('logCount').textContent = state.donations.length;
}

function renderLog() {
    const list = el('logList');
    list.textContent = '';

    const items = state.filter === 'all'
        ? state.donations
        : state.donations.filter((d) => d.platform === state.filter);

    if (items.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.textContent = 'Belum ada donasi masuk.';
        list.appendChild(empty);
        return;
    }

    for (const entry of items) {
        list.appendChild(buildLogItem(entry));
    }
}

// Semua teks memakai textContent agar aman dari input donatur
function buildLogItem(entry) {
    const item = document.createElement('div');
    item.className = 'log-item' + (entry.status === 'failed' ? ' failed' : '');

    const top = document.createElement('div');
    top.className = 'log-top';

    const name = document.createElement('span');
    name.className = 'log-name';
    name.textContent = entry.donatorName;

    const amount = document.createElement('span');
    amount.className = 'log-amount';
    amount.textContent = rupiah(entry.amount);

    top.append(name, amount);
    item.appendChild(top);

    if (entry.message) {
        const message = document.createElement('div');
        message.className = 'log-message';
        message.textContent = entry.message;
        item.appendChild(message);
    }

    const meta = document.createElement('div');
    meta.className = 'log-meta';

    const platform = document.createElement('span');
    platform.className = `badge ${entry.platform}`;
    platform.textContent = entry.platform;
    meta.appendChild(platform);

    if (entry.by) {
        const by = document.createElement('span');
        by.textContent = `oleh @${entry.by}`;
        meta.appendChild(by);
    }

    if (entry.status === 'failed') {
        const failed = document.createElement('span');
        failed.className = 'badge failed';
        failed.textContent = 'gagal';
        failed.title = entry.error || '';
        meta.appendChild(failed);
    }

    const time = document.createElement('span');
    time.textContent = timeText(entry.timestamp);
    meta.appendChild(time);

    item.appendChild(meta);
    return item;
}

// ---------- MANUAL DONATE ----------
el('manualForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = el('manualSubmit');
    button.disabled = true;
    button.textContent = 'Mengirim...';

    try {
        const data = await api('/api/manual-donate', {
            method: 'POST',
            body: JSON.stringify({
                donatorName: el('mName').value,
                amount: Number(el('mAmount').value),
                message: el('mMessage').value
            })
        });
        toast(`Terkirim ke Roblox: ${data.donation.donatorName} — ${rupiah(data.donation.amount)}`);
        el('mMessage').value = '';
        el('mAmount').value = '';
        el('msgCount').textContent = '0';
        el('mName').focus();
    } catch (err) {
        toast(err.message, true);
    } finally {
        button.disabled = false;
        button.textContent = 'Kirim ke Roblox';
    }
});

document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => { el('mAmount').value = chip.dataset.amount; });
});

el('mMessage').addEventListener('input', (e) => {
    el('msgCount').textContent = e.target.value.length;
});

// ---------- KONTROL LOG ----------
el('filterPlatform').addEventListener('change', (e) => {
    state.filter = e.target.value;
    renderLog();
});

el('refreshBtn').addEventListener('click', () => {
    loadDonations();
});

el('exportBtn').addEventListener('click', async () => {
    const button = el('exportBtn');
    button.disabled = true;
    button.textContent = 'Menyiapkan...';

    try {
        const res = await fetch('/api/export.xlsx', { headers: { 'x-auth-token': state.token } });
        if (!res.ok) throw new Error(res.status === 401 ? 'Sesi berakhir, login lagi' : 'Export gagal');

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `donasi-${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        toast('Excel berhasil diunduh');
    } catch (err) {
        toast(err.message, true);
    } finally {
        button.disabled = false;
        button.textContent = 'Export Excel';
    }
});

el('clearBtn').addEventListener('click', async () => {
    if (!confirm('Hapus semua log donasi?')) return;
    try {
        await api('/api/donations', { method: 'DELETE' });
        state.donations = [];
        renderLog();
        renderStats();
        toast('Log dibersihkan');
    } catch (err) {
        toast(err.message, true);
    }
});

boot();
