export interface PlatformAuthPayload {
  userId: string
  role: string
  token: string
}

function isInIframe(): boolean {
  try {
    return window.parent !== window
  } catch {
    return false
  }
}

export const PlatformBridge = {
  async init(): Promise<PlatformAuthPayload | null> {
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
    if (!isInIframe()) return
    try {
      window.parent?.postMessage({ type: 'AGENT_EVENT', event, payload }, '*')
    } catch {
    }
  }
}