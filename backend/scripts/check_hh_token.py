"""
Проверка интеграции с HH.ru API.

Запуск:
    cd backend
    python scripts/check_hh_token.py

Что делает:
1. Получает application-токен через OAuth2 client_credentials
   (HH_CLIENT_ID / HH_CLIENT_SECRET из .env).
2. Делает тестовый запрос к /vacancies с этим токеном.
3. Делает тестовый запрос к /employers/{id} по одной из найденных вакансий.

Никаких записей в БД не делает — только проверка авторизации и доступа к API.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx

from app.core.config import settings
from app.integrations.hh.client import HHClient, get_cached_application_token


async def main():
    print("=" * 60)
    print("Проверка интеграции с HH.ru")
    print("=" * 60)

    # 1. Проверка наличия данных в .env
    if not settings.HH_CLIENT_ID or not settings.HH_CLIENT_SECRET:
        print("ОШИБКА: HH_CLIENT_ID / HH_CLIENT_SECRET не заданы в .env")
        return
    print(f"HH_CLIENT_ID: {settings.HH_CLIENT_ID[:8]}...")
    print(f"HH_AREA_ID:   {settings.HH_AREA_ID}")

    # 2. Получение токена
    print("\n[1/3] Получение application-токена...")
    try:
        token = await get_cached_application_token(
            client_id=settings.HH_CLIENT_ID,
            client_secret=settings.HH_CLIENT_SECRET,
        )
        print(f"OK: токен получен (длина {len(token)} символов)")
    except httpx.HTTPStatusError as e:
        print(f"ОШИБКА при получении токена: {e.response.status_code} {e.response.text}")
        return
    except Exception as e:
        print(f"ОШИБКА при получении токена: {e}")
        return

    # 3. Тестовый запрос вакансий
    print("\n[2/3] Тестовый запрос вакансий (ключевое слово 'Python разработчик')...")
    try:
        async with HHClient(access_token=token) as hh:
            vacancies = await hh.search_vacancies(
                text="Python разработчик",
                area=settings.HH_AREA_ID,
                per_page=5,
                pages=1,
            )
            print(f"OK: найдено вакансий: {len(vacancies)}")
            for v in vacancies[:3]:
                print(f"   - {v.name} | работодатель: {v.employer.name}")

            # 4. Тестовый запрос работодателя по первой вакансии
            if vacancies:
                print("\n[3/3] Тестовый запрос данных работодателя...")
                emp_id = vacancies[0].employer.id
                employer = await hh.get_employer(emp_id)
                print(f"OK: {employer.name}")
                print(f"   сайт: {employer.site_url}")
                print(f"   сфера: {[i.get('name') for i in employer.industries[:3]]}")
                print(f"   сотрудников: {employer.employee_count}")
            else:
                print("\n[3/3] Пропущено — нет вакансий для проверки работодателя")

    except httpx.HTTPStatusError as e:
        print(f"ОШИБКА запроса: {e.response.status_code} {e.response.text}")
        return
    except Exception as e:
        print(f"ОШИБКА запроса: {e}")
        return

    print("\n" + "=" * 60)
    print("Интеграция с HH.ru работает корректно.")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
