
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
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  seen: boolean;
  type: 'text' | 'image' | 'voice' | 'ai';
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

export interface AppState {
  currentUser: UserProfile | null;
  loading: boolean;
}
