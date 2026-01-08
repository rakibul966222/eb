
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { db, rtdb, storage } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref, push, onValue, set, remove, update } from 'firebase/database';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Search, Send, MoreVertical, LogOut, Settings, Image as ImageIcon, X, ShieldAlert, ShieldCheck, Volume2, Edit3, Trash2, Check, CheckCheck, CircleDashed } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { UserProfile, Message } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { gemini } from '../geminiService';

const EBLogo = ({ className }: { className?: string }) => (
  <div className={`relative flex items-center justify-center ${className}`}>
    <div className="absolute inset-0 bg-indigo-500 rounded-[18px] blur-xl opacity-20"></div>
    <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 w-full h-full rounded-[18px] flex items-center justify-center shadow-xl shadow-indigo-500/20 text-white border border-white/10">
      <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 5h11v2H6v3h8v2H6v3h9v2H4V5zM16 5h3c1.1 0 2 .9 2 2v3.5c0 .83-.67 1.5-1.5 1.5.83 0 1.5.67 1.5 1.5V17c0 1.1-.9 2-2 2h-3V5zm2 7h1V7h-1v5zm0 5h1v-3.5h-1V17z" />
      </svg>
    </div>
  </div>
);

const HomePage: React.FC = () => {
  const { profile, user, refreshProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [unreadUsers, setUnreadUsers] = useState<Set<string>>(new Set());
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [contextMenuMessage, setContextMenuMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const AI_BOT: UserProfile = {
    uid: 'eb-assistant-bot',
    name: 'EB Assistant',
    email: 'ai@eb.com',
    photoURL: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
    bio: 'Official EB Intelligence Node.',
    lastSeen: Date.now(),
    isOnline: true,
    createdAt: 0
  };

  const formatLastSeen = (timestamp: number, isOnline: boolean) => {
    if (isOnline) return "Online";
    if (!timestamp) return "Offline";
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (seconds < 60) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Sync users and presence
  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'users');
    const unsubscribeUsers = onSnapshot(q, (snapshot) => {
      const userList: UserProfile[] = [];
      snapshot.forEach((doc) => { if (doc.id !== user?.uid) userList.push(doc.data() as UserProfile); });
      setUsers([AI_BOT, ...userList]);
    });

    const statusRef = ref(rtdb, 'status');
    const unsubscribePresence = onValue(statusRef, (snap) => {
      const statuses = snap.val();
      if (statuses) {
        setUsers(prev => prev.map(u => {
          if (statuses[u.uid]) {
            return { ...u, isOnline: statuses[u.uid].isOnline, lastSeen: statuses[u.uid].lastSeen };
          }
          return u;
        }));
      }
    });

    return () => { unsubscribeUsers(); unsubscribePresence(); };
  }, [user]);

  // Track unread messages
  useEffect(() => {
    if (!user) return;
    const chatsRef = ref(rtdb, 'chats');
    const unsubscribe = onValue(chatsRef, (snap) => {
      const chats = snap.val();
      const newUnreads = new Set<string>();
      if (chats) {
        Object.keys(chats).forEach(chatId => {
          if (chatId.includes(user.uid)) {
            const msgs = chats[chatId].messages;
            if (msgs) {
              Object.values(msgs).forEach((m: any) => {
                if (m.senderId !== user.uid && !m.seen) {
                  const otherUid = chatId.replace(user.uid, '').replace('_', '');
                  newUnreads.add(otherUid);
                }
              });
            }
          }
        });
      }
      setUnreadUsers(newUnreads);
    });
    return () => unsubscribe();
  }, [user]);

  // Typing state
  useEffect(() => {
    if (!selectedUser || !user || selectedUser.uid === 'eb-assistant-bot') return;
    const typingRef = ref(rtdb, `typing/${user.uid}/${selectedUser.uid}`);
    set(typingRef, inputText.length > 0);
    return () => { set(typingRef, false); };
  }, [inputText, selectedUser, user]);

  useEffect(() => {
    if (!selectedUser || !user || selectedUser.uid === 'eb-assistant-bot') {
      setRemoteTyping(false);
      return;
    }
    const typingRef = ref(rtdb, `typing/${selectedUser.uid}/${user.uid}`);
    const unsubscribe = onValue(typingRef, (snap) => setRemoteTyping(snap.val() === true));
    return () => unsubscribe();
  }, [selectedUser, user]);

  // Message listener
  useEffect(() => {
    if (!selectedUser || !user) return;
    const chatId = [user.uid, selectedUser.uid].sort().join('_');
    const chatRef = ref(rtdb, `chats/${chatId}/messages`);
    
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgList: Message[] = Object.entries(data).map(([id, val]: any) => ({ id, ...val }));
        const sorted = msgList.sort((a, b) => a.timestamp - b.timestamp);
        sorted.forEach(m => {
          if (m.senderId !== user.uid && !m.seen) {
            update(ref(rtdb, `chats/${chatId}/messages/${m.id}`), { seen: true });
          }
        });
        setMessages(sorted);
      } else setMessages([]);
    });
    return () => unsubscribe();
  }, [selectedUser, user]);

  useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, remoteTyping]);

  const toggleBlock = async () => {
    if (!selectedUser || !user) return;
    const isBlocked = profile?.blockedUsers?.includes(selectedUser.uid);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { 
        blockedUsers: isBlocked ? arrayRemove(selectedUser.uid) : arrayUnion(selectedUser.uid) 
      });
      await refreshProfile();
      setShowMenu(false);
      toast.success(isBlocked ? `Unblocked ${selectedUser.name}` : `Blocked ${selectedUser.name}`);
    } catch (e) { toast.error("Sync failed."); }
  };

  const handleDeleteMessage = async (msg: Message) => {
    if (!selectedUser || !user) return;
    const chatId = [user.uid, selectedUser.uid].sort().join('_');
    try {
      await remove(ref(rtdb, `chats/${chatId}/messages/${msg.id}`));
      toast.success("Message Unsent");
      setContextMenuMessage(null);
    } catch (e) { toast.error("Permission Denied."); }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedImage) || !selectedUser || !user) return;
    if (profile?.blockedUsers?.includes(selectedUser.uid)) return toast.error("User is Blocked");

    const currentText = inputText.trim();
    const currentImage = selectedImage;
    const chatId = [user.uid, selectedUser.uid].sort().join('_');
    const chatRef = ref(rtdb, `chats/${chatId}/messages`);

    if (editingMessage) {
      try {
        await update(ref(rtdb, `chats/${chatId}/messages/${editingMessage.id}`), { text: currentText, edited: true });
        setEditingMessage(null);
        setInputText('');
        return;
      } catch (e) { return; }
    }

    setInputText('');
    setSelectedImage(null);
    setImagePreview(null);

    try {
      let imageUrl = '';
      if (currentImage) {
        const storageRef = sRef(storage, `chats/${chatId}/${Date.now()}_${currentImage.name}`);
        await uploadBytes(storageRef, currentImage);
        imageUrl = await getDownloadURL(storageRef);
      }

      const msgRef = push(chatRef);
      await set(msgRef, {
        id: msgRef.key,
        senderId: user.uid,
        text: currentText,
        timestamp: Date.now(),
        type: imageUrl ? 'image' : 'text',
        seen: false,
        metadata: imageUrl ? { url: imageUrl } : null
      });

      if (selectedUser.uid === 'eb-assistant-bot') {
        setIsAiProcessing(true);
        const aiReply = await gemini.getAiResponse(currentText, imageUrl);
        setIsAiProcessing(false);
        const aiRef = push(chatRef);
        await set(aiRef, { id: aiRef.key, senderId: 'eb-assistant-bot', text: aiReply, timestamp: Date.now(), type: 'ai', seen: true });
      }
    } catch (err: any) { toast.error("Signal Lost."); }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans transition-colors duration-300">
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
         <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-500/20 blur-[150px] rounded-full animate-pulse"></div>
         <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/20 blur-[120px] rounded-full"></div>
      </div>

      {/* Sidebar */}
      <div className={`w-full md:w-[400px] flex flex-col bg-white/90 dark:bg-slate-900/40 backdrop-blur-3xl z-10 transition-transform duration-500 border-r border-slate-200 dark:border-slate-800 ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-8 pb-4">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <EBLogo className="w-12 h-12" />
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-none tracking-tighter">EB</h1>
                <p className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 mt-1">Ecosystem</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigate('/settings')} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:text-indigo-600 transition-all shadow-sm"><Settings size={20} /></button>
              <button onClick={() => auth.signOut()} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:text-red-500 transition-all shadow-sm"><LogOut size={20} /></button>
            </div>
          </div>

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input 
              type="text" placeholder="Search Encrypted Nodes..." 
              className="w-full pl-12 pr-4 py-4 bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-[24px] text-sm outline-none font-bold placeholder:text-slate-400 dark:text-white transition-all"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-3 custom-scrollbar">
          {users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())).map(u => {
            const isBlocked = profile?.blockedUsers?.includes(u.uid);
            const hasUnread = unreadUsers.has(u.uid);
            return (
              <motion.div 
                key={u.uid} 
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedUser(u)}
                className={`flex items-center gap-4 p-4 cursor-pointer rounded-[32px] transition-all border ${
                  selectedUser?.uid === u.uid 
                    ? 'bg-white dark:bg-slate-800 shadow-xl border-indigo-500/20' 
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/30 border-transparent'
                } ${isBlocked ? 'opacity-30 grayscale' : ''}`}
              >
                <div className="relative flex-shrink-0">
                  <img src={u.photoURL} className="w-14 h-14 rounded-[22px] object-cover shadow-lg border-2 border-white dark:border-slate-700" alt={u.name} />
                  {u.isOnline && !isBlocked && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-[4px] border-white dark:border-slate-900 rounded-full shadow-lg"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className={`font-black text-sm truncate ${u.uid === 'eb-assistant-bot' ? 'text-indigo-600' : 'text-slate-900 dark:text-white'}`}>{u.name}</h3>
                    <div className="flex items-center gap-2">
                       {hasUnread && <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_red]" />}
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{formatLastSeen(u.lastSeen, u.isOnline)}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold truncate italic opacity-80">{u.bio || "Secure Channel"}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col relative transition-all duration-500 ${selectedUser ? 'flex' : 'hidden md:flex'}`}>
        {selectedUser ? (
          <>
            <div className="p-6 bg-white/80 dark:bg-slate-900/60 backdrop-blur-3xl sticky top-0 z-30 flex items-center justify-between shadow-sm border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-5">
                <button onClick={() => setSelectedUser(null)} className="md:hidden text-slate-500 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={20} /></button>
                <div className="relative">
                  <img src={selectedUser.photoURL} className="w-12 h-12 rounded-[20px] object-cover shadow-xl border-2 border-white dark:border-slate-800" alt={selectedUser.name} />
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-[3px] border-white dark:border-slate-900 ${selectedUser.isOnline ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                </div>
                <div>
                  <h2 className="font-black text-lg text-slate-900 dark:text-white leading-none mb-1">{selectedUser.name}</h2>
                  <div className="flex items-center gap-2">
                    {remoteTyping ? (
                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest animate-pulse">Uplink active...</span>
                    ) : (
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{selectedUser.isOnline ? 'Authorized Online' : 'Node Offline'}</span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowMenu(!showMenu)} className="p-3 text-slate-400 hover:text-indigo-600 transition-colors bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700"><MoreVertical size={20} /></button>
              
              <AnimatePresence>
                {showMenu && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-6 top-24 w-60 bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-slate-200 dark:border-slate-800 p-3 z-50">
                    <button onClick={toggleBlock} className="w-full flex items-center gap-3 p-4 rounded-2xl text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all font-black text-[11px] uppercase tracking-widest">
                      {profile?.blockedUsers?.includes(selectedUser.uid) ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
                      {profile?.blockedUsers?.includes(selectedUser.uid) ? 'Restore Node' : 'Block Node'}
                    </button>
                    <button className="w-full flex items-center gap-3 p-4 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-black text-[11px] uppercase tracking-widest">
                      <Volume2 size={18} /> Silence
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-10 space-y-8 custom-scrollbar relative">
              {messages.map((m, idx) => {
                const isMe = m.senderId === user?.uid;
                const isAi = m.senderId === 'eb-assistant-bot';
                return (
                  <motion.div key={m.id || idx} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%] relative group`}>
                      <div 
                        onContextMenu={(e) => { e.preventDefault(); if (isMe) setContextMenuMessage(m); }}
                        onClick={() => { if (isMe) setContextMenuMessage(contextMenuMessage?.id === m.id ? null : m); }}
                        className={`px-6 py-4 rounded-[32px] text-[15px] font-semibold leading-relaxed cursor-pointer transition-all shadow-lg border ${
                          isMe ? 'bg-indigo-600 text-white rounded-tr-none border-indigo-500' : 
                          isAi ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-tl-none border-indigo-500/20 shadow-indigo-500/5' : 
                          'bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-tl-none border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {m.metadata?.url && <img src={m.metadata.url} className="rounded-2xl mb-4 max-h-80 w-full object-cover border-2 border-white/10 shadow-md" alt="Media" />}
                        <p>{m.text}</p>
                        {m.edited && <span className="text-[9px] opacity-40 ml-2 font-black italic">EDITED</span>}
                      </div>

                      <AnimatePresence>
                        {contextMenuMessage?.id === m.id && (
                          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className={`absolute z-40 bottom-full mb-3 flex gap-2 bg-white dark:bg-slate-800 p-2 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 ${isMe ? 'right-0' : 'left-0'}`}>
                            <button onClick={() => { setEditingMessage(m); setInputText(m.text); setContextMenuMessage(null); }} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-600 rounded-2xl"><Edit3 size={18} /></button>
                            <button onClick={() => handleDeleteMessage(m)} className="p-3 hover:bg-red-50 dark:hover:bg-slate-700 text-red-500 rounded-2xl"><Trash2 size={18} /></button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex items-center gap-2 mt-2 px-2">
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMe && (
                          <span className={`${m.seen ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-600'} transition-colors`}>
                            {m.seen ? <CheckCheck size={14} strokeWidth={3} /> : <Check size={14} strokeWidth={3} />}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {isAiProcessing && (
                <div className="flex justify-start">
                   <div className="bg-white dark:bg-slate-800 p-4 rounded-[28px] rounded-tl-none flex items-center gap-3 border border-indigo-500/20 shadow-sm">
                      <CircleDashed size={16} className="text-indigo-600 dark:text-indigo-400 animate-spin" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">EB Processor Active</span>
                   </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-8 py-8 z-30">
              <div className="max-w-4xl mx-auto flex flex-col gap-4">
                <AnimatePresence>
                  {editingMessage && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="flex items-center justify-between px-6 py-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-[24px] border border-indigo-200 dark:border-indigo-800 shadow-sm">
                      <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-widest"><Edit3 size={16} /> Patching Transmission</div>
                      <button onClick={() => {setEditingMessage(null); setInputText('');}} className="p-2 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-full text-indigo-600"><X size={16} /></button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.form onSubmit={handleSendMessage} className="relative bg-white dark:bg-slate-900 p-2.5 rounded-[42px] shadow-2xl border-2 border-slate-200 dark:border-slate-800">
                  <AnimatePresence>
                    {imagePreview && (
                      <div className="p-4 border-b border-slate-100 dark:border-slate-800 mb-2">
                        <div className="relative w-28 h-28">
                          <img src={imagePreview} className="w-full h-full object-cover rounded-3xl shadow-xl border-2 border-white/20" alt="Preview" />
                          <button onClick={() => {setImagePreview(null); setSelectedImage(null);}} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-2 shadow-2xl hover:scale-110 transition-transform"><X size={14} /></button>
                        </div>
                      </div>
                    )}
                  </AnimatePresence>
                  <div className="flex items-center gap-3">
                    <label className="p-4 text-slate-400 hover:text-indigo-600 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full"><ImageIcon size={24} /><input type="file" className="hidden" accept="image/*" onChange={e => {
                      if (e.target.files?.[0]) {
                        setSelectedImage(e.target.files[0]);
                        setImagePreview(URL.createObjectURL(e.target.files[0]));
                      }
                    }} /></label>
                    <input type="text" placeholder={editingMessage ? "Updating data..." : "Start transmission..."} className="flex-1 bg-transparent py-4 px-2 text-[15px] focus:outline-none dark:text-white placeholder:text-slate-400 font-bold" value={inputText} onChange={e => setInputText(e.target.value)} />
                    <button type="submit" disabled={!inputText.trim() && !selectedImage} className="bg-indigo-600 text-white p-5 rounded-[30px] shadow-xl shadow-indigo-500/30 hover:scale-105 active:scale-95 disabled:opacity-30 transition-all">
                      {editingMessage ? <Check size={24} strokeWidth={3} /> : <Send size={24} strokeWidth={3} />}
                    </button>
                  </div>
                </motion.form>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-16">
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="w-64 h-64 mb-12">
              <EBLogo className="w-full h-full" />
            </motion.div>
            <h2 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter mb-4">EB ECOSYSTEM</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm text-sm font-black uppercase tracking-[0.3em] opacity-40 leading-loose">Secure Uplink Required. Select a client to begin encrypted sync.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
