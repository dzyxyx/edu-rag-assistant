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

Контекст:
{context}
"""


def _format_docs(docs) -> str:
    return "\n\n---\n\n".join(
        f"[{d.metadata.get('topic', '')} / {d.metadata.get('source', '')}]\n{d.page_content}"
        for d in docs
    )


# TODO[MOCK]: удалить функцию целиком
def _full_mock_chain():
    """
    Полная заглушка: не обращается ни к Chroma, ни к Ollama.
    Embedding-модель не загружается в память.
    """
    def echo(question: str) -> str:
        logger.info("MOCK_LLM: echo для '%s'", question[:60])
        return (
            f"[MOCK] Вопрос получен: «{question}»\n"
            f"(MOCK_LLM=true — Chroma и Ollama не используются)"
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
        {"context": retriever | _format_docs, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )
    return chain
