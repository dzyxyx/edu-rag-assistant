# Frontend — rh-ai-agent

## Стек технологий

| Слой | Технологии |
|------|------------|
| **Фреймворк** | React 18, TypeScript |
| **Сборка** | Vite |
| **Управление состоянием** | Zustand (клиентское), TanStack Query (серверное) |
| **Маршрутизация** | React Router v6 |
| **Стилизация** | Tailwind CSS |
| **UI компоненты** | Кастомная библиотека (Card, Badge, Button, Modal) |
| **HTTP клиент** | Axios |
| **Валидация** | Zod |
| **Формы** | React Hook Form |
| **Графики** | Recharts |
| **Интернационализация** | i18next |
| **WebSocket** | Native WebSocket API |
| **Чат** | Streaming через WebSocket |

## Быстрый старт

### 1. Установка зависимостей

```bash
cd frontend/rh-ai-agent
npm install
```
### 2. Переменные окружения
```bash
cp .env
# Отредактируй .env под свои значения
```

### 3. Запуск в режиме разработки
```bash
npm run dev
```
Приложение будет доступно по адресу: http://localhost:5173

### 4. Сборка для production
```bash
npm run build
```
### 5. Предпросмотр production сборки
```bash
npm run preview
```

## Переменные окружения
| Переменная | Описание |
|------------|-----|
| **VITE_API_URL** | Базовый URL API бэкенда |

## Доступные скрипты
| Команда | Описание |
|------------|-----|
| **npm run dev** | Запуск в режиме разработки |
| **npm run build** | Сборка production версии |
| **npm run preview** | Предпросмотр production сборки |
| **npm run lint** | Проверка кода ESLint |
| **npm run type-check** | Проверка типов TypeScript |

## Структура проекта
```
rh-ai-agent/
│
├── public/ # Публичные статические файлы
│
├── src/ # Исходный код приложения
│ │
│ ├── api/ # API клиенты и типизация
│ │ ├── clients.ts # HTTP и WebSocket клиенты
│ │ ├── endpoints.ts # Все API эндпоинты
│ │ └── types.ts # TypeScript интерфейсы и типы
│ │
│ ├── assets/ # Статические ресурсы
│ │ ├── hero.png
│ │ ├── react.svg
│ │ └── vite.svg
│ │
│ ├── components/ # Переиспользуемые компоненты
│ │ │
│ │ ├── layout/ # Компоненты макета
│ │ │ └── AppShell.tsx # Основная обёртка приложения (шапка, сайдбар)
│ │ │
│ │ └── ui/ # UI компоненты
│ │   ├── Badge.tsx # Бейдж для статусов
│ │   ├── Button.tsx # Кнопка с вариантами (primary, secondary, ghost)
│ │   ├── Card.tsx # Карточка с тенями и скруглениями
│ │   ├── ChatButton.tsx # Кнопка открытия чата
│ │   ├── ChatSidebar.tsx # Сайдбар с историей чатов
│ │   ├── ChatWindow.tsx # Окно чата с ИИ-агентом
│ │   ├── ErrorBoundary.tsx # Перехват ошибок рендеринга
│ │   ├── LanguageToggle.tsx # Переключатель языка
│ │   ├── Modal.tsx # Модальное окно
│ │   ├── NotificationDropdown.tsx # Выпадающий список уведомлений
│ │   ├── ProtectedRoute.tsx # Защита маршрутов 
│ │   ├── ToastContainer.tsx # Контейнер для всплывающих уведомлений
│ │   └── Translatable.tsx # Компонент автоматического перевода
│ │
│ ├── hooks/ # Кастомные React хуки
│ │ ├── useAuth.ts # Авторизация (логин, регистрация, токен)
│ │ ├── useChat.ts # WebSocket чат с ИИ
│ │ ├── useChatSessions.ts # Управление сессиями чата
│ │ ├── useCompanies.ts # CRUD операции с компаниями, скоринг
│ │ ├── useDashboard.ts # Метрики и графики дашборда
│ │ ├── useMemory.ts # Память агента 
│ │ ├── useNotifications.ts # Уведомления пользователя
│ │ ├── useOutreach.ts # Коммуникации
│ │ ├── useProjects.ts # Управление проектами
│ │ └── useAutoTranslate.ts # Автоматический перевод UI текста
│ │
│ ├── lib/ # Утилиты и вспомогательные модули
│ │ ├── export.ts # Экспорт данных 
│ │ ├── mini-app-bridge.ts # Интеграция с мини-приложениями 
│ │ ├── platform-bridge.ts 
│ │ ├── utils.ts # Общие утилиты 
│ │ └── websocket.ts # WebSocket менеджер с переподключением
│ │
│ ├── pages/ # Страницы приложения
│ │ ├── Analysis.tsx # Аналитика и матрица компетенций
│ │ ├── Communications.tsx # Коммуникации
│ │ ├── Companies.tsx # Управление компаниями 
│ │ ├── Dashboard.tsx # Главная страница с метриками
│ │ ├── Login.tsx # Страница входа
│ │ ├── Memory.tsx # Визуализация памяти агента 
│ │ ├── NotFound.tsx # Страница 404
│ │ ├── Projects.tsx # Управление проектами
│ │ ├── Register.tsx # Страница регистрации
│ │ └── Settings.tsx # Настройки профиля
│ │
│ ├── store/ # Zustand хранилища
│ │ └── useAppStore.ts # Глобальное UI состояние (сайдбар, токен)
│ │
│ ├── App.tsx # Корневой компонент
│ ├── i18n.ts # Конфигурация i18n
│ ├── main.tsx # Точка входа (рендеринг приложения)
│ ├── routes.tsx # Конфигурация маршрутов
│ └── index.css # Глобальные стили (Tailwind + базовые)
└── README.md 
```
