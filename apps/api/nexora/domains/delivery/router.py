"""
Delivery Domain Router.

Exposes endpoints for triggering autonomous delivery pipelines,
querying linked delivery records, inspecting stage artifacts, and checking reports.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from nexora.domains.delivery.schemas import DeliveryReport, DeliveryRequest, LinkedDeliveryRecord
from nexora.domains.delivery.service import DeliveryService

router = APIRouter(prefix="/delivery", tags=["Autonomous Software Delivery"])

# Shared service instance
delivery_service = DeliveryService()


class TriggerDeliveryRunRequest(BaseModel):
    title: str
    raw_request: str
    target_environment: str = "STAGING"
    requires_ui: bool = True
    max_patch_lines: int = 500
    source_files: dict[str, str] = {
        "src/main.py": "def run():\n    print('NEIMAN sample running')\n"
    }
    ceo_approved: bool = False


@router.post("/runs", response_model=DeliveryReport, status_code=status.HTTP_201_CREATED)
async def trigger_delivery_run(payload: TriggerDeliveryRunRequest):
    """Triggers an end-to-end autonomous software delivery workflow."""
    import uuid

    from nexora.domains.delivery.schemas import TargetEnvironment

    req = DeliveryRequest(
        id=f"run-{uuid.uuid4().hex[:8]}",
        title=payload.title,
        raw_request=payload.raw_request,
        target_environment=TargetEnvironment(payload.target_environment),
        requires_ui=payload.requires_ui,
        max_patch_lines=payload.max_patch_lines,
    )
    report = await delivery_service.execute_full_pipeline(
        request=req,
        source_files=payload.source_files,
        ceo_approved=payload.ceo_approved,
    )
    return report


@router.get("/runs/{run_id}", response_model=LinkedDeliveryRecord)
async def get_delivery_record(run_id: str):
    """Retrieves all linked records for a given delivery run."""
    record = delivery_service.get_record(run_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Delivery run {run_id} not found")
    return record


@router.get("/runs/{run_id}/report", response_model=DeliveryReport)
async def get_delivery_report(run_id: str):
    """Generates the final delivery report with release provenance for a given run."""
    record = delivery_service.get_record(run_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Delivery run {run_id} not found")
    return delivery_service.engine.generate_delivery_report(run_id)
