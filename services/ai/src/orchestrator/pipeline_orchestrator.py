"""
Pipeline Orchestrator Agent — coordinates multi-step AI workflows.

Manages the lifecycle of async jobs: document ingestion (parse→chunk→embed→index),
contract analysis, research synthesis, etc. Tracks job status, handles retries,
and provides progress updates.
"""

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class PipelineStep:
    name: str
    agent: str
    status: StepStatus = StepStatus.PENDING
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    result: Optional[Any] = None
    error: Optional[str] = None
    retries: int = 0
    max_retries: int = 3


@dataclass
class PipelineJob:
    id: str
    type: str
    status: JobStatus = JobStatus.PENDING
    steps: List[PipelineStep] = field(default_factory=list)
    progress: float = 0.0
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    result: Optional[Any] = None
    error: Optional[str] = None
    context: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "status": self.status.value,
            "progress": self.progress,
            "steps": [
                {
                    "name": s.name,
                    "agent": s.agent,
                    "status": s.status.value,
                    "error": s.error,
                }
                for s in self.steps
            ],
            "created_at": self.created_at,
            "error": self.error,
        }


class PipelineOrchestrator:
    """
    Orchestrates multi-step AI pipelines with:
    - Step sequencing and dependency management
    - Retry logic with exponential backoff
    - Progress tracking
    - Job status persistence
    """

    # Predefined pipeline recipes
    PIPELINES: Dict[str, List[tuple[str, str]]] = {
        "document_ingestion": [
            ("Parse Document", "parser"),
            ("Semantic Chunking", "chunker"),
            ("Generate Embeddings", "embedder"),
            ("Index into Vector Store", "retriever"),
        ],
        "contract_analysis": [
            ("Parse & Chunk", "pipeline_orchestrator"),  # triggers document_ingestion first
            ("Extract Clauses", "clause_extractor"),
            ("Evaluate Against Playbook", "playbook_evaluator"),
            ("Quality Gate Review", "quality_gate"),
        ],
        "research_synthesis": [
            ("Retrieve Relevant Chunks", "retriever"),
            ("Per-Source Summarization", "research_synthesizer"),
            ("Cross-Source Synthesis", "research_synthesizer"),
            ("Citation Verification", "quality_gate"),
        ],
        "meeting_processing": [
            ("Parse Transcript", "meeting_processor"),
            ("Extract Action Items", "meeting_processor"),
            ("Extract Decisions", "meeting_processor"),
            ("Validate Assignments", "quality_gate"),
        ],
    }

    def __init__(self):
        self.jobs: Dict[str, PipelineJob] = {}
        self._step_handlers: Dict[str, Callable] = {}

    def register_handler(self, agent_name: str, handler: Callable):
        """Register a handler function for an agent."""
        self._step_handlers[agent_name] = handler

    def create_job(self, job_type: str, context: Dict[str, Any]) -> PipelineJob:
        """Create a new pipeline job from a recipe."""
        if job_type not in self.PIPELINES:
            raise ValueError(f"Unknown pipeline type: {job_type}. Available: {list(self.PIPELINES.keys())}")

        steps = [
            PipelineStep(name=name, agent=agent)
            for name, agent in self.PIPELINES[job_type]
        ]

        job = PipelineJob(
            id=f"job-{uuid.uuid4().hex[:12]}",
            type=job_type,
            steps=steps,
            context=context,
        )
        self.jobs[job.id] = job
        return job

    async def run_job(self, job: PipelineJob) -> PipelineJob:
        """Execute all steps in a pipeline job sequentially."""
        job.status = JobStatus.RUNNING
        job.started_at = time.time()
        total_steps = len(job.steps)

        try:
            for i, step in enumerate(job.steps):
                step.status = StepStatus.RUNNING
                step.started_at = time.time()

                try:
                    if step.agent in self._step_handlers:
                        handler = self._step_handlers[step.agent]
                        result = await self._run_with_retry(handler, job.context, step)
                        step.result = result
                        step.status = StepStatus.COMPLETED
                        # Pass result forward as context for next steps
                        if isinstance(result, dict):
                            job.context.update(result)
                    else:
                        # Agent handler not registered — skip with warning
                        step.status = StepStatus.SKIPPED
                        step.error = f"No handler registered for agent '{step.agent}'"
                except Exception as e:
                    step.status = StepStatus.FAILED
                    step.error = str(e)
                    raise  # Fail the entire pipeline on step failure

                finally:
                    step.completed_at = time.time()
                    job.progress = (i + 1) / total_steps

            job.status = JobStatus.COMPLETED
            job.completed_at = time.time()

        except Exception as e:
            job.status = JobStatus.FAILED
            job.error = str(e)
            job.completed_at = time.time()

        return job

    async def _run_with_retry(self, handler: Callable, context: Dict[str, Any], step: PipelineStep) -> Any:
        """Execute a step handler with retry logic and exponential backoff."""
        last_error = None

        for attempt in range(step.max_retries + 1):
            try:
                if asyncio.iscoroutinefunction(handler):
                    return await handler(context)
                else:
                    return handler(context)
            except Exception as e:
                last_error = e
                step.retries = attempt + 1
                if attempt < step.max_retries:
                    wait = 2 ** attempt  # 1s, 2s, 4s
                    await asyncio.sleep(wait)
                else:
                    raise last_error

    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get the current status of a pipeline job."""
        job = self.jobs.get(job_id)
        if not job:
            return None
        return job.to_dict()

    def cancel_job(self, job_id: str) -> bool:
        """Cancel a running or pending job."""
        job = self.jobs.get(job_id)
        if not job or job.status not in (JobStatus.PENDING, JobStatus.RUNNING):
            return False
        job.status = JobStatus.CANCELLED
        return True
