import logging

import sendgrid
from sendgrid.helpers.mail import Mail

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_email(to_email: str, subject: str, body: str) -> bool:
    """
    Отправляет письмо через SendGrid.
    Если SENDGRID_API_KEY не задан — dry run (логирует и возвращает True).
    """
    if not settings.SENDGRID_API_KEY:
        logger.info(
            "SendGrid dry run: to=%s subject=%s (SENDGRID_API_KEY не задан)",
            to_email, subject[:60],
        )
        return True

    try:
        sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        message = Mail(
            from_email=(settings.SENDGRID_FROM_EMAIL, settings.SENDGRID_FROM_NAME),
            to_emails=to_email,
            subject=subject,
            plain_text_content=body,
        )
        response = sg.client.mail.send.post(request_body=message.get())
        ok = response.status_code in (200, 202)
        logger.info(
            "SendGrid: to=%s status=%s ok=%s",
            to_email, response.status_code, ok,
        )
        return ok
    except Exception as exc:
        logger.exception("SendGrid error: to=%s exc=%s", to_email, exc)
        return False
