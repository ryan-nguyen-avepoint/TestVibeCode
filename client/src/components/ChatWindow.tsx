import { useEffect, useRef, useState, useCallback } from 'react';
import {
  PanelLeftOpen, PanelRightOpen, Users, Copy, Check,
  ImagePlus, Send, Smile, Paperclip, Hash, Globe, Lock,
  Loader2, MessageSquare, UserPlus, ArrowDown, LogOut, MoreVertical, Menu
} from 'lucide-react';
import { useStore } from '../store';
import { useThemeStore } from '../store/theme';
import { roomApi, uploadApi } from '../lib/api';
import { Message } from '../types';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import toast from 'react-hot-toast';

interface ChatWindowProps {
  socket: {
    sendMessage: (roomId: string, content: string, type?: 'TEXT' | 'IMAGE' | 'EMOJI', imageUrl?: string) => Promise<any>;
    startTyping: (roomId: string) => void;
    stopTyping: (roomId: string) => void;
  };
  onMobileMenuOpen?: () => void;
}

export default function ChatWindow({ socket, onMobileMenuOpen }: ChatWindowProps) {
  const {
    activeRoom, activeRoomId, user, messages, hasMoreMessages,
    typingUsers, setMessages, prependMessages, toggleSidebar,
    toggleMembers, sidebarOpen, membersOpen, setInviteOpen,
    removeRoom, setActiveRoom,
  } = useStore();
  const { theme } = useThemeStore();

  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const isComposingRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentMessages = activeRoomId ? messages[activeRoomId] || [] : [];
  const roomTypingUsers = typingUsers.filter(
    (t) => t.roomId === activeRoomId && t.userId !== user?.id
  );

  // Load messages when room changes
  useEffect(() => {
    if (!activeRoomId) return;
    if (messages[activeRoomId]) return; // Already loaded

    loadMessages(activeRoomId);
  }, [activeRoomId]);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) {
      scrollToBottom();
    }
  }, [currentMessages.length]);

  const loadMessages = async (roomId: string, cursor?: string) => {
    setLoadingMessages(true);
    try {
      const { data } = await roomApi.getMessages(roomId, cursor);
      if (cursor) {
        prependMessages(roomId, data.messages, data.hasMore);
      } else {
        setMessages(roomId, data.messages, data.hasMore);
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadMore = () => {
    if (!activeRoomId || loadingMessages) return;
    const roomMsgs = messages[activeRoomId];
    if (!roomMsgs?.length) return;
    loadMessages(activeRoomId, roomMsgs[0].id);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShowScrollDown(!atBottom);
  };

  const handleSend = async () => {
    if (!input.trim() || !activeRoomId) return;

    const content = input.trim();
    setInput('');
    setShowEmoji(false);

    try {
      await socket.sendMessage(activeRoomId, content, 'TEXT');
      socket.stopTyping(activeRoomId);
    } catch (err) {
      toast.error('Failed to send message');
      setInput(content);
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ignore Enter during IME composition (prevents duplicate messages on Mac)
    if (e.nativeEvent.isComposing || isComposingRef.current) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (activeRoomId && e.target.value.trim()) {
      socket.startTyping(activeRoomId);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeRoomId) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setUploading(true);
    try {
      const { data } = await uploadApi.uploadImage(file);
      await socket.sendMessage(activeRoomId, '', 'IMAGE', data.imageUrl);
    } catch (err) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleEmojiClick = (emoji: any) => {
    setInput((prev) => prev + emoji.emoji);
    inputRef.current?.focus();
  };

  const copyRoomId = () => {
    if (!activeRoomId) return;
    navigator.clipboard.writeText(activeRoomId);
    setCopied(true);
    toast.success('Room ID copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveRoom = async () => {
    if (!activeRoomId || !activeRoom) return;
    if (activeRoom.isGlobal) {
      toast.error("Can't leave the global room");
      return;
    }
    setLeaving(true);
    try {
      await roomApi.leaveRoom(activeRoomId);
      removeRoom(activeRoomId);
      setActiveRoom(null);
      setShowMenu(false);
      toast.success(`Left "${activeRoom.name}"`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to leave room');
    } finally {
      setLeaving(false);
    }
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Yesterday ' + format(date, 'HH:mm');
    return format(date, 'MMM d, HH:mm');
  };

  const shouldShowDate = (msg: Message, prevMsg: Message | null) => {
    if (!prevMsg) return true;
    const curr = new Date(msg.createdAt).toDateString();
    const prev = new Date(prevMsg.createdAt).toDateString();
    return curr !== prev;
  };

  const shouldGroupMessage = (msg: Message, prevMsg: Message | null) => {
    if (!prevMsg) return false;
    if (prevMsg.userId !== msg.userId) return false;
    if (prevMsg.type === 'SYSTEM' || msg.type === 'SYSTEM') return false;
    const diff = new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime();
    return diff < 2 * 60 * 1000; // 2 minutes
  };

  // Empty state
  if (!activeRoomId) {
    return (
      <div className="flex-1 flex items-center justify-center t-bg">
        <div className="text-center animate-fade-in max-w-sm px-4">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6 border border-primary-500/10">
            <MessageSquare className="w-10 h-10 text-primary-400" />
          </div>
          <h2 className="text-2xl font-bold t-text mb-2">Welcome to VibeRyan</h2>
          <p className="t-text-m text-sm leading-relaxed">
            Select a room from the sidebar to start chatting, or create a new one.
          </p>
          <button
            onClick={() => onMobileMenuOpen ? onMobileMenuOpen() : !sidebarOpen && toggleSidebar()}
            className="btn-primary mt-6 text-sm"
          >
            <PanelLeftOpen className="w-4 h-4 inline mr-2" />
            Open Sidebar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full t-bg relative">
      {/* Chat Header */}
      <div className="h-14 md:h-16 px-3 md:px-4 flex items-center justify-between border-b t-border-s t-bg-s backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {/* Mobile menu button */}
          <button onClick={onMobileMenuOpen} className="btn-ghost p-2 md:hidden flex-shrink-0">
            <Menu className="w-5 h-5" />
          </button>
          {/* Desktop toggle */}
          <button onClick={toggleSidebar} className="btn-ghost p-2 hidden md:block flex-shrink-0">
            <PanelLeftOpen className="w-5 h-5" />
          </button>
          <div className="w-8 md:w-9 h-8 md:h-9 rounded-xl t-bg-t flex items-center justify-center border t-border flex-shrink-0">
            {activeRoom?.isGlobal ? (
              <Globe className="w-4 md:w-4.5 h-4 md:h-4.5 text-emerald-400" />
            ) : activeRoom?.isPrivate ? (
              <Lock className="w-4 md:w-4.5 h-4 md:h-4.5 text-amber-400" />
            ) : (
              <Hash className="w-4 md:w-4.5 h-4 md:h-4.5 t-text-m" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold t-text flex items-center gap-2 truncate">
              <span className="truncate">{activeRoom?.name}</span>
              {!activeRoom?.isGlobal && (
                <button
                  onClick={copyRoomId}
                  className="t-text-f hover:t-text-t transition-colors flex-shrink-0 hidden sm:block"
                  title="Copy Room ID"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </h2>
            <p className="text-[11px] t-text-f truncate">
              {activeRoom?.memberCount} member{activeRoom?.memberCount !== 1 ? 's' : ''}
              {activeRoom?.description && <span className="hidden sm:inline"> • {activeRoom.description}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 md:gap-1 flex-shrink-0">
          {activeRoom?.myRole === 'OWNER' && !activeRoom?.isGlobal && (
            <button
              onClick={() => setInviteOpen(true)}
              className="btn-ghost p-2"
              title="Invite users"
            >
              <UserPlus className="w-4 md:w-4.5 h-4 md:h-4.5" />
            </button>
          )}
          <button onClick={toggleMembers} className={`btn-ghost p-2 hidden md:block ${membersOpen ? 'text-primary-400' : ''}`}>
            <Users className="w-4.5 h-4.5" />
          </button>
          {/* Room menu */}
          {!activeRoom?.isGlobal && (
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="btn-ghost p-2">
                <MoreVertical className="w-4 md:w-4.5 h-4 md:h-4.5" />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-48 py-1 t-bg-t border t-border rounded-xl shadow-xl animate-fade-in">
                    <button
                      onClick={copyRoomId}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm t-text-s hover:t-bg-h transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      Copy Room ID
                    </button>
                    <div className="h-px t-bg-e my-1" style={{ backgroundColor: 'var(--border-primary)' }} />
                    <button
                      onClick={handleLeaveRoom}
                      disabled={leaving}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      {leaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                      Leave Room
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5"
      >
        {/* Load More */}
        {hasMoreMessages[activeRoomId] && (
          <div className="text-center py-3">
            <button
              onClick={loadMore}
              disabled={loadingMessages}
              className="btn-secondary text-xs py-1.5 px-4"
            >
              {loadingMessages ? (
                <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
              ) : null}
              Load older messages
            </button>
          </div>
        )}

        {currentMessages.map((msg, i) => {
          const prevMsg = i > 0 ? currentMessages[i - 1] : null;
          const isOwn = msg.userId === user?.id;
          const isSystem = msg.type === 'SYSTEM';
          const showDate = shouldShowDate(msg, prevMsg);
          const grouped = shouldGroupMessage(msg, prevMsg);

          return (
            <div key={msg.id}>
              {/* Date separator */}
              {showDate && (
                <div className="flex items-center gap-3 py-4">
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-secondary)' }} />
                  <span className="text-[11px] t-text-f font-medium px-2">
                    {isToday(new Date(msg.createdAt))
                      ? 'Today'
                      : isYesterday(new Date(msg.createdAt))
                      ? 'Yesterday'
                      : format(new Date(msg.createdAt), 'MMMM d, yyyy')}
                  </span>
                  <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-secondary)' }} />
                </div>
              )}

              {/* System message */}
              {isSystem ? (
                <div className="flex justify-center py-1.5">
                  <p className="message-system">{msg.content}</p>
                </div>
              ) : (
                /* User message */
                <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${grouped ? 'mt-0.5' : 'mt-3'}`}>
                  <div className={`flex gap-2.5 max-w-[75%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                    {/* Avatar */}
                    {!grouped && (
                      <div className="flex-shrink-0 mt-0.5">
                        <div className={`avatar w-8 h-8 text-xs ${
                          isOwn
                            ? 'bg-gradient-to-br from-primary-500 to-purple-600'
                            : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                        }`}>
                          {msg.user.avatarUrl ? (
                            <img src={msg.user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            msg.user.username.charAt(0).toUpperCase()
                          )}
                        </div>
                      </div>
                    )}

                    <div className={`${grouped && !isOwn ? 'ml-[42px]' : ''} ${grouped && isOwn ? 'mr-[42px]' : ''}`}>
                      {/* Username & time */}
                      {!grouped && (
                        <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'justify-end' : ''}`}>
                          <span className="text-sm font-semibold t-text-t">
                            {isOwn ? 'You' : msg.user.username}
                          </span>
                          <span className="text-[11px] t-text-g">{formatMessageTime(msg.createdAt)}</span>
                        </div>
                      )}

                      {/* Bubble */}
                      {msg.type === 'IMAGE' && msg.imageUrl ? (
                        <div className={`rounded-2xl overflow-hidden ${isOwn ? 'rounded-br-md' : 'rounded-bl-md'} border t-border-s`}>
                          <img
                            src={msg.imageUrl}
                            alt="Shared image"
                            className="max-w-sm max-h-80 object-contain t-bg-s cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(msg.imageUrl!, '_blank')}
                          />
                          {msg.content && (
                            <p className={`px-3 py-2 text-[15px] ${isOwn ? 'bg-primary-600 text-white' : 'message-other'}`}>
                              {msg.content}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className={`message-bubble ${isOwn ? 'message-own' : 'message-other'}`}>
                          <p className="text-[15px] whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                          {grouped && (
                            <span className="text-[9px] opacity-50 mt-0.5 block text-right">
                              {format(new Date(msg.createdAt), 'HH:mm')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Typing indicator */}
        {roomTypingUsers.length > 0 && (
          <div className="flex items-center gap-2 py-2 ml-[42px] animate-fade-in">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs t-text-m">
              {roomTypingUsers.map((t) => t.username).join(', ')}{' '}
              {roomTypingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollDown && (
        <div className="absolute bottom-24 right-4 md:right-8">
          <button
            onClick={scrollToBottom}
            className="w-10 h-10 t-bg-t border t-border rounded-full flex items-center justify-center shadow-xl hover:t-bg-h transition-colors"
          >
            <ArrowDown className="w-4 h-4 t-text-t" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-2 md:px-4 py-2 md:py-3 border-t t-border-s t-bg-s backdrop-blur-xl flex-shrink-0">
        <div className="flex items-end gap-1.5 md:gap-2">
          {/* Image upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-ghost p-2 md:p-2.5 flex-shrink-0 mb-0.5"
            title="Upload image"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary-400" />
            ) : (
              <ImagePlus className="w-5 h-5" />
            )}
          </button>

          {/* Emoji */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setShowEmoji(!showEmoji)}
              className={`btn-ghost p-2 md:p-2.5 flex-shrink-0 mb-0.5 ${showEmoji ? 'text-primary-400' : ''}`}
              title="Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
            {showEmoji && (
              <div className="absolute bottom-14 left-0 z-50 animate-slide-up">
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT}
                  width={320}
                  height={400}
                  searchPlaceholder="Search emoji..."
                  skinTonesDisabled
                />
              </div>
            )}
          </div>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => { isComposingRef.current = true; }}
              onCompositionEnd={() => { isComposingRef.current = false; }}
              placeholder={`Message ${activeRoom?.name || ''}...`}
              rows={1}
              className="input-field resize-none py-2.5 pr-12 min-h-[44px] max-h-32 text-sm md:text-base"
              style={{
                height: 'auto',
                overflow: input.split('\n').length > 3 ? 'auto' : 'hidden',
              }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 128) + 'px';
              }}
            />
          </div>

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={!input.trim() && !uploading}
            className="btn-primary p-2.5 flex-shrink-0 mb-0.5 rounded-xl disabled:opacity-30"
            title="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
