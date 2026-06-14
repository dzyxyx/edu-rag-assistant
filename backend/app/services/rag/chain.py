import logging

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough, RunnableLambda

from app.core.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
Ты — EdAgent, AI-ассистент для студентов УрФУ по методологиям разработки ПО.
Отвечай только на основе предоставленного контекста.
Если ответа нет в контексте — честно скажи: "В базе знаний нет информации по этому вопросу."
Отвечай кратко и по делу. Язык ответа — язык вопроса (русский или английский).

История диалога (может быть пустой):
{history}

Контекст:
{context}

Аналитика рынка труда (если релевантна вопросу; может быть пустой):
{market_context}
"""

# Сколько последних сообщений сессии передавать в промпт как историю диалога
HISTORY_MAX_MESSAGES = 6


def _format_docs(docs) -> str:
    return "\n\n---\n\n".join(
        f"[{d.metadata.get('topic', '')} / {d.metadata.get('source', '')}]\n{d.page_content}"
        for d in docs
    )


def format_history(messages: list[dict]) -> str:
    """
    Преобразует список сообщений [{"role": "user"|"assistant", "content": "..."}]
    в текстовый блок для подстановки в промпт. Пустой список -> пустая строка.
    """
    if not messages:
        return ""
    role_labels = {"user": "Студент", "assistant": "EdAgent", "system": "Система"}
    lines = [
        f"{role_labels.get(m['role'], m['role'])}: {m['content']}"
        for m in messages[-HISTORY_MAX_MESSAGES:]
    ]
    return "\n".join(lines)


def _get_question(x: dict | str) -> str:
    """Цепочка может вызываться как с dict {"question": ..., "history": [...]}, так и со строкой."""
    return x["question"] if isinstance(x, dict) else x


def _get_history(x: dict | str) -> str:
    if isinstance(x, dict):
        return format_history(x.get("history", []))
    return ""


def _get_market_context(x: dict | str) -> str:
    if isinstance(x, dict):
        return x.get("market_context", "") or ""
    return ""


# TODO[MOCK]: удалить функцию целиком
def _full_mock_chain():
    """
    Полная заглушка: не обращается ни к Chroma, ни к Ollama.
    Embedding-модель не загружается в память.
    """
    def echo(x: dict | str) -> str:
        question = _get_question(x)
        history = _get_history(x)
        market_context = _get_market_context(x)
        logger.info("MOCK_LLM: echo для '%s' (история: %d сообщений)", question[:60], len(history.splitlines()) if history else 0)
        suffix = f"\n(в истории {len(history.splitlines())} сообщений)" if history else ""
        if market_context:
            suffix += "\n(подмешана аналитика рынка труда)"
        return (
            f"[MOCK] Вопрос получен: «{question}»\n"
            f"(MOCK_LLM=true — Chroma и Ollama не используются){suffix}"
        )
    return RunnableLambda(echo)


def build_rag_chain():
    # TODO[MOCK]: удалить весь if-блок, оставить только реальную цепочку ниже
    if settings.MOCK_LLM:
        logger.warning("MOCK_LLM включён — Chroma и Ollama не загружаются")
        return _full_mock_chain()

    # Реальная цепочка — загружает embeddings и Ollama
    from langchain_ollama import ChatOllama
    from app.services.rag.vector_store import get_vector_store

    retriever = get_vector_store().as_retriever(
        search_type="similarity",
        search_kwargs={"k": 5},
    )
    llm = ChatOllama(
        base_url=settings.OLLAMA_BASE_URL,
        model=settings.OLLAMA_MODEL,
        temperature=0.3,
    )
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", "{question}"),
    ])
    chain = (
        {
            "context": RunnableLambda(_get_question) | retriever | _format_docs,
            "question": RunnableLambda(_get_question),
            "history": RunnableLambda(_get_history),
            "market_context": RunnableLambda(_get_market_context),
        }
        | prompt
        | llm
        | StrOutputParser()
    )
    return chain
