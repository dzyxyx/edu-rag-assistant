# Импортируем все модели чтобы SQLAlchemy видел их при конфигурации маппера.
# Порядок важен: сначала модели без внешних ключей, потом зависимые.
from app.db.models.user import User  # noqa: F401
from app.db.models.company import Company  # noqa: F401
from app.db.models.company_score_history import CompanyScoreHistory  # noqa: F401
from app.db.models.vacancy import Vacancy  # noqa: F401
from app.db.models.competency import Competency, VacancyCompetency  # noqa: F401
from app.db.models.priority_area import PriorityArea  # noqa: F401
from app.db.models.project import Project  # noqa: F401
from app.db.models.agent_memory import AgentMemory, AgentAuditLog  # noqa: F401
from app.db.models.chat import ChatSession, ChatMessage  # noqa: F401
from app.db.models.outreach import OutreachCampaign, OutreachEvent  # noqa: F401
from app.db.models.notification import Notification  # noqa: F401
from app.db.models.ingest_log import IngestLog  # noqa: F401
