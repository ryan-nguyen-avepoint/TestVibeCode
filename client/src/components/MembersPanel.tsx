import { useMemo } from 'react';
import { Crown, Shield, Users, Circle } from 'lucide-react';
import { useStore } from '../store';

export default function MembersPanel() {
  const { activeRoom, activeRoomId, onlineUsers } = useStore();

  const members = activeRoom?.members || [];
  const online = onlineUsers[activeRoomId || ''] || [];
  const onlineIds = new Set(online.map((u) => u.id));

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      // Sort by role (Owner > Admin > Member), then by online status
      const roleOrder = { OWNER: 0, ADMIN: 1, MEMBER: 2 };
      const roleDiff = roleOrder[a.role] - roleOrder[b.role];
      if (roleDiff !== 0) return roleDiff;
      const aOnline = onlineIds.has(a.user.id) ? 0 : 1;
      const bOnline = onlineIds.has(b.user.id) ? 0 : 1;
      return aOnline - bOnline;
    });
  }, [members, onlineIds]);

  const onlineCount = members.filter((m) => onlineIds.has(m.user.id)).length;

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'OWNER':
        return (
          <span className="flex items-center gap-0.5 text-[10px] text-amber-400 font-medium">
            <Crown className="w-3 h-3" /> Owner
          </span>
        );
      case 'ADMIN':
        return (
          <span className="flex items-center gap-0.5 text-[10px] text-primary-400 font-medium">
            <Shield className="w-3 h-3" /> Admin
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full w-72 t-bg-s backdrop-blur-xl flex flex-col">
      {/* Header */}
      <div className="p-4 border-b t-border-s">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 t-text-m" />
          <h3 className="text-sm font-semibold t-text">Members</h3>
          <span className="text-[11px] t-text-f ml-auto">
            {onlineCount} online
          </span>
        </div>
      </div>

      {/* Members list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {/* Online section */}
        <p className="text-[10px] font-semibold t-text-f uppercase tracking-wider px-2 mb-2">
          Online — {onlineCount}
        </p>
        {sortedMembers
          .filter((m) => onlineIds.has(m.user.id))
          .map((m) => (
            <div
              key={m.user.id}
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:t-bg-h transition-colors"
            >
              <div className="relative flex-shrink-0">
                <div className="avatar w-8 h-8 text-xs bg-gradient-to-br from-emerald-500 to-teal-600">
                  {m.user.avatarUrl ? (
                    <img src={m.user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    m.user.username.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 online-dot w-2 h-2" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium t-text truncate">{m.user.username}</p>
                {getRoleBadge(m.role)}
              </div>
            </div>
          ))}

        {/* Offline section */}
        {sortedMembers.filter((m) => !onlineIds.has(m.user.id)).length > 0 && (
          <>
            <p className="text-[10px] font-semibold t-text-f uppercase tracking-wider px-2 mt-4 mb-2">
              Offline — {members.length - onlineCount}
            </p>
            {sortedMembers
              .filter((m) => !onlineIds.has(m.user.id))
              .map((m) => (
                <div
                  key={m.user.id}
                  className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:t-bg-h transition-colors opacity-50"
                >
                  <div className="relative flex-shrink-0">
                    <div className="avatar w-8 h-8 text-xs" style={{ background: 'var(--bg-tertiary)' }}>
                      {m.user.avatarUrl ? (
                        <img src={m.user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        m.user.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 offline-dot w-2 h-2" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium t-text-t truncate">{m.user.username}</p>
                    {getRoleBadge(m.role)}
                  </div>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
