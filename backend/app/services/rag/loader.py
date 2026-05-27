from pathlib import Path

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter


def load_knowledge_base(kb_dir: str | Path) -> list[Document]:
    """
    Читает все .md файлы из kb_dir, нарезает на чанки.
    Метаданные: topic (имя папки), source (имя файла).
    """
    kb_dir = Path(kb_dir)
    raw_docs: list[Document] = []

    for md_file in sorted(kb_dir.rglob("*.md")):
        text = md_file.read_text(encoding="utf-8")
        raw_docs.append(Document(
            page_content=text,
            metadata={
                "topic": md_file.parent.name,
                "source": md_file.name,
            },
        ))

    if not raw_docs:
        return []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=120,
        separators=["\n## ", "\n### ", "\n\n", "\n", " "],
    )
    return splitter.split_documents(raw_docs)
