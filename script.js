import { firebaseConfig } from './config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, push, set, onValue, get, update, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const IMGBB_KEY = '47c2368e92247d1a461c9175e20ba5bf';

let currentUserData = null;
let currentTarget = "all";
let currentUnsubscribe = null;

const getEmail = (nick) => `${nick.trim().toLowerCase()}@lite.chat`;

// Управление интерфейсом
window.toggleSettings = () => {
    const m = document.getElementById('settings-modal');
    m.style.display = (m.style.display === 'flex') ? 'none' : 'flex';
};

window.closeChat = () => document.body.classList.remove('chat-open');

window.switchChat = (target, el) => {
    currentTarget = target;
    document.getElementById('chat-title').innerText = target;
    document.body.classList.add('chat-open');
    
    if (el) {
        document.querySelectorAll('.contact-item').forEach(i => i.classList.remove('active'));
        el.classList.add('active');
    }

    const myId = auth.currentUser.email.split('@')[0];
    const path = (target === 'all') ? 'All_chat' : 'Chats/' + [myId, target].sort().join('-');
    
    if (currentUnsubscribe) currentUnsubscribe();
    currentUnsubscribe = onValue(query(ref(db, path), limitToLast(60)), (snap) => {
        const container = document.getElementById('chat-container');
        container.innerHTML = "";
        snap.forEach(c => {
            const m = c.val();
            const div = document.createElement('div');
            div.className = 'msg';
            const isImg = m.text && m.text.includes('ibb.co');
            const content = isImg ? `<img src="${m.text}" class="chat-img" onclick="window.open('${m.text}')">` : `<div>${m.text}</div>`;
            div.innerHTML = `<div class="msg-author">${m.sender}</div>${content}`;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    });
};

// Авторизация
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const myId = user.email.split('@')[0];
        const snap = await get(ref(db, `Users/${myId}`));
        currentUserData = snap.exists() ? snap.val() : { nick: myId };
        document.getElementById('display-nick').innerText = currentUserData.nick;
        document.getElementById('auth-screen').style.display = 'none';
        loadContacts();
        switchChat('all');
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
    }
});

document.getElementById('loginBtn').onclick = () => {
    signInWithEmailAndPassword(auth, getEmail(nickInput.value), passInput.value).catch(() => alert("Ошибка"));
};

document.getElementById('regBtn').onclick = () => {
    const n = nickInput.value.trim();
    createUserWithEmailAndPassword(auth, getEmail(n), passInput.value)
        .then(() => set(ref(db, `Users/${n.toLowerCase()}`), { nick: n, email: getEmail(n) }))
        .catch(() => alert("Ошибка"));
};

window.logOut = () => signOut(auth);

// Чат и поиск
document.getElementById('messageInput').onkeydown = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
        const myId = auth.currentUser.email.split('@')[0];
        const path = (currentTarget === 'all') ? 'All_chat' : 'Chats/' + [myId, currentTarget].sort().join('-');
        push(ref(db, path), { sender: currentUserData.nick, text: e.target.value, time: Date.now() });
        e.target.value = "";
    }
};

window.uploadImage = async (input) => {
    const file = input.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: fd });
    const json = await res.json();
    if (json.success) {
        const myId = auth.currentUser.email.split('@')[0];
        const path = (currentTarget === 'all') ? 'All_chat' : 'Chats/' + [myId, currentTarget].sort().join('-');
        push(ref(db, path), { sender: currentUserData.nick, text: json.data.url, time: Date.now() });
    }
};

function loadContacts() {
    onValue(ref(db, 'Chats'), (snap) => {
        const list = document.getElementById('contacts-list');
        const myId = auth.currentUser.email.split('@')[0];
        list.innerHTML = `<div class="contact-item ${currentTarget === 'all' ? 'active' : ''}" onclick="switchChat('all', this)">общий-чат</div>`;
        snap.forEach(chat => {
            if (chat.key.includes(myId)) {
                const other = chat.key.split('-').find(p => p !== myId);
                const div = document.createElement('div');
                div.className = `contact-item ${currentTarget === other ? 'active' : ''}`;
                div.innerText = other;
                div.onclick = () => switchChat(other, div);
                list.appendChild(div);
            }
        });
    });
}

document.getElementById('search-input').onkeydown = async (e) => {
    if (e.key === 'Enter') {
        const t = e.target.value.trim().toLowerCase();
        const s = await get(ref(db, `Users/${t}`));
        if (s.exists()) { switchChat(t); e.target.value = ""; }
    }
};

window.setTheme = (t) => { document.body.setAttribute('data-theme', t); localStorage.setItem('theme', t); };
if (localStorage.getItem('theme')) setTheme(localStorage.getItem('theme'));