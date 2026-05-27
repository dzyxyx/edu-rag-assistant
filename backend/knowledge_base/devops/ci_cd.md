# CI/CD: непрерывная интеграция и поставка

## Непрерывная интеграция (Continuous Integration)

CI — практика, при которой разработчики интегрируют код в общий репозиторий несколько раз в день. Каждый коммит автоматически проверяется: сборка + тесты.

### Принципы CI:
- Единый репозиторий с общей веткой (main/trunk)
- Автоматическая сборка при каждом коммите
- Быстрые тесты (< 10 минут)
- Сборка не должна падать — если упала, исправить немедленно
- Разработчики делают коммиты минимум раз в день

### Типичный CI-пайплайн:
```
Коммит → Lint → Unit Tests → Build → Integration Tests → Артефакт
```

## Непрерывная поставка (Continuous Delivery)

Continuous Delivery — расширение CI. Код всегда находится в состоянии, готовом к деплою в production. Деплой — осознанное решение человека (нажатие кнопки).

## Непрерывное развёртывание (Continuous Deployment)

Continuous Deployment — автоматический деплой каждого изменения, прошедшего все проверки, прямо в production. Без участия человека.

### Разница:
- **CI** — автоматическая интеграция и тестирование
- **Continuous Delivery** — всегда готов к релизу, деплой вручную
- **Continuous Deployment** — автоматический деплой в production

## GitHub Actions

GitHub Actions — платформа CI/CD встроенная в GitHub.

### Структура workflow:
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: pytest
```

### Ключевые понятия:
- **Workflow** — автоматизированный процесс (файл .yml в .github/workflows/)
- **Job** — набор шагов, выполняемых на одном runner
- **Step** — отдельная задача (action или shell-команда)
- **Runner** — сервер, на котором выполняется job
- **Action** — переиспользуемый компонент

## GitLab CI/CD

GitLab CI описывается в файле `.gitlab-ci.yml` в корне репозитория.

### Пример пайплайна:
```yaml
stages:
  - test
  - build
  - deploy

test:
  stage: test
  script:
    - pytest --cov

build:
  stage: build
  script:
    - docker build -t myapp:$CI_COMMIT_SHA .

deploy:
  stage: deploy
  script:
    - kubectl set image deployment/myapp app=myapp:$CI_COMMIT_SHA
  only:
    - main
```

## Стратегии деплоя

### Blue-Green Deployment
Две одинаковые production-среды (blue и green). Новая версия деплоится в неактивную среду, затем трафик переключается. При проблемах — мгновенный откат.

### Canary Deployment
Новая версия получает небольшой процент трафика (5-10%). При нормальной работе процент постепенно увеличивается до 100%.

### Rolling Update
Постепенная замена старых инстансов новыми. В любой момент часть инстансов работает на старой версии, часть — на новой.

### Feature Flags
Функциональность деплоится, но включается/выключается конфигурацией без нового деплоя. Позволяет тестировать в production на части пользователей.
