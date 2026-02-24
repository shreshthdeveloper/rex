import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, Button, Modal, Input, Select, DataTable, Badge, ConfirmDialog, GlassCard, SearchInput, Loader, TabList, Textarea, StatCard, Pagination } from '../../components/ui';
import { notificationsAPI } from '../../api';
import { Bell, Check, CheckCheck, Trash2, Info, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

const typeConfig = {
  info:    { icon: Info,          color: 'blue',  iconClass: 'text-blue-400' },
  warning: { icon: AlertTriangle, color: 'amber', iconClass: 'text-amber-400' },
  error:   { icon: AlertCircle,   color: 'red',   iconClass: 'text-red-400' },
  success: { icon: CheckCircle,   color: 'green', iconClass: 'text-emerald-400' },
};

function timeAgo(date) {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function Notifications() {
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter === 'unread') params.isRead = false;
      if (filter === 'read') params.isRead = true;
      const res = await notificationsAPI.list(params);
      setNotifications(res.data?.notifications || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [toast, filter]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const handleMarkRead = async (id) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n));
      toast.success('Marked as read');
    } catch (err) {
      toast.error(err.message || 'Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      await notificationsAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error(err.message || 'Failed to mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await notificationsAPI.delete(deleteTarget._id);
      toast.success('Notification deleted');
      setDeleteTarget(null);
      fetchNotifications();
    } catch (err) {
      toast.error(err.message || 'Failed to delete notification');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'read') return n.isRead;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filterTabs = [
    { id: 'all', label: `All (${notifications.length})` },
    { id: 'unread', label: `Unread (${unreadCount})` },
    { id: 'read', label: `Read (${notifications.length - unreadCount})` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
        actions={
          <Button onClick={handleMarkAllRead} loading={markingAll} variant="ghost" disabled={unreadCount === 0}>
            <CheckCheck size={16} /> Mark All Read
          </Button>
        }
      />

      <GlassCard>
        <TabList tabs={filterTabs} active={filter} onChange={setFilter} />

        {loading ? <Loader /> : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bell size={48} className="text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-500">No notifications</h3>
            <p className="text-sm text-gray-500 mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((n) => {
              const cfg = typeConfig[n.type] || typeConfig.info;
              const Icon = cfg.icon;
              return (
                <div
                  key={n._id}
                  className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
                    n.isRead
                      ? 'border-violet-100 bg-violet-50/50'
                      : 'border-cyan-500/20 bg-cyan-500/[0.04]'
                  }`}
                >
                  <div className={`mt-0.5 p-2 rounded-lg bg-violet-50 ${cfg.iconClass}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`text-sm font-medium ${n.isRead ? 'text-slate-600' : 'text-slate-800'}`}>{n.title}</h4>
                      <Badge color={cfg.color}>{n.type}</Badge>
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" />}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!n.isRead && (
                      <Button variant="icon" onClick={() => handleMarkRead(n._id)} title="Mark as read">
                        <Check size={16} className="text-violet-600" />
                      </Button>
                    )}
                    <Button variant="icon" onClick={() => setDeleteTarget(n)} title="Delete">
                      <Trash2 size={16} className="text-red-400" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Notification"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}
