/**
 * Tovyr Rust Core Browser Harness
 * Inspired by Browser Use's Rust-based browser automation
 * Provides TypeScript interface to Rust browser automation backend
 */

export interface BrowserHarness {
  id: string;
  name: string;
  config: HarnessConfig;
  sessions: Map<string, BrowserSession>;
  statistics: HarnessStatistics;
  metadata: HarnessMetadata;
}

export interface HarnessConfig {
  headless: boolean;
  viewportWidth: number;
  viewportHeight: number;
  userAgent?: string;
  locale?: string;
  timezone?: string;
  enableCookies: boolean;
  enableCache: boolean;
  enableJavaScript: boolean;
  enableImages: boolean;
  proxy?: ProxyConfig;
  downloadPath?: string;
  timeout: number;
}

export interface ProxyConfig {
  server: string;
  port: number;
  username?: string;
  password?: string;
}

export interface BrowserSession {
  id: string;
  browserId: string;
  status: SessionStatus;
  url: string;
  title: string;
  cookies: Cookie[];
  tabs: Tab[];
  activeTabId: number;
  createdAt: number;
  lastActivity: number;
}

export type SessionStatus = 'active' | 'idle' | 'closed' | 'crashed';

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: SameSite;
}

export type SameSite = 'strict' | 'lax' | 'none';

export interface Tab {
  id: number;
  url: string;
  title: string;
  status: TabStatus;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

export type TabStatus = 'loading' | 'complete' | 'error';

export interface HarnessStatistics {
  totalSessions: number;
  activeSessions: number;
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  averageActionDuration: number;
  totalBytesDownloaded: number;
  uptime: number;
  startTime: number;
}

export interface HarnessMetadata {
  version: string;
  rustVersion: string;
  chromiumVersion: string;
  startTime: number;
  totalOperations: number;
}

export interface BrowserAction {
  type: ActionType;
  tabId: number;
  selector?: string;
  data?: unknown;
  timeout?: number;
}

export type ActionType = 
  | 'navigate'
  | 'click'
  | 'input'
  | 'select'
  | 'scroll'
  | 'wait'
  | 'screenshot'
  | 'pdf'
  | 'evaluate'
  | 'execute'
  | 'goto'
  | 'back'
  | 'forward'
  | 'refresh'
  | 'close';

export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
}

export interface ElementInfo {
  tagName: string;
  text: string;
  attributes: Record<string, string>;
  visible: boolean;
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  status?: number;
  type: ResourceType;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
}

export type ResourceType = 'document' | 'stylesheet' | 'image' | 'font' | 'script' | 'xhr' | 'fetch' | 'websocket' | 'other';

export interface ConsoleMessage {
  level: ConsoleLevel;
  text: string;
  url?: string;
  line?: number;
  column?: number;
  timestamp: number;
}

export type ConsoleLevel = 'log' | 'warn' | 'error' | 'debug' | 'info';

class BrowserHarnessManager {
  private harnesses: Map<string, BrowserHarness> = new Map();

  /**
   * Create a browser harness
   */
  createHarness(name: string, config?: Partial<HarnessConfig>): BrowserHarness {
    const harness: BrowserHarness = {
      id: this.generateHarnessId(),
      name,
      config: {
        headless: config?.headless ?? true,
        viewportWidth: config?.viewportWidth || 1920,
        viewportHeight: config?.viewportHeight || 1080,
        userAgent: config?.userAgent,
        locale: config?.locale || 'en-US',
        timezone: config?.timezone || 'America/New_York',
        enableCookies: config?.enableCookies ?? true,
        enableCache: config?.enableCache ?? true,
        enableJavaScript: config?.enableJavaScript ?? true,
        enableImages: config?.enableImages ?? true,
        proxy: config?.proxy,
        downloadPath: config?.downloadPath,
        timeout: config?.timeout || 30000,
      },
      sessions: new Map(),
      statistics: {
        totalSessions: 0,
        activeSessions: 0,
        totalActions: 0,
        successfulActions: 0,
        failedActions: 0,
        averageActionDuration: 0,
        totalBytesDownloaded: 0,
        uptime: 0,
        startTime: Date.now(),
      },
      metadata: {
        version: '1.0.0',
        rustVersion: '1.70.0',
        chromiumVersion: '120.0.6099.109',
        startTime: Date.now(),
        totalOperations: 0,
      },
    };

    this.harnesses.set(harness.id, harness);
    return harness;
  }

