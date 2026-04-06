import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useSocket } from '../hooks/useSocket';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import MembersPanel from './MembersPanel';
import CreateRoomModal from './modals/CreateRoomModal';
import JoinRoomModal from './modals/JoinRoomModal';
import InviteModal from './modals/InviteModal';
import PendingInvitesModal from './modals/PendingInvitesModal';

export default function ChatLayout() {
  const { fetchRooms, fetchInvites, sidebarOpen, membersOpen, activeRoomId } = useStore();
  const socket = useSocket();
  const [invitesModalOpen, setInvitesModalOpen] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);

  useEffect(() => {
    fetchRooms();
    fetchInvites();
  }, []);

  // Close mobile sidebar when a room is selected
  const handleMobileSidebarClose = () => setMobileSidebar(false);

  return (
    <div className="h-screen flex overflow-hidden t-bg">
      {/* Desktop Sidebar */}
      <div
        className={`hidden md:block ${
          sidebarOpen ? 'w-80' : 'w-0'
        } transition-all duration-300 ease-in-out flex-shrink-0 overflow-hidden`}
      >
        <Sidebar onOpenInvites={() => setInvitesModalOpen(true)} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebar && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            onClick={handleMobileSidebarClose}
          />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden w-80 animate-slide-in-left">
            <Sidebar
              onOpenInvites={() => {
                setInvitesModalOpen(true);
                handleMobileSidebarClose();
              }}
              onMobileClose={handleMobileSidebarClose}
            />
          </div>
        </>
      )}

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <ChatWindow socket={socket} onMobileMenuOpen={() => setMobileSidebar(true)} />
      </div>

      {/* Members Panel - hidden on mobile */}
      {activeRoomId && (
        <div
          className={`hidden md:block ${
            membersOpen ? 'w-72' : 'w-0'
          } transition-all duration-300 ease-in-out flex-shrink-0 overflow-hidden border-l t-border-s`}
        >
          <MembersPanel />
        </div>
      )}

      {/* Modals */}
      <CreateRoomModal />
      <JoinRoomModal socket={socket} />
      <InviteModal />
      <PendingInvitesModal
        open={invitesModalOpen}
        onClose={() => setInvitesModalOpen(false)}
        socket={socket}
      />
    </div>
  );
}
