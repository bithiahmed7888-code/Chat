export enum MessageType {
  USER = 'USER',
  SYSTEM = 'SYSTEM',
  AI = 'AI',
}

export enum UserRole {
  HOST = 'HOST',
  MANAGER = 'MANAGER',
  GUEST = 'GUEST',
}

export interface Reaction {
  emoji: string;
  senderId: string;
  senderName: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  type: MessageType;
  reactions: Reaction[];
}

export interface Participant {
  id: string;
  name: string;
  role: UserRole;
  isHost: boolean; // Kept for convenience, derived from role === HOST
}

export interface PeerState {
  peerId: string;
  stream: MediaStream | null;
}
