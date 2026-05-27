export interface PlatformAuthPayload {
  userId: string
  role: string
  token: string
}

export const PlatformBridge = {
  async init(): Promise<PlatformAuthPayload> {
    // Заглушка. В продакшене: слушать postMessage от ProCompetencies
    return new Promise((resolve) => {
      if (import.meta.env.DEV) {
        setTimeout(() => resolve({ userId: 'dev-1', role: 'admin', token: 'mock-jwt' }), 500)
      } else {
        window.addEventListener('message', (e) => {
          if (e.data?.type === 'PROCOMP_AUTH') resolve(e.data.payload)
        })
        window.parent.postMessage({ type: 'REQUEST_AUTH' }, '*')
      }
    })
  },
  notify(event: string, payload: unknown) {
    window.parent.postMessage({ type: 'AGENT_EVENT', event, payload }, '*')
  }
}