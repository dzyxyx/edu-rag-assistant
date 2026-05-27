export interface PlatformAuthPayload {
  userId: string
  role: string
  token: string
}

// 🔥 Безопасная проверка: находимся ли мы внутри iframe
function isInIframe(): boolean {
  try {
    return window.parent !== window
  } catch {
    // Если доступ к parent запрещён — считаем, что мы не в iframe
    return false
  }
}

export const PlatformBridge = {
  async init(): Promise<PlatformAuthPayload | null> {
    // 🔥 Сначала проверяем, что мы в iframe — БЕЗ доступа к parent в условии
    if (!isInIframe()) {
      console.log('PlatformBridge: standalone mode, skipping auth')
      return null
    }

    return new Promise((resolve) => {
      let resolved = false

      const handleMessage = (e: MessageEvent) => {
        if (e.data?.type === 'PROCOMP_AUTH' && !resolved) {
          resolved = true
          try {
            window.removeEventListener('message', handleMessage)
          } catch {}
          clearTimeout(timeoutId)
          console.log('PlatformBridge: auth received')
          resolve(e.data.payload)
        }
      }

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true
          try {
            window.removeEventListener('message', handleMessage)
          } catch {}
          console.warn('PlatformBridge: auth timeout')
          resolve(null)
        }
      }, 3000)

      try {
        window.addEventListener('message', handleMessage)
        // 🔥 postMessage только если точно в iframe
        window.parent?.postMessage({ type: 'REQUEST_AUTH' }, '*')
      } catch (err) {
        console.warn('PlatformBridge: communication failed', err)
        if (!resolved) {
          resolved = true
          resolve(null)
        }
      }
    })
  },

  notify(event: string, payload: unknown) {
    // 🔥 Безопасная отправка
    if (!isInIframe()) return
    try {
      window.parent?.postMessage({ type: 'AGENT_EVENT', event, payload }, '*')
    } catch {
      // Игнорируем ошибки
    }
  }
}