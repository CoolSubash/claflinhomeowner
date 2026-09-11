from fastapi import FastAPI

from app.api.routes.assessments import router as assessments_router
from app.api.routes.auth import router as auth_router
from app.api.routes.chat import router as chat_router
from app.api.routes.health import router as health_router
from app.api.routes.readiness_results import router as readiness_results_router
from app.api.routes.testimonials import router as testimonials_router
from app.api.routes.users import router as users_router
from app.core.config import get_settings
from app.core.logging import configure_logging

configure_logging()
settings = get_settings()

app = FastAPI(title="HomeReady AI API")

app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(testimonials_router, prefix="/api/v1")
app.include_router(assessments_router, prefix="/api/v1")
app.include_router(readiness_results_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
