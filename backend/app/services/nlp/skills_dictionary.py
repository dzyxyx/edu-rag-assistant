"""
Словарь компетенций для извлечения из текстов вакансий (FR-1.2).

Структура: категория -> список терминов (фраз). Сопоставление
регистронезависимое и идёт по словоформе как она встречается в тексте
(см. competency_extractor.py — используется spaCy PhraseMatcher с attr="LOWER").

Категории:
    hard_skill — языки программирования, фреймворки, технологии
    tool       — инструменты, СУБД, инфраструктура
    soft_skill — личностные/командные навыки
    methodology — методологии разработки/управления
"""

HARD_SKILLS = [
    "python", "java", "kotlin", "go", "golang", "rust", "c++", "c#", "php",
    "javascript", "typescript", "ruby", "scala", "1с", "1c",
    "django", "fastapi", "flask", "spring", "spring boot", "react", "vue",
    "angular", "node.js", "nodejs", "next.js", ".net", "asp.net",
    "html", "css", "sql", "nosql", "machine learning", "deep learning",
    "pandas", "numpy", "pytorch", "tensorflow", "scikit-learn", "spacy",
    "nlp", "computer vision", "rest api", "graphql", "grpc", "microservices",
    "микросервисы", "etl", "airflow", "spark", "hadoop", "большие данные",
    "big data", "data science", "анализ данных", "machine learning engineer",
]

TOOLS = [
    "docker", "kubernetes", "k8s", "git", "gitlab", "github", "jenkins",
    "ci/cd", "terraform", "ansible", "linux", "bash", "nginx", "postgresql",
    "postgres", "mysql", "mongodb", "redis", "kafka", "rabbitmq", "elasticsearch",
    "clickhouse", "grafana", "prometheus", "aws", "azure", "gcp", "yandex cloud",
    "1с:предприятие", "jira", "confluence", "figma", "tableau", "power bi",
    "excel", "google sheets",
]

SOFT_SKILLS = [
    "коммуникабельность", "командная работа", "работа в команде",
    "ответственность", "стрессоустойчивость", "многозадачность",
    "тайм-менеджмент", "управление временем", "критическое мышление",
    "лидерство", "проактивность", "адаптивность", "обучаемость",
    "внимательность к деталям", "грамотная речь", "клиентоориентированность",
    "решение проблем", "проблем-солвинг", "аналитическое мышление",
]

METHODOLOGIES = [
    "agile", "scrum", "kanban", "devops", "lean", "waterfall",
    "tdd", "bdd", "code review", "pair programming",
]

SKILLS_DICTIONARY: dict[str, list[str]] = {
    "hard_skill": HARD_SKILLS,
    "tool": TOOLS,
    "soft_skill": SOFT_SKILLS,
    "methodology": METHODOLOGIES,
}
