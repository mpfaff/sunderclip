import { Event, UnlistenFn, listen } from "@tauri-apps/api/event";

class Menubar {
  private unlisteners: UnlistenFn[] = new Array(MENUBAR_BTN_OPTS.length);
  private listeners: Map<MenubarBtnOption, Set<Function>> = new Map();

  async init() {
    for (let i = 0; i < MENUBAR_BTN_OPTS.length; i++) {
      const unlisten = await listen(MENUBAR_BTN_OPTS[i], this.handle);
      this.unlisteners[i] = unlisten;
    }
  }

  handle(event: Event<unknown>) {
    const listeners = this.listeners.get(event.event as MenubarBtnOption);

    if (listeners == null) return console.warn(`Listener not registered for event: ${event.event}`);

    for (const listener of listeners) listener(event.payload);
  }

  async addEventListener(key: MenubarBtnOption, callback: Function) {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());

    this.listeners.get(key)!.add(callback);
  }

  async removeEventListener(key: MenubarBtnOption, callback: Function) {
    const listener = this.listeners.get(key);
    if (listener == null) return console.warn(`Cannot remove non-existent listener for ${key}`);
    listener.delete(callback);

    if (listener.size === 0) this.listeners.delete(key);
  }

  cleanup() {
    for (const unlisten of this.unlisteners) unlisten();
  }
}

export type MenubarBtnOption = (typeof MENUBAR_BTN_OPTS)[number];
export const MENUBAR_BTN_OPTS = ["zoom_in", "zoom_out", "prefs", "new_proj"] as const;
export default new Menubar();
