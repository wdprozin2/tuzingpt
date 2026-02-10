import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Plus, MessageSquare, ShieldCheck, User, Bot, 
  Settings, ExternalLink, Trash2, Menu, X, LogOut, 
  ShieldAlert, Sparkles, Image as ImageIcon, FileText,
  Wand2, Loader2, Hash, Trash, Copy, Check, Code as CodeIcon, 
  Download, ChevronRight, Globe, Lock, Users, ClipboardList
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, getDoc, getDocs, 
  addDoc, onSnapshot, deleteDoc, query
} from 'firebase/firestore';

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'tuzingpt-elite-v3';

const ADMIN_EMAIL = 'joaolucasspin@gmail.com';

// --- COMPONENTE RENDERIZADOR DE MARKDOWN ---
const Markdown = ({ text }) => {
  const segments = text.split(/(```[\s\S]*?```)/g);

  return segments.map((segment, idx) => {
    if (segment.startsWith('```')) {
      const match = segment.match(/```(\w+)?\n?([\s\S]*?)```/);
      return <CodeBlock key={idx} code={match?.[2]?.trim() || ''} language={match?.[1] || 'code'} />;
    }

    return (
      <div key={idx} className="space-y-3 my-2 text-[13px] md:text-[14px] leading-relaxed">
        {segment.split('\n').map((line, i) => {
          if (line.trim() === '---') return <hr key={i} className="border-zinc-800 my-4" />;
          if (line.startsWith('### ')) return <h3 key={i} className="text-base md:text-lg font-black text-white mt-4 mb-2">{line.replace('### ', '')}</h3>;
          if (line.startsWith('## ')) return <h2 key={i} className="text-lg md:text-xl font-black text-white mt-6 mb-3 border-b border-zinc-800 pb-1">{line.replace('## ', '')}</h2>;
          if (line.startsWith('# ')) return <h1 key={i} className="text-xl md:text-2xl font-black text-white mt-8 mb-4 tracking-tighter">{line.replace('# ', '')}</h1>;
          
          if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            return (
              <div key={i} className="flex gap-2 pl-1 md:pl-2 items-start text-zinc-400">
                <span className="text-indigo-500 mt-1.5">•</span>
                <span>{renderInline(line.trim().substring(2))}</span>
              </div>
            );
          }
          return <p key={i}>{renderInline(line)}</p>;
        })}
      </div>
    );
  });
};

const renderInline = (text) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-black">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

