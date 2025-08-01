/**
 * Chrome Extension API の型定義
 */

declare namespace chrome {
  namespace storage {
    interface StorageArea {
      get(keys: string | string[] | { [key: string]: any } | null): Promise<{ [key: string]: any }>;
      set(items: { [key: string]: any }): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
      clear(): Promise<void>;
      getBytesInUse(keys?: string | string[] | null): Promise<number>;
      onChanged: chrome.events.Event<(changes: { [key: string]: StorageChange }, areaName: string) => void>;
    }
    
    interface StorageChange {
      oldValue?: any;
      newValue?: any;
    }
    
    const local: StorageArea;
    const sync: StorageArea;
    const managed: StorageArea;
    const session: StorageArea;
    
    const onChanged: chrome.events.Event<(changes: { [key: string]: StorageChange }, areaName: string) => void>;
  }
  
  namespace runtime {
    interface MessageSender {
      tab?: chrome.tabs.Tab;
      frameId?: number;
      id?: string;
      url?: string;
      tlsChannelId?: string;
    }
    
    interface Port {
      name: string;
      disconnect(): void;
      onDisconnect: chrome.events.Event<(port: Port) => void>;
      onMessage: chrome.events.Event<(message: any, port: Port) => void>;
      postMessage(message: any): void;
      sender?: MessageSender;
    }
    
    const id: string;
    const lastError: { message: string } | null;
    
    function sendMessage(message: any): Promise<any>;
    function sendMessage(extensionId: string, message: any): Promise<any>;
    function getURL(path: string): string;
    function getManifest(): chrome.runtime.Manifest;
    function connect(extensionId?: string, connectInfo?: { name?: string; includeTlsChannelId?: boolean }): Port;
    function reload(): void;
    function requestUpdateCheck(): Promise<{ status: string; version?: string }>;
    function restart(): void;
    function restartAfterDelay(seconds: number): void;
    function setUninstallURL(url: string): Promise<void>;
    function openOptionsPage(): Promise<void>;
    
    const onMessage: chrome.events.Event<(message: any, sender: MessageSender, sendResponse: (response?: any) => void) => void>;
    const onConnect: chrome.events.Event<(port: Port) => void>;
    const onInstalled: chrome.events.Event<(details: { reason: string; previousVersion?: string; id?: string }) => void>;
    const onStartup: chrome.events.Event<() => void>;
    const onSuspend: chrome.events.Event<() => void>;
    const onSuspendCanceled: chrome.events.Event<() => void>;
    const onUpdateAvailable: chrome.events.Event<(details: { version: string }) => void>;
    const onBrowserUpdateAvailable: chrome.events.Event<() => void>;
    const onRestartRequired: chrome.events.Event<(reason: string) => void>;
  }
  
  namespace action {
    interface BadgeColorDetails {
      color: string | [number, number, number, number];
      tabId?: number;
    }
    
    interface BadgeTextDetails {
      text: string;
      tabId?: number;
    }
    
    interface TitleDetails {
      title: string;
      tabId?: number;
    }
    
    function setBadgeBackgroundColor(details: BadgeColorDetails): Promise<void>;
    function setBadgeText(details: BadgeTextDetails): Promise<void>;
    function getBadgeText(details: { tabId?: number }): Promise<string>;
    function setTitle(details: TitleDetails): Promise<void>;
    function getTitle(details: { tabId?: number }): Promise<string>;
    function enable(tabId?: number): Promise<void>;
    function disable(tabId?: number): Promise<void>;
    function isEnabled(details: { tabId?: number }): Promise<boolean>;
    
    const onClicked: chrome.events.Event<(tab: chrome.tabs.Tab) => void>;
  }
  
  namespace tabs {
    interface Tab {
      id?: number;
      index: number;
      windowId: number;
      openerTabId?: number;
      selected: boolean;
      highlighted: boolean;
      active: boolean;
      pinned: boolean;
      audible?: boolean;
      discarded: boolean;
      autoDiscardable: boolean;
      mutedInfo?: MutedInfo;
      url?: string;
      title?: string;
      favIconUrl?: string;
      status?: string;
      incognito: boolean;
      width?: number;
      height?: number;
      sessionId?: string;
    }
    
    interface MutedInfo {
      muted: boolean;
      reason?: string;
      extensionId?: string;
    }
    
    interface CreateProperties {
      windowId?: number;
      index?: number;
      url?: string;
      active?: boolean;
      selected?: boolean;
      pinned?: boolean;
      openerTabId?: number;
    }
    
