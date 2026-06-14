import asyncio
import contextlib
import logging
from typing import Any

import httpx

from app.core.config import settings
from app.integrations.hh.schemas import HHEmployer, HHVacancy

logger = logging.getLogger(__name__)

HH_API = settings.HH_API_URL
HH_OAUTH_URL = "https://hh.ru/oauth/token"
DEFAULT_AREA = settings.HH_AREA_ID
HEADERS = {
    "User-Agent": "edu-rag-assistant/1.0 (aleksandr.klim4enko@yandex.ru)",
}


HH_TOKEN_CACHE_KEY = "hh:access_token"
# Запрашиваем новый токен немного раньше, чем он истечёт на самом деле
HH_TOKEN_EXPIRY_MARGIN = 60  # сек


async def _request_application_token(client_id: str, client_secret: str) -> dict[str, Any]:
    """Делает сам запрос к /oauth/token и возвращает JSON-ответ."""
    async with httpx.AsyncClient(headers=HEADERS, timeout=15.0) as client:
        resp = await client.post(
            HH_OAUTH_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
        )
        resp.raise_for_status()
        return resp.json()


async def get_application_token(client_id: str, client_secret: str) -> str:
    """
    Получает application-токен через OAuth2 client_credentials.

    Такой токен нужен, потому что HH.ru блокирует анонимные запросы
    к /vacancies и /employers без авторизации.

    Без кеширования (всегда делает новый запрос к /oauth/token).
    Для большинства случаев используйте get_cached_application_token().
    """
    data = await _request_application_token(client_id, client_secret)
    logger.info(
        "HH: получен application-токен (expires_in=%s сек)",
        data.get("expires_in"),
    )
    return data["access_token"]


async def get_cached_application_token(client_id: str, client_secret: str) -> str:
    """
    Возвращает application-токен, используя кеш в Redis.

    HH.ru ограничивает частоту запросов к /oauth/token (наблюдался 403
    при повторных запросах за короткий промежуток). Поэтому токен
    кешируется на время его жизни (expires_in), и повторные вызовы
    в течение этого времени не делают новый запрос к HH.ru.
    """
    import redis.asyncio as aioredis

    redis_client = aioredis.from_url(
        settings.REDIS_URL, encoding="utf-8", decode_responses=True
    )
    try:
        cached = await redis_client.get(HH_TOKEN_CACHE_KEY)
        if cached:
            logger.info("HH: использован кешированный access_token")
            return cached

        data = await _request_application_token(client_id, client_secret)
        token = data["access_token"]
        expires_in = int(data.get("expires_in", 3600))
        ttl = max(expires_in - HH_TOKEN_EXPIRY_MARGIN, 60)

        await redis_client.set(HH_TOKEN_CACHE_KEY, token, ex=ttl)
        logger.info(
            "HH: получен новый application-токен, закеширован на %s сек", ttl
        )
        return token
    finally:
        await redis_client.aclose()


class HHClient:
    """Async HTTP-клиент для HH.ru API v1"""

    def __init__(self, access_token: str | None = None):
        headers = HEADERS.copy()
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
        self._client = httpx.AsyncClient(
            base_url=HH_API,
            headers=headers,
            timeout=15.0
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self._client.aclose()


#---Vacancies-----------------------------

    async def search_vacancies(
            self,
            text: str,
            area: int = DEFAULT_AREA,
            per_page: int = 100,
            pages: int = 3,
    ) -> list[HHVacancy]:
        """Собирает вакансии по ключевому слову (до количества в pages)"""
        vacancies: list[HHVacancy] = []
        for page in range(pages):
            resp = await self._client.get(
                "/vacancies",
                params={
                    "text": text,
                    "area": area,
                    "per_page": per_page,
                    "page": page,
                    "only_with_salary": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            items = data.get("items", [])
            if not items:
                break
            for item in items:
                try:
                    vacancies.append(HHVacancy(**item))
                except Exception as e:
                    logger.debug("Skip vacancy %s: %s", item.get("id"), e)
            if page >= data.get("pages", 1) - 1:
                break
            await asyncio.sleep(0.3)
        return vacancies

    async def get_vacancy_detail(self, vacancy_id: str) -> dict[str, Any]:
        resp = await self._client.get(f"/vacancies/{vacancy_id}")
        resp.raise_for_status()
        return resp.json()

#---Employers----------------------------------

    async def get_employer(self, employer_id: str) -> HHEmployer:
        resp = await self._client.get(f"/employers/{employer_id}")
        resp.raise_for_status()
        data = resp.json()

        employee_count: int | None = None
        if "employee_count" in data:
            employee_count = data["employee_count"]
        elif "staff_count" in data:
            with contextlib.suppress(Exception):
                employee_count = int(data["staff_count"].split()[1])

        return HHEmployer(
            id=data["id"],
            name=data["name"],
            url=data.get("alternate_url"),
            site_url=data.get("site_url"),
            description=data.get("description"),
            area=data.get("area"),
            industries=data.get("industries", []),
            employee_count=employee_count,
        )

    async def collect_companies(
            self,
            keywords: list[str],
            area: int = DEFAULT_AREA,
    ) -> list[HHEmployer]:
        """Собирает уникальные компании по набору ключевых слов"""
        employers, _ = await self.collect(keywords=keywords, area=area)
        return employers

    async def collect(
            self,
            keywords: list[str],
            area: int = DEFAULT_AREA,
    ) -> tuple[list[HHEmployer], list[HHVacancy]]:
        """
        Собирает уникальные компании и вакансии по набору ключевых слов.

        Возвращает (employers, vacancies) — обе коллекции уникальны по id.
        """
        seen_employer_ids: set[str] = set()
        seen_vacancy_ids: set[str] = set()
        employers: list[HHEmployer] = []
        all_vacancies: list[HHVacancy] = []

        for keyword in keywords:
            logger.info("HH: searching vacancies for '%s'", keyword)
            try:
                vacancies = await self.search_vacancies(text=keyword, area=area)
            except httpx.HTTPError as e:
                logger.error("HH search failed for '%s': %s", keyword, e)
                continue

            for vacancy in vacancies:
                if vacancy.id not in seen_vacancy_ids:
                    seen_vacancy_ids.add(vacancy.id)
                    all_vacancies.append(vacancy)

                emp_id = vacancy.employer.id
                if emp_id in seen_employer_ids:
                    continue
                seen_employer_ids.add(emp_id)

                try:
                    employer = await self.get_employer(emp_id)
                    employers.append(employer)
                    await asyncio.sleep(0.2)
                except httpx.HTTPError as e:
                    logger.warning("HH employer %s failed: %s", emp_id, e)

        logger.info(
            "HH: collected %d unique companies, %d unique vacancies",
            len(employers), len(all_vacancies),
        )
        return employers, all_vacancies
