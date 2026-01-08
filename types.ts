
export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  dob?: string;
  photoURL: string;
  bio: string;
  lastSeen: number;
  isOnline: boolean;
  createdAt: number;
  blockedUsers?: string[]; // IDs of users this user has blocked
  settings?: {
    showOnlineStatus: boolean;
    readReceipts: boolean;
    notificationsEnabled: boolean;
  };
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  seen: boolean;
  type: 'text' | 'image' | 'voice' | 'ai';
  edited?: boolean;
  reactions?: Record<string, string>; // userId: emoji
  metadata?: {
    width?: number;
    height?: number;
    url?: string;
  };
}

export interface ChatSession {
  chatId: string;
  participants: string[];
  lastMessage?: string;
  lastTimestamp?: number;
}