    function create(createProperties: CreateProperties): Promise<Tab>;
    function get(tabId: number): Promise<Tab>;
    function query(queryInfo: {
      active?: boolean;
      pinned?: boolean;
      audible?: boolean;
      muted?: boolean;
      highlighted?: boolean;
      discarded?: boolean;
      autoDiscardable?: boolean;
      currentWindow?: boolean;
      lastFocusedWindow?: boolean;
      status?: string;
      title?: string;
      url?: string | string[];
      windowId?: number;
      windowType?: string;
      index?: number;
    }): Promise<Tab[]>;
    function update(tabId: number, updateProperties: {
      url?: string;
      active?: boolean;
      highlighted?: boolean;
      selected?: boolean;
      pinned?: boolean;
      muted?: boolean;
      openerTabId?: number;
      autoDiscardable?: boolean;
    }): Promise<Tab>;
    function reload(tabId?: number, reloadProperties?: { bypassCache?: boolean }): Promise<void>;
    function remove(tabIds: number | number[]): Promise<void>;
    
    const onCreated: chrome.events.Event<(tab: Tab) => void>;
    const onUpdated: chrome.events.Event<(tabId: number, changeInfo: any, tab: Tab) => void>;
    const onRemoved: chrome.events.Event<(tabId: number, removeInfo: { windowId: number; isWindowClosing: boolean }) => void>;
    const onActivated: chrome.events.Event<(activeInfo: { tabId: number; windowId: number }) => void>;
  }
  
  namespace notifications {
    interface NotificationOptions {
      type?: string;
      iconUrl?: string;
      title?: string;
      message?: string;
      contextMessage?: string;
      priority?: number;
      eventTime?: number;
      buttons?: Array<{ title: string; iconUrl?: string }>;
      imageUrl?: string;
      items?: Array<{ title: string; message: string }>;
      progress?: number;
      isClickable?: boolean;
      requireInteraction?: boolean;
      silent?: boolean;
    }
    
    function create(notificationId: string, options: NotificationOptions): Promise<string>;
    function create(options: NotificationOptions): Promise<string>;
    function update(notificationId: string, options: NotificationOptions): Promise<boolean>;
    function clear(notificationId: string): Promise<boolean>;
    function getAll(): Promise<{ [notificationId: string]: NotificationOptions }>;
    function getPermissionLevel(): Promise<string>;
    
    const onClicked: chrome.events.Event<(notificationId: string) => void>;
    const onButtonClicked: chrome.events.Event<(notificationId: string, buttonIndex: number) => void>;
    const onClosed: chrome.events.Event<(notificationId: string, byUser: boolean) => void>;
    const onShowSettings: chrome.events.Event<() => void>;
    const onPermissionLevelChanged: chrome.events.Event<(level: string) => void>;
  }
  
  namespace alarms {
    interface Alarm {
      name: string;
      scheduledTime: number;
      periodInMinutes?: number;
    }
    
    interface AlarmCreateInfo {
      when?: number;
      delayInMinutes?: number;
      periodInMinutes?: number;
    }
    
    function create(name: string, alarmInfo: AlarmCreateInfo): void;
    function create(alarmInfo: AlarmCreateInfo): void;
    function get(name: string): Promise<Alarm | undefined>;
    function getAll(): Promise<Alarm[]>;
    function clear(name: string): Promise<boolean>;
    function clearAll(): Promise<boolean>;
    
    const onAlarm: chrome.events.Event<(alarm: Alarm) => void>;
  }
  
  namespace events {
    interface Event<T extends Function> {
      addListener(callback: T): void;
      removeListener(callback: T): void;
      hasListener(callback: T): boolean;
      hasListeners(): boolean;
      getRules(callback: (rules: Rule[]) => void): void;
      getRules(ruleIdentifiers: string[], callback: (rules: Rule[]) => void): void;
      addRules(rules: Rule[], callback?: (rules: Rule[]) => void): void;
      removeRules(ruleIdentifiers?: string[], callback?: () => void): void;
    }
    
    interface Rule {
      id?: string;
      tags?: string[];
      conditions: any[];
      actions: any[];
      priority?: number;
    }
  }
  
  namespace runtime {
    interface Manifest {
      name: string;
      version: string;
      manifest_version: number;
      description?: string;
      permissions?: string[];
      host_permissions?: string[];
      content_scripts?: ContentScript[];
      background?: {
        service_worker?: string;
        scripts?: string[];
        page?: string;
        persistent?: boolean;
      };
      action?: {
        default_popup?: string;
        default_title?: string;
        default_icon?: string | { [size: string]: string };
      };
      icons?: { [size: string]: string };
      web_accessible_resources?: Array<{
        resources: string[];
        matches: string[];
      }>;
    }
    
    interface ContentScript {
      matches: string[];
      exclude_matches?: string[];
      css?: string[];
      js?: string[];
      run_at?: string;
      all_frames?: boolean;
      exclude_globs?: string[];
      include_globs?: string[];
      match_about_blank?: boolean;
    }
  }
}

// グローバル変数として chrome を宣言
declare const chrome: typeof chrome;