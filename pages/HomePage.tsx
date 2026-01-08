
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { db, rtdb, storage } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { ref, push, onValue, set, off, onDisconnect, remove } from 'firebase/database';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Search, Send, MoreVertical, LogOut, Settings, MessageCircle, Bot, Image as ImageIcon, Paperclip, X, Sparkles, User, Hash, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { UserProfile, Message } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { gemini } from '../geminiService';

const HomePage: React.FC = () => {
  const { profile, user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const AI_BOT: UserProfile = {
    uid: 'gemini-ai-bot',
    name: 'Gemini Advanced',
    email: 'ai@gemini.com',
    photoURL: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
    bio: 'Premium Multi-modal Intelligence. Try /draw.',
    lastSeen: Date.now(),
    isOnline: true,
    createdAt: 0
  };

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const userList: UserProfile[] = [];
        snapshot.forEach((doc) => { if (doc.id !== user?.uid) userList.push(doc.data() as UserProfile); });
        setUsers([AI_BOT, ...userList]);
      },
      (error) => {
        console.error("Users list listen failed:", error);
        if (error.code === 'permission-denied') {
          // If we can't list everyone, just show the bot
          setUsers([AI_BOT]);
        }
      }
    );
    return () => unsubscribe();
  }, [user]);

  // Typing logic
  useEffect(() => {
    if (!selectedUser || !user) return;
    const chatId = [user.uid, selectedUser.uid].sort().join('_');
    const typingRef = ref(rtdb, `typing/${chatId}/${selectedUser.uid}`);
    const myTypingRef = ref(rtdb, `typing/${chatId}/${user.uid}`);
    
    const unsubscribe = onValue(typingRef, 
      (snap) => setRemoteTyping(!!snap.val()),
      (err) => console.warn("Typing listen permission issue:", err)
    );
    
    onDisconnect(myTypingRef).remove().catch(() => {});
    
    return () => {
      off(typingRef);
      remove(myTypingRef).catch(() => {});
    };
  }, [selectedUser, user]);

  useEffect(() => {
    if (!selectedUser || !user) return;
    const chatId = [user.uid, selectedUser.uid].sort().join('_');
    const myTypingRef = ref(rtdb, `typing/${chatId}/${user.uid}`);
    if (inputText.length > 0) {
      set(myTypingRef, true).catch(() => {});
    } else {
      remove(myTypingRef).catch(() => {});
    }
  }, [inputText, selectedUser, user]);

  useEffect(() => {
    if (!selectedUser || !user) return;
    const chatId = [user.uid, selectedUser.uid].sort().join('_');
    const chatRef = ref(rtdb, `chats/${chatId}/messages`);
    const unsubscribe = onValue(chatRef, 
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const msgList: Message[] = Object.entries(data).map(([id, val]: any) => ({ id, ...val }));
          setMessages(msgList.sort((a, b) => a.timestamp - b.timestamp));
        } else setMessages([]);
      },
      (error) => {
        console.error("Messages listen failed:", error);
        if (error.code === 'permission-denied') {
          toast.error("Conversation access restricted.");
        }
      }
    );
    return () => unsubscribe();
  }, [selectedUser, user]);

  useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, remoteTyping]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedImage) || !selectedUser || !user) return;

    const currentText = inputText.trim();
    const currentImage = selectedImage;
    setInputText('');
    setSelectedImage(null);
    setImagePreview(null);

    const chatId = [user.uid, selectedUser.uid].sort().join('_');
    const chatRef = ref(rtdb, `chats/${chatId}/messages`);

    try {
      let imageUrl = '';
      if (currentImage) {
        const storageRef = sRef(storage, `chats/${chatId}/${Date.now()}_${currentImage.name}`);
        await uploadBytes(storageRef, currentImage);
        imageUrl = await getDownloadURL(storageRef);
      }

      if (selectedUser.uid === 'gemini-ai-bot' && currentText.startsWith('/draw ')) {
        const prompt = currentText.replace('/draw ', '');
        await set(push(chatRef), { senderId: user.uid, text: currentText, timestamp: Date.now(), type: 'text' });
        setIsAiProcessing(true);
        const generatedImg = await gemini.generateImage(prompt);
        setIsAiProcessing(false);
        await set(push(chatRef), { 
          senderId: 'gemini-ai-bot', 
          text: `Here is your creation: ${prompt}`, 
          timestamp: Date.now(), 
          type: 'ai', 
          metadata: { url: generatedImg || '' } 
        });
        return;
      }

      await set(push(chatRef), {
        senderId: user.uid,
        text: currentText,
        timestamp: Date.now(),
        type: imageUrl ? 'image' : 'text',
        metadata: imageUrl ? { url: imageUrl } : null
      });

      if (selectedUser.uid === 'gemini-ai-bot') {
        setIsAiProcessing(true);
        const aiReply = await gemini.getAiResponse(currentText, imageUrl);
        setIsAiProcessing(false);
        await set(push(chatRef), { senderId: 'gemini-ai-bot', text: aiReply, timestamp: Date.now(), type: 'ai' });
      }
    } catch (err: any) {
      console.error("Send failed:", err);
      toast.error("Failed to send: Permissions required.");
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0 }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
      {/* Dynamic Background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500 rounded-full blur-[120px] animate-pulse"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-purple-500 rounded-full blur-[100px] animate-pulse" style={{animationDelay: '1s'}}></div>
      </div>

      {/* Sidebar */}
      <div className={`w-full md:w-80 lg:w-[380px] flex flex-col glass z-10 transition-all duration-500 ease-in-out ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 pb-2">
          <div className="flex items-center justify-between mb-6">
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex items-center gap-2">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/40">
                <Sparkles size={20} />
              </div>
              <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400">Gemini Pro</h1>
            </motion.div>
            <div className="flex gap-2">
              <motion.button whileHover={{ rotate: 15 }} onClick={() => navigate('/settings')} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 hover:text-indigo-600 transition-all">
                <Settings size={18} />
              </motion.button>
              <button onClick={() => auth.signOut()} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 hover:text-red-500 transition-all">
                <LogOut size={18} />
              </button>
            </div>
          </div>

          <div className="relative group">
            <Search className="absolute left-3 top-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input 
              type="text" placeholder="Search conversations..." 
              className="w-full pl-10 pr-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 border border-transparent focus:border-indigo-500/50 rounded-2xl text-sm outline-none transition-all duration-300 font-medium"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex-1 overflow-y-auto px-4 py-4 space-y-2 custom-scrollbar"
        >
          {users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
            <motion.div 
              key={u.uid} 
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedUser(u)}
              className={`flex items-center gap-4 p-4 cursor-pointer rounded-2xl transition-all duration-300 ${
                selectedUser?.uid === u.uid 
                  ? 'bg-white dark:bg-slate-800 shadow-xl shadow-indigo-500/10 border border-indigo-500/20' 
                  : 'hover:bg-white/40 dark:hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              <div className="relative flex-shrink-0">
                <img src={u.photoURL} className="w-12 h-12 rounded-2xl object-cover shadow-inner" />
                {u.isOnline && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-[3px] border-white dark:border-slate-800 rounded-full shadow-lg"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <h3 className={`font-bold text-sm truncate ${u.uid === 'gemini-ai-bot' ? 'text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5' : 'text-slate-800 dark:text-slate-100'}`}>
                    {u.uid === 'gemini-ai-bot' && <Zap size={14} fill="currentColor" />}
                    {u.name}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                    {u.uid === 'gemini-ai-bot' ? 'Core' : 'User'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1 opacity-70 font-medium">{u.bio || "Active status"}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col relative transition-all duration-500 ${selectedUser ? 'flex' : 'hidden md:flex'}`}>
        {selectedUser ? (
          <>
            {/* Glass Header */}
            <div className="p-4 glass sticky top-0 z-20 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <motion.button whileTap={{ x: -5 }} onClick={() => setSelectedUser(null)} className="md:hidden text-slate-500 p-2 hover:bg-slate-100 rounded-full">
                  <X size={20} />
                </motion.button>
                <div className="relative">
                  <img src={selectedUser.photoURL} className="w-10 h-10 rounded-xl object-cover ring-2 ring-indigo-500/20 shadow-lg" />
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${selectedUser.isOnline ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                </div>
                <div>
                  <h2 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    {selectedUser.name}
                    {selectedUser.uid === 'gemini-ai-bot' && <span className="bg-indigo-600/10 text-indigo-600 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tight">PRO</span>}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${selectedUser.isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div>
                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">{selectedUser.isOnline ? 'Connected' : 'Offline'}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                 <button className="p-2.5 text-slate-400 hover:text-indigo-600 transition-colors"><Paperclip size={20} /></button>
                 <button className="p-2.5 text-slate-400 hover:text-indigo-600 transition-colors"><MoreVertical size={20} /></button>
              </div>
            </div>

            {/* Messages Display */}
            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 custom-scrollbar bg-white/5 dark:bg-slate-900/5 backdrop-blur-[2px]">
              <AnimatePresence mode="popLayout">
                {messages.map((m, idx) => {
                  const isMe = m.senderId === user?.uid;
                  const isAi = m.senderId === 'gemini-ai-bot';
                  return (
                    <motion.div 
                      key={m.id || idx} 
                      layout
                      initial={{ opacity: 0, y: 30, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                        <div className={`group relative px-5 py-3.5 rounded-3xl shadow-sm text-sm leading-relaxed transition-all duration-300 ${
                          isMe 
                            ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-500/20' 
                            : isAi 
                              ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-indigo-500/20 ring-4 ring-indigo-500/5 shadow-lg shadow-indigo-500/5' 
                              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700 shadow-sm'
                        }`}>
                          {m.metadata?.url && (
                            <motion.img 
                              layoutId={`img-${m.id}`}
                              src={m.metadata.url} 
                              className="rounded-2xl mb-3 max-h-72 w-full object-cover cursor-zoom-in hover:brightness-105 transition-all shadow-md" 
                              onClick={() => window.open(m.metadata?.url)} 
                            />
                          )}
                          {m.text && (
                            <div className="relative">
                              {isAi && <Bot size={14} className="mb-2 text-indigo-500 opacity-60" />}
                              <p className="font-medium">{m.text}</p>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] mt-1.5 text-slate-400 font-medium px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {remoteTyping && (
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex justify-start">
                   <div className="bg-slate-100 dark:bg-slate-800/50 px-4 py-2 rounded-2xl rounded-tl-none text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border border-slate-200/50 dark:border-slate-700/50">
                     <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                     </span>
                     User is typing
                   </div>
                </motion.div>
              )}

              {isAiProcessing && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="bg-white dark:bg-slate-800 px-5 py-4 rounded-3xl rounded-tl-none border border-indigo-500/20 shadow-lg shadow-indigo-500/5 flex flex-col gap-3 min-w-[200px]">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/10 rounded-xl">
                        <Bot size={18} className="text-indigo-600 animate-pulse" />
                      </div>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">AI Thinking</span>
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full w-full shimmer"></div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full w-[80%] shimmer"></div>
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Smart Floating Input */}
            <div className="px-6 py-6 z-20">
              <motion.form 
                onSubmit={handleSendMessage} 
                className="max-w-4xl mx-auto relative glass p-2 rounded-[32px] shadow-2xl shadow-indigo-500/10 border border-white dark:border-slate-800"
              >
                <AnimatePresence>
                  {imagePreview && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="p-2 border-b border-slate-100 dark:border-slate-800 mb-2 overflow-hidden">
                      <div className="relative w-24 h-24">
                        <img src={imagePreview} className="w-full h-full object-cover rounded-2xl border-2 border-indigo-500/20 shadow-md" />
                        <button onClick={() => {setImagePreview(null); setSelectedImage(null);}} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg ring-4 ring-white dark:ring-slate-900 transition-transform hover:scale-110"><X size={14} /></button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    <label className="p-3.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-all">
                      <ImageIcon size={22} />
                      <input type="file" className="hidden" accept="image/*" onChange={e => {
                        if (e.target.files?.[0]) {
                          setSelectedImage(e.target.files[0]);
                          setImagePreview(URL.createObjectURL(e.target.files[0]));
                        }
                      }} />
                    </label>
                  </div>
                  
                  <input 
                    type="text" 
                    placeholder={selectedUser.uid === 'gemini-ai-bot' ? "Ask anything or /draw..." : "Type a smart message..."}
                    className="flex-1 bg-transparent py-4 px-2 text-sm focus:outline-none dark:text-white placeholder-slate-400 font-semibold"
                    value={inputText} onChange={e => setInputText(e.target.value)}
                  />

                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit" 
                    disabled={!inputText.trim() && !selectedImage}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-3xl transition-all shadow-xl shadow-indigo-500/30 disabled:opacity-40 disabled:shadow-none"
                  >
                    <Send size={22} />
                  </motion.button>
                </div>
              </motion.form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="w-40 h-40 bg-indigo-100/50 dark:bg-indigo-500/10 rounded-[48px] flex items-center justify-center mb-8 relative"
            >
              <div className="absolute inset-0 bg-indigo-500 rounded-[48px] blur-3xl opacity-20 animate-pulse"></div>
              <MessageCircle size={80} strokeWidth={1.5} className="text-indigo-600 dark:text-indigo-400 z-10" />
            </motion.div>
            <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">Select a Chat</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-3 max-w-sm text-lg font-medium leading-relaxed opacity-70">Experience the future of communication with Gemini Advanced intelligence.</p>
            <div className="mt-8 flex gap-3">
               <span className="px-4 py-2 bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-bold uppercase tracking-widest border border-indigo-500/10">Ultra Fast</span>
               <span className="px-4 py-2 bg-purple-50 dark:bg-slate-800 text-purple-600 dark:text-purple-400 rounded-full text-[10px] font-bold uppercase tracking-widest border border-purple-500/10">AI Native</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
