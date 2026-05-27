"""
Скрипт для создания первого суперпользователя.
Запуск: python scripts/create_superuser.py
"""

import asyncio

from app.core.security import hash_password
from app.db.models.user import User, UserRole
from app.db.session import AsyncSessionLocal


async def create_superuser() -> None:
    email = input("Email: ")
    full_name = input("Full name: ")
    password = input("Password: ")

    async with AsyncSessionLocal() as session:
        user = User(
            email=email,
            full_name=full_name,
            hashed_password=hash_password(password),
            role=UserRole.ADMIN,
            is_active=True,
            is_superuser=True,
        )
        session.add(user)
        await session.commit()
        print(f"✅ Superuser created: {email}")


if __name__ == "__main__":
    asyncio.run(create_superuser())
