import html2pdf from 'html2pdf.js'
import { useAppStore } from '@/store/useAppStore'
import i18n from '@/i18n'

// 🔥 Вспомогательная функция для создания контейнера с правильным шрифтом (Решает проблему "кракозябр")
const createPdfContainer = (contentHTML: string) => {
  const element = document.createElement('div')
  // Явно указываем шрифт с поддержкой кириллицы
  element.style.fontFamily = '"Roboto", "Arial", sans-serif' 
  element.style.padding = '20px'
  element.style.color = '#0F172A'
  element.style.background = '#FFFFFF'
  element.style.lineHeight = '1.5'
  element.style.fontSize = '14px'
  
  // Внедряем ссылку на шрифт прямо в элемент, чтобы он подгрузился при генерации PDF
  element.innerHTML = `
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
    ${contentHTML}
  `
  return element
}

// 1. Отчет по компаниям
export function exportCompaniesReport() {
  const { companies } = useAppStore.getState()
  const t = i18n.t
  
  const rows = companies.map(c => `
    <tr>
      <td style="padding: 8px; border: 1px solid #E2E8F0;">${c.name}</td>
      <td style="padding: 8px; border: 1px solid #E2E8F0;">${c.industry}</td>
      <td style="padding: 8px; border: 1px solid #E2E8F0; text-align: center; font-weight: 600;">${c.score}/100</td>
      <td style="padding: 8px; border: 1px solid #E2E8F0;">${c.region}</td>
      <td style="padding: 8px; border: 1px solid #E2E8F0;">${c.status}</td>
    </tr>
  `).join('')

  const content = `
    <div style="margin-bottom: 20px;">
      <h1 style="font-size: 24px; color: #155DFC; margin: 0 0 8px 0;">${t('companies.title')}</h1>
      <p style="margin: 0; color: #64748B;">${new Date().toLocaleDateString()}</p>
    </div>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <thead>
        <tr style="background: #F1F5F9;">
          <th style="padding: 8px; border: 1px solid #E2E8F0; text-align: left;">${t('companies.table.company')}</th>
          <th style="padding: 8px; border: 1px solid #E2E8F0; text-align: left;">${t('companies.table.industry')}</th>
          <th style="padding: 8px; border: 1px solid #E2E8F0; text-align: center;">${t('companies.table.scoring')}</th>
          <th style="padding: 8px; border: 1px solid #E2E8F0; text-align: left;">${t('companies.table.region')}</th>
          <th style="padding: 8px; border: 1px solid #E2E8F0; text-align: left;">${t('companies.table.status')}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `
  
  const opt = {
    margin: 10,
    filename: `Report_Companies_${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
  }
  
  html2pdf().set(opt).from(createPdfContainer(content)).save()
}

// 2. Отчет по проектам (🔥 ДОБАВЛЕНО)
export function exportProjectsReport() {
  const { projects } = useAppStore.getState()
  const t = i18n.t
  const { locale } = useAppStore.getState()

  const rows = (projects || []).map((p: any) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #E2E8F0;">${p.title || '-'}</td>
      <td style="padding: 8px; border: 1px solid #E2E8F0;">${p.partner || '-'}</td>
      <td style="padding: 8px; border: 1px solid #E2E8F0;">${p.complexity || '-'}</td>
      <td style="padding: 8px; border: 1px solid #E2E8F0;">${(p.roles || []).join(', ')}</td>
      <td style="padding: 8px; border: 1px solid #E2E8F0;">${p.isPublished ? (locale === 'ru' ? 'Опубликован' : 'Published') : (locale === 'ru' ? 'Черновик' : 'Draft')}</td>
    </tr>
  `).join('')

  const content = `
    <div style="margin-bottom: 20px;">
      <h1 style="font-size: 24px; color: #155DFC; margin: 0 0 8px 0;">${t('projects.title')}</h1>
      <p style="margin: 0; color: #64748B;">${new Date().toLocaleDateString()}</p>
    </div>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <thead>
        <tr style="background: #F1F5F9;">
          <th style="padding: 8px; border: 1px solid #E2E8F0; text-align: left;">${t('projects.title')}</th>
          <th style="padding: 8px; border: 1px solid #E2E8F0; text-align: left;">${t('projects.empty.message').split(' ').slice(-1)[0] || 'Partner'}</th>
          <th style="padding: 8px; border: 1px solid #E2E8F0; text-align: left;">${t('projects.empty.tip').split(' ')[1] || 'Complexity'}</th>
          <th style="padding: 8px; border: 1px solid #E2E8F0; text-align: left;">${t('projects.roles')}</th>
          <th style="padding: 8px; border: 1px solid #E2E8F0; text-align: left;">${t('projects.published')}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `
  
  const opt = {
    margin: 10,
    filename: `Report_Projects_${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
  }
  
  html2pdf().set(opt).from(createPdfContainer(content)).save()
}

// 3. Партнерский пакет материалов (PDF)
export function exportPartnerMaterials() {
  const t = i18n.t
  const { locale } = useAppStore.getState()
  
  const isRu = locale === 'ru'
  
  const content = `
    <div style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid #155DFC; padding-bottom: 20px;">
      <h1 style="font-size: 32px; color: #155DFC; margin: 0;">${isRu ? 'ПроКомпетенции' : 'ProCompetencies'}</h1>
      <p style="font-size: 18px; color: #64748B;">${isRu ? 'Партнерский пакет документов' : 'Partner Information Pack'}</p>
    </div>

    <h2 style="color: #155DFC; margin-top: 30px;">${isRu ? '👋 О программе' : '👋 About the Program'}</h2>
    <p style="margin-bottom: 20px;">
      ${isRu 
        ? 'Платформа УрФУ, соединяющая студентов с бизнесом для проектного обучения.' 
        : 'UrFU platform connecting students with business for project-based learning.'}
    </p>

    <h2 style="color: #155DFC; margin-top: 30px;">❓ FAQ</h2>
    <div style="margin-top: 15px;">
      <p><strong>1. ${isRu ? 'Обязательства?' : 'Obligations?'}</strong><br/>${isRu ? 'Гибкие форматы, от менторства до ТЗ.' : 'Flexible formats, from mentoring to TZ.'}</p>
      <p><strong>2. ${isRu ? 'Код?' : 'Code?'}</strong><br/>${isRu ? 'Передача прав по соглашению.' : 'Rights transfer via agreement.'}</p>
    </div>

    <div style="margin-top: 50px; text-align: center; color: #94A3B8; font-size: 12px;">
      Generated: ${new Date().toLocaleDateString()}
    </div>
  `

  const opt = {
    margin: 15,
    filename: `Partner_Pack_${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }
  
  html2pdf().set(opt).from(createPdfContainer(content)).save()
}