import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter as Router, Route, Routes, useNavigate, useParams, useLocation } from 'react-router-dom';
import Peer from 'peerjs';
import { v4 as uuidv4 } from 'uuid';
import { 
  Copy, MessageSquare, Users, LogOut, Menu, X, KeyRound, 
  ArrowRight, Loader2, AlertCircle, MoreVertical, Shield, 
  ShieldAlert, UserMinus, Ban, ShieldCheck 
} from 'lucide-react';
import Chat from './components/Chat';
import { ChatMessage, MessageType, Participant, Reaction, UserRole } from './types';

const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const Lobby = () => {
  const navigate = useNavigate();
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRoom = () => {
    const code = generateRoomCode();
    // Pass state to indicate this user is the Host
    navigate(`/room/${code}`, { state: { isHost: true } });
  };

  const checkRoomExists = (code: string): Promise<boolean> => {
    return new Promise((resolve) => {
        const testId = `gemini-chat-host-${code}`;
        // Use debug: 0 to minimize logs during this check
        const peer = new Peer(testId, {
            config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
            debug: 0 
        });
        
        let resolved = false;

        peer.on('open', () => {
            if (resolved) return;
            resolved = true;
            peer.destroy();
            resolve(false); // We claimed it, so room DOES NOT exist
        });

        peer.on('error', (err: any) => {
            if (resolved) return;
            resolved = true;
            // If ID is unavailable, it means a Host exists
            if (err.type === 'unavailable-id') {
                peer.destroy(); 
                resolve(true);
            } else {
                if (!peer.destroyed) peer.destroy();
                resolve(false);
            }
        });
        
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                if (!peer.destroyed) peer.destroy();
                resolve(false);
            }
        }, 5000);
    });
  };

  const joinRoom = async () => {
    const code = roomCodeInput.trim().toUpperCase();
    if (code.length < 6) return;
    
    setIsLoading(true);
    setError(null);

    try {
        const exists = await checkRoomExists(code);
        if (exists) {
            // Pass state to indicate this user is a Guest
            navigate(`/room/${code}`, { state: { isHost: false } });
        } else {
            setError("Room not found. Please check the code.");
        }
    } catch (err) {
        setError("Unable to connect. Please try again.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat bg-blend-overlay bg-slate-950/90">
      <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-700 shadow-2xl animate-fade-in">
        <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl mb-4 shadow-lg">
                <MessageSquare className="w-8 h-8 text-white" />
            </div>
          <h1 className="text-3xl font-bold text-white mb-2">Gemini Chat</h1>
          <p className="text-slate-400">Secure, text-based messaging with AI.</p>
        </div>

        <div className="space-y-6">
          <button
            onClick={createRoom}
            disabled={isLoading}
            className="w-full py-4 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white rounded-xl font-semibold text-lg shadow-lg shadow-brand-500/20 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <KeyRound className="w-5 h-5" />
            Create New Room
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-900/80 text-slate-500">or enter code</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2 relative">
                <input
                type="text"
                placeholder="ENTER 6-DIGIT CODE"
                maxLength={6}
                value={roomCodeInput}
                disabled={isLoading}
                onChange={(e) => {
                    setRoomCodeInput(e.target.value.toUpperCase());
                    setError(null);
                }}
                className={`flex-1 bg-slate-800 border ${error ? 'border-red-500/50 focus:ring-red-500' : 'border-slate-700 focus:ring-brand-500'} text-white text-center tracking-widest font-mono text-lg rounded-xl px-4 focus:ring-2 focus:outline-none uppercase placeholder:text-sm placeholder:tracking-normal transition-all`}
                />
                <button
                onClick={joinRoom}
                disabled={roomCodeInput.length < 6 || isLoading}
                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center justify-center min-w-[60px]"
                >
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : <ArrowRight className="w-6 h-6" />}
                </button>
            </div>
            
            {error && (
                <div className="flex items-center justify-center gap-2 text-red-400 text-sm animate-slide-up-fade">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Room = () => {
  const { id: roomCode } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [peerId, setPeerId] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [kickReason, setKickReason] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  // Constants
  const HOST_PREFIX = 'gemini-chat-host-';
  const hostPeerId = `${HOST_PREFIX}${roomCode}`;

  // Refs
  const peerInstance = useRef<Peer | null>(null);
  const connectionsRef = useRef<{ [key: string]: any }>({});
  const bannedPeersRef = useRef<Set<string>>(new Set());

  // Cleanup
  const cleanup = useCallback(() => {
    if (peerInstance.current) {
      peerInstance.current.destroy();
      peerInstance.current = null;
    }
    connectionsRef.current = {};
    setMessages([]);
    setParticipants([]);
    setTypingUsers(new Set());
    bannedPeersRef.current.clear();
  }, []);

  // --- Participation Logic ---

  const addParticipant = (id: string, role: UserRole) => {
    setParticipants(prev => {
        const existing = prev.find(p => p.id === id);
        if (existing) {
            // Update role if changed
            if (existing.role !== role) {
                return prev.map(p => p.id === id ? { ...p, role, isHost: role === UserRole.HOST } : p);
            }
            return prev;
        }
        
        let name = 'User';
        if (role === UserRole.HOST) name = 'Host';
        else name = `User ${id.substring(0, 4)}`;

        return [...prev, { id, name, role, isHost: role === UserRole.HOST }];
    });
  };

  const removeParticipant = (id: string) => {
      setParticipants(prev => prev.filter(p => p.id !== id));
      setTypingUsers(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
  };

  // --- Host Broadcast Logic ---

  const broadcastParticipantList = () => {
    const myId = peerInstance.current?.id;
    if (!myId) return;

    // We need to construct the list based on current state to preserve names/roles
    // But ensure we only include currently connected peers + host
    setParticipants(currentList => {
        const connectedIds = Object.keys(connectionsRef.current);
        const activeIds = new Set([myId, ...connectedIds]);

        // Filter out disconnected, keep existing data (roles/names)
        const updatedList = currentList.filter(p => activeIds.has(p.id));

        // Add any new connections that might not be in state yet (fallback)
        connectedIds.forEach(cid => {
            if (!updatedList.find(p => p.id === cid)) {
                updatedList.push({ 
                    id: cid, 
                    name: `User ${cid.substring(0, 4)}`, 
                    role: UserRole.GUEST, 
                    isHost: false 
                });
            }
        });

        // Broadcast this definitive list to everyone
        Object.values(connectionsRef.current).forEach((conn: any) => {
            if (conn.open) {
                conn.send({ type: 'SYNC_PARTICIPANTS', payload: updatedList });
            }
        });

        return updatedList;
    });
  };

  const broadcastData = (data: any, excludePeerId?: string) => {
    Object.values(connectionsRef.current).forEach((conn: any) => {
        if (conn.open && conn.peer !== excludePeerId) {
            conn.send(data);
        }
    });
  };

  // --- Connection Handling ---

  const handleDataConnection = (conn: any) => {
      // 1. Check Ban List (Host only)
      if (peerInstance.current?.id === hostPeerId) {
          if (bannedPeersRef.current.has(conn.peer)) {
              console.log(`Rejected connection from banned peer: ${conn.peer}`);
              conn.on('open', () => {
                  conn.send({ type: 'KICKED', reason: 'You are banned from this room.' });
                  setTimeout(() => conn.close(), 500);
              });
              return;
          }
      }

      connectionsRef.current[conn.peer] = conn;

      conn.on('open', () => {
          const isRemoteHost = conn.peer === hostPeerId;
          // Default role for new joiners is GUEST, unless they are the Host
          addParticipant(conn.peer, isRemoteHost ? UserRole.HOST : UserRole.GUEST);
          
          if (peerInstance.current?.id === hostPeerId) {
             broadcastParticipantList();
          }
      });

      conn.on('data', (data: any) => {
          if (data.type === 'CHAT') {
              const message = data.payload;
              setMessages(prev => {
                  if (prev.some(m => m.id === message.id)) return prev;
                  return [...prev, message];
              });
              if (peerInstance.current?.id === hostPeerId) {
                  broadcastData(data, conn.peer);
              }
          } else if (data.type === 'SYNC_PARTICIPANTS') {
              setParticipants(data.payload);
          } else if (data.type === 'REACTION') {
              const { messageId, emoji, senderId, senderName, action } = data.payload;
              setMessages(prev => prev.map(msg => {
                  if (msg.id === messageId) {
                      let newReactions = msg.reactions || [];
                      if (action === 'remove') {
                          newReactions = newReactions.filter(r => !(r.senderId === senderId && r.emoji === emoji));
                      } else {
                          if (!newReactions.some(r => r.senderId === senderId && r.emoji === emoji)) {
                             newReactions = [...newReactions, { emoji, senderId, senderName }];
                          }
                      }
                      return { ...msg, reactions: newReactions };
                  }
                  return msg;
              }));
              if (peerInstance.current?.id === hostPeerId) {
                  broadcastData(data, conn.peer);
              }
          } else if (data.type === 'TYPING') {
              const { userId, isTyping } = data.payload;
              setTypingUsers(prev => {
                  const next = new Set(prev);
                  if (isTyping) next.add(userId);
                  else next.delete(userId);
                  return next;
              });
              
              // Relay if host
              if (peerInstance.current?.id === hostPeerId) {
                  broadcastData(data, conn.peer);
              }
          } else if (data.type === 'KICKED') {
              // Received by the victim
              setKickReason(data.reason || 'You have been kicked.');
              cleanup(); // Disconnect self
          } else if (data.type === 'ADMIN_REQUEST') {
              // Host receives request from Manager
              if (peerInstance.current?.id === hostPeerId) {
                  handleAdminRequest(data.payload, conn.peer);
              }
          }
      });
      
      conn.on('close', () => {
           delete connectionsRef.current[conn.peer];
           if (peerInstance.current?.id === hostPeerId) {
               broadcastParticipantList();
           } else {
               removeParticipant(conn.peer);
           }
      });

      conn.on('error', () => { /* Handle error silently */ });
  };

  // --- Admin Actions (Host Logic) ---

  const executeAdminAction = (action: string, targetId: string) => {
      // Logic executed ONLY by the Host
      if (peerInstance.current?.id !== hostPeerId) return;

      const conn = connectionsRef.current[targetId];

      switch (action) {
          case 'PROMOTE':
              setParticipants(prev => {
                  const updated = prev.map(p => p.id === targetId ? { ...p, role: UserRole.MANAGER } : p);
                  // Broadcast manually inside here to ensure state consistency
                  setTimeout(broadcastParticipantList, 0); 
                  return updated;
              });
              break;
          case 'DEMOTE':
              setParticipants(prev => {
                  const updated = prev.map(p => p.id === targetId ? { ...p, role: UserRole.GUEST } : p);
                  setTimeout(broadcastParticipantList, 0);
                  return updated;
              });
              break;
          case 'KICK':
              if (conn && conn.open) {
                  conn.send({ type: 'KICKED', reason: 'You have been kicked by an admin.' });
                  setTimeout(() => conn.close(), 500);
              }
              break;
          case 'BAN':
              bannedPeersRef.current.add(targetId);
              if (conn && conn.open) {
                  conn.send({ type: 'KICKED', reason: 'You have been banned from this room.' });
                  setTimeout(() => conn.close(), 500);
              }
              break;
      }
  };

  const handleAdminRequest = (payload: { action: string, targetId: string }, requesterId: string) => {
      // 1. Verify Requester is at least a Manager
      const requester = participants.find(p => p.id === requesterId);
      if (!requester || (requester.role !== UserRole.MANAGER && requester.role !== UserRole.HOST)) {
          console.warn("Unauthorized admin request");
          return;
      }

      // 2. Verify Target (Managers cannot kick Host or other Managers)
      const target = participants.find(p => p.id === payload.targetId);
      if (!target) return;

      if (target.role === UserRole.HOST) return; // Never touch host
      if (requester.role === UserRole.MANAGER && target.role === UserRole.MANAGER) return; // Manager vs Manager

      // 3. Execute
      executeAdminAction(payload.action, payload.targetId);
  };

  // --- UI Triggers for Actions ---

  const triggerAction = (action: 'PROMOTE' | 'DEMOTE' | 'KICK' | 'BAN', targetId: string) => {
      setActiveMenuId(null); // Close menu
      
      if (isHost) {
          // Host executes directly
          executeAdminAction(action, targetId);
      } else {
          // Manager sends request to Host
          const hostConn = connectionsRef.current[hostPeerId];
          if (hostConn && hostConn.open) {
              hostConn.send({
                  type: 'ADMIN_REQUEST',
                  payload: { action, targetId }
              });
          }
      }
  };

  const getMyRole = (): UserRole => {
      if (isHost) return UserRole.HOST;
      const me = participants.find(p => p.id === peerId);
      return me ? me.role : UserRole.GUEST;
  };

  // --- Initial Setup ---

  const connectToHost = (peer: Peer, targetHostId: string) => {
      const conn = peer.connect(targetHostId, { reliable: true });
      handleDataConnection(conn);
  };

  useEffect(() => {
    if (!roomCode) return;

    const setupGuest = () => {
        const guestPeer = new Peer(undefined, {
            config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
        });

        guestPeer.on('open', (myId) => {
            console.log('Connected as Guest:', myId);
            setPeerId(myId);
            setIsHost(false);
            addParticipant(myId, UserRole.GUEST);
            connectToHost(guestPeer, hostPeerId);
        });
        
        guestPeer.on('connection', (conn) => handleDataConnection(conn));
        
        // Handle guest errors
        guestPeer.on('error', (err) => {
             console.log('Guest peer error:', err.type);
        });

        peerInstance.current = guestPeer;
    };

    const setupHost = () => {
        const peer = new Peer(hostPeerId, {
            config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
            debug: 1
        });

        peer.on('open', (id) => {
            console.log('Connected as Host:', id);
            setPeerId(id);
            setIsHost(true);
            addParticipant(id, UserRole.HOST);
        });

        peer.on('error', (err: any) => {
            if (err.type === 'unavailable-id') {
                // Host ID is taken, so a host already exists.
                // We shouldn't be here if we checked correctly in Lobby, but handle fallback gracefully.
                console.log('Host ID taken, falling back to guest.');
                peer.destroy();
                setupGuest();
            } else {
                console.error('Host Peer Error:', err);
            }
        });

        peer.on('connection', (conn) => handleDataConnection(conn));
        peerInstance.current = peer;
    };

    const initPeer = () => {
        if (peerInstance.current) return;
        
        // Check state passed from Lobby
        const state = location.state as { isHost?: boolean } | null;
        // If state says we are NOT host (Guest), skip Host attempt directly.
        // If state is undefined (page reload), assume Host attempt first (fallback logic).
        if (state?.isHost === false) {
            setupGuest();
        } else {
            setupHost();
        }
    };

    initPeer();
    return cleanup;
  }, [roomCode, cleanup, location.state]); // Added location.state dependency

  const sendMessage = (text: string, type: MessageType = MessageType.USER) => {
      const me = participants.find(p => p.id === peerId);
      const myName = me ? me.name : (isHost ? 'Host' : 'User');

      const newMessage: ChatMessage = {
          id: uuidv4(),
          senderId: peerId,
          senderName: type === MessageType.AI ? 'Gemini' : myName,
          text,
          timestamp: Date.now(),
          type,
          reactions: []
      };

      setMessages(prev => [...prev, newMessage]);
      broadcastData({ type: 'CHAT', payload: newMessage });
  };

  const handleTyping = (isTyping: boolean) => {
      const payload = { userId: peerId, isTyping };
      // Update local logic if needed, but primarily broadcast
      broadcastData({ type: 'TYPING', payload });
  };

  const handleReaction = (messageId: string, emoji: string) => {
      const me = participants.find(p => p.id === peerId);
      const senderName = me ? me.name : 'User';
      let action: 'add' | 'remove' = 'add';

      setMessages(prev => prev.map(msg => {
          if (msg.id === messageId) {
              const hasReacted = msg.reactions?.some(r => r.senderId === peerId && r.emoji === emoji);
              action = hasReacted ? 'remove' : 'add';
              
              let newReactions = msg.reactions || [];
              if (action === 'remove') {
                  newReactions = newReactions.filter(r => !(r.senderId === peerId && r.emoji === emoji));
              } else {
                  newReactions = [...newReactions, { emoji, senderId: peerId, senderName }];
              }
              return { ...msg, reactions: newReactions };
          }
          return msg;
      }));

      broadcastData({
          type: 'REACTION',
          payload: { messageId, emoji, senderId: peerId, senderName, action }
      });
  };

  const copyCode = () => {
      if (roomCode) {
        navigator.clipboard.writeText(roomCode);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }
  };

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (!(event.target as Element).closest('.user-menu-trigger')) {
            setActiveMenuId(null);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getTypingNames = () => {
    const names: string[] = [];
    typingUsers.forEach(id => {
        // Don't show ourselves
        if (id === peerId) return;
        const p = participants.find(p => p.id === id);
        if (p) names.push(p.name);
    });
    return names;
  };

  if (kickReason) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
              <div className="bg-slate-900 border border-red-500/30 p-8 rounded-2xl max-w-md text-center shadow-2xl">
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Ban className="w-8 h-8 text-red-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
                  <p className="text-slate-400 mb-6">{kickReason}</p>
                  <button 
                    onClick={() => navigate('/')}
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                  >
                      Return to Lobby
                  </button>
              </div>
          </div>
      );
  }

  const myRole = getMyRole();

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-30 w-72 bg-slate-900 border-r border-slate-700 transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900">
                <div className="flex items-center gap-2 font-bold text-white text-xl">
                    <div className="bg-brand-600 p-1.5 rounded-lg">
                        <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <span>GeminiChat</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="p-5 space-y-8 flex-1 overflow-y-auto">
                {/* Room Code */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-800/50 p-5 rounded-2xl border border-slate-700/50 shadow-lg">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <KeyRound className="w-3 h-3" />
                        Room Code
                    </h3>
                    <div className="flex flex-col gap-3">
                        <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-700 text-center relative group">
                            <span className="text-3xl font-mono font-bold text-brand-400 tracking-[0.2em] shadow-brand-500/20 drop-shadow-sm">{roomCode}</span>
                        </div>
                        <button 
                            onClick={copyCode} 
                            className="flex items-center justify-center gap-2 w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white font-medium transition-colors"
                        >
                            {isCopied ? <span className="text-green-400">Copied!</span> : <> <Copy className="w-4 h-4" /> Copy Code </>}
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-3 text-center leading-relaxed">
                        Share this code with friends to let them join your chat.
                    </p>
                </div>

                {/* Participants */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <Users className="w-3 h-3" />
                            Active Users
                        </h3>
                        <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-1 rounded-md border border-slate-700">
                            {participants.length}
                        </span>
                    </div>
                    <ul className="space-y-2 pb-20">
                        {participants.map((p) => {
                            const isMe = p.id === peerId;
                            const canManage = (myRole === UserRole.HOST) || (myRole === UserRole.MANAGER && p.role === UserRole.GUEST);
                            const showMenu = !isMe && canManage;

                            return (
                            <li key={p.id} className="relative flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-800 group">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${
                                    isMe ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white' : 
                                    p.role === UserRole.HOST ? 'bg-purple-600 text-white' :
                                    p.role === UserRole.MANAGER ? 'bg-blue-600 text-white' :
                                    'bg-slate-700 text-slate-300'
                                }`}>
                                    {p.role === UserRole.HOST ? 'H' : p.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-200 font-medium truncate flex items-center gap-2">
                                        {p.name}
                                        {isMe && <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">You</span>}
                                    </p>
                                    <p className="text-[10px] text-slate-500 truncate font-medium flex items-center gap-1">
                                        {p.role === UserRole.HOST && <ShieldCheck className="w-3 h-3 text-purple-400" />}
                                        {p.role === UserRole.MANAGER && <Shield className="w-3 h-3 text-blue-400" />}
                                        {p.role === UserRole.HOST ? 'Host' : p.role === UserRole.MANAGER ? 'Manager' : 'Guest'}
                                    </p>
                                </div>
                                
                                {showMenu && (
                                    <div className="relative user-menu-trigger">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveMenuId(activeMenuId === p.id ? null : p.id);
                                            }}
                                            className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                        
                                        {activeMenuId === p.id && (
                                            <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in origin-top-right">
                                                <div className="p-1">
                                                    {myRole === UserRole.HOST && p.role === UserRole.GUEST && (
                                                        <button 
                                                            onClick={() => triggerAction('PROMOTE', p.id)}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:bg-slate-700 rounded-lg"
                                                        >
                                                            <Shield className="w-4 h-4" /> Make Manager
                                                        </button>
                                                    )}
                                                    {myRole === UserRole.HOST && p.role === UserRole.MANAGER && (
                                                        <button 
                                                            onClick={() => triggerAction('DEMOTE', p.id)}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:bg-slate-700 rounded-lg"
                                                        >
                                                            <ShieldAlert className="w-4 h-4" /> Remove Manager
                                                        </button>
                                                    )}
                                                    <div className="h-px bg-slate-700/50 my-1" />
                                                    <button 
                                                        onClick={() => triggerAction('KICK', p.id)}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-orange-400 hover:bg-slate-700 rounded-lg"
                                                    >
                                                        <UserMinus className="w-4 h-4" /> Kick User
                                                    </button>
                                                    <button 
                                                        onClick={() => triggerAction('BAN', p.id)}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 rounded-lg"
                                                    >
                                                        <Ban className="w-4 h-4" /> Ban User
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </li>
                        )})}
                    </ul>
                </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                <button 
                    onClick={() => navigate('/')}
                    className="w-full flex items-center justify-center gap-2 p-3 text-red-400 hover:text-white hover:bg-red-500/20 rounded-xl transition-all font-medium text-sm"
                >
                    <LogOut className="w-4 h-4" />
                    Leave Room
                </button>
            </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col w-full bg-slate-950 relative">
          {/* Mobile Header */}
          <div className="lg:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
              <div className="flex items-center gap-3">
                  <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-white rounded-lg active:bg-slate-800">
                      <Menu className="w-6 h-6" />
                  </button>
                  <div>
                      <span className="font-semibold text-white block leading-tight">GeminiChat</span>
                      <span className="text-xs text-brand-400 font-mono tracking-wider">#{roomCode}</span>
                  </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-800 py-1.5 px-3 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span>{participants.length} Online</span>
              </div>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <Chat 
                messages={messages} 
                onSendMessage={sendMessage} 
                onReact={handleReaction}
                userName={participants.find(p => p.id === peerId)?.name || 'User'} 
                currentUserId={peerId}
                typingUsers={getTypingNames()}
                onTyping={handleTyping}
            />
          </div>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/room/:id" element={<Room />} />
      </Routes>
    </Router>
  );
};

export default App;