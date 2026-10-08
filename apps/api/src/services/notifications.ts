import crypto from 'crypto';

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export interface NotificationPayload {
  tenantId: string;
  recipientId: string;
  recipientContact?: string; // phone or email
  title: string;
  message: string;
  channel: NotificationChannel;
  priority?: NotificationPriority;
  metadata?: Record<string, any>;
}

export interface InAppNotification {
  id: string;
  tenantId: string;
  recipientId: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
  metadata?: Record<string, any>;
}

export interface OutboundSimulatorLog {
  id: string;
  tenantId: string;
  channel: NotificationChannel;
  recipientContact: string;
  title: string;
  message: string;
  timestamp: string;
  provider: string;
  status: 'DELIVERED' | 'SIMULATED';
}

export interface INotificationService {
  dispatch(payload: NotificationPayload): Promise<{ success: boolean; notificationId: string; status: string }>;
  getInAppNotifications(tenantId: string, recipientId: string, unreadOnly?: boolean): Promise<InAppNotification[]>;
  getUnreadCount(tenantId: string, recipientId: string): Promise<number>;
  markAsRead(tenantId: string, notificationId: string): Promise<boolean>;
  getSimulatorOutbox(tenantId?: string): Promise<OutboundSimulatorLog[]>;
  clearSimulatorOutbox(): void;
  isSimulator(): boolean;
}

class NotificationService implements INotificationService {
  private inAppNotifications: Map<string, InAppNotification> = new Map();
  private simulatorOutbox: OutboundSimulatorLog[] = [];

  isSimulator(): boolean {
    return true;
  }

  async dispatch(payload: NotificationPayload): Promise<{ success: boolean; notificationId: string; status: string }> {
    const id = 'notif-' + Date.now() + '-' + crypto.randomUUID().slice(0, 8);
    const priority = payload.priority || 'NORMAL';

    if (payload.channel === 'IN_APP') {
      const record: InAppNotification = {
        id,
        tenantId: payload.tenantId,
        recipientId: payload.recipientId,
        title: payload.title,
        message: payload.message,
        priority,
        isRead: false,
        createdAt: new Date().toISOString(),
        metadata: payload.metadata,
      };
      this.inAppNotifications.set(id, record);
      return { success: true, notificationId: id, status: 'STORED' };
    }

    // External channels: EMAIL, SMS, WHATSAPP
    const outboundRecord: OutboundSimulatorLog = {
      id,
      tenantId: payload.tenantId,
      channel: payload.channel,
      recipientContact: payload.recipientContact || payload.recipientId,
      title: payload.title,
      message: payload.message,
      timestamp: new Date().toISOString(),
      provider: payload.channel === 'EMAIL' ? 'SMTP_SIMULATOR' : 'TWILIO_SIMULATOR',
      status: 'DELIVERED',
    };

    this.simulatorOutbox.push(outboundRecord);
    return { success: true, notificationId: id, status: 'DELIVERED' };
  }

  async getInAppNotifications(tenantId: string, recipientId: string, unreadOnly: boolean = false): Promise<InAppNotification[]> {
    const list = Array.from(this.inAppNotifications.values())
      .filter((n) => n.tenantId === tenantId && n.recipientId === recipientId)
      .filter((n) => (!unreadOnly ? true : !n.isRead))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return list;
  }

  async getUnreadCount(tenantId: string, recipientId: string): Promise<number> {
    const list = await this.getInAppNotifications(tenantId, recipientId, true);
    return list.length;
  }

  async markAsRead(tenantId: string, notificationId: string): Promise<boolean> {
    const item = this.inAppNotifications.get(notificationId);
    if (!item || item.tenantId !== tenantId) return false;

    item.isRead = true;
    item.readAt = new Date().toISOString();
    return true;
  }

  async getSimulatorOutbox(tenantId?: string): Promise<OutboundSimulatorLog[]> {
    if (!tenantId) return [...this.simulatorOutbox];
    return this.simulatorOutbox.filter((log) => log.tenantId === tenantId);
  }

  clearSimulatorOutbox(): void {
    this.simulatorOutbox = [];
  }
}

export const notificationService = new NotificationService();
