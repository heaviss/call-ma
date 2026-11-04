export interface Logger {
  log(msg: string): void;
  clear(): void;
}

export function createLogger(logsEl: Element): Logger {
  return {
    log(msg) {
      logsEl.textContent += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
    },
    clear() {
      logsEl.textContent = '';
    },
  };
}
