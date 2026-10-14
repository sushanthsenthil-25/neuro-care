import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  CheckCheck,
  AlertTriangle,
  Truck,
  Cpu,
  Package,
  Users,
  Droplet,
  ExternalLink
} from 'lucide-react';
import { notificationStore } from '../services/notificationStore';
import type { AppNotification, NotificationCategory } from '../types/icu';

interface NotificationCenterDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToPatient?: (patientId: string) => void;
  onNavigateToPharmacy?: () => void;
  onNavigateToQueue?: () => void;
  onNavigateToBlood?: () => void;
}

export const NotificationCenterDropdown: React.FC<NotificationCenterDropdownProps> = ({
  isOpen,
  onClose,
  onNavigateToPatient,
  onNavigateToPharmacy,
  onNavigateToQueue,
  onNavigateToBlood,
}) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  useEffect(() => {
    if (!isOpen) return;
    setNotifications(notificationStore.getNotifications());

    const unsubscribe = notificationStore.subscribe(() => {
      setNotifications(notificationStore.getNotifications());
    });
    return unsubscribe;
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = notifications.filter(
    (n) => filterCategory === 'ALL' || n.category === filterCategory
  );
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    notificationStore.markAllAsRead();
  };

  const handleItemClick = (notif: AppNotification) => {
    notificationStore.markAsRead(notif.id);
    if (notif.linkType === 'patient' && notif.patientId && onNavigateToPatient) {
      onNavigateToPatient(notif.patientId);
      onClose();
    } else if (notif.linkType === 'pharmacy' && onNavigateToPharmacy) {
      onNavigateToPharmacy();
      onClose();
    } else if (notif.linkType === 'queue' && onNavigateToQueue) {
      onNavigateToQueue();
      onClose();
    } else if (notif.linkType === 'blood' && onNavigateToBlood) {
      onNavigateToBlood();
      onClose();
    }
  };

  const getCategoryIcon = (cat: NotificationCategory) => {
    switch (cat) {
      case 'CLINICAL_ALERT':
        return <AlertTriangle className="w-3.5 h-3.5 text-red-600" />;
      case 'DELIVERY_UPDATE':
        return <Truck className="w-3.5 h-3.5 text-blue-600" />;
      case 'EQUIPMENT_FAULT':
        return <Cpu className="w-3.5 h-3.5 text-amber-600" />;
      case 'LOW_STOCK':
      case 'MEDICINE_EXPIRY':
        return <Package className="w-3.5 h-3.5 text-purple-600" />;
      case 'QUEUE_ALERT':
        return <Users className="w-3.5 h-3.5 text-orange-600" />;
      case 'BLOOD_REQUEST':
        return <Droplet className="w-3.5 h-3.5 text-red-500 fill-current" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6 bg-slate-950/40 backdrop-blur-xs font-sans">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden mt-12 font-mono text-xs">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-red-600" />
            <h3 className="font-black text-slate-900 dark:text-slate-100 text-sm">
              Clinical & Operations Notification Center
            </h3>
            {unreadCount > 0 && (
              <span className="text-[10px] font-black bg-red-600 text-white px-1.5 py-0.2 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 underline font-semibold flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" /> Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="p-2.5 bg-slate-100/60 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1 overflow-x-auto text-[11px]">
          {['ALL', 'CLINICAL_ALERT', 'DELIVERY_UPDATE', 'EQUIPMENT_FAULT', 'LOW_STOCK', 'QUEUE_ALERT', 'BLOOD_REQUEST'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-2 py-1 rounded-lg font-bold shrink-0 transition-colors ${
                filterCategory === cat
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {cat === 'ALL'
                ? 'All'
                : cat === 'CLINICAL_ALERT'
                ? 'Clinical'
                : cat === 'DELIVERY_UPDATE'
                ? 'Delivery'
                : cat === 'EQUIPMENT_FAULT'
                ? 'Equipment'
                : cat === 'LOW_STOCK'
                ? 'Pharmacy'
                : cat === 'QUEUE_ALERT'
                ? 'Queue'
                : 'Blood'}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No notifications in this category.
            </div>
          ) : (
            filtered.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleItemClick(notif)}
                className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1 ${
                  !notif.read
                    ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900 shadow-xs'
                    : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(notif.category)}
                    <span className="font-black text-slate-900 dark:text-slate-100 text-xs">
                      {notif.title}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-400 shrink-0">{notif.timestamp}</span>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 pl-5">
                  {notif.message}
                </p>

                <div className="pl-5 pt-1 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">
                    {notif.room ? `Location: ${notif.room}` : 'Hospital-wide'}
                  </span>
                  <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-0.5">
                    View Record <ExternalLink className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
