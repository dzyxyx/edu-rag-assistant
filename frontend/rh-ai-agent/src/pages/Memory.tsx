import { useEffect, useRef, useState } from 'react'
import { useMemory } from '@/hooks/useMemory'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { BrainCircuit, RefreshCw, Info, ZoomIn, ZoomOut, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const GRAPH_TRANSLATIONS: Record<string, string> = {
  "Интеграция модуля для": "Module Integration for",
  "Интеграция модуля": "Module Integration",
  "Финансы": "Finance", "Телеком": "Telecom", "Промышленность": "Industry",
  "Финтех": "Fintech", "E-commerce": "E-commerce", "IT/Безопасность": "IT Security",
  "Backend": "Backend", "ML-инженер": "ML Engineer", "Разработчик": "Developer",
  "Аналитик": "Analyst", "Дизайнер": "Designer", "DevOps": "DevOps",
  "Python": "Python", "PyTorch": "PyTorch", "Docker": "Docker", "FastAPI": "FastAPI",
  "Data Science": "Data Science", "NLP": "NLP", "React": "React", "TypeScript": "TypeScript",
  "SQL": "SQL", "Node.js": "Node.js", "Vue": "Vue", "Go": "Go", "Scrapy": "Scrapy",
  "BeautifulSoup": "BeautifulSoup", "CatBoost": "CatBoost", "Airflow": "Airflow",
  "Активный": "Active", "Ожидание": "Pending", "Новый": "New"
}

const translateLabel = (label: string, type: string, locale: string): string => {
  if (locale === 'ru' || type === 'company') return label
  if (label.startsWith("Интеграция модуля для ")) {
    return `Module Integration for ${label.replace("Интеграция модуля для ", "")}`
  }
  return GRAPH_TRANSLATIONS[label] || label
}

interface Node {
  id: string
  label: string
  type: 'company' | 'skill' | 'competency'
  x: number
  y: number
  vx: number
  vy: number
  weight: number
  radius: number
  connections?: Array<{ to_id: number }>
}

interface Link {
  source: string
  target: string
}

export default function Memory() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  
  const { nodes: apiNodes, isLoading, updateWeights, isUpdating } = useMemory()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const animationRef = useRef<number>()

  // 🔥 Безопасная работа с данными
  const safeNodes = apiNodes || []

  const initializeNodes = (): { nodes: Node[]; links: Link[] } => {
    const nodes: Node[] = []
    const links: Link[] = []
    const addedIds = new Set<string>()

    // 🔥 Фильтрация с защитой от undefined
    const companies = safeNodes.filter(n => n?.type === 'company')
    const skills = safeNodes.filter(n => n?.type === 'skill')
    const competencies = safeNodes.filter(n => n?.type === 'competency')

    companies.forEach((n, i) => {
      const angle = (i / Math.max(companies.length, 1)) * Math.PI * 2
      const radius = 180
      nodes.push({
        id: String(n.id), label: n.label, type: n.type,
        x: 300 + Math.cos(angle) * radius, y: 300 + Math.sin(angle) * radius,
        vx: 0, vy: 0, weight: n.weight || 0, radius: Math.max(10, Math.min(28, (n.weight || 0) * 3))
      })
      addedIds.add(String(n.id))
    })

    skills.forEach((n, i) => {
      const angle = (i / Math.max(skills.length, 1)) * Math.PI * 2
      const radius = 200
      nodes.push({
        id: String(n.id), label: translateLabel(n.label, n.type, locale), type: n.type,
        x: 700 + Math.cos(angle) * radius, y: 300 + Math.sin(angle) * radius,
        vx: 0, vy: 0, weight: n.weight || 0, radius: Math.max(7, Math.min(16, (n.weight || 0) * 2))
      })
      addedIds.add(String(n.id))
    })

    competencies.forEach((n, i) => {
      const x = 150 + (i * 120) % 700
      nodes.push({
        id: String(n.id), label: translateLabel(n.label, n.type, locale), type: n.type,
        x: x, y: 120, vx: 0, vy: 0, weight: n.weight || 0, radius: Math.max(7, Math.min(14, (n.weight || 0) * 2))
      })
      addedIds.add(String(n.id))
    })

    // 🔥 Безопасная обработка связей
    safeNodes.forEach(n => {
      const connections = n.connections || []
      connections.forEach(conn => {
        if (conn?.to_id && addedIds.has(String(conn.to_id))) {
          links.push({ source: String(n.id), target: String(conn.to_id) })
        }
      })
    })

    return { nodes, links }
  }

  const simulateForce = (nodes: Node[], links: Link[], iterations: number = 250) => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const center = { x: 450, y: 300 }
    
    for (let iter = 0; iter < iterations; iter++) {
      const temperature = 1 - iter / iterations
      nodes.forEach(n => { n.vx = 0; n.vy = 0 })

      links.forEach(link => {
        const source = nodeMap.get(link.source)
        const target = nodeMap.get(link.target)
        if (source && target) {
          const dx = target.x - source.x; const dy = target.y - source.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = (dist - 160) * 0.006
          const fx = (dx / dist) * force; const fy = (dy / dist) * force
          source.vx += fx; source.vy += fy; target.vx -= fx; target.vy -= fy
        }
      })

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i]; const n2 = nodes[j]
          const dx = n2.x - n1.x; const dy = n2.y - n1.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = 1500 / (dist * 1.2)
          const fx = (dx / dist) * force; const fy = (dy / dist) * force
          n1.vx -= fx; n1.vy -= fy; n2.vx += fx; n2.vy += fy
        }
      }

      nodes.forEach(n => {
        const dx = center.x - n.x; const dy = center.y - n.y
        n.vx += dx * 0.0008; n.vy += dy * 0.0008
      })

      nodes.forEach(n => {
        n.x += n.vx * temperature * 8
        n.y += n.vy * temperature * 8
        n.x = Math.max(60, Math.min(840, n.x))
        n.y = Math.max(60, Math.min(540, n.y))
      })
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { nodes, links } = initializeNodes()
    if (nodes.length === 0) return // 🔥 Не рисуем если нет данных

    simulateForce(nodes, links, 250)

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.translate(offset.x, offset.y)
      ctx.scale(scale, scale)

      ctx.strokeStyle = '#94A3B8'
      ctx.lineWidth = 1.2
      ctx.globalAlpha = 0.4
      links.forEach(link => {
        const source = nodes.find(n => n.id === link.source)
        const target = nodes.find(n => n.id === link.target)
        if (source && target) {
          ctx.beginPath(); ctx.moveTo(source.x, source.y); ctx.lineTo(target.x, target.y); ctx.stroke()
        }
      })
      ctx.globalAlpha = 1

      nodes.forEach(node => {
        ctx.beginPath(); ctx.arc(node.x + 2, node.y + 2, node.radius, 0, 2 * Math.PI)
        ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fill()

        ctx.beginPath(); ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI)
        if (node.type === 'company') {
          const g = ctx.createRadialGradient(node.x - 4, node.y - 4, 0, node.x, node.y, node.radius)
          g.addColorStop(0, '#60A5FA'); g.addColorStop(1, '#2563EB'); ctx.fillStyle = g
        } else if (node.type === 'skill') {
          const g = ctx.createRadialGradient(node.x - 4, node.y - 4, 0, node.x, node.y, node.radius)
          g.addColorStop(0, '#34D399'); g.addColorStop(1, '#059669'); ctx.fillStyle = g
        } else {
          const g = ctx.createRadialGradient(node.x - 4, node.y - 4, 0, node.x, node.y, node.radius)
          g.addColorStop(0, '#FBBF24'); g.addColorStop(1, '#D97706'); ctx.fillStyle = g
        }
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.stroke()
        
        ctx.font = `${node.weight > 5 ? '600' : '500'} 11px Inter`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        const metrics = ctx.measureText(node.label)
        const pad = 5; const h = 16
        const w = metrics.width + pad * 2
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
        ctx.beginPath()
        if (ctx.roundRect) {
          ctx.roundRect(node.x - w/2, node.y + node.radius + 4, w, h, 4)
        } else {
          ctx.rect(node.x - w/2, node.y + node.radius + 4, w, h)
        }
        ctx.fill()
        
        ctx.fillStyle = '#0F172A'
        ctx.fillText(node.label, node.x, node.y + node.radius + 12)
      })

      ctx.restore()
      animationRef.current = requestAnimationFrame(draw)
    }

    draw()
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.92 : 1.08
      setScale(prev => Math.max(0.4, Math.min(2.5, prev * delta)))
    }
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      canvas.removeEventListener('wheel', handleWheel)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [safeNodes, scale, offset, locale])

  const handleMouseDown = (e: React.MouseEvent) => { setIsDragging(true); setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y }) }
  const handleMouseMove = (e: React.MouseEvent) => { if (isDragging) setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }) }
  const handleMouseUp = () => setIsDragging(false)

  // 🔥 Безопасный расчёт статистики
  const stats = {
    companies: safeNodes.filter(n => n?.type === 'company').length,
    skills: safeNodes.filter(n => n?.type === 'skill').length,
    connections: safeNodes.reduce((acc, n) => acc + ((n.connections?.length) || 0), 0) / 2
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin mr-2" /> {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('memory.title')}</h1>
          <p className="text-text-secondary mt-1">{t('memory.subtitle')}</p>
        </div>
        <Badge variant="info" className="flex items-center gap-2">
          <BrainCircuit size={14} /> {t('memory.companies')}: {safeNodes.length}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold text-text-primary mb-3">{t('memory.structure')}</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-text-secondary">{t('memory.companies')}</span><span className="font-bold">{stats.companies}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">{t('memory.skills')}</span><span className="font-bold">{stats.skills}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">{t('memory.connections')}</span><span className="font-bold">{Math.round(stats.connections)}</span></div>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-text-primary mb-2">{t('memory.legend')}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-primary shadow-sm"></div><span>{t('memory.company')}</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-status-success shadow-sm"></div><span>{t('memory.skill')}</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-status-warning shadow-sm"></div><span>{t('memory.competency')}</span></div>
            </div>
          </Card>

          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setScale(s => Math.min(2.5, s * 1.2))}><ZoomIn size={14} className="mr-1" />+</Button>
            <Button variant="secondary" size="sm" onClick={() => setScale(s => Math.max(0.4, s * 0.8))}><ZoomOut size={14} className="mr-1" />-</Button>
            <Button variant="secondary" size="sm" onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }) }}><RefreshCw size={14} /></Button>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-800 border border-blue-200">
            <div className="flex items-start gap-2">
              <Info size={14} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold mb-1">{t('memory.howItWorks.title')}</p>
                <p>{t('memory.howItWorks.message')}</p>
                <p className="mt-2 text-blue-600">{t('memory.howItWorks.hint')}</p>
              </div>
            </div>
          </div>
        </div>

        <Card className="lg:col-span-3 p-0 overflow-hidden relative bg-slate-50 min-h-[500px] cursor-move">
          <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg border border-border text-xs font-medium shadow-sm">
            RFT Graph Visualization
          </div>
          <canvas 
            ref={canvasRef} 
            width={900} 
            height={600} 
            className="w-full h-full block"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ touchAction: 'none' }}
          />
        </Card>
      </div>
    </div>
  )
}