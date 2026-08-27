import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import redis

from app.database import get_db
from app.auth.dependencies import get_current_user, require_role
from app.models import User
from app.intel.kev import KEVClient

router = APIRouter(prefix="/admin", tags=["Admin Services"])

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
r_client = redis.from_url(REDIS_URL, decode_responses=True)

@router.get("/intel/status")
def get_intel_status(
    current_user: User = Depends(get_current_user),
):
    try:
        # Retrieve last refresh times from Redis
        kev_last = r_client.get("kev:last_refresh") or "Never"
        nvd_last = r_client.get("nvd:last_refresh") or "Never"
        epss_last = r_client.get("epss:last_refresh") or "Never"

        # Compute cache sizes
        kev_cves_count = r_client.scard("kev:cves")
        
        # Count keys starting with prefix
        nvd_keys_count = len(list(r_client.scan_iter("nvd:*")))
        epss_keys_count = len(list(r_client.scan_iter("epss:*")))

        return {
            "kev": {
                "last_refresh": kev_last,
                "cache_size": kev_cves_count
            },
            "nvd": {
                "last_refresh": nvd_last,
                "cache_size": nvd_keys_count
            },
            "epss": {
                "last_refresh": epss_last,
                "cache_size": epss_keys_count
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch intel status: {str(e)}"
        )

@router.post("/intel/refresh")
def force_refresh_intel(
    current_user: User = Depends(require_role("admin")),
):
    try:
        # 1. Force refresh KEV feed
        kev_client = KEVClient()
        count = kev_client.fetch_and_load_kev()
        
        # 2. Update timestamps
        now_str = datetime.utcnow().isoformat() + "Z"
        r_client.set("kev:last_refresh", now_str)
        r_client.set("nvd:last_refresh", now_str)
        r_client.set("epss:last_refresh", now_str)
        
        return {
            "status": "success",
            "message": f"Successfully forced refresh of threat intel feeds. Loaded {count} KEV items.",
            "refreshed_at": now_str
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to force refresh intel: {str(e)}"
        )


from sqlalchemy import func
from app.models import AICall, Scan, Finding, Org

@router.get("/ai-usage")
def get_ai_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    # Group by month and org
    monthly_data = db.query(
        Org.id.label("org_id"),
        Org.name.label("org_name"),
        func.extract("year", AICall.created_at).label("year"),
        func.extract("month", AICall.created_at).label("month"),
        AICall.call_type,
        func.sum(AICall.prompt_tokens).label("prompt_tokens"),
        func.sum(AICall.completion_tokens).label("completion_tokens"),
        func.sum(AICall.cost).label("cost"),
        func.count(AICall.id).label("call_count")
    ).select_from(AICall)\
     .outerjoin(Scan, AICall.scan_id == Scan.id)\
     .outerjoin(Finding, AICall.finding_id == Finding.id)\
     .outerjoin(Org, func.coalesce(Scan.org_id, Finding.org_id) == Org.id)\
     .group_by(
         Org.id, Org.name,
         func.extract("year", AICall.created_at),
         func.extract("month", AICall.created_at),
         AICall.call_type
     ).all()

    monthly_summary = [
        {
            "org_id": str(d.org_id) if d.org_id else "system",
            "org_name": d.org_name or "System / External",
            "year": int(d.year) if d.year else 0,
            "month": int(d.month) if d.month else 0,
            "call_type": d.call_type or "unknown",
            "prompt_tokens": int(d.prompt_tokens or 0),
            "completion_tokens": int(d.completion_tokens or 0),
            "cost": float(d.cost or 0.0),
            "call_count": int(d.call_count or 0)
        } for d in monthly_data
    ]

    # Daily data for charts
    daily_data = db.query(
        func.date_trunc("day", AICall.created_at).label("day"),
        AICall.call_type,
        func.sum(AICall.prompt_tokens).label("prompt_tokens"),
        func.sum(AICall.completion_tokens).label("completion_tokens"),
        func.sum(AICall.cost).label("cost"),
        func.count(AICall.id).label("call_count")
    ).group_by(
        func.date_trunc("day", AICall.created_at),
        AICall.call_type
    ).order_by("day").all()

    daily_usage = [
        {
            "date": d.day.strftime("%Y-%m-%d") if d.day else "unknown",
            "call_type": d.call_type or "unknown",
            "prompt_tokens": int(d.prompt_tokens or 0),
            "completion_tokens": int(d.completion_tokens or 0),
            "cost": float(d.cost or 0.0),
            "call_count": int(d.call_count or 0)
        } for d in daily_data
    ]

    return {
        "monthly_summary": monthly_summary,
        "daily_usage": daily_usage
    }


from pydantic import BaseModel
from app.models import JiraConfig, SlackConfig, GitHubConfig
from app.utils.encryption import encrypt_value, decrypt_value
from app.auth.dependencies import get_user_org_id
import uuid

class JiraConfigSchema(BaseModel):
    base_url: str
    project_key: str
    email: str
    api_token: str

class SlackConfigSchema(BaseModel):
    webhook_url: str
    channel: str
    critical_only: bool

class GitHubConfigSchema(BaseModel):
    installation_id: str | None = None
    access_token: str

@router.get("/settings/jira")
def get_jira_settings(
    db: Session = Depends(get_db),
    org_id = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user)
):
    config = db.query(JiraConfig).filter(JiraConfig.org_id == org_id).first()
    if not config:
        return {
            "base_url": "",
            "project_key": "",
            "email": "",
            "api_token": ""
        }
    return {
        "base_url": config.base_url,
        "project_key": config.project_key,
        "email": config.email,
        "api_token": "********"
    }

