
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { db, rtdb, storage } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { ref, push, onValue, set, off, onDisconnect, remove } from 'firebase/database';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Search, Send, MoreVertical, LogOut, Settings, MessageCircle, Bot, Image as ImageIcon, Paperclip, X, Smile } from 'lucide-react';
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
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const AI_BOT: UserProfile = {
    uid: 'gemini-ai-bot',
    name: 'Gemini Assistant',
    email: 'ai@gemini.com',
    photoURL: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
    bio: 'Multi-modal AI Assistant. Use /draw for images.',
    lastSeen: Date.now(),
    isOnline: true,
    createdAt: 0
  };

  useEffect(() => {
    const q = query(collection(db, 'users'));
    return onSnapshot(q, (snapshot) => {
      const userList: UserProfile[] = [];
      snapshot.forEach((doc) => { if (doc.id !== user?.uid) userList.push(doc.data() as UserProfile); });
      setUsers([AI_BOT, ...userList]);
    });
  }, [user]);

  // Typing Indicator Logic
  useEffect(() => {
    if (!selectedUser || !user) return;
    const chatId = [user.uid, selectedUser.uid].sort().join('_');
    const typingRef = ref(rtdb, `typing/${chatId}/${selectedUser.uid}`);
    const myTypingRef = ref(rtdb, `typing/${chatId}/${user.uid}`);

    const unsubscribe = onValue(typingRef, (snap) => setRemoteTyping(!!snap.val()));
    onDisconnect(myTypingRef).remove();

    return () => {
      off(typingRef);
      remove(myTypingRef);
    };
  }, [selectedUser, user]);

  useEffect(() => {
    if (!selectedUser || !user) return;
    const chatId = [user.uid, selectedUser.uid].sort().join('_');
    const myTypingRef = ref(rtdb, `typing/${chatId}/${user.uid}`);
    if (inputText.length > 0) {
      set(myTypingRef, true);
    } else {
      remove(myTypingRef);
    }
  }, [inputText, selectedUser, user]);

  useEffect(() => {
    if (!selectedUser || !user) return;
    const chatId = [user.uid, selectedUser.uid].sort().join('_');
    const chatRef = ref(rtdb, `chats/${chatId}/messages`);
    return onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgList: Message[] = Object.entries(data).map(([id, val]: any) => ({ id, ...val }));
        setMessages(msgList.sort((a, b) => a.timestamp - b.timestamp));
      } else setMessages([]);
    });
  }, [selectedUser, user]);

  useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, remoteTyping]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
      setImagePreview(URL.createObjectURL(e.target.files[0]));
    }
  };

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

    let imageUrl = '';
    if (currentImage) {
      const storageRef = sRef(storage, `chats/${chatId}/${Date.now()}_${currentImage.name}`);
      await uploadBytes(storageRef, currentImage);
      imageUrl = await getDownloadURL(storageRef);
    }

    // AI Command Check
    if (selectedUser.uid === 'gemini-ai-bot' && currentText.startsWith('/draw ')) {
      const prompt = currentText.replace('/draw ', '');
      await set(push(chatRef), { senderId: user.uid, text: currentText, timestamp: Date.now(), type: 'text' });
      setIsTyping(true);
      const generatedImg = await gemini.generateImage(prompt);
      setIsTyping(false);
      if (generatedImg) {
        await set(push(chatRef), { senderId: 'gemini-ai-bot', text: `Here is your: ${prompt}`, timestamp: Date.now(), type: 'ai', metadata: { url: generatedImg } });
      } else {
        await set(push(chatRef), { senderId: 'gemini-ai-bot', text: "Sorry, I couldn't generate that image.", timestamp: Date.now(), type: 'ai' });
      }
      return;
    }

    const newMsgRef = push(chatRef);
    await set(newMsgRef, {
      senderId: user.uid,
      text: currentText,
      timestamp: Date.now(),
      type: imageUrl ? 'image' : 'text',
      metadata: imageUrl ? { url: imageUrl } : null
    });

    if (selectedUser.uid === 'gemini-ai-bot') {
      setIsTyping(true);
      const aiReply = await gemini.getAiResponse(currentText, imageUrl);
      setIsTyping(false);
      await set(push(chatRef), { senderId: 'gemini-ai-bot', text: aiReply, timestamp: Date.now(), type: 'ai' });
    }
  };

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar */}
      <div className={`w-full md:w-80 lg:w-96 flex flex-col border-r bg-white ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={profile?.photoURL} className="w-10 h-10 rounded-full border" />
            <h2 className="font-bold text-slate-800 hidden sm:block">Chats</h2>
          </div>
          <div className="flex gap-1">
            <button onClick={() => navigate('/settings')} className="p-2 hover:bg-slate-100 rounded-full"><Settings size={18} /></button>
            <button onClick={() => auth.signOut()} className="p-2 hover:bg-slate-100 rounded-full"><LogOut size={18} /></button>
          </div>
        </div>
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input 
              type="text" placeholder="Search friends..." 
              className="w-full pl-9 pr-4 py-2 bg-slate-100 rounded-xl text-sm focus:outline-none"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredUsers.map(u => (
            <div 
              key={u.uid} onClick={() => setSelectedUser(u)}
              className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 border-l-4 transition-all ${selectedUser?.uid === u.uid ? 'bg-indigo-50 border-indigo-600' : 'border-transparent'}`}
            >
              <div className="relative">
                <img src={u.photoURL} className="w-12 h-12 rounded-full object-cover shadow-sm" />
                {u.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold text-sm truncate ${u.uid === 'gemini-ai-bot' ? 'text-indigo-600' : ''}`}>{u.name}</h3>
                <p className="text-xs text-slate-500 truncate">{u.bio || "Active"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Area */}
      <div className={`flex-1 flex flex-col bg-[#e5ddd5] dark:bg-slate-900 ${selectedUser ? 'flex' : 'hidden md:flex'}`}>
        {selectedUser ? (
          <>
            <div className="p-3 bg-white border-b flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedUser(null)} className="md:hidden text-slate-500"><X size={24} /></button>
                <img src={selectedUser.photoURL} className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <h2 className="font-bold text-sm text-slate-800">{selectedUser.name}</h2>
                  <p className="text-[10px] text-green-600">{selectedUser.isOnline ? 'online' : 'offline'}</p>
                </div>
              </div>
              <div className="flex gap-4 text-slate-400"><ImageIcon size={20} /><MoreVertical size={20} /></div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-3 py-2 rounded-xl text-sm shadow-sm ${m.senderId === user?.uid ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none'}`}>
                    {m.metadata?.url && (
                      <img src={m.metadata.url} className="rounded-lg mb-2 max-h-60 w-full object-cover cursor-pointer hover:opacity-90" onClick={() => window.open(m.metadata?.url)} />
                    )}
                    {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
                    <p className={`text-[9px] mt-1 text-right ${m.senderId === user?.uid ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {remoteTyping && (
                <div className="flex justify-start">
                  <div className="bg-white px-3 py-2 rounded-xl rounded-tl-none text-xs text-slate-400 italic">typing...</div>
                </div>
              )}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white px-3 py-2 rounded-xl rounded-tl-none flex gap-1 items-center">
                    <Bot size={14} className="text-indigo-600 animate-pulse" />
                    <span className="w-1 h-1 bg-slate-300 rounded-full animate-bounce"></span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t space-y-2">
              <AnimatePresence>
                {imagePreview && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="relative inline-block">
                    <img src={imagePreview} className="w-20 h-20 object-cover rounded-lg border" />
                    <button onClick={() => {setImagePreview(null); setSelectedImage(null);}} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X size={12} /></button>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex items-center gap-2">
                <label className="p-2 text-slate-400 hover:text-indigo-600 cursor-pointer">
                  <Paperclip size={20} />
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
                </label>
                <input 
                  type="text" placeholder={selectedUser.uid === 'gemini-ai-bot' ? "Try /draw cute cat" : "Message..."}
                  className="flex-1 bg-slate-100 py-2.5 px-4 rounded-full text-sm focus:outline-none"
                  value={inputText} onChange={e => setInputText(e.target.value)}
                />
                <button type="submit" className="bg-indigo-600 text-white p-2.5 rounded-full hover:bg-indigo-700 transition-all">
                  <Send size={20} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <MessageCircle size={60} strokeWidth={1} className="mb-4" />
            <p className="text-lg font-medium">Select a friend to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
