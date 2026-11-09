"""
Delivery Domain Service.

Provides high-level coordination and execution flows for delivery runs,
including resuming interrupted tasks from checkpoints and running full sample pipelines.
"""


from nexora.domains.delivery.engine import DeliveryEngine
from nexora.domains.delivery.schemas import (
    CodeReviewVerdict,
    DeliveryReport,
    DeliveryRequest,
    DeliveryStage,
    LinkedDeliveryRecord,
)


class DeliveryService:
    def __init__(self, engine: DeliveryEngine | None = None):
        self.engine = engine or DeliveryEngine()

    def get_record(self, run_id: str) -> LinkedDeliveryRecord | None:
        return self.engine.get_record(run_id)

    def get_stage(self, run_id: str) -> DeliveryStage | None:
        return self.engine.get_stage(run_id)

    async def execute_full_pipeline(
        self,
        request: DeliveryRequest,
        source_files: dict[str, str],
        simulate_test_failure: bool = False,
        simulate_security_rejection: bool = False,
        simulate_health_check_failure: bool = False,
        ceo_approved: bool = False,
    ) -> DeliveryReport:
        """
        Executes all 12 stages of the autonomous delivery lifecycle.
        Supports simulating failures for verification testing.
        """
        run_id = request.id
        self.engine.initialize_run(request)

        # 1. Discovery
        await self.engine.run_discovery(run_id)

        # 2. Requirements
        await self.engine.run_requirements(run_id)

        # 3. Architecture
        await self.engine.run_architecture(run_id)

        # 4. Design (if required)
        if request.requires_ui:
            await self.engine.run_design(run_id)

        # 5. Task Decomposition
        await self.engine.run_decomposition(run_id)

        # 6. Implementation
        await self.engine.run_implementation(run_id, files=source_files)

        # 7. Code Review
        await self.engine.run_code_review(run_id, verdict=CodeReviewVerdict.APPROVED)

        # 8. Testing
        if simulate_test_failure:
            await self.engine.run_testing(
                run_id,
                passed=False,
                total_tests=10,
                failed_tests=2,
                failures_diagnostics=[{"test": "test_auth", "error": "TokenExpired"}],
            )
            return self.engine.generate_delivery_report(run_id)

        await self.engine.run_testing(run_id, passed=True, total_tests=10, failed_tests=0)

        # 9. Security Review
        if simulate_security_rejection:
            await self.engine.run_security_review(
                run_id,
                approved=False,
                red_line_violations=["Unbounded execution detected in untrusted code"],
                block_release=True,
            )
            return self.engine.generate_delivery_report(run_id)

        await self.engine.run_security_review(run_id, approved=True, block_release=False)

        # 10. Staging Deployment
        if simulate_health_check_failure:
            await self.engine.run_staging_deployment(run_id, health_check_passed=False)
            return self.engine.generate_delivery_report(run_id)

        await self.engine.run_staging_deployment(run_id, health_check_passed=True)

        # 11. Acceptance Verification
        await self.engine.run_acceptance_verification(run_id)

        # 12. Release Authorization
        await self.engine.run_release_authorization(
            run_id,
            target_environment=request.target_environment,
            ceo_approved=ceo_approved,
        )

        return self.engine.generate_delivery_report(run_id)