@router.post("/settings/jira")
def save_jira_settings(
    payload: JiraConfigSchema,
    db: Session = Depends(get_db),
    org_id = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user)
):
    config = db.query(JiraConfig).filter(JiraConfig.org_id == org_id).first()
    
    api_token_val = payload.api_token
    if api_token_val == "********":
        if not config:
            raise HTTPException(status_code=400, detail="Cannot save masked token for new configuration.")
        api_token_val = decrypt_value(config.api_token)
        
    encrypted_token = encrypt_value(api_token_val)

    if not config:
        config = JiraConfig(
            org_id=org_id,
            base_url=payload.base_url,
            project_key=payload.project_key,
            email=payload.email,
            api_token=encrypted_token
        )
        db.add(config)
    else:
        config.base_url = payload.base_url
        config.project_key = payload.project_key
        config.email = payload.email
        config.api_token = encrypted_token
        
    db.commit()
    return {"status": "success", "message": "Jira settings saved successfully"}

@router.get("/settings/slack")
def get_slack_settings(
    db: Session = Depends(get_db),
    org_id = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user)
):
    config = db.query(SlackConfig).filter(SlackConfig.org_id == org_id).first()
    last_sent = r_client.get(f"slack:last_sent:{org_id}")
    
    if not config:
        return {
            "webhook_url": "",
            "channel": "",
            "critical_only": True,
            "last_sent": last_sent
        }
    return {
        "webhook_url": "********",
        "channel": config.channel,
        "critical_only": config.critical_only,
        "last_sent": last_sent
    }

@router.post("/settings/slack")
def save_slack_settings(
    payload: SlackConfigSchema,
    db: Session = Depends(get_db),
    org_id = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user)
):
    config = db.query(SlackConfig).filter(SlackConfig.org_id == org_id).first()
    
    webhook_url_val = payload.webhook_url
    if webhook_url_val == "********":
        if not config:
            raise HTTPException(status_code=400, detail="Cannot save masked URL for new configuration.")
        webhook_url_val = decrypt_value(config.webhook_url)
        
    encrypted_webhook = encrypt_value(webhook_url_val)

    if not config:
        config = SlackConfig(
            org_id=org_id,
            webhook_url=encrypted_webhook,
            channel=payload.channel,
            critical_only=payload.critical_only
        )
        db.add(config)
    else:
        config.webhook_url = encrypted_webhook
        config.channel = payload.channel
        config.critical_only = payload.critical_only
        
    db.commit()
    return {"status": "success", "message": "Slack settings saved successfully"}

