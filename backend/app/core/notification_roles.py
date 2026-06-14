"""
Связка Notification.recipient_role <-> User.role (Sprint 9 доработка, S4-7/S9-7).

Notification.recipient_role — свободнотекстовое "человеческое" обозначение
адресата (например, "методист", "менеджер по партнёрствам"), которое
формируется сервисами на этапе создания уведомления (priority_areas,
outreach, scoring). User.role — формальная роль учётной записи
(``UserRole``: admin/curator/student/agent).

Этот модуль связывает их, чтобы:
  * /notifications мог отдавать пользователю только уведомления,
    адресованные его роли (плюс общие, без recipient_role);
  * WebSocket /notifications/ws мог подписать пользователя на нужные
    Redis-каналы.

ADMIN видит все уведомления независимо от recipient_role.
"""

from app.db.models.user import UserRole

# recipient_role (как используется в NotificationRepository.create) -> роли
# пользователей, которым уведомление должно быть видно.
RECIPIENT_ROLE_TO_USER_ROLES: dict[str, set[str]] = {
    "методист": {UserRole.CURATOR, UserRole.ADMIN},
    "менеджер по партнёрствам": {UserRole.CURATOR, UserRole.ADMIN},
    "координатор": {UserRole.CURATOR, UserRole.ADMIN},
}

# Обратное отображение: для роли пользователя — список "человеческих"
# recipient_role, которые ему адресованы (используется для подписки на
# Redis pub/sub каналы в WS).
def recipient_roles_for_user_role(user_role: str) -> list[str]:
    if user_role == UserRole.ADMIN:
        return sorted(RECIPIENT_ROLE_TO_USER_ROLES.keys())
    return sorted(
        recipient_role
        for recipient_role, user_roles in RECIPIENT_ROLE_TO_USER_ROLES.items()
        if user_role in user_roles
    )


def allowed_recipient_roles_filter(user_role: str) -> list[str] | None:
    """
    Список значений recipient_role, видимых пользователю с данной ролью,
    для фильтрации в NotificationRepository.list/count.

    Возвращает ``None``, если фильтрация не нужна (пользователь видит всё —
    роль admin).
    """
    if user_role == UserRole.ADMIN:
        return None
    return recipient_roles_for_user_role(user_role)


def is_visible_to(recipient_role: str | None, user_role: str) -> bool:
    """Видно ли уведомление с данным recipient_role пользователю с данной ролью."""
    if user_role == UserRole.ADMIN:
        return True
    if recipient_role is None:
        return True
    return user_role in RECIPIENT_ROLE_TO_USER_ROLES.get(recipient_role, set())
