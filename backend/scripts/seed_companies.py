"""
Скрипт заполнения БД тестовыми компаниями Уральского региона.

Запуск:
    cd backend
    python scripts/seed_companies.py
"""

import asyncio
import sys
from pathlib import Path

# Добавляем корень проекта в sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.session import AsyncSessionFactory
from app.db.repositories.company import CompanyRepository
from app.services.scoring.company_scorer import CompanyScorer
import app.db.models  # noqa: F401 — регистрирует все модели

COMPANIES = [
    {
        "name": "СКБ Контур",
        "inn": "6663003127",
        "website": "https://kontur.ru",
        "description": (
            "Один из крупнейших разработчиков программного обеспечения в России. "
            "Разрабатывает облачные сервисы для бизнеса: электронная отчётность, "
            "ЭДО, CRM, бухгалтерия. Использует Python, Java, Kotlin, React, Kubernetes, "
            "DevOps-практики, Agile/Scrum. Активно привлекает студентов на стажировки "
            "и практики, проводит хакатоны для университетов."
        ),
        "industry": "Разработка ПО, SaaS",
        "region": "Екатеринбург",
        "employee_count": 8000,
        "email": "hr@skbkontur.ru",
        "phone": "+7 (343) 278-88-88",
        "status": "shortlisted",
        "source": "manual",
    },
    {
        "name": "Уралсиб Технологии",
        "inn": "6671412630",
        "website": "https://uralsib.ru",
        "description": (
            "IT-подразделение финансовой группы Уралсиб. Разрабатывает банковские "
            "системы и цифровые продукты. Стек: Java, Python, PostgreSQL, Kafka, "
            "Docker, микросервисная архитектура. Проводит стажировки для студентов "
            "технических специальностей."
        ),
        "industry": "Финтех, Банковское ПО",
        "region": "Екатеринбург",
        "employee_count": 500,
        "email": "careers@uralsib.ru",
        "status": "raw",
        "source": "manual",
    },
    {
        "name": "Тензор",
        "inn": "7605016030",
        "website": "https://tensor.ru",
        "description": (
            "Разработчик системы СБИС — комплексного решения для бизнеса: "
            "электронный документооборот, CRM, учёт персонала. "
            "Технологии: Python, C++, JavaScript, React, PostgreSQL, CI/CD, Agile. "
            "Имеет программу для молодых специалистов и выпускников вузов."
        ),
        "industry": "Разработка ПО, ERP",
        "region": "Екатеринбург",
        "employee_count": 3000,
        "email": "job@tensor.ru",
        "status": "scored",
        "source": "manual",
    },
    {
        "name": "ИТ-Интегратор",
        "website": "https://it-integrator.ru",
        "description": (
            "Системный интегратор, реализует проекты по автоматизации предприятий "
            "на базе 1С, SAP, Microsoft. Использует DevOps-инструменты, "
            "занимается цифровой трансформацией промышленных предприятий региона. "
            "Открыт к партнёрству с вузами для подготовки специалистов."
        ),
        "industry": "Системная интеграция, 1С",
        "region": "Екатеринбург",
        "employee_count": 150,
        "email": "info@it-integrator.ru",
        "status": "raw",
        "source": "manual",
    },
    {
        "name": "УГМК-Телеком",
        "inn": "6672200900",
        "website": "https://ugmk-telecom.ru",
        "description": (
            "Телекоммуникационная компания холдинга УГМК. Развивает сети связи, "
            "облачные сервисы и корпоративные IT-решения для промышленных предприятий. "
            "Применяет Python, Golang, Kubernetes, микросервисы, DevOps."
        ),
        "industry": "Телекоммуникации, Облачные сервисы",
        "region": "Екатеринбург",
        "employee_count": 300,
        "email": "hr@ugmk-telecom.ru",
        "status": "raw",
        "source": "manual",
    },
    {
        "name": "Naumen",
        "inn": "6670092756",
        "website": "https://naumen.ru",
        "description": (
            "Российский разработчик платформы для автоматизации бизнес-процессов "
            "и контакт-центров. Продукты: Naumen Service Desk, Naumen Contact Center. "
            "Стек: Java, Kotlin, React, TypeScript, PostgreSQL, Kafka, Docker, Scrum. "
            "Регулярно берёт студентов на практику и стажировку, сотрудничает с УрФУ."
        ),
        "industry": "Разработка ПО, BPM",
        "region": "Екатеринбург",
        "employee_count": 700,
        "email": "career@naumen.ru",
        "phone": "+7 (343) 253-20-80",
        "status": "approved",
        "source": "manual",
    },
    {
        "name": "Directum",
        "inn": "1840003331",
        "website": "https://directum.ru",
        "description": (
            "Разработчик системы электронного документооборота и управления "
            "бизнес-процессами DIRECTUM RX. Использует .NET, React, PostgreSQL, "
            "Docker, CI/CD, Agile. Имеет университетскую программу — "
            "берёт студентов на практику и проводит курсы."
        ),
        "industry": "Разработка ПО, СЭД",
        "region": "Ижевск / Екатеринбург",
        "employee_count": 600,
        "email": "work@directum.ru",
        "status": "shortlisted",
        "source": "manual",
    },
    {
        "name": "Softline Екатеринбург",
        "website": "https://softline.ru",
        "description": (
            "Региональный офис крупного IT-дистрибьютора и интегратора. "
            "Занимается поставкой ПО, облачными решениями Microsoft Azure, AWS, "
            "информационной безопасностью. Есть программы стажировок для студентов."
        ),
        "industry": "IT-дистрибуция, Облачные решения",
        "region": "Екатеринбург",
        "employee_count": 200,
        "email": "ekb@softline.ru",
        "status": "raw",
        "source": "manual",
    },
    {
        "name": "Уральский центр систем безопасности",
        "inn": "6670073788",
        "website": "https://ussb.ru",
        "description": (
            "Разработчик решений в области информационной безопасности. "
            "Продукты для защиты персональных данных, аудит IT-инфраструктур. "
            "Использует Python, Linux, Docker. Участвует в образовательных программах "
            "по кибербезопасности совместно с УрФУ."
        ),
        "industry": "Информационная безопасность",
        "region": "Екатеринбург",
        "employee_count": 80,
        "email": "info@ussb.ru",
        "status": "interested",
        "source": "manual",
    },
    {
        "name": "Контакт Центр",
        "website": "https://contact-center.ru",
        "description": (
            "Разработчик AI-решений для автоматизации клиентского обслуживания. "
            "Продукты на базе машинного обучения, NLP, Python, TensorFlow. "
            "Молодая компания, активно ищет выпускников и стажёров."
        ),
        "industry": "AI, NLP, Автоматизация",
        "region": "Екатеринбург",
        "employee_count": 45,
        "email": "hr@contact-center.ru",
        "status": "raw",
        "source": "manual",
    },
]


async def seed():
    scorer = CompanyScorer()
    async with AsyncSessionFactory() as session:
        repo = CompanyRepository(session)
        created_count = 0
        skipped_count = 0

        for data in COMPANIES:
            name = data["name"]
            existing = await repo.get_by_name(name)
            if existing:
                print(f"  SKIP  {name} (уже существует)")
                skipped_count += 1
                continue

            company, _ = await repo.upsert_by_name(**data)

            # Скоринг
            scores = scorer.score(company)
            await repo.update_scores(company.id, **scores)

            print(f"  OK    {name} | score={scores['score']:.2f} | status={data.get('status', 'raw')}")
            created_count += 1

        await session.commit()
        print(f"\nГотово: создано {created_count}, пропущено {skipped_count}")


if __name__ == "__main__":
    asyncio.run(seed())
