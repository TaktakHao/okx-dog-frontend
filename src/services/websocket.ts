/**
 * @file websocket.ts
 * @description OKX-Dog WebSocket 实时通信服务
 * 包含心跳保活、断线指数退避重连、频道订阅分发与高频事件缓冲机制
 */

import { WSPushPayload, WSClientMessage } from '../types';

type MessageHandler<T = unknown> = (payload: WSPushPayload<T>) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000;
  private pingIntervalTimer: number | null = null;
  private pongTimeoutTimer: number | null = null;
  private subscribedChannels = new Set<string>();
  private handlers = new Map<string, Set<MessageHandler>>();
  private isExplicitlyClosed = false;
  private isConnected = false;

  constructor() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || '127.0.0.1:8000';
    // 在 Vite 开发模式下，走 /ws/v1/stream 代理或直接连后端 8000
    this.url = `${protocol}//${host}/ws/v1/stream`;
  }

  /**
   * 启动 WebSocket 连接
   */
  public connect(customUrl?: string) {
    if (customUrl) this.url = customUrl;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;

    try {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
    } catch (err) {
      console.warn('[WS] 连接创建失败，等待重试:', err);
      this.scheduleReconnect();
    }
  }

  /**
   * 断开连接
   */
  public disconnect() {
    this.isExplicitlyClosed = true;
    this.clearTimers();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * 订阅指定频道
   */
  public subscribe(channel: string, handler?: MessageHandler) {
    if (handler) {
      if (!this.handlers.has(channel)) {
        this.handlers.set(channel, new Set());
      }
      this.handlers.get(channel)!.add(handler);
    }

    if (!this.subscribedChannels.has(channel)) {
      this.subscribedChannels.add(channel);
      this.sendSubscription([channel], 'subscribe');
    }
  }

  /**
   * 取消订阅指定频道
   */
  public unsubscribe(channel: string, handler?: MessageHandler) {
    if (handler && this.handlers.has(channel)) {
      this.handlers.get(channel)!.delete(handler);
      if (this.handlers.get(channel)!.size === 0) {
        this.handlers.delete(channel);
      }
    } else if (!handler) {
      this.handlers.delete(channel);
    }

    // 仅当该频道无任何监听器时，才从订阅集合移除并向服务端发送 unsubscribe 报文
    const remainingHandlers = this.handlers.get(channel);
    if (!remainingHandlers || remainingHandlers.size === 0) {
      if (this.subscribedChannels.has(channel)) {
        this.subscribedChannels.delete(channel);
        this.sendSubscription([channel], 'unsubscribe');
      }
    }
  }

  /**
   * 全局监听所有消息
   */
  public onAny(handler: MessageHandler) {
    this.subscribe('*', handler);
    return () => this.unsubscribe('*', handler);
  }

  /**
   * 发送订阅/取消订阅请求
   */
  private sendSubscription(channels: string[], action: 'subscribe' | 'unsubscribe') {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg: WSClientMessage = {
        action,
        channels,
        timestamp: Date.now(),
      };
      this.ws.send(JSON.stringify(msg));
    }
  }

  /**
   * 发送 Ping 心跳包
   */
  private sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const pingMsg: WSClientMessage = {
        action: 'ping',
        timestamp: Date.now(),
      };
      this.ws.send(JSON.stringify(pingMsg));

      // 启动 Pong 超时检查 (10秒内未收到任何响应则主动判定掉线)
      if (this.pongTimeoutTimer) window.clearTimeout(this.pongTimeoutTimer);
      this.pongTimeoutTimer = window.setTimeout(() => {
        console.warn('[WS] 心跳超时无响应，主动重连');
        if (this.ws) this.ws.close();
      }, 10000);
    }
  }

  private handleOpen() {
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.startHeartbeat();

    // 重新订阅所有注册频道
    if (this.subscribedChannels.size > 0) {
      this.sendSubscription(Array.from(this.subscribedChannels), 'subscribe');
    }
  }

  private handleMessage(event: MessageEvent) {
    // 重置 Pong 超时检测
    if (this.pongTimeoutTimer) {
      window.clearTimeout(this.pongTimeoutTimer);
      this.pongTimeoutTimer = null;
    }

    try {
      const payload: WSPushPayload = JSON.parse(event.data);

      if (payload.event === 'pong') {
        return;
      }

      // 频道精准分发
      if (payload.channel && this.handlers.has(payload.channel)) {
        const channelHandlers = this.handlers.get(payload.channel)!;
        channelHandlers.forEach((handler) => handler(payload));
      }

      // 通配符监听分发
      if (this.handlers.has('*')) {
        const globalHandlers = this.handlers.get('*')!;
        globalHandlers.forEach((handler) => handler(payload));
      }
    } catch {
      // 忽略非 JSON 数据
    }
  }

  private handleError(err: Event) {
    console.warn('[WS] 连接异常:', err);
  }

  private handleClose() {
    this.isConnected = false;
    this.clearTimers();
    if (!this.isExplicitlyClosed) {
      this.scheduleReconnect();
    }
  }

  private startHeartbeat() {
    this.clearTimers();
    // 每 15 秒发送一次心跳
    this.pingIntervalTimer = window.setInterval(() => {
      this.sendPing();
    }, 15000);
  }

  private clearTimers() {
    if (this.pingIntervalTimer) {
      window.clearInterval(this.pingIntervalTimer);
      this.pingIntervalTimer = null;
    }
    if (this.pongTimeoutTimer) {
      window.clearTimeout(this.pongTimeoutTimer);
      this.pongTimeoutTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[WS] 已达最大重连次数，停止重连');
      return;
    }

    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts),
      15000
    );
    this.reconnectAttempts++;

    window.setTimeout(() => {
      if (!this.isExplicitlyClosed) {
        this.connect();
      }
    }, delay);
  }

  public getStatus(): boolean {
    return this.isConnected;
  }
}

export const wsService = new WebSocketClient();
