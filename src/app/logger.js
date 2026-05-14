export function createLogger(logsEl) {
  return {
    log(msg) {
      logsEl.textContent += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
    },
    clear() {
      logsEl.textContent = '';
    },
  };
}
