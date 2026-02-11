import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Plus, MessageSquare, ShieldCheck, User, Bot, 
  Settings, LogOut, ShieldAlert, Sparkles, Image as ImageIcon, 
  Trash, Copy, Check, Download, Menu, X, Lock, Globe, Users, 
  ClipboardList, ChevronRight, Terminal, Loader2
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, onSnapshot, deleteDoc, updateDoc } from 'firebase/firestore';

// --- CONFIGURAÇÃO FIREBASE ---
// Substitua pelos seus dados reais do console do Firebase
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'tuzingpt-elite-final';

const ADMIN_EMAIL = 'joaolucasspin@gmail.com';
// --- COLOQUE A URL DO SEU WORKER AQUI PARA SEGURANÇA TOTAL ---
const WORKER_URL = ""; 

// --- RENDERIZADOR DE MARKDOWN ---
const Markdown = ({ text }) => {
  const segments = text.split(/(```[\s\S]*?```)/g);
  return segments.map((segment, idx) => {
    if (segment.startsWith('```')) {
      const match = segment.match(/```(\w+)?\n?([\s\S]*?)```/);
      return <CodeBlock key={idx} code={match?.[2]?.trim() || ''} language={match?.[1] || 'code'} />;
    }
    return (
      <div key={idx} className="space-y-3 my-2 text-[14px] md:text-[15px] leading-relaxed text-zinc-300">
        {segment.split('\n').map((line, i) => {
          if (line.trim() === '---') return <hr key={i} className="border-zinc-800 my-6" />;
          if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-black text-white mt-6 mb-2 tracking-tight">{line.replace('### ', '')}</h3>;
          if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-black text-white mt-8 mb-3 border-b border-zinc-800 pb-2 tracking-tighter">{line.replace('## ', '')}</h2>;
          if (line.startsWith('# ')) return <h1 key={i} className="text-3xl font-black text-white mt-10 mb-4 tracking-tighter uppercase italic">{line.replace('# ', '')}</h1>;
          if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            return (
              <div key={i} className="flex gap-3 pl-2 items-start">
                <span className="text-indigo-500 font-bold mt-1.5">•</span>
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
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="text-white font-black">{part.slice(2, -2)}</strong>;
    return part;
  });
};

// --- BLOCO DE CÓDIGO MONACO-STYLE ---
const CodeBlock = ({ code, language }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    const textArea = document.createElement("textarea");
    textArea.value = code; document.body.appendChild(textArea);
    textArea.select(); document.execCommand('copy');
    setCopied(true); setTimeout(() => setCopied(false), 2000);
    document.body.removeChild(textArea);
  };
  return (
    <div className="my-8 rounded-2xl border border-zinc-800 bg-[#0a0a0a] overflow-hidden font-mono text-[12px] shadow-2xl">
      <div className="flex items-center justify-between px-6 py-4 bg-[#111] border-b border-zinc-800/50">
        <div className="flex gap-2 items-center">
          <Terminal size={14} className="text-indigo-500" />
          <span className="text-zinc-500 font-black uppercase tracking-[2px] text-[10px]">{language}</span>
        </div>
        <button onClick={handleCopy} className="text-zinc-500 hover:text-indigo-400 transition-all flex items-center gap-2 active:scale-90">
          {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          <span className="font-bold text-[10px] uppercase tracking-tighter">{copied ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>
      <div className="p-6 overflow-x-auto flex">
        <div className="hidden sm:block pr-6 text-zinc-800 text-right select-none border-r border-zinc-900 mr-6 font-bold min-w-[35px]">
          {code.split('\n').map((_, i) => <div key={i} className="leading-relaxed">{i + 1}</div>)}
        </div>
        <pre className="text-indigo-100 flex-1 leading-relaxed"><code>{code}</code></pre>
      </div>
    </div>
  );
};

// --- APP ---
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
  const [allUsers, setAllUsers] = useState([]);
  const [globalHistory, setGlobalHistory] = useState([]);

  const messagesEndRef = useRef(null);
  const getFirstName = (name) => name ? name.split(' ')[0] : "João";

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const init = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else { await signInAnonymously(auth); }
    };
    init();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      const session = localStorage.getItem('tuzingpt_v4_session');
      if (session) { setUserData(JSON.parse(session)); setView('chat'); }
    });
  }, []);

  useEffect(() => {
    if (!user || !userData || view !== 'chat') return;
    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'chats');
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setChats(list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
    });
  }, [user, userData, view]);

  useEffect(() => {
    if (!activeChatId || !user || view !== 'chat') return;
    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'chats', activeChatId, 'messages');
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => d.data()).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)));
    });
  }, [activeChatId, user, view]);

  const handleAuth = async (e) => {
    e.preventDefault(); setError('');
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'users', email);
    if (authMode === 'register') {
      if (!fullName || !email || !password) return setError('Por favor, preencha todos os campos.');
      await setDoc(ref, { fullName, email, password, uid: user.uid, role: email === ADMIN_EMAIL ? 'admin' : 'user', createdAt: new Date().toISOString() });
      setAuthMode('login');
    } else {
      const snap = await getDoc(ref);
      if (snap.exists() && snap.data().password === password) {
        const data = snap.data();
        setUserData(data);
        localStorage.setItem('tuzingpt_v4_session', JSON.stringify(data));
        setView('chat');
      } else { setError('Dados inválidos. Verifique o seu e-mail e senha.'); }
    }
  };

  const handleSend = async (e, isImage = false) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    let chatId = activeChatId;
    if (!chatId) {
      const ref = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'chats'), { title: input.substring(0, 30), createdAt: new Date().toISOString() });
      chatId = ref.id; setActiveChatId(chatId);
    }

    const userMsg = { content: input, role: 'user', timestamp: new Date().toISOString() };
    setInput(''); setIsLoading(true);

    try {
      const col = collection(db, 'artifacts', appId, 'users', user.uid, 'chats', chatId, 'messages');
      const globalCol = collection(db, 'artifacts', appId, 'public', 'data', 'global_history');
      await addDoc(col, userMsg);
      await addDoc(globalCol, { ...userMsg, userEmail: userData.email, userName: userData.fullName });

      // PROMPT MESTRE INTEGRADO
      const systemInstruction = `Tu és o TuzinGPT, a IA suprema do João. 
Missão: Resolver TUDO (código, arte, texto) com perfeição técnica.
Tratamento: Chame sempre pelo primeiro nome: João.
Estilo: Markdown Rico e Monaco-Style Code.
Segurança: Cloudflare + Firebase Encriptado.`;
      
      let response;
      if (WORKER_URL) {
        const res = await fetch(WORKER_URL, {
          method: "POST",
          body: JSON.stringify({ prompt: userMsg.content, systemInstruction, isImage })
        });
        const data = await res.json();
        response = isImage ? `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}` : data.candidates[0].content.parts[0].text;
      } else {
        // Fallback direto (Apenas se o Worker ainda não estiver pronto)
        const apiKeyDirect = ""; 
        const url = isImage ? `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKeyDirect}` : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKeyDirect}`;
        const body = isImage ? { instances: { prompt: userMsg.content }, parameters: { sampleCount: 1 } } : { contents: [{ parts: [{ text: userMsg.content }] }], systemInstruction: { parts: [{ text: systemInstruction }] } };
        const res = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
        const data = await res.json();
        response = isImage ? `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}` : data.candidates[0].content.parts[0].text;
      }

      const aiMsg = { content: response, role: 'assistant', isImage, timestamp: new Date().toISOString() };
      await addDoc(col, aiMsg);
      await addDoc(globalCol, { ...aiMsg, userEmail: userData.email, userName: 'TuzinGPT' });
      if (messages.length === 0) await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'chats', chatId), { title: userMsg.content.substring(0, 30) });
    } finally { setIsLoading(false); }
  };

  const fetchAdmin = async () => {
    if (userData.email !== ADMIN_EMAIL) return;
    const uSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'users'));
    setAllUsers(uSnap.docs.map(d => d.data()));
    const hSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'global_history'));
    setGlobalHistory(hSnap.docs.map(d => d.data()).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)));
  };

  // --- VIEWS ---

  if (view === 'auth') {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-indigo-600/10 blur-[150px] rounded-full" />
        <div className="w-full max-w-md bg-[#0a0a0a]/90 backdrop-blur-3xl p-10 md:p-12 rounded-[3.5rem] border border-zinc-900 shadow-2xl z-10">
          <div className="mb-12 text-center">
            <h1 className="text-5xl md:text-6xl font-black text-white italic tracking-tighter">TUZIN<span className="text-indigo-600">GPT</span></h1>
            <p className="text-zinc-700 text-[10px] font-black uppercase tracking-[6px] mt-4">Nível Elite de IA</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-[#111] border border-zinc-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-indigo-600 transition-all font-bold placeholder-zinc-800" placeholder="NOME COMPLETO" />}
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#111] border border-zinc-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-indigo-600 transition-all font-bold placeholder-zinc-800" placeholder="E-MAIL" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#111] border border-zinc-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-indigo-600 transition-all font-bold placeholder-zinc-800" placeholder="SENHA" />
            {error && <p className="text-red-500 text-[11px] font-black text-center uppercase tracking-widest bg-red-500/10 p-3 rounded-xl">{error}</p>}
            <button className="w-full bg-indigo-600 py-4 rounded-2xl text-white font-black tracking-[4px] hover:bg-indigo-500 transition-all uppercase shadow-2xl shadow-indigo-600/20 active:scale-95">
              {authMode === 'login' ? 'ACESSAR' : 'REGISTRAR'}
            </button>
            <button type="button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full text-zinc-600 text-[11px] font-black uppercase tracking-[2px] mt-6 hover:text-white transition-all">
              {authMode === 'login' ? 'Não tem uma conta? Registre-se!' : 'Já tem uma conta? Faça login!'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'admin') {
    return (
      <div className="min-h-screen bg-[#050505] text-zinc-300 p-6 md:p-12 font-sans">
        <div className="max-w-7xl mx-auto space-y-12">
          <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-900 pb-8 gap-6">
            <div className="flex items-center gap-4">
              <ShieldAlert className="text-red-500" size={32} />
              <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter text-white uppercase">Painel Master</h1>
            </div>
            <button onClick={() => setView('chat')} className="px-10 py-4 bg-zinc-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-xl">Voltar ao Chat</button>
          </header>
          
          <div className="grid lg:grid-cols-2 gap-12">
            <section className="space-y-6">
              <h2 className="text-xl font-black text-indigo-500 uppercase flex items-center gap-3 tracking-[2px]"><Users size={20}/> Base de Utilizadores</h2>
              <div className="bg-[#0e0e0e] border border-zinc-900 rounded-[2.5rem] overflow-hidden shadow-2xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900 text-zinc-500 font-black uppercase tracking-widest">
                    <tr><th className="p-6">Nome</th><th className="p-6">Email</th><th className="p-6">Senha</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {allUsers.map((u, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                        <td className="p-6 font-bold text-white whitespace-nowrap">{u.fullName}</td>
                        <td className="p-6 text-zinc-500 whitespace-nowrap">{u.email}</td>
                        <td className="p-6 font-mono text-indigo-400 whitespace-nowrap">{u.password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="text-xl font-black text-indigo-500 uppercase flex items-center gap-3 tracking-[2px]"><ClipboardList size={20}/> Monitorização Global</h2>
              <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-4">
                {globalHistory.map((h, i) => (
                  <div key={i} className={`p-6 rounded-[2rem] border transition-all hover:border-zinc-700 ${h.role === 'assistant' ? 'bg-zinc-900/20 border-zinc-800' : 'bg-indigo-900/5 border-indigo-900/20'}`}>
                    <div className="flex justify-between items-start mb-3">
                       <span className="text-[11px] font-black text-indigo-500 uppercase">{h.userName}</span>
                       <span className="text-[9px] text-zinc-700 font-bold uppercase">{new Date(h.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[13px] text-zinc-400 leading-relaxed italic">"{h.content?.substring(0, 200)}..."</p>
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
      {isSidebarOpen && <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300" onClick={() => setIsSidebarOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 md:w-80 bg-[#0a0a0a] border-r border-zinc-900 transition-all duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 shadow-2xl`}>
        <div className="flex flex-col h-full p-6 md:p-10">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-3xl font-black text-white tracking-tighter italic">TUZIN<span className="text-indigo-600">GPT</span></h2>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-zinc-600 hover:text-white"><X size={28} /></button>
          </div>
          <button onClick={async () => { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'chats'), { title: 'Nova Conversa', createdAt: new Date().toISOString() }); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className="w-full flex items-center justify-center gap-3 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.8rem] transition-all font-black text-[11px] tracking-[4px] mb-10 shadow-2xl shadow-indigo-600/10 active:scale-95"><Plus size={20}/> NOVO CHAT</button>
          <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
            <p className="text-[10px] text-zinc-700 font-black uppercase tracking-[4px] px-3 mb-6">Arquivo Local</p>
            {chats.map(c => (<div key={c.id} onClick={() => { setActiveChatId(c.id); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border ${activeChatId === c.id ? 'bg-zinc-900 border-zinc-800 text-white shadow-xl' : 'border-transparent hover:bg-zinc-900/40 text-zinc-600'}`}><div className="flex items-center gap-4 overflow-hidden"><MessageSquare size={16} className={activeChatId === c.id ? 'text-indigo-400' : 'text-zinc-800'} /><span className="truncate text-[12px] font-bold tracking-tight uppercase">{c.title}</span></div><button onClick={async (e) => { e.stopPropagation(); await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'chats', c.id)); if(activeChatId === c.id) setActiveChatId(null); }} className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all p-1"><Trash size={14}/></button></div>))}
          </div>
          <div className="mt-auto pt-10 border-t border-zinc-900/50 space-y-4">
            {userData?.email === ADMIN_EMAIL && <button onClick={() => { setView('admin'); fetchAdmin(); }} className="w-full py-4 bg-red-600/10 text-red-500 rounded-2xl font-black text-[10px] tracking-[4px] border border-red-600/20 uppercase hover:bg-red-600/20 transition-all flex items-center justify-center gap-3 shadow-xl"><ShieldAlert size={18}/> Painel Master</button>}
            <div className="p-5 bg-zinc-900/50 rounded-[2.2rem] flex items-center justify-between border border-zinc-900 shadow-2xl">
               <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-inner shrink-0">{getFirstName(userData?.fullName)[0]}</div>
                  <div className="flex flex-col overflow-hidden"><span className="text-[12px] font-black text-white truncate">{getFirstName(userData?.fullName)}</span><span className="text-[8px] text-indigo-500 font-black uppercase tracking-widest tracking-[2px]">Elite Member</span></div>
               </div>
               <button onClick={() => { localStorage.removeItem('tuzingpt_v4_session'); window.location.reload(); }} className="text-zinc-700 hover:text-red-500 transition-all p-2"><LogOut size={20}/></button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative bg-[#080808] w-full min-w-0">
        <header className="h-20 flex items-center justify-between px-6 md:px-12 bg-[#080808]/90 backdrop-blur-3xl border-b border-zinc-900/40 z-40 sticky top-0">
           <div className="flex items-center gap-6"><button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-zinc-600 p-2 hover:text-white transition-all"><Menu size={28}/></button><div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)] animate-pulse"></div><h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[5px] truncate max-w-[150px] md:max-w-none">{activeChatId ? chats.find(c => c.id === activeChatId)?.title : 'TuzinGPT CORE'}</h3></div></div>
           <div className="flex items-center gap-6">
              <div className="hidden lg:flex items-center gap-2 px-4 py-1.5 bg-indigo-600/5 rounded-full border border-indigo-600/10">
                 <ShieldCheck size={14} className="text-indigo-500" /><span className="text-[9px] font-black text-indigo-400 uppercase tracking-[2px]">Encrypted Stream</span>
              </div>
              <Settings size={24} className="text-zinc-700 hover:text-white cursor-pointer transition-colors" />
           </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#080808]">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 space-y-16 animate-in fade-in duration-1000"><div className="relative group text-center"><div className="absolute inset-0 bg-indigo-600 blur-[100px] md:blur-[150px] opacity-10 rounded-full transition-all duration-1000 group-hover:opacity-20" /><h1 className="relative text-7xl sm:text-8xl md:text-[11rem] font-black text-white italic tracking-tighter select-none">TUZIN<span className="text-indigo-600">GPT</span></h1></div><p className="text-zinc-700 font-black text-[10px] md:text-xs uppercase tracking-[8px] text-center max-w-md px-6">Olá {getFirstName(userData?.fullName)}, em que posso ser útil hoje?</p><div className="grid sm:grid-cols-2 gap-6 w-full max-w-4xl px-8 md:px-12">{["Desenvolve um algoritmo complexo", "Explica a Teoria da Relatividade", "Gera uma arte cyberpunk elite", "Analisa este código React"].map(t => (<button key={t} onClick={() => setInput(t)} className="p-10 bg-[#0e0e0e] border border-zinc-900 rounded-[2.5rem] hover:border-indigo-500/40 hover:bg-[#111] transition-all text-left text-[11px] md:text-xs font-black text-zinc-600 group shadow-2xl hover:shadow-indigo-500/5"><span className="group-hover:text-zinc-200 transition-colors uppercase tracking-[2px]">{t}</span></button>))}</div></div>
          ) : (
            <div className="max-w-5xl mx-auto py-12 md:py-24 px-6 md:px-12 space-y-12 md:space-y-16">{messages.map((m, i) => (<div key={i} className={`flex gap-5 md:gap-10 ${m.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-8 duration-500`}><div className={`w-11 h-11 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-2xl ${m.role === 'user' ? 'bg-indigo-600 shadow-indigo-600/30' : 'bg-zinc-900 border border-zinc-800'}`}>{m.role === 'user' ? <User size={24} className="text-white" /> : <Bot size={24} className="text-indigo-500" />}</div><div className={`max-w-[92%] md:max-w-[85%] p-8 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] text-[15px] md:text-[16px] shadow-2xl ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none border border-white/10' : 'bg-[#0f0f0f] border border-zinc-900 text-zinc-300 rounded-tl-none'}`}>{m.isImage ? (<div className="space-y-8 group"><img src={m.content} alt="Arte IA" className="rounded-3xl w-full border border-white/5 shadow-2xl transition-all hover:scale-[1.01] duration-700" /><div className="flex justify-end opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => { const a = document.createElement('a'); a.href = m.content; a.download = 'tuzin-masterpiece.png'; a.click(); }} className="flex items-center gap-3 text-[11px] font-black uppercase text-zinc-600 hover:text-white tracking-[3px] active:scale-90"><Download size={20}/> Guardar Masterpiece</button></div></div>) : <Markdown text={m.content} />}<div className={`mt-6 text-[10px] font-black uppercase tracking-[4px] opacity-30 ${m.role === 'user' ? 'text-white' : 'text-zinc-600'}`}>{new Date(m.timestamp).toLocaleTimeString()} • {m.role === 'user' ? 'AUTENTICADO' : 'TUZIN_CORE'}</div></div></div>))}{isLoading && (<div className="flex gap-5 md:gap-10 animate-pulse"><div className="w-11 h-11 md:w-14 md:h-14 rounded-2xl bg-zinc-900 shadow-2xl" /><div className="bg-zinc-900/50 h-24 w-56 md:w-72 rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl" /></div>)}<div ref={messagesEndRef} /></div>
          )}
        </div>

        <div className="p-6 md:p-12 md:pb-24 bg-gradient-to-t from-[#080808] via-[#080808] to-transparent z-40">
          <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
             {input.trim() && (<button onClick={(e) => handleSend(e, true)} disabled={isLoading} className="flex items-center gap-4 px-10 py-4 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-[1.8rem] text-[11px] font-black hover:bg-amber-500/20 transition-all uppercase tracking-[5px] animate-in slide-in-from-bottom-4 shadow-2xl active:scale-95"><ImageIcon size={20}/> ✨ CRIAR ARTE ELITE</button>)}
             <form onSubmit={handleSend} className="relative group border-0 outline-none">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 rounded-[3rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-all duration-1000"></div>
                <div className="relative flex items-center bg-[#0a0a0a] border border-zinc-900 rounded-[2.8rem] p-3 shadow-2xl focus-within:ring-4 focus-within:ring-indigo-600/10 focus-within:border-indigo-500/50 transition-all outline-none">
                   <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) { e.preventDefault(); handleSend(e); } }} placeholder={`Em que posso ajudar-te, ${getFirstName(userData?.fullName)}?`} className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-zinc-800 py-6 px-8 md:px-12 resize-none max-h-48 md:max-h-64 text-[16px] md:text-[18px] font-bold outline-none custom-scrollbar" rows={1} />
                   <button type="submit" disabled={isLoading || !input.trim()} className={`p-8 rounded-[2.5rem] transition-all shadow-2xl active:scale-90 shrink-0 ${isLoading || !input.trim() ? 'bg-zinc-900 text-zinc-800' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/30'}`}><Send size={28} /></button>
                </div>
             </form>
             <div className="flex justify-center gap-8 md:gap-16 text-[8px] md:text-[10px] text-zinc-800 font-black uppercase tracking-[6px] md:tracking-[8px]">
                <span className="flex items-center gap-3"><Lock size={16}/> ENCRYPTED</span><span className="flex items-center gap-3"><Sparkles size={16}/> GEMINI 2.5</span><span className="flex items-center gap-3"><Globe size={16}/> CLOUDFLARE</span>
             </div>
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 40px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #252525; }
        textarea::placeholder { font-weight: 900; letter-spacing: 2px; md:letter-spacing: 4px; opacity: 0.3; text-transform: uppercase; font-size: 11px; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-in { animation: fade-in 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
        input:focus, textarea:focus, button:focus { outline: none !important; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
};

export default App;
