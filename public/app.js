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
    stream: null
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
    loadStats();
    connectStream();
}

function logout(message = '') {
    if (state.stream) state.stream.close();
    state.stream = null;
    state.token = '';
    state.username = '';
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
    const node = el('connStatus');
    node.classList.toggle('online', online);
    node.classList.toggle('offline', !online);
    node.lastChild.textContent = online ? ' Live' : ' Offline';
}

function connectStream() {
    if (state.stream) state.stream.close();

    const stream = new EventSource(`/api/stream?token=${encodeURIComponent(state.token)}`);
    state.stream = stream;

    stream.addEventListener('connected', () => setConnection(true));
    stream.addEventListener('donation', (e) => {
        const entry = JSON.parse(e.data);
        state.donations.unshift(entry);
        renderLog();
        loadStats();
        if (!(entry.source === 'manual' && entry.by === state.username)) {
            toast(`Donasi baru: ${entry.donatorName} — ${rupiah(entry.amount)}`);
        }
    });
    stream.addEventListener('cleared', () => {
        state.donations = [];
        renderLog();
        loadStats();
    });
    stream.onerror = () => {
        setConnection(false);
        // EventSource otomatis reconnect; tutup jika token sudah tidak valid
        if (stream.readyState === EventSource.CLOSED) {
            setTimeout(() => { if (state.token) connectStream(); }, 5000);
        }
    };
}

// ---------- DATA ----------
async function loadDonations() {
    try {
        const data = await api('/api/donations?limit=200');
        state.donations = data.donations;
        renderLog();
    } catch (err) {
        toast(err.message, true);
    }
}

async function loadStats() {
    try {
        const { stats } = await api('/api/stats');
        el('statTotalCount').textContent = stats.totalDonations;
        el('statTotalAmount').textContent = rupiah(stats.totalAmount);
        el('statTodayAmount').textContent = rupiah(stats.todayAmount);
        el('statTodayCount').textContent = `${stats.todayCount} donasi`;
        el('statFailed').textContent = stats.failed;
    } catch { /* diam saja, stats tidak kritis */ }
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
    loadStats();
});

el('clearBtn').addEventListener('click', async () => {
    if (!confirm('Hapus semua log donasi?')) return;
    try {
        await api('/api/donations', { method: 'DELETE' });
        state.donations = [];
        renderLog();
        loadStats();
        toast('Log dibersihkan');
    } catch (err) {
        toast(err.message, true);
    }
});

boot();
