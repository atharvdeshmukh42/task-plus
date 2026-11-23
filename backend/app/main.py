from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, me, members, organization, reports, roles, tasks

settings = get_settings()

app = FastAPI(
    title="Task Plus API",
    version="0.1.0",
    description="Assign recurring tasks to roles and people, and report on how they get done.",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")
for module in (auth, organization, members, roles, tasks, me, reports):
    api.include_router(module.router)


@api.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api)
