import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Sparkles, Smile, Plus } from 'lucide-react';
import { ChatMessage, MessageType, Reaction } from '../types';
import { generateAIResponse, generateConversationStarter } from '../services/geminiService';

interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, type?: MessageType) => void;
  onReact: (messageId: string, emoji: string) => void;
  userName: string;
  currentUserId: string;
  typingUsers: string[];
  onTyping: (isTyping: boolean) => void;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

const Chat: React.FC<ChatProps> = ({ 
  messages, 
  onSendMessage, 
  onReact, 
  userName, 
  currentUserId,
  typingUsers,
  onTyping 
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, typingUsers]);

  // Close reaction picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeReactionMessageId && !(event.target as Element).closest('.reaction-picker-container')) {
        setActiveReactionMessageId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeReactionMessageId]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
    } else {
        // If no timeout exists, we weren't typing before (or it expired), so signal start
        onTyping(true);
    }

    // Set new timeout to signal stop
    typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
        typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const text = inputValue.trim();
    setInputValue('');
    
    // Stop typing immediately
    if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
        onTyping(false);
    }
    
    // Standard user message
    onSendMessage(text, MessageType.USER);

    // Check for AI command or direct interaction
    if (text.toLowerCase().startsWith('@ai') || text.toLowerCase().includes('gemini')) {
      setIsThinking(true);
      try {
        const response = await generateAIResponse(text, messages);
        onSendMessage(response, MessageType.AI);
      } catch (err) {
        console.error(err);
        onSendMessage("I had a glitch.", MessageType.SYSTEM);
      } finally {
        setIsThinking(false);
      }
    }
  };

  const handleMagicStarter = async () => {
      setIsThinking(true);
      try {
          const starter = await generateConversationStarter();
          onSendMessage(starter, MessageType.AI);
      } catch(e) {
          // ignore
      } finally {
          setIsThinking(false);
      }
  }

  const groupReactions = (reactions: Reaction[]) => {
    const groups: { [emoji: string]: { count: number, hasReacted: boolean, senders: string[] } } = {};
    
    reactions.forEach(r => {
      if (!groups[r.emoji]) {
        groups[r.emoji] = { count: 0, hasReacted: false, senders: [] };
      }
      groups[r.emoji].count++;
      groups[r.emoji].senders.push(r.senderName);
      if (r.senderId === currentUserId) {
        groups[r.emoji].hasReacted = true;
      }
    });
    
    return Object.entries(groups).map(([emoji, data]) => ({
      emoji,
      ...data
    }));
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-0 scrollbar-hide">
        {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60 space-y-4">
                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg border border-slate-800">
                    <Bot className="w-8 h-8 text-brand-400" />
                </div>
                <div className="text-center">
                    <p className="text-lg font-medium text-slate-300">No messages yet</p>
                    <p className="text-sm mt-1">Type <span className="font-mono text-brand-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">@ai</span> to invite Gemini</p>
                </div>
                <button 
                    onClick={handleMagicStarter}
                    className="text-xs flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all shadow-sm group"
                >
                    <Sparkles className="w-3.5 h-3.5 text-yellow-500 group-hover:rotate-12 transition-transform" />
                    <span className="group-hover:text-slate-300 transition-colors">Get a conversation starter</span>
                </button>
            </div>
        )}
        
        {messages.map((msg, index) => {
          const isMe = msg.senderName === userName; // Note: userName passed prop vs currentUserId for logic
          const isMyMessage = msg.senderId === currentUserId; // More accurate check
          const isAI = msg.type === MessageType.AI;
          const isSystem = msg.type === MessageType.SYSTEM;
          const isConsecutive = index > 0 && messages[index - 1].senderName === msg.senderName && (msg.timestamp - messages[index - 1].timestamp < 60000); // 1 min threshold
          const groupedReactions = groupReactions(msg.reactions || []);
          
          if (isSystem) {
            return (
                <div key={msg.id} className="flex justify-center py-4 animate-fade-in">
                    <span className="bg-slate-900/80 text-slate-500 text-xs px-3 py-1 rounded-full border border-slate-800">
                        {msg.text}
                    </span>
                </div>
            );
          }

          return (
          <div
            key={msg.id}
            className={`flex flex-col ${
              isAI || !isMyMessage ? 'items-start' : 'items-end'
            } animate-slide-up-fade group ${isConsecutive ? 'mt-1' : 'mt-5'}`}
          >
            {!isConsecutive && (
                <div className={`flex items-center gap-2 mb-1.5 px-1 ${isMyMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span className={`text-xs font-bold tracking-wide ${
                      isAI ? 'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400' : 'text-slate-400'
                  }`}>
                    {isAI ? (
                        <span className="flex items-center gap-1.5"><Bot className="w-3.5 h-3.5" /> Gemini</span>
                    ) : msg.senderName}
                  </span>
                  <span className="text-[10px] text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
            )}
            
            <div className={`relative max-w-[85%] md:max-w-[70%] group/bubble reaction-picker-container`}>
                
                {/* Message Bubble */}
                <div
                className={`px-5 py-3 text-[15px] shadow-md leading-relaxed break-words relative transition-all hover:shadow-lg ${
                    isAI
                    ? 'bg-slate-900/95 border border-purple-500/20 text-slate-100 rounded-2xl rounded-tl-sm'
                    : isMyMessage
                    ? 'bg-gradient-to-br from-brand-600 to-brand-500 text-white rounded-2xl rounded-tr-sm shadow-brand-500/10'
                    : 'bg-slate-800/90 border border-slate-700/50 text-slate-200 rounded-2xl rounded-tl-sm'
                }`}
                >
                    {msg.text}
                </div>

                {/* Reaction Button (Hover) */}
                <button
                    onClick={() => setActiveReactionMessageId(activeReactionMessageId === msg.id ? null : msg.id)}
                    className={`absolute -top-3 ${isMyMessage ? '-left-8' : '-right-8'} p-1.5 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 opacity-0 group-hover/bubble:opacity-100 transition-all shadow-lg border border-slate-700 z-10 ${activeReactionMessageId === msg.id ? 'opacity-100' : ''}`}
                >
                    <Smile className="w-4 h-4" />
                </button>

                {/* Emoji Picker Popover */}
                {activeReactionMessageId === msg.id && (
                    <div className={`absolute -top-12 ${isMyMessage ? 'right-0' : 'left-0'} bg-slate-900 border border-slate-700 rounded-full shadow-xl flex items-center p-1 gap-1 z-20 animate-fade-in`}>
                        {REACTION_EMOJIS.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => {
                                    onReact(msg.id, emoji);
                                    setActiveReactionMessageId(null);
                                }}
                                className="w-8 h-8 flex items-center justify-center hover:bg-slate-800 rounded-full transition-colors text-lg"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}

                {/* Reactions Display */}
                {groupedReactions.length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1.5 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                        {groupedReactions.map((reaction) => (
                            <button
                                key={reaction.emoji}
                                onClick={() => onReact(msg.id, reaction.emoji)}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
                                    reaction.hasReacted 
                                        ? 'bg-brand-500/20 border-brand-500/50 text-brand-200' 
                                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800 hover:border-slate-600'
                                }`}
                                title={reaction.senders.join(', ')}
                            >
                                <span>{reaction.emoji}</span>
                                <span className="font-medium">{reaction.count}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
          </div>
        )})}

        {isThinking && (
             <div className="flex flex-col items-start animate-fade-in mt-5">
                 <div className="flex items-center gap-2 mb-1.5 px-1">
                    <span className="text-xs font-medium text-purple-400 flex items-center gap-1.5"><Bot className="w-3.5 h-3.5" /> Gemini</span>
                 </div>
                 <div className="bg-slate-900/95 border border-purple-500/20 px-5 py-4 rounded-2xl rounded-tl-sm shadow-lg">
                    <div className="flex gap-1.5">
                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-75"></span>
                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-150"></span>
                    </div>
                 </div>
             </div>
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* Input Area */}
      <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800/50">
        <div className="max-w-4xl mx-auto relative flex flex-col gap-2">
            
          {/* Typing Indicator */}
          <div className="h-5 pl-2 flex items-center gap-2 text-xs font-medium text-slate-500 overflow-hidden transition-all">
            {typingUsers.length > 0 && (
                <div className="flex items-center gap-2 animate-slide-up-fade">
                    <div className="flex gap-0.5">
                        <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce"></span>
                        <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce delay-75"></span>
                        <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce delay-150"></span>
                    </div>
                    <span>
                        {typingUsers.length > 2 
                            ? 'Several people are typing...' 
                            : `${typingUsers.join(' and ')} ${typingUsers.length === 1 ? 'is' : 'are'} typing...`
                        }
                    </span>
                </div>
            )}
          </div>

          <div className="flex items-end gap-3">
            <button 
                onClick={handleMagicStarter}
                className="mb-1.5 p-3 rounded-xl text-slate-400 hover:text-yellow-400 hover:bg-slate-900 transition-all hidden sm:block border border-transparent hover:border-slate-800"
                title="Get AI conversation starter"
            >
                <Sparkles className="w-5 h-5" />
            </button>
            <div className="flex-1 relative bg-slate-900 rounded-3xl border border-slate-800 focus-within:ring-2 focus-within:ring-brand-500/30 focus-within:border-brand-500/50 transition-all shadow-sm">
                <textarea
                    value={inputValue}
                    onChange={handleInput}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder="Type a message..."
                    rows={1}
                    className="w-full bg-transparent text-white rounded-3xl pl-5 pr-12 py-3.5 focus:outline-none resize-none max-h-32 placeholder-slate-500"
                    style={{ minHeight: '52px' }}
                />
                <button
                    onClick={handleSend}
                    disabled={!inputValue.trim()}
                    className="absolute right-2 bottom-2 p-2 bg-brand-600 rounded-full text-white hover:bg-brand-500 disabled:opacity-0 disabled:cursor-not-allowed transition-all shadow-lg hover:scale-105 active:scale-95"
                >
                    <Send className="w-4 h-4" />
                </button>
            </div>
          </div>
        </div>
        <div className="text-center mt-3">
            <p className="text-[10px] text-slate-600">Gemini can make mistakes. Use <span className="font-mono text-slate-500 bg-slate-900 px-1 rounded">@ai</span> to chat.</p>
        </div>
      </div>
    </div>
  );
};

export default Chat;