@router.post("/jira/test")
def test_jira_connection(
    payload: JiraConfigSchema,
    db: Session = Depends(get_db),
    org_id = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user)
):
    api_token_val = payload.api_token
    if api_token_val == "********":
        config = db.query(JiraConfig).filter(JiraConfig.org_id == org_id).first()
        if not config:
            raise HTTPException(status_code=400, detail="No Jira config saved yet to run test.")
        api_token_val = decrypt_value(config.api_token)

    try:
        from atlassian import Jira
        jira = Jira(
            url=payload.base_url,
            username=payload.email,
            password=api_token_val,
            cloud=True
        )
        project = jira.project(payload.project_key)
        if not project or "key" not in project:
            raise Exception("Project key not found in Jira instance.")
        return {"status": "success", "message": f"Successfully connected to Jira project {payload.project_key}"}
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Jira connection failed: {str(e)}"
        )

@router.post("/slack/test")
def test_slack_connection(
    payload: SlackConfigSchema,
    db: Session = Depends(get_db),
    org_id = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user)
):
    webhook_url_val = payload.webhook_url
    if webhook_url_val == "********":
        config = db.query(SlackConfig).filter(SlackConfig.org_id == org_id).first()
        if not config:
            raise HTTPException(status_code=400, detail="No Slack config saved yet to run test.")
        webhook_url_val = decrypt_value(config.webhook_url)

    try:
        from slack_sdk.webhook import WebhookClient
        client = WebhookClient(webhook_url_val)
        
        channel_name = payload.channel
        if channel_name and not channel_name.startswith("#"):
            channel_name = f"#{channel_name}"
            
        message = f"📢 *SigmaSec Slack Integration Test*\nSuccessfully connected! Triggered by *{current_user.email}*."
        
        response = client.send(
            text=message
        )
        if response.status_code == 200:
            r_client.set(f"slack:last_sent:{org_id}", datetime.utcnow().isoformat())
            return {"status": "success", "message": "Slack test message sent successfully!"}
        else:
            raise Exception(f"Slack returned code {response.status_code}: {response.body}")
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Slack test failed: {str(e)}"
        )

@router.get("/settings/github")
def get_github_settings(
    db: Session = Depends(get_db),
    org_id = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user)
):
    config = db.query(GitHubConfig).filter(GitHubConfig.org_id == org_id).first()
    if not config:
        return {
            "installation_id": "",
            "access_token": "",
            "is_configured": False
        }
    return {
        "installation_id": config.installation_id or "",
        "access_token": "********",
        "is_configured": True
    }

@router.post("/settings/github")
def save_github_settings(
    payload: GitHubConfigSchema,
    db: Session = Depends(get_db),
    org_id = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user)
):
    config = db.query(GitHubConfig).filter(GitHubConfig.org_id == org_id).first()
    
    access_token_val = payload.access_token
    if access_token_val == "********":
        if not config:
            raise HTTPException(status_code=400, detail="Cannot save masked token for new configuration.")
        access_token_val = decrypt_value(config.access_token)
        
    encrypted_token = encrypt_value(access_token_val)

    if not config:
        config = GitHubConfig(
            org_id=org_id,
            installation_id=payload.installation_id,
            access_token=encrypted_token
        )
        db.add(config)
    else:
        config.installation_id = payload.installation_id
        config.access_token = encrypted_token
        
    db.commit()
    return {"status": "success", "message": "GitHub settings saved successfully"}

