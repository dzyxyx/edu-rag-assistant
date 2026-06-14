"""Sprint 5 (FR-5.*): Jinja2-шаблоны для оформления коммуникаций.

LLM (или MOCK_LLM-заглушка) генерирует только "тему" и "тело" письма
(см. ``app/services/communications/generator.py``). Этот модуль оборачивает
сгенерированный текст в единообразный HTML-шаблон письма — общую шапку,
подпись отдела по работе с работодателями УрФУ и т.п.

Используется опционально (например, перед отправкой через SendGrid или для
предпросмотра в UI) — сама генерация текста коммуникации от шаблонов не
зависит.
"""
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, TemplateNotFound, select_autoescape

from app.services.communications.generator import CommunicationType

_TEMPLATES_DIR = Path(__file__).parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "j2"]),
    trim_blocks=True,
    lstrip_blocks=True,
)

# Соответствие типа коммуникации -> имя шаблона. Типы без записи здесь
# используют общий "base_email.html.j2".
_TEMPLATE_BY_TYPE: dict[str, str] = {
    CommunicationType.NOTIFICATION: "notification.html.j2",
    CommunicationType.FOLLOW_UP: "follow_up.html.j2",
}

_DEFAULT_TEMPLATE = "base_email.html.j2"


def render_communication_html(
    comm_type: CommunicationType | str,
    subject: str,
    body: str,
    *,
    company_name: str | None = None,
    from_email: str | None = None,
    **extra,
) -> str:
    """
    Рендерит письмо/уведомление в HTML по шаблону, соответствующему типу
    коммуникации (FR-5.*).

    Параметры ``company_name``/``from_email``/``**extra`` (например,
    ``follow_up_number``, ``recipient_role``) передаются в шаблон как
    контекст и используются опционально, в зависимости от шаблона.
    """
    comm_type = str(comm_type)
    template_name = _TEMPLATE_BY_TYPE.get(comm_type, _DEFAULT_TEMPLATE)

    try:
        template = _env.get_template(template_name)
    except TemplateNotFound:
        template = _env.get_template(_DEFAULT_TEMPLATE)

    return template.render(
        subject=subject,
        body=body,
        company_name=company_name,
        from_email=from_email,
        **extra,
    )
