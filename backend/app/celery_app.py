# app/celery_app.py

import os

from celery import Celery
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")

celery_app = Celery(
    "sigmasec",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.tasks.scan_tasks"],  # tells Celery where tasks live
)

from celery.schedules import crontab

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "app.tasks.scan_tasks.*": {"queue": "scans"},
    },
    worker_prefetch_multiplier=1,  # one task at a time per worker
    task_acks_late=True,  # re-queue if worker crashes mid-task
    beat_schedule={
        "refresh-kev-feed-daily": {
            "task": "app.tasks.scan_tasks.refresh_kev_feed",
            "schedule": crontab(hour=2, minute=0),
        },
    },
)
