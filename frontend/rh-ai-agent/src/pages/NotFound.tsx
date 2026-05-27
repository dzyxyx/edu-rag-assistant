import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function NotFound() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
      <div className="text-6xl font-bold text-primary mb-4">404</div>
      <h1 className="text-2xl font-bold text-text-primary mb-2">
        {t('common.notFound.title', 'Страница не найдена')}
      </h1>
      <p className="text-text-secondary mb-6 max-w-md">
        {t('common.notFound.message', 'Запрошенная страница не существует или была перемещена.')}
      </p>
      <Button onClick={() => navigate('/')}>
        {t('common.notFound.back', 'Вернуться на главную')}
      </Button>
    </div>
  )
}