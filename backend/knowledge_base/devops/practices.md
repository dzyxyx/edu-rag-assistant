# DevOps-практики: Docker, Kubernetes, IaC

## Docker

Docker — платформа для разработки, доставки и запуска приложений в контейнерах.

### Ключевые понятия:
- **Image** — неизменяемый снимок приложения со всеми зависимостями
- **Container** — запущенный экземпляр image
- **Dockerfile** — инструкция для сборки image
- **Registry** — хранилище images (Docker Hub, GitLab Registry, ECR)
- **Docker Compose** — инструмент для запуска multi-container приложений

### Пример Dockerfile:
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0"]
```

### Лучшие практики:
- Использовать конкретные теги (не `latest`)
- Минимизировать слои и размер образа
- Не запускать процессы от root
- Использовать multi-stage builds для production

## Kubernetes (K8s)

Kubernetes — система оркестрации контейнеров. Автоматизирует деплой, масштабирование и управление контейнеризованными приложениями.

### Ключевые объекты:
- **Pod** — минимальная единица развёртывания, один или несколько контейнеров
- **Deployment** — описывает желаемое состояние подов, управляет обновлениями
- **Service** — стабильная точка доступа к подам (ClusterIP, NodePort, LoadBalancer)
- **ConfigMap / Secret** — конфигурация и секреты для подов
- **Ingress** — HTTP/HTTPS-маршрутизация извне в сервисы
- **Namespace** — логическое разделение ресурсов

### Пример Deployment:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    spec:
      containers:
      - name: myapp
        image: myapp:1.0.0
        resources:
          requests:
            memory: "128Mi"
            cpu: "250m"
          limits:
            memory: "256Mi"
            cpu: "500m"
```

## Инфраструктура как код (IaC)

IaC — практика управления инфраструктурой через машиночитаемые файлы конфигурации.

### Преимущества:
- Воспроизводимость — одинаковая инфраструктура в dev/staging/prod
- Версионирование — история изменений в Git
- Автоматизация — нет ручных операций
- Документация — код описывает, что задеплоено

### Terraform
Декларативный инструмент для provisioning инфраструктуры в облаке (AWS, GCP, Azure и другие).

```hcl
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"
  tags = {
    Name = "WebServer"
  }
}
```

### Ansible
Инструмент для конфигурирования серверов. Agentless (работает через SSH). Конфигурация описывается в playbooks (YAML).

## Site Reliability Engineering (SRE)

SRE — практика, разработанная Google. Применяет принципы программной инженерии к задачам эксплуатации.

### Ключевые концепции:
- **SLI (Service Level Indicator)** — измеримый показатель качества сервиса (например, latency p99)
- **SLO (Service Level Objective)** — целевое значение SLI (например, p99 latency < 200ms)
- **SLA (Service Level Agreement)** — договорённость с клиентом о уровне сервиса
- **Error Budget** — допустимое количество ошибок. Если бюджет исчерпан — новые фичи не деплоятся, команда занимается надёжностью.
- **Toil** — ручная, повторяющаяся операционная работа. SRE стремится автоматизировать toil (цель: < 50% времени на toil).

### Принцип: надёжность важнее скорости
SRE считает, что 100% надёжность невозможна и не нужна. Правильно выбранный SLO (например, 99.9%) оставляет место для инноваций.