  /**
   * Get a harness
   */
  getHarness(harnessId: string): BrowserHarness | undefined {
    return this.harnesses.get(harnessId);
  }

  /**
   * Get all harnesses
   */
  getAllHarnesses(): BrowserHarness[] {
    return Array.from(this.harnesses.values());
  }

  /**
   * Delete a harness
   */
  deleteHarness(harnessId: string): boolean {
    return this.harnesses.delete(harnessId);
  }

  /**
   * Create a browser session
   */
  async createSession(harnessId: string): Promise<BrowserSession | undefined> {
    const harness = this.harnesses.get(harnessId);
    if (!harness) return undefined;

    try {
      // Simulate Rust backend call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const session: BrowserSession = {
        id: this.generateSessionId(),
        browserId: harness.id,
        status: 'active',
        url: 'about:blank',
        title: 'New Tab',
        cookies: [],
        tabs: [
          {
            id: 1,
            url: 'about:blank',
            title: 'New Tab',
            status: 'complete',
            loading: false,
            canGoBack: false,
            canGoForward: false,
          },
        ],
        activeTabId: 1,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };

      harness.sessions.set(session.id, session);
      harness.statistics.totalSessions++;
      harness.statistics.activeSessions++;
      harness.metadata.totalOperations++;

      return session;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get a session
   */
  getSession(harnessId: string, sessionId: string): BrowserSession | undefined {
    const harness = this.harnesses.get(harnessId);
    if (!harness) return undefined;

    return harness.sessions.get(sessionId);
  }

  /**
   * Close a session
   */
  async closeSession(harnessId: string, sessionId: string): Promise<boolean> {
    const harness = this.harnesses.get(harnessId);
    if (!harness) return false;

    const session = harness.sessions.get(sessionId);
    if (!session) return false;

    try {
      // Simulate Rust backend call
      await new Promise(resolve => setTimeout(resolve, 500));

      session.status = 'closed';
      harness.statistics.activeSessions--;
      harness.metadata.totalOperations++;

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Execute a browser action
   */
  async executeAction(harnessId: string, sessionId: string, action: BrowserAction): Promise<ActionResult> {
    const harness = this.harnesses.get(harnessId);
    if (!harness) {
      return {
        success: false,
        error: 'Harness not found',
        duration: 0,
      };
    }

    const session = harness.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        error: 'Session not found',
        duration: 0,
      };
    }

    const startTime = Date.now();

    try {
      // Simulate Rust backend action execution
      await new Promise(resolve => setTimeout(resolve, this.getActionDelay(action.type)));

      const result = await this.performAction(session, action);

      session.lastActivity = Date.now();
      harness.statistics.totalActions++;
      harness.statistics.successfulActions++;
      harness.statistics.averageActionDuration = this.updateAverage(
        harness.statistics.averageActionDuration,
        harness.statistics.totalActions,
        Date.now() - startTime
      );
      harness.metadata.totalOperations++;

      return {
        success: true,
        data: result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      harness.statistics.totalActions++;
      harness.statistics.failedActions++;
      harness.metadata.totalOperations++;

      return {
        success: false,
        error: String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get element info
   */
  async getElementInfo(harnessId: string, sessionId: string, tabId: number, selector: string): Promise<ElementInfo | undefined> {
    const harness = this.harnesses.get(harnessId);
    if (!harness) return undefined;

    const session = harness.sessions.get(sessionId);
    if (!session) return undefined;

    try {
      // Simulate Rust backend call
      await new Promise(resolve => setTimeout(resolve, 200));

      // Return mock element info
      return {
        tagName: 'div',
        text: 'Sample element',
        attributes: { id: 'sample', class: 'element' },
        visible: true,
        enabled: true,
        x: 100,
        y: 200,
        width: 300,
        height: 50,
      };
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get network requests
   */
  async getNetworkRequests(harnessId: string, sessionId: string, tabId: number): Promise<NetworkRequest[]> {
    const harness = this.harnesses.get(harnessId);
    if (!harness) return [];

    const session = harness.sessions.get(sessionId);
    if (!session) return [];

    try {
      // Simulate Rust backend call
      await new Promise(resolve => setTimeout(resolve, 100));

      // Return mock network requests
      return [
        {
          id: 'req-1',
          url: session.url,
          method: 'GET',
          status: 200,
          type: 'document',
          headers: {},
          timestamp: Date.now(),
        },
      ];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get console messages
   */
  async getConsoleMessages(harnessId: string, sessionId: string, tabId: number): Promise<ConsoleMessage[]> {
    const harness = this.harnesses.get(harnessId);
    if (!harness) return [];

    const session = harness.sessions.get(sessionId);
    if (!session) return [];

    try {
      // Simulate Rust backend call
      await new Promise(resolve => setTimeout(resolve, 100));

      // Return mock console messages
      return [
        {
          level: 'log',
          text: 'Page loaded',
          timestamp: Date.now(),
        },
      ];
    } catch (error) {
      return [];
    }
  }

  /**
   * Take screenshot
   */
  async takeScreenshot(harnessId: string, sessionId: string, tabId: number, format: 'png' | 'jpeg' = 'png'): Promise<string | undefined> {
    const harness = this.harnesses.get(harnessId);
    if (!harness) return undefined;

    const session = harness.sessions.get(sessionId);
    if (!session) return undefined;

    try {
      // Simulate Rust backend call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Return base64 encoded screenshot
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get cookies
   */
  async getCookies(harnessId: string, sessionId: string): Promise<Cookie[]> {
    const harness = this.harnesses.get(harnessId);
    if (!harness) return [];

    const session = harness.sessions.get(sessionId);
    if (!session) return [];

    return session.cookies;
  }

  /**
   * Set cookie
   */
  async setCookie(harnessId: string, sessionId: string, cookie: Cookie): Promise<boolean> {
    const harness = this.harnesses.get(harnessId);
    if (!harness) return false;

    const session = harness.sessions.get(sessionId);
    if (!session) return false;

    try {
      // Simulate Rust backend call
      await new Promise(resolve => setTimeout(resolve, 100));

      session.cookies.push(cookie);
      harness.metadata.totalOperations++;

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get statistics for a harness
   */
  getStatistics(harnessId: string): HarnessStatistics | undefined {
    const harness = this.harnesses.get(harnessId);
    if (!harness) return undefined;

    // Update active sessions count
    harness.statistics.activeSessions = Array.from(harness.sessions.values())
      .filter(s => s.status === 'active').length;

    // Update uptime
    harness.statistics.uptime = Date.now() - harness.statistics.startTime;

    return { ...harness.statistics };
  }

  /**
   * Reset statistics for a harness
   */
  resetStatistics(harnessId: string): boolean {
    const harness = this.harnesses.get(harnessId);
    if (!harness) return false;

    harness.statistics = {
      totalSessions: harness.sessions.size,
      activeSessions: 0,
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
      averageActionDuration: 0,
      totalBytesDownloaded: 0,
      uptime: 0,
      startTime: Date.now(),
    };

    harness.metadata.totalOperations++;

    return true;
  }

  // Private methods

  private async performAction(session: BrowserSession, action: BrowserAction): Promise<unknown> {
    switch (action.type) {
      case 'navigate':
        session.url = action.data as string;
        session.title = 'Navigated Page';
        return { url: session.url };

      case 'click':
        return { clicked: true };

      case 'input':
        return { input: action.data };

      case 'scroll':
        return { scrolled: true };

      case 'screenshot':
        return 'screenshot-data';

      case 'back':
        return { navigated: 'back' };

      case 'forward':
        return { navigated: 'forward' };

      case 'refresh':
        return { refreshed: true };

      case 'close':
        return { closed: true };

      default:
        return { performed: action.type };
    }
  }

  private getActionDelay(type: ActionType): number {
    const delays: Record<ActionType, number> = {
      navigate: 1000,
      click: 200,
      input: 300,
      select: 200,
      scroll: 100,
      wait: 500,
      screenshot: 500,
      pdf: 1000,
      evaluate: 300,
      execute: 300,
      goto: 1000,
      back: 500,
      forward: 500,
      refresh: 500,
      close: 200,
    };
    return delays[type] || 300;
  }

  private updateAverage(current: number, count: number, newValue: number): number {
    if (count === 1) return newValue;
    return (current * (count - 1) + newValue) / count;
  }

  private generateHarnessId(): string {
    return `harness-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Helper functions
export function createBrowserAction(
  type: ActionType,
  tabId: number,
  selector?: string,
  data?: unknown,
  timeout?: number
): BrowserAction {
  return {
    type,
    tabId,
    selector,
    data,
    timeout,
  };
}

export function createCookie(
  name: string,
  value: string,
  domain: string,
  path: string = '/',
  expires?: number,
  httpOnly: boolean = false,
  secure: boolean = false,
  sameSite: SameSite = 'lax'
): Cookie {
  return {
    name,
    value,
    domain,
    path,
    expires,
    httpOnly,
    secure,
    sameSite,
  };
}

export function createProxyConfig(
  server: string,
  port: number,
  username?: string,
  password?: string
): ProxyConfig {
  return {
    server,
    port,
    username,
    password,
  };
}

// Global browser harness manager instance
const browserHarnessManager = new BrowserHarnessManager();

export function createBrowserHarness(name: string, config?: Partial<HarnessConfig>): BrowserHarness {
  return browserHarnessManager.createHarness(name, config);
}

export function getBrowserHarness(harnessId: string): BrowserHarness | undefined {
  return browserHarnessManager.getHarness(harnessId);
}

export function getAllBrowserHarnesses(): BrowserHarness[] {
  return browserHarnessManager.getAllHarnesses();
}

export function deleteBrowserHarness(harnessId: string): boolean {
  return browserHarnessManager.deleteHarness(harnessId);
}

export async function createBrowserSession(harnessId: string): Promise<BrowserSession | undefined> {
  return browserHarnessManager.createSession(harnessId);
}

export function getBrowserSession(harnessId: string, sessionId: string): BrowserSession | undefined {
  return browserHarnessManager.getSession(harnessId, sessionId);
}

export async function closeBrowserSession(harnessId: string, sessionId: string): Promise<boolean> {
  return browserHarnessManager.closeSession(harnessId, sessionId);
}

export async function executeBrowserAction(harnessId: string, sessionId: string, action: BrowserAction): Promise<ActionResult> {
  return browserHarnessManager.executeAction(harnessId, sessionId, action);
}

export async function getElementInfo(harnessId: string, sessionId: string, tabId: number, selector: string): Promise<ElementInfo | undefined> {
  return browserHarnessManager.getElementInfo(harnessId, sessionId, tabId, selector);
}

export async function getNetworkRequests(harnessId: string, sessionId: string, tabId: number): Promise<NetworkRequest[]> {
  return browserHarnessManager.getNetworkRequests(harnessId, sessionId, tabId);
}

export async function getConsoleMessages(harnessId: string, sessionId: string, tabId: number): Promise<ConsoleMessage[]> {
  return browserHarnessManager.getConsoleMessages(harnessId, sessionId, tabId);
}

export async function takeBrowserScreenshot(harnessId: string, sessionId: string, tabId: number, format: 'png' | 'jpeg' = 'png'): Promise<string | undefined> {
  return browserHarnessManager.takeScreenshot(harnessId, sessionId, tabId, format);
}

export async function getBrowserCookies(harnessId: string, sessionId: string): Promise<Cookie[]> {
  return browserHarnessManager.getCookies(harnessId, sessionId);
}

export async function setBrowserCookie(harnessId: string, sessionId: string, cookie: Cookie): Promise<boolean> {
  return browserHarnessManager.setCookie(harnessId, sessionId, cookie);
}

export function getHarnessStatistics(harnessId: string): HarnessStatistics | undefined {
  return browserHarnessManager.getStatistics(harnessId);
}

export function resetHarnessStatistics(harnessId: string): boolean {
  return browserHarnessManager.resetStatistics(harnessId);
}
