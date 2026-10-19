export type DebugValue = number | boolean | string | null;
export interface DebugSample { x: number; value: DebugValue; }
export interface DebugChannel {
  id: string;
  label?: string;
  group?: string;
  kind?: 'number' | 'boolean' | 'text';
  unit?: string;
  basis?: string;
  value: DebugValue;
  /** Supplied domain in the channel's native units. Otherwise derived from samples. */
  domain?: [number, number] | null;
  samples?: DebugSample[];
}
export interface DebugTrace {
  id?: string;
  x?: number | null;
  op?: string;
  text?: string;
  level?: 'info' | 'warning' | 'error';
  fields?: Record<string, DebugValue>;
}
export interface DebugPacket {
  version: 1;
  /** Change epoch when source/session changes. Never combine unrelated executions. */
  epoch?: string;
  title?: string;
  cursor?: number | null;
  axis?: { label?: string; unit?: string };
  status?: string;
  channels?: DebugChannel[];
  traces?: DebugTrace[];
  provenance?: string[];
  notices?: string[];
}
export interface DebugAdapter {
  snapshot?(): DebugPacket | null | Promise<DebugPacket | null>;
  subscribe?(receive: (packet: DebugPacket) => void): (() => void) | void;
}
export interface DebugView {
  id: string;
  label?: string;
  mount(container: HTMLElement, tools: {document: Document; format(value: DebugValue): string}): {
    update?(packet: DebugPacket, tools: {channels: DebugChannel[]; format(value: DebugValue): string}): void;
    destroy?(): void;
  };
}
export interface DebugPanel {
  element: HTMLElement;
  update(packet: DebugPacket): void;
  connect(adapter: DebugAdapter | null): void;
  setView(id: string): void;
  setFrozen(frozen: boolean): void;
  setVisible(visible: boolean): void;
  refresh(): void;
  registerView(view: DebugView): () => void;
  getState(): {view: string; frozen: boolean; visible: boolean; epoch: string; channels: number; cursor: number | null};
  destroy(): void;
}
export interface DebugOptions {
  document?: Document;
  adapter?: DebugAdapter | null;
  title?: string;
  view?: 'overview' | 'scope' | 'lanes' | 'metrics' | 'program' | 'raw' | 'overwhelm';
  sprite?: string;
  onError?(error: unknown): void;
}
export interface SharedUIDebugAPI { createDebugPanel(options?: DebugOptions): DebugPanel; }
/** Runtime API: window.SharedUI.createDebugPanel. This declaration describes the optional bundle. */
