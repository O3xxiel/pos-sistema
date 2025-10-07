// pos-app/src/utils/notifications.ts
// Sistema de gestión de notificaciones para evitar conflictos

interface NotificationOptions {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

class NotificationManager {
  private notifications: Map<string, HTMLElement> = new Map();
  private zIndex = 50;

  show(options: NotificationOptions): string {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Remover notificaciones existentes del mismo tipo para evitar duplicados
    this.clearByType(options.type);
    
    const notification = this.createNotification(id, options);
    this.notifications.set(id, notification);
    
    // Ajustar z-index para que aparezca encima de otras notificaciones
    notification.style.zIndex = (this.zIndex++).toString();
    
    document.body.appendChild(notification);
    
    // Auto-remove después del tiempo especificado
    const duration = options.duration || 5000;
    setTimeout(() => {
      this.remove(id);
    }, duration);
    
    return id;
  }

  private createNotification(id: string, options: NotificationOptions): HTMLElement {
    const notification = document.createElement('div');
    notification.id = id;
    
    const position = options.position || 'top-right';
    const positionClasses = {
      'top-right': 'fixed top-4 right-4',
      'top-left': 'fixed top-4 left-4',
      'bottom-right': 'fixed bottom-4 right-4',
      'bottom-left': 'fixed bottom-4 left-4'
    };
    
    const typeClasses = {
      success: 'bg-green-500 text-white',
      error: 'bg-red-500 text-white',
      warning: 'bg-orange-500 text-white',
      info: 'bg-blue-500 text-white'
    };
    
    const icons = {
      success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      error: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
      warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
      info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    };
    
    notification.className = `${positionClasses[position]} ${typeClasses[options.type]} px-6 py-4 rounded-lg shadow-lg z-50 fade-in`;
    
    notification.innerHTML = `
      <div class="flex items-center">
        <svg class="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${icons[options.type]}"></path>
        </svg>
        <div>
          <div class="font-semibold">${options.title}</div>
          <div class="text-sm">${options.message}</div>
        </div>
        <button class="ml-4 text-white hover:text-gray-200" onclick="window.notificationManager.remove('${id}')">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    `;
    
    return notification;
  }

  remove(id: string): void {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.remove();
      this.notifications.delete(id);
    }
  }

  clearByType(type: string): void {
    // Remover notificaciones existentes del mismo tipo
    for (const [id, notification] of this.notifications) {
      if (notification.className.includes(`bg-${type === 'success' ? 'green' : type === 'error' ? 'red' : type === 'warning' ? 'orange' : 'blue'}-500`)) {
        this.remove(id);
      }
    }
  }

  clearAll(): void {
    for (const [id] of this.notifications) {
      this.remove(id);
    }
  }
}

// Crear instancia global
const notificationManager = new NotificationManager();

// Exponer globalmente para uso en botones
(window as any).notificationManager = notificationManager;

export default notificationManager;