// --- COMPONENTE MONACO CODE BLOCK ---
const CodeBlock = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const textArea = document.createElement("textarea");
    textArea.value = code;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    document.body.removeChild(textArea);
  };

  return (
    <div className="my-4 md:my-6 rounded-xl md:rounded-2xl border border-zinc-800 bg-[#0a0a0a] overflow-hidden font-mono text-[11px] md:text-[12px] shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2 bg-[#111] border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500/20 border border-red-500/40" />
            <div className="w-2 h-2 rounded-full bg-amber-500/20 border border-amber-500/40" />
            <div className="w-2 h-2 rounded-full bg-green-500/20 border border-green-500/40" />
          </div>
          <span className="text-zinc-600 font-black uppercase tracking-[1px] text-[8px] sm:ml-2">{language}</span>
        </div>
        <button onClick={handleCopy} className="text-zinc-500 hover:text-indigo-400 transition-all flex items-center gap-1.5">
          {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          <span className="font-bold text-[9px] uppercase tracking-tighter">{copied ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>
      <div className="p-4 md:p-6 overflow-x-auto flex">
        <div className="hidden sm:block pr-4 text-zinc-800 text-right select-none border-r border-zinc-900 mr-4 font-bold min-w-[25px]">
          {code.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
        </div>
        <pre className="text-indigo-100 flex-1 leading-relaxed"><code>{code}</code></pre>
      </div>
    </div>
  );
};

// --- MAIN APP ---
const App = () => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [view, setView] = useState('auth'); 
  const [authMode, setAuthMode] = useState('login');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Admin States
  const [allUsers, setAllUsers] = useState([]);
  const [globalHistory, setGlobalHistory] = useState([]);

  const messagesEndRef = useRef(null);
  const apiKey = ""; 

  const getFirstName = (name) => name ? name.split(' ')[0] : "João";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- AUTH FLOW ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error(err); }
    };
    initAuth();

    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      const session = localStorage.getItem('tuzingpt_v3_session');
      if (session) {
        setUserData(JSON.parse(session));
        setView('chat');
      }
    });
  }, []);

  // --- FIRESTORE REALTIME ---
  useEffect(() => {
    if (!user || !userData || view !== 'chat') return;
    const qChats = collection(db, 'artifacts', appId, 'users', user.uid, 'chats');
    return onSnapshot(qChats, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setChats(list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
    });
  }, [user, userData, view]);

  useEffect(() => {
    if (!activeChatId || !user || view !== 'chat') return;
    const qMsgs = collection(db, 'artifacts', appId, 'users', user.uid, 'chats', activeChatId, 'messages');
    return onSnapshot(qMsgs, (snap) => {
      const list = snap.docs.map(d => d.data());
      setMessages(list.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)));
    });
  }, [activeChatId, user, view]);

  // --- ACTIONS ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', email);
    
    if (authMode === 'register') {
      if (!fullName || !email || !password) return setError('Preencha tudo.');
      await setDoc(userRef, { 
        fullName, email, password, uid: user.uid, 
        role: email === ADMIN_EMAIL ? 'admin' : 'user',
        createdAt: new Date().toISOString() 
      });
      setAuthMode('login');
      alert('Conta criada!');
    } else {
      const snap = await getDoc(userRef);
      if (snap.exists() && snap.data().password === password) {
        const data = snap.data();
        setUserData(data);
        localStorage.setItem('tuzingpt_v3_session', JSON.stringify(data));
        setView('chat');
      } else { setError('Dados incorretos.'); }
    }
  };

  const createChat = async () => {
    if (!user) return;
    const ref = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'chats'), {
      title: 'Nova Conversa', createdAt: new Date().toISOString()
    });
    setActiveChatId(ref.id);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const deleteChat = async (id, e) => {
    e.stopPropagation();
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'chats', id));
    if (activeChatId === id) setActiveChatId(null);
  };

  // --- IA INTEGRATION ---
  const handleSend = async (e, isImage = false) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    let chatId = activeChatId;
    if (!chatId) {
      const ref = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'chats'), {
        title: input.substring(0, 30), createdAt: new Date().toISOString()
      });
      chatId = ref.id;
      setActiveChatId(chatId);
    }

    const userMsg = { content: input, role: 'user', timestamp: new Date().toISOString() };
    setInput('');
    setIsLoading(true);

    try {
      const col = collection(db, 'artifacts', appId, 'users', user.uid, 'chats', chatId, 'messages');
      const globalCol = collection(db, 'artifacts', appId, 'public', 'data', 'global_history');
      
      await addDoc(col, userMsg);
      await addDoc(globalCol, { ...userMsg, userEmail: userData.email, userName: userData.fullName });

      let response;
      if (isImage) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`, {
          method: 'POST', body: JSON.stringify({ instances: { prompt: userMsg.content }, parameters: { sampleCount: 1 } })
        });
        const data = await res.json();
        response = `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
      } else {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
          method: 'POST', body: JSON.stringify({
            contents: [{ parts: [{ text: userMsg.content }] }],
            systemInstruction: { parts: [{ text: `Você é o TuzinGPT, um assistente de inteligência artificial de elite e multifuncional. Sua missão é fazer TUDO o que o usuário pedir com máxima eficiência. Sempre chame o usuário pelo primeiro nome: ${getFirstName(userData.fullName)}. Use formatação Markdown rica em suas respostas.` }] }
          })
        });
        const data = await res.json();
        response = data.candidates[0].content.parts[0].text;
      }

      const aiMsg = { content: response, role: 'assistant', isImage, timestamp: new Date().toISOString() };
      await addDoc(col, aiMsg);
      await addDoc(globalCol, { ...aiMsg, userEmail: userData.email, userName: 'TuzinGPT' });

      if (messages.length === 0) {
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'chats', chatId), { title: userMsg.content.substring(0, 30) }, { merge: true });
      }
    } finally { setIsLoading(false); }
  };

  // --- ADMIN PANEL ---
  const fetchAdmin = async () => {
    if (userData.email !== ADMIN_EMAIL) return;
    const uSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'users'));
    setAllUsers(uSnap.docs.map(d => d.data()));
    const hSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'global_history'));
    setGlobalHistory(hSnap.docs.map(d => d.data()).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)));
  };

  if (view === 'auth') {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 md:p-6 relative overflow-hidden font-sans">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[150px] rounded-full" />
        <div className="w-full max-w-md bg-[#0a0a0a]/90 backdrop-blur-3xl p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] border border-zinc-900 shadow-2xl z-10">
          <h1 className="text-4xl md:text-6xl font-black text-white italic text-center mb-8 md:mb-12 tracking-tighter">TUZIN<span className="text-indigo-600">GPT</span></h1>
          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-[#111] border border-zinc-800 rounded-2xl px-6 py-3.5 md:py-4 text-white outline-none focus:border-indigo-600 transition-all font-bold placeholder-zinc-800 text-sm md:text-base" placeholder="NOME COMPLETO" />}
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#111] border border-zinc-800 rounded-2xl px-6 py-3.5 md:py-4 text-white outline-none focus:border-indigo-600 transition-all font-bold placeholder-zinc-800 text-sm md:text-base" placeholder="E-MAIL" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#111] border border-zinc-800 rounded-2xl px-6 py-3.5 md:py-4 text-white outline-none focus:border-indigo-600 transition-all font-bold placeholder-zinc-800 text-sm md:text-base" placeholder="SENHA" />
            {error && <p className="text-red-500 text-[10px] font-black text-center uppercase tracking-[2px]">{error}</p>}
            <button className="w-full bg-indigo-600 py-3.5 md:py-4 rounded-2xl text-white font-black tracking-[4px] hover:bg-indigo-500 transition-all uppercase shadow-xl shadow-indigo-600/20 text-sm md:text-base">{authMode === 'login' ? 'ACESSAR' : 'REGISTRAR'}</button>
            <button 
              type="button" 
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} 
              className="w-full text-zinc-600 text-[10px] font-black uppercase tracking-[2px] mt-4 hover:text-white transition-colors"
            >
              {authMode === 'login' ? 'Não tem uma conta? Registre-se!' : 'Já tem uma conta? Faça login!'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'admin') {
    return (
      <div className="min-h-screen bg-[#050505] text-zinc-300 p-4 md:p-10 font-sans">
        <div className="max-w-7xl mx-auto space-y-8 md:space-y-12">
          <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-900 pb-6 md:pb-8 gap-4">
            <div className="flex items-center gap-4">
              <ShieldAlert className="text-red-500" size={28} />
              <h1 className="text-2xl md:text-4xl font-black italic tracking-tighter text-white uppercase">Painel do Mestre</h1>
            </div>
            <button onClick={() => setView('chat')} className="px-6 md:px-8 py-2 md:py-3 bg-zinc-900 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-zinc-800 transition-all">Sair do Painel</button>
          </header>
          
          <div className="grid lg:grid-cols-2 gap-6 md:gap-10">
            <section className="space-y-4 md:space-y-6">
              <h2 className="text-lg md:text-xl font-black text-indigo-500 uppercase flex items-center gap-3"><Users size={18}/> Usuários</h2>
              <div className="bg-[#0e0e0e] border border-zinc-900 rounded-2xl md:rounded-[2rem] overflow-x-auto shadow-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900 text-zinc-500">
                    <tr><th className="p-4 md:p-5">Nome</th><th className="p-4 md:p-5">Email</th><th className="p-4 md:p-5">Senha</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {allUsers.map((u, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 md:p-5 font-bold text-white whitespace-nowrap">{u.fullName}</td>
                        <td className="p-4 md:p-5 text-zinc-500 whitespace-nowrap">{u.email}</td>
                        <td className="p-4 md:p-5 font-mono text-indigo-400 whitespace-nowrap">{u.password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-4 md:space-y-6">
              <h2 className="text-lg md:text-xl font-black text-indigo-500 uppercase flex items-center gap-3"><ClipboardList size={18}/> Histórico Global</h2>
              <div className="space-y-3 md:space-y-4 max-h-[400px] md:max-h-[600px] overflow-y-auto custom-scrollbar pr-2 md:pr-4">
                {globalHistory.map((h, i) => (
                  <div key={i} className={`p-4 md:p-6 rounded-2xl md:rounded-[1.5rem] border ${h.role === 'assistant' ? 'bg-zinc-900/20 border-zinc-800' : 'bg-indigo-900/5 border-indigo-900/20'}`}>
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-[9px] font-black text-indigo-500 uppercase">{h.userName}</span>
                       <span className="text-[8px] text-zinc-700">{new Date(h.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 italic">"{h.content?.substring(0, 100)}..."</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#080808] text-zinc-300 overflow-hidden font-sans border-0 outline-none">
      {/* SIDEBAR OVERLAY FOR MOBILE */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 md:w-80 bg-[#0a0a0a] border-r border-zinc-900 transition-all duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0
      `}>
        <div className="flex flex-col h-full p-6 md:p-8">
          <div className="flex items-center justify-between mb-8 md:mb-12">
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter italic">TUZIN<span className="text-indigo-600">GPT</span></h2>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-zinc-500 hover:text-white">
              <X size={24} />
            </button>
          </div>
          
          <button onClick={createChat} className="w-full flex items-center justify-center gap-3 py-4 md:py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.5rem] transition-all font-black text-[10px] md:text-xs tracking-[4px] mb-8 md:mb-10 shadow-xl shadow-indigo-600/10 active:scale-95">
            <Plus size={18}/> NOVO CHAT
          </button>

          <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
            <p className="text-[9px] text-zinc-700 font-black uppercase tracking-[3px] px-3 mb-4 md:mb-5">Conversas</p>
            {chats.map(c => (
              <div key={c.id} onClick={() => { setActiveChatId(c.id); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`group flex items-center justify-between p-3.5 md:p-4 rounded-2xl cursor-pointer transition-all border ${activeChatId === c.id ? 'bg-zinc-900 border-zinc-800 text-white shadow-2xl' : 'border-transparent hover:bg-zinc-900/40 text-zinc-600'}`}>
                <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                  <MessageSquare size={14} className={activeChatId === c.id ? 'text-indigo-400' : 'text-zinc-800'} />
                  <span className="truncate text-[11px] md:text-[12px] font-bold tracking-tight">{c.title}</span>
                </div>
                <button onClick={(e) => deleteChat(c.id, e)} className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all p-1">
                  <Trash size={12}/>
                </button>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-8 md:pt-10 border-t border-zinc-900/50 space-y-4">
            {userData.email === ADMIN_EMAIL && (
              <button onClick={() => { setView('admin'); fetchAdmin(); }} className="w-full py-3.5 md:py-4 bg-red-600/10 text-red-500 rounded-2xl font-black text-[10px] tracking-[3px] md:tracking-[4px] border border-red-600/20 uppercase hover:bg-red-600/20 transition-all flex items-center justify-center gap-3">
                <ShieldAlert size={14}/> Painel Master
              </button>
            )}
            <div className="p-4 md:p-5 bg-zinc-900/50 rounded-2xl md:rounded-3xl flex items-center justify-between border border-zinc-900 shadow-xl">
               <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xs md:text-sm shadow-inner shrink-0">{getFirstName(userData.fullName)[0]}</div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-[10px] md:text-xs font-black text-white truncate">{getFirstName(userData.fullName)}</span>
                    <span className="text-[8px] text-indigo-500 font-black uppercase tracking-widest">Elite Member</span>
                  </div>
               </div>
               <button onClick={() => { localStorage.removeItem('tuzingpt_v3_session'); window.location.reload(); }} className="text-zinc-700 hover:text-red-500 transition-all p-2">
                 <LogOut size={16}/>
               </button>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative bg-[#080808] w-full min-w-0">
        <header className="h-16 md:h-20 flex items-center justify-between px-4 md:px-10 bg-[#080808]/90 backdrop-blur-3xl border-b border-zinc-900/40 z-40 sticky top-0">
           <div className="flex items-center gap-3 md:gap-6">
              <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-zinc-500 p-2 hover:text-white transition-all">
                <Menu size={22}/>
              </button>
              <div className="flex items-center gap-2 md:gap-3">
                 <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)] animate-pulse"></div>
                 <h3 className="text-[9px] md:text-[10px] font-black text-zinc-600 uppercase tracking-[3px] md:tracking-[5px] truncate max-w-[120px] md:max-w-none">
                   {activeChatId ? chats.find(c => c.id === activeChatId)?.title : 'TuzinGPT Core'}
                 </h3>
              </div>
           </div>
           <Settings size={20} className="text-zinc-800 hover:text-white cursor-pointer transition-colors" />
        </header>

        {/* CHAT WINDOW */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#080808]">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 md:p-10 space-y-12 md:space-y-16 animate-in fade-in duration-1000">
               <div className="relative group text-center">
                  <div className="absolute inset-0 bg-indigo-600 blur-[100px] md:blur-[120px] opacity-10 rounded-full" />
                  <h1 className="relative text-5xl sm:text-7xl md:text-[10rem] font-black text-white italic tracking-tighter select-none">TUZIN<span className="text-indigo-600">GPT</span></h1>
               </div>
               <p className="text-zinc-700 font-black text-[10px] md:text-xs uppercase tracking-[4px] md:tracking-[6px] text-center max-w-sm px-4">
                 Olá {getFirstName(userData.fullName)}, o que vamos criar hoje?
               </p>
               <div className="grid sm:grid-cols-2 gap-3 md:gap-5 w-full max-w-3xl px-4 md:px-6">
                  {["Crie um algoritmo complexo", "Explique a Física Quântica", "Gere uma arte cyberpunk", "Corrija o meu código"].map(t => (
                    <button key={t} onClick={() => setInput(t)} className="p-5 md:p-8 bg-[#0e0e0e] border border-zinc-900 rounded-[1.8rem] md:rounded-[2.5rem] hover:border-indigo-500/40 hover:bg-[#111] transition-all text-left text-[10px] md:text-xs font-black text-zinc-600 group shadow-2xl">
                       <span className="group-hover:text-zinc-200 transition-colors uppercase tracking-widest">{t}</span>
                    </button>
                  ))}
               </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto py-10 md:py-20 px-4 md:px-10 space-y-10 md:space-y-12">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-4 md:gap-8 ${m.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-6 duration-500`}>
                   <div className={`w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 shadow-2xl ${m.role === 'user' ? 'bg-indigo-600' : 'bg-zinc-900 border border-zinc-800'}`}>
                      {m.role === 'user' ? <User size={18} className="text-white" /> : <Bot size={18} className="text-indigo-500" />}
                   </div>
                   <div className={`
                    max-w-[88%] md:max-w-[85%] p-5 md:p-8 rounded-[1.8rem] md:rounded-[2.5rem] text-[13px] md:text-[15px] shadow-2xl
                    ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none border border-white/5' : 'bg-[#0f0f0f] border border-zinc-900 text-zinc-300 rounded-tl-none'}
                   `}>
                      {m.isImage ? (
                        <div className="space-y-4 md:space-y-6 group">
                           <img src={m.content} alt="Arte IA" className="rounded-2xl md:rounded-3xl w-full border border-white/5 shadow-2xl transition-transform hover:scale-[1.01] duration-700" />
                           <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { const a = document.createElement('a'); a.href = m.content; a.download = 'tuzin-masterpiece.png'; a.click(); }} className="flex items-center gap-2 text-[8px] md:text-[10px] font-black uppercase text-zinc-600 hover:text-white tracking-[2px]">
                                <Download size={14}/> Guardar Arte
                              </button>
                           </div>
                        </div>
                      ) : <Markdown text={m.content} />}
                      <div className={`mt-4 text-[8px] font-black uppercase tracking-[2px] opacity-30 ${m.role === 'user' ? 'text-white' : 'text-zinc-600'}`}>
                        {new Date(m.timestamp).toLocaleTimeString()}
                      </div>
                   </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-4 md:gap-8 animate-pulse">
                  <div className="w-9 h-9 md:w-12 md:h-12 rounded-xl bg-zinc-900" />
                  <div className="bg-zinc-900/50 h-16 w-40 md:w-56 rounded-[1.8rem] md:rounded-[2.5rem]" />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* INPUT AREA */}
        <div className="p-4 md:p-10 md:pb-20 bg-gradient-to-t from-[#080808] to-transparent z-40">
          <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
             {input.trim() && (
               <button onClick={(e) => handleSend(e, true)} disabled={isLoading} className="flex items-center gap-3 px-5 md:px-8 py-2 md:py-3 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-[1.2rem] md:rounded-[1.5rem] text-[9px] md:text-[10px] font-black hover:bg-amber-500/20 transition-all uppercase tracking-[3px] md:tracking-[4px] animate-in slide-in-from-bottom-2 shadow-2xl">
                 <ImageIcon size={14}/> ✨ CRIAR ARTE REAL
               </button>
             )}
             <form onSubmit={handleSend} className="relative group border-0 outline-none">
                <div className="relative flex items-center bg-[#0a0a0a] border border-zinc-900 rounded-[2rem] md:rounded-[2.5rem] p-2 md:p-4 shadow-2xl focus-within:ring-4 focus-within:ring-indigo-600/10 focus-within:border-indigo-500/40 transition-all outline-none">
                   <textarea 
                    value={input} 
                    onChange={e => setInput(e.target.value)} 
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) {
                        e.preventDefault();
                        handleSend(e);
                      }
                    }} 
                    placeholder={`Como posso ajudar-te, ${getFirstName(userData?.fullName)}?`} 
                    className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-zinc-800 py-3 md:py-4 px-4 md:px-8 resize-none max-h-40 md:max-h-60 text-[13px] md:text-[15px] font-bold outline-none custom-scrollbar" 
                    rows={1} 
                   />
                   <button 
                    type="submit" 
                    disabled={isLoading || !input.trim()} 
                    className={`p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] transition-all shadow-2xl active:scale-90 shrink-0 ${isLoading || !input.trim() ? 'bg-zinc-900 text-zinc-800' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/30'}`}
                   >
                     <Send size={20} className="md:w-6 md:h-6" />
                   </button>
                </div>
             </form>
             <div className="flex justify-center gap-6 md:gap-12 text-[7px] md:text-[9px] text-zinc-800 font-black uppercase tracking-[3px] md:tracking-[6px]">
                <span className="flex items-center gap-2 md:gap-3"><Lock size={12}/> AES-256</span>
                <span className="flex items-center gap-2 md:gap-3"><Sparkles size={12}/> Gemini 2.5</span>
                <span className="flex items-center gap-2 md:gap-3"><Globe size={12}/> Firebase</span>
             </div>
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 30px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #252525; }
        textarea::placeholder { font-weight: 900; letter-spacing: 1px; md:letter-spacing: 2px; opacity: 0.3; text-transform: uppercase; font-size: 10px; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-in { animation: fade-in 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
        input:focus, textarea:focus, button:focus { outline: none !important; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
};

export default App;
