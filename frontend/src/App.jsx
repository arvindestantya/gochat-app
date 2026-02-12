import { useState, useEffect, useRef } from "react";
const API_URL = "http://localhost:3000"; 
const WS_URL = "ws://localhost:3000";
// ==========================================
// 1. KOMPONEN UI KECIL
// ==========================================

const ImageModal = ({ src, onClose }) => {
  if (!src) return null;
  return (
    <div className="fixed inset-0 bg-black/95 z-[999] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div className="relative max-w-5xl max-h-full flex flex-col items-center">
        <img src={src} alt="Full Size" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain ring-1 ring-white/20" />
        <button className="mt-4 bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-full backdrop-blur-sm transition font-medium" onClick={onClose}>
          Tutup Gambar
        </button>
      </div>
    </div>
  );
};

const AuthForm = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const endpoint = isRegistering ? "register" : "login";

    try {
      const res = await fetch(API_URL + `/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        if (isRegistering) {
          alert("🎉 Registrasi Berhasil! Silakan Login.");
          setIsRegistering(false);
        } else {
          // SIMPAN SESSION (Login Persisten)
          localStorage.setItem("chat_username", username);
          onLogin(username);
        }
      } else {
        const text = await res.text();
        alert("❌ Gagal: " + text);
      }
    } catch (err) {
      alert("⚠️ Error koneksi server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl w-full max-w-sm text-center">
        <div className="mb-6 flex justify-center">
          <div className="bg-emerald-500/20 p-4 rounded-full">
            <span className="text-4xl">💬</span>
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-2 text-white tracking-tight">GoChat</h1>
        <p className="text-slate-400 mb-8 text-sm">{isRegistering ? "Gabung komunitas kami sekarang" : "Selamat datang kembali!"}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition placeholder:text-slate-500"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
          <input
            type="password"
            className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition placeholder:text-slate-500"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button 
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition active:scale-[0.98] shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {loading ? "Memproses..." : (isRegistering ? "Daftar Akun" : "Masuk Aplikasi")}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 text-sm text-slate-400">
          {isRegistering ? "Sudah punya akun? " : "Belum punya akun? "}
          <button onClick={() => setIsRegistering(!isRegistering)} className="text-emerald-400 font-bold hover:text-emerald-300 transition ml-1">
            {isRegistering ? "Login" : "Daftar"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. APLIKASI UTAMA
// ==========================================

function App() {
  const [username, setUsername] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [target, setTarget] = useState(""); 
  const [status, setStatus] = useState("Connecting...");
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);

  const ws = useRef(null);
  const messagesEndRef = useRef(null);

  // --- CEK SESSION SAAT LOAD ---
  useEffect(() => {
    const savedUser = localStorage.getItem("chat_username");
    if (savedUser) {
      setUsername(savedUser);
      setIsLoggedIn(true);
    }
  }, []);

  // --- LOGIC: WebSocket & Data ---
  useEffect(() => {
    if (!isLoggedIn) return;

    fetch(API_URL + `/history?username=${username}`)
      .then((res) => res.json())
      .then((data) => setMessages(data))
      .catch((err) => console.error("History error:", err));

    ws.current = new WebSocket(WS_URL + `/ws?username=${username}`);
    ws.current.onopen = () => {
      setStatus("Connected");
      
      // --- TAMBAHAN BARU: Pancing Server kirim User List ---
      // Kirim pesan khusus tipe "get_users" begitu koneksi nyambung
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
            username: username,
            type: "get_users", // <--- Tipe pesan khusus
            content: "", 
            target: "" 
        }));
      }
    };
    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "users") {
          // console.log("Update User List:", data.list); // <--- Cek ini muncul gak?
          setOnlineUsers(data.list);
        } else {
          setMessages((prev) => [...prev, data]);
        }
      } catch (e) { console.error("WS Parse Error", e); }
    };
    ws.current.onclose = () => setStatus("Disconnected");

    return () => ws.current?.close();
  }, [isLoggedIn, username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ username, content: input, target, type: "text" }));
      setInput("");
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch(API_URL + "/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url && ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ username, content: data.url, target, type: "image" }));
      }
    } catch (err) { alert("Gagal upload gambar"); }
  };

  const handleLogout = () => {
    localStorage.removeItem("chat_username");
    window.location.reload();
  };

  if (!isLoggedIn) return <AuthForm onLogin={(user) => { localStorage.setItem("chat_username", user); setUsername(user); setIsLoggedIn(true); }} />;

  const filteredMessages = messages.filter((msg) => {
    if (!target) return !msg.target; 
    return (msg.username === username && msg.target === target) || (msg.username === target && msg.target === username);
  });

  return (
    <div className="h-screen bg-slate-100 flex items-center justify-center font-sans p-4 md:p-6">
      <div className="w-full max-w-6xl bg-white h-[92vh] rounded-3xl shadow-2xl overflow-hidden flex border border-slate-200">
        
        {/* === SIDEBAR === */}
        <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col hidden md:flex">
          <div className="p-5 border-b border-slate-200 bg-white">
            <h2 className="font-bold text-slate-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Online Users ({onlineUsers.length})
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <button 
              onClick={() => setTarget("")}
              className={`w-full text-left px-4 py-3 rounded-xl transition flex items-center gap-3 ${target === "" ? "bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 shadow-sm" : "text-slate-600 hover:bg-slate-100 border border-transparent"}`}
            >
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-lg">📢</div>
              <div>
                <div className="text-sm">Public Room</div>
                <div className="text-[10px] opacity-70 font-normal">Broadcast message</div>
              </div>
            </button>

            <div className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Direct Messages</div>

            {onlineUsers.map((u, idx) => (
              u !== username && (
                <button 
                  key={idx}
                  onClick={() => setTarget(u)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition flex items-center gap-3 ${target === u ? "bg-purple-50 text-purple-700 font-bold border border-purple-200 shadow-sm" : "text-slate-600 hover:bg-slate-100 border border-transparent"}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${target === u ? "bg-purple-500" : "bg-slate-400"}`}>
                    {u.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm">{u}</div>
                    {target === u && <div className="text-[10px] text-purple-500 font-normal">Private Chat</div>}
                  </div>
                </button>
              )
            ))}
          </div>
          
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-500/20">
                {username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-700">{username}</div>
                <div className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                   {status === "Connected" ? "● Online" : "○ Offline"}
                </div>
              </div>
              <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition p-2" title="Keluar">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* === MAIN CHAT AREA === */}
        <div className="flex-1 flex flex-col bg-[#F8FAFC]">
          <div className="md:hidden p-4 bg-white border-b flex justify-between items-center shadow-sm">
             <span className="font-bold text-slate-700">GoChat</span>
             <div className="flex items-center gap-2">
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">{target || "Public"}</span>
                <button onClick={handleLogout} className="text-slate-400">🚪</button>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            {filteredMessages.map((msg, index) => {
              const isMe = msg.username === username;
              return (
                <div key={index} className={`flex ${isMe ? "justify-end" : "justify-start"} group`}>
                  <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[85%] md:max-w-[70%]`}>
                    {!isMe && <span className="text-[11px] text-slate-400 mb-1 ml-1 font-medium">{msg.username}</span>}
                    <div className={`
                      px-4 py-3 shadow-sm text-[15px] leading-relaxed relative
                      ${isMe 
                        ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-2xl rounded-tr-sm" 
                        : "bg-white text-slate-700 border border-slate-200 rounded-2xl rounded-tl-sm"}
                    `}>
                       {msg.type === "image" ? (
                         <div className="rounded-lg overflow-hidden my-1">
                            <img src={msg.content} alt="sent" className="w-full h-auto max-w-[280px] object-cover cursor-zoom-in hover:scale-105 transition duration-300" onClick={() => setSelectedImage(msg.content)} />
                         </div>
                       ) : msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-white border-t border-slate-200">
             {target && (
                <div className="flex items-center gap-2 mb-2 text-xs font-medium text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg w-fit animate-fade-in">
                   <span>🔒 Private Message to <b>{target}</b></span>
                   <button onClick={() => setTarget("")} className="hover:text-purple-800">✕</button>
                </div>
             )}
             
             <form onSubmit={handleSendMessage} className="flex gap-3 items-end">
                <label className="p-3 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer transition active:scale-95">
                   <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                </label>

                <div className="flex-1 relative">
                   <input
                      type="text"
                      className={`w-full border-2 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-2 transition text-sm font-medium ${target ? 'border-purple-100 focus:border-purple-500 focus:ring-purple-200 bg-purple-50/20' : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-200 bg-slate-50'}`}
                      placeholder={target ? `Kirim pesan rahasia ke ${target}...` : "Tulis pesan..."}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                   />
                </div>

                <button type="submit" className={`p-3.5 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition active:scale-95 flex items-center justify-center text-white ${target ? 'bg-purple-600 shadow-purple-200' : 'bg-emerald-500 shadow-emerald-200'}`}>
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 transform rotate-[-45deg] translate-x-0.5 -translate-y-0.5">
                      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                   </svg>
                </button>
             </form>
          </div>
        </div>
      </div>
      <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />
    </div>
  );
}

export default App;