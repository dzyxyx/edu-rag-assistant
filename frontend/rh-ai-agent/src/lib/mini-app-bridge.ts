/**
 * Mini App Bridge for ProCompetencies Integration
 * Позволяет приложению общаться с родительским окном (iframe)
 */

export interface MiniAppMessage {
  type: string
  payload?: any
}

export const MiniAppBridge = {
  // Отправить событие родителю
  send: (type: string, payload?: any) => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type, payload }, '*')
    }
  },

  // Запросить данные у родителя (например, токен)
  request: (type: string): Promise<any> => {
    return new Promise((resolve) => {
      const handler = (event: MessageEvent) => {
        if (event.data.type === type) {
          resolve(event.data.payload)
          window.removeEventListener('message', handler)
        }
      }
      window.addEventListener('message', handler)
      MiniAppBridge.send(type)
    })
  },

  // Сообщить высоту контента (чтобы iframe растягивался)
  updateHeight: () => {
    const height = document.documentElement.scrollHeight
    MiniAppBridge.send('RESIZE', { height })
  },

  // Слушать события от платформы (например, смена темы или выход)
  on: (type: string, callback: (payload: any) => void) => {
    window.addEventListener('message', (event) => {
      if (event.data.type === type) {
        callback(event.data.payload)
      }
    })
  }
}