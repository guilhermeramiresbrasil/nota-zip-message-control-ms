interface LogEntry {
  level: 'info' | 'warning' | 'error' | 'success' | 'debug';
  service: string;
  message: string;
  details?: any;
}

interface LoggerClientOptions {
  adminAdpUrl?: string;
  serviceName: string;
  enabled?: boolean;
}

export class LoggerClient {
  private adminAdpUrl: string;
  private serviceName: string;
  private enabled: boolean;
  private queue: LogEntry[] = [];
  private maxQueueSize = 100;
  private flushInterval: number = 5000; // 5 seconds
  private flushTimer?: NodeJS.Timeout;

  constructor(options: LoggerClientOptions) {
    this.adminAdpUrl = options.adminAdpUrl || process.env.ADMIN_ADP_URL || 'http://localhost:3017';
    this.serviceName = options.serviceName;
    this.enabled = options.enabled !== false;
    
    if (this.enabled) {
      this.startFlushTimer();
    }
  }

  private async flushQueue() {
    if (this.queue.length === 0) return;

    const logsToSend = [...this.queue];
    this.queue = [];

    try {
      await fetch(`${this.adminAdpUrl}/api/admin/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logsToSend[0]), // Send one at a time for now
      });
    } catch (error) {
      console.error('Failed to send logs to admin-adp:', error);
      // Re-add failed logs to queue
      this.queue.unshift(...logsToSend);
    }
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flushQueue();
    }, this.flushInterval);
  }

  private log(level: LogEntry['level'], message: string, details?: any) {
    if (!this.enabled) return;

    const logEntry: LogEntry = {
      level,
      service: this.serviceName,
      message,
      details,
    };

    this.queue.push(logEntry);

    if (this.queue.length >= this.maxQueueSize) {
      this.flushQueue();
    }

    // Also log to console for local debugging
    const consoleMethod = level === 'error' ? 'error' : 
                         level === 'warning' ? 'warn' : 
                         level === 'debug' ? 'debug' : 'log';
    console[consoleMethod](`[${this.serviceName}] ${message}`, details || '');
  }

  info(message: string, details?: any) {
    this.log('info', message, details);
  }

  warning(message: string, details?: any) {
    this.log('warning', message, details);
  }

  error(message: string, details?: any) {
    this.log('error', message, details);
  }

  success(message: string, details?: any) {
    this.log('success', message, details);
  }

  debug(message: string, details?: any) {
    this.log('debug', message, details);
  }

  async flush() {
    await this.flushQueue();
  }

  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }
}

// Singleton instance
let loggerInstance: LoggerClient | null = null;

export function initLogger(options: LoggerClientOptions): LoggerClient {
  if (loggerInstance) {
    loggerInstance.destroy();
  }
  loggerInstance = new LoggerClient(options);
  return loggerInstance;
}

export function getLogger(): LoggerClient | null {
  return loggerInstance;
}
