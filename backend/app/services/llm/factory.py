"""
Фабрика чат-LLM с резервным провайдером (S10-x).

Основная модель — Ollama (локальная, бесплатная). Если она недоступна
(сервис не запущен, сеть, модель не подтянута и т.п.), LangChain автоматически
переключается на резервную модель GigaChat (облако, платно, но всегда
доступно при наличии кредов) через ``Runnable.with_fallbacks``.

GigaChat подключается через "голый" SDK ``gigachat`` (а не ``langchain-gigachat``,
который требует langchain-core<0.4 и конфликтует с langchain 1.x, используемым
в проекте) — ниже реализована минимальная обёртка ``_GigaChatWrapper(BaseChatModel)``.

Включение fallback: settings.GIGACHAT_ENABLED=true + заполненный
settings.GIGACHAT_CREDENTIALS (см. .env.example).

При settings.MOCK_LLM=true фабрика не используется — сервисы возвращают
заглушки (см. # TODO[MOCK] в каждом generator.py/chain.py).
"""

import logging
from typing import Any, Optional

from langchain_core.callbacks import CallbackManagerForLLMRun
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatResult

from app.core.config import settings

logger = logging.getLogger(__name__)


def _build_ollama(temperature: float) -> BaseChatModel:
    from langchain_ollama import ChatOllama

    return ChatOllama(
        base_url=settings.OLLAMA_BASE_URL,
        model=settings.OLLAMA_MODEL,
        temperature=temperature,
    )


class _GigaChatWrapper(BaseChatModel):
    """
    Минимальная LangChain-обёртка над SDK ``gigachat`` (без langchain-gigachat).

    Поддерживает только синхронный ``invoke``/``.with_fallbacks`` — этого
    достаточно для использования как fallback-модели в существующих цепочках
    (``ChatPromptTemplate | llm | StrOutputParser``).
    """

    credentials: str
    scope: str = "GIGACHAT_API_PERS"
    model: str = "GigaChat"
    verify_ssl_certs: bool = False
    temperature: float = 0.3

    @property
    def _llm_type(self) -> str:
        return "gigachat"

    def _to_gigachat_messages(self, messages: list[BaseMessage]) -> list:
        from gigachat.models import Messages, MessagesRole

        role_map = {
            "system": MessagesRole.SYSTEM,
            "human": MessagesRole.USER,
            "ai": MessagesRole.ASSISTANT,
        }
        result = []
        for m in messages:
            role = role_map.get(m.type, MessagesRole.USER)
            result.append(Messages(role=role, content=m.content))
        return result

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        from gigachat import GigaChat
        from gigachat.models import Chat

        with GigaChat(
            credentials=self.credentials,
            scope=self.scope,
            model=self.model,
            verify_ssl_certs=self.verify_ssl_certs,
        ) as giga:
            payload = Chat(
                messages=self._to_gigachat_messages(messages),
                temperature=self.temperature,
            )
            response = giga.chat(payload)

        content = response.choices[0].message.content
        generation = ChatGeneration(message=AIMessage(content=content))
        return ChatResult(generations=[generation])


def _build_gigachat(temperature: float) -> BaseChatModel:
    return _GigaChatWrapper(
        credentials=settings.GIGACHAT_CREDENTIALS,
        scope=settings.GIGACHAT_SCOPE,
        model=settings.GIGACHAT_MODEL,
        verify_ssl_certs=settings.GIGACHAT_VERIFY_SSL_CERTS,
        temperature=temperature,
    )


def get_chat_llm(temperature: float = 0.3) -> BaseChatModel:
    """
    Возвращает чат-модель: Ollama как основная, с автоматическим переключением
    на GigaChat при ошибке (таймаут, connection error, 5xx и т.п.), если
    fallback включён и настроен.

    Если GigaChat не настроен — возвращает обычную ChatOllama без fallback
    (поведение как раньше).
    """
    primary = _build_ollama(temperature)

    if not settings.GIGACHAT_ENABLED or not settings.GIGACHAT_CREDENTIALS:
        return primary

    try:
        fallback = _build_gigachat(temperature)
    except Exception:
        logger.exception("Не удалось инициализировать GigaChat fallback — используется только Ollama")
        return primary

    logger.debug("LLM с fallback: Ollama (%s) -> GigaChat (%s)", settings.OLLAMA_MODEL, settings.GIGACHAT_MODEL)
    return primary.with_fallbacks([fallback])