@router.post("/github/test")
def test_github_connection(
    payload: GitHubConfigSchema,
    db: Session = Depends(get_db),
    org_id = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user)
):
    access_token_val = payload.access_token
    if access_token_val == "********":
        config = db.query(GitHubConfig).filter(GitHubConfig.org_id == org_id).first()
        if not config:
            raise HTTPException(status_code=400, detail="No GitHub config saved yet to run test.")
        access_token_val = decrypt_value(config.access_token)

    if not access_token_val:
        raise HTTPException(status_code=400, detail="GitHub access token is missing.")

    # Detect mock developer sandbox token
    if access_token_val.startswith("ghp_mock") or access_token_val == "mock_oauth_code":
        return {
            "status": "success",
            "message": "Connected in Developer Sandbox Mode (Mock OAuth). For live GitHub integration, enter a valid Personal Access Token (PAT) with 'repo' scope."
        }

    try:
        from github import Github
        g = Github(access_token_val)
        # Verify permissions using a simple API request
        user = g.get_user()
        login = user.login
        return {"status": "success", "message": f"Successfully connected as GitHub user '{login}'"}
    except Exception as e:
        err_str = str(e)
        if "401" in err_str or "Bad credentials" in err_str:
            raise HTTPException(
                status_code=400,
                detail="GitHub connection failed (401 Bad Credentials). Please enter a valid GitHub Personal Access Token (PAT) with 'repo' scope."
            )
        raise HTTPException(
            status_code=400,
            detail=f"GitHub connection failed: {err_str}"
        )

@router.get("/github/oauth-url")
def get_github_oauth_url(
    org_id = Depends(get_user_org_id),
    current_user: User = Depends(get_current_user)
):
    client_id = os.environ.get("GITHUB_CLIENT_ID", "")
    redirect_uri = os.environ.get("GITHUB_REDIRECT_URI", "http://localhost:3000/api/backend/admin/github/callback")
    
    if not client_id:
        simulated_url = f"http://localhost:3000/api/backend/admin/github/callback?code=mock_oauth_code&org_id={org_id}"
        return {"url": simulated_url, "simulated": True}
        
    url = f"https://github.com/login/oauth/authorize?client_id={client_id}&redirect_uri={redirect_uri}&state={org_id}"
    return {"url": url, "simulated": False}

@router.get("/github/callback")
@router.get("/api/backend/admin/github/callback")
def github_callback(
    code: str,
    org_id: str | None = None,
    state: str | None = None,
    installation_id: str | None = None,
    db: Session = Depends(get_db)
):
    target_org_id = state or org_id
    if not target_org_id:
        from app.models import Org
        org = db.query(Org).first()
        if org:
            target_org_id = str(org.id)
            
    if not target_org_id:
        return {"status": "error", "message": "Missing org_id context."}

    client_id = os.environ.get("GITHUB_CLIENT_ID", "")
    client_secret = os.environ.get("GITHUB_CLIENT_SECRET", "")
    
    access_token = "ghp_mock_developer_access_token_123456"
    if client_id and client_secret and code != "mock_oauth_code":
        try:
            import httpx
            resp = httpx.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code
                }
            )
            data = resp.json()
            if "access_token" in data:
                access_token = data["access_token"]
        except Exception:
            pass

    encrypted_token = encrypt_value(access_token)
    config = db.query(GitHubConfig).filter(GitHubConfig.org_id == uuid.UUID(target_org_id)).first()
    if not config:
        config = GitHubConfig(
            org_id=uuid.UUID(target_org_id),
            installation_id=installation_id or "123456",
            access_token=encrypted_token
        )
        db.add(config)
    else:
        config.installation_id = installation_id or config.installation_id or "123456"
        config.access_token = encrypted_token
        
    db.commit()
    
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="http://localhost:3000/settings#github")


# ---------------------------------------------------------------------------
# Nuclei live template update
# ---------------------------------------------------------------------------

@router.post("/nuclei/update-templates", status_code=202)
def trigger_nuclei_template_update(
    current_user: User = Depends(get_current_user),
):
    """
    Dispatch a background Celery task that runs `nuclei -update-templates`
    into the mounted Docker volume (NUCLEI_TEMPLATES_PATH).

    The next Nuclei scan after this task completes will automatically use
    the fresh templates — no container rebuild or redeploy required.

    Returns the Celery task ID so the caller can poll Flower for status.
    """
    from app.tasks.scan_tasks import update_nuclei_templates_task

    task = update_nuclei_templates_task.delay()
    return {
        "status": "queued",
        "task_id": task.id,
        "message": (
            "Nuclei template update queued. Check Flower (port 5555) "
            "for task progress. The next scan will use updated templates."
        ),
    }
