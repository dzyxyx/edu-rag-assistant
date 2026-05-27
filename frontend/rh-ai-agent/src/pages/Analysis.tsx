import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAppStore } from '@/store/useAppStore'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { CheckCircle2, AlertTriangle, TrendingUp, ArrowUpRight, Minus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const radarData = [
  { skill: 'Python', market: 95, program: 60 },
  { skill: 'ML/AI', market: 88, program: 30 },
  { skill: 'DevOps', market: 72, program: 45 },
  { skill: 'NLP', market: 65, program: 15 },
  { skill: 'Backend', market: 80, program: 70 }
]

const skills = [
  { name: 'Python', demand: 95, inProgram: 60, trend: 'up' },
  { name: 'ML/AI', demand: 88, inProgram: 30, trend: 'up' },
  { name: 'DevOps', demand: 72, inProgram: 45, trend: 'stable' },
  { name: 'NLP', demand: 65, inProgram: 15, trend: 'up' },
  { name: 'Backend', demand: 80, inProgram: 70, trend: 'stable' }
]

export default function Analysis() {
  const { t } = useTranslation()
  const { ui, setAnalysisApproved, locale } = useAppStore()

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('analysis.title')}</h1>
          <p className="text-text-secondary mt-1">{t('analysis.subtitle')}</p>
        </div>
        {!ui.analysisApproved ? (
          <Button onClick={() => setAnalysisApproved(true)} className="bg-amber-500 hover:bg-amber-600 text-white">
            <AlertTriangle size={16} className="mr-2" />
            {t('analysis.approve')}
          </Button>
        ) : (
          <Badge variant="success" className="flex items-center gap-1 px-3 py-1">
            <CheckCircle2 size={14} /> {locale === 'ru' ? 'Стратегия утверждена' : 'Strategy Approved'}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-semibold text-text-primary mb-4">{t('analysis.profileTitle')}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: '#64748B', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name={locale === 'ru' ? 'Рынок' : 'Market'} dataKey="market" stroke="#020817" fill="#020817" fillOpacity={0.8} />
                <Radar name={locale === 'ru' ? 'Программа' : 'Program'} dataKey="program" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.5} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold text-text-primary mb-4">{t('analysis.gapTitle')}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={radarData} barCategoryGap="40%">
                <XAxis dataKey="skill" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0' }} />
                <Bar dataKey="market" fill="#020817" radius={[4, 4, 0, 0]} name={locale === 'ru' ? 'Рынок' : 'Market'} />
                <Bar dataKey="program" fill="#CBD5E1" radius={[4, 4, 0, 0]} name={locale === 'ru' ? 'В программе' : 'In Program'} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {!ui.analysisApproved && (
        <Card className="bg-amber-50/50 border-amber-200">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 rounded-full text-amber-600">
              <AlertTriangle size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-text-primary mb-2">{t('analysis.alert.title')}</h3>
              <p className="text-text-secondary mb-4">
                {t('analysis.alert.message')}
              </p>
              <div className="flex gap-3">
                <Button onClick={() => setAnalysisApproved(true)} className="bg-amber-500 hover:bg-amber-600 text-white">
                  {t('analysis.alert.approveBtn')}
                </Button>
                <Button variant="secondary">{t('analysis.alert.adjustBtn')}</Button>
              </div>
            </div>
          </div>
        </Card>
      )}
      
      {ui.analysisApproved && (
         <Card>
           <h3 className="font-semibold text-text-primary mb-4">{t('analysis.artifact.title')}</h3>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="p-3 bg-slate-50 rounded-lg">
               <p className="text-xs text-text-secondary">{t('analysis.artifact.industry')}</p>
               <p className="font-bold text-text-primary">IT / ML</p>
             </div>
             <div className="p-3 bg-slate-50 rounded-lg">
               <p className="text-xs text-text-secondary">{t('analysis.artifact.skills')}</p>
               <p className="font-bold text-text-primary">Python, PyTorch</p>
             </div>
             <div className="p-3 bg-slate-50 rounded-lg">
               <p className="text-xs text-text-secondary">{t('analysis.artifact.niche')}</p>
               <p className="font-bold text-text-primary">NARS, RFT</p>
             </div>
             <div className="p-3 bg-slate-50 rounded-lg">
               <p className="text-xs text-text-secondary">{t('analysis.artifact.region')}</p>
               <p className="font-bold text-text-primary">{locale === 'ru' ? 'Москва, ЕКБ' : 'Moscow, EKB'}</p>
             </div>
           </div>
         </Card>
      )}

      <Card>
        <h3 className="font-semibold text-text-primary mb-4">{t('analysis.detailsTitle')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 font-medium text-text-secondary">{t('analysis.skill')}</th>
                <th className="pb-3 font-medium text-text-secondary">{t('analysis.demand')}</th>
                <th className="pb-3 font-medium text-text-secondary">{t('analysis.inProgram')}</th>
                <th className="pb-3 font-medium text-text-secondary">{t('analysis.trend')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {skills.map((s) => (
                <tr key={s.name}>
                  <td className="py-3 font-medium text-text-primary">{s.name}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-text-primary rounded-full" style={{ width: `${s.demand}%` }} />
                      </div>
                      <span className="text-text-secondary">{s.demand}%</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${s.inProgram}%` }} />
                      </div>
                      <span className="text-text-secondary">{s.inProgram}%</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <Badge variant={s.trend === 'up' ? 'success' : 'default'} className="flex items-center gap-1 w-fit">
                      {s.trend === 'up' ? <ArrowUpRight size={12} /> : <Minus size={12} />}
                      {s.trend === 'up' ? t('analysis.growing') : t('analysis.stable')}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}