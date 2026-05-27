import asyncio
import contextlib
import logging
from typing import Any

import httpx

from app.core.config import settings
from app.integrations.hh.schemas import HHEmployer, HHVacancy

logger = logging.getLogger(__name__)

HH_API = settings.HH_API_URL
DEFAULT_AREA = settings.HH_AREA_ID
HEADERS = {
    "User-Agent": "edu-rag-assistant/1.0 (aleksandr.klim4enko@yandex.ru)",
}


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
        seen_ids: set[str] = set()
        employers: list[HHEmployer] = []

        for keyword in keywords:
            logger.info("HH: searching vacancies for '%s'", keyword)
            try:
                vacancies = await self.search_vacancies(text=keyword, area=area)
            except httpx.HTTPError as e:
                logger.error("HH search failed for '%s': %s", keyword, e)
                continue

            for vacancy in vacancies:
                emp_id = vacancy.employer.id
                if emp_id in seen_ids:
                    continue
                seen_ids.add(emp_id)

                try:
                    employer = await self.get_employer(emp_id)
                    employers.append(employer)
                    await asyncio.sleep(0.2)
                except httpx.HTTPError as e:
                    logger.warning("HH employer %s failed: %s", emp_id, e)

        logger.info("HH: collected %d unique companies", len(employers))
        return employers
