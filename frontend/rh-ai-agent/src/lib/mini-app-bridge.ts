// 🔥 Безопасная проверка iframe
function isInIframe(): boolean {
  try {
    return window.parent !== window
  } catch {
    return false
  }
}

export const MiniAppBridge = {
  send: (type: string, payload?: any) => {
    if (!isInIframe()) return
    try {
      window.parent?.postMessage({ type, payload }, '*')
    } catch {
      // ignore
    }
  },

  updateHeight: () => {
    if (!isInIframe()) return
    try {
      const height = document.documentElement.scrollHeight
      MiniAppBridge.send('RESIZE', { height, timestamp: Date.now() })
    } catch {
      // ignore
    }
  },

  on: (type: string, callback: (payload: any) => void) => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === type) {
        callback(event.data.payload)
      }
    }
    window.addEventListener('message', handler)
    return () => {
      try {
        window.removeEventListener('message', handler)
      } catch {}
    }
  }
}