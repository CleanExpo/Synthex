"""
BayesianOptimization engine wrapper.

Manages optimisation spaces per org, stores observations in-memory,
and provides suggest/maximise capabilities.
"""

import logging
import uuid
from threading import Thread
from typing import Optional

from bayes_opt import BayesianOptimization, UtilityFunction

logger = logging.getLogger("synthex-ai.bo")

# In-memory storage for spaces and jobs
# In production, these would be backed by the Synthex Prisma DB
_spaces: dict[str, dict] = {}  # spaceId -> space config + optimizer
_jobs: dict[str, dict] = {}  # jobId -> job state


def _build_optimizer(space: dict) -> BayesianOptimization:
    """Create a BayesianOptimization instance from a space config."""
    pbounds = {
        k: (v["min"], v["max"])
        for k, v in space["parameters"].items()
    }

    # Create with a dummy function — we use probe() for external observations
    optimizer = BayesianOptimization(
        f=None,
        pbounds=pbounds,
        random_state=42,
        allow_duplicate_points=True,
    )
    return optimizer


def create_space(space_id: str, org_id: str, surface: str,
                 parameters: dict, acquisition_fn: str = "ei",
                 constraints: Optional[dict] = None) -> dict:
    """Create a new optimisation space."""
    if space_id in _spaces:
        raise ValueError(f"Space {space_id} already exists")

    space = {
        "spaceId": space_id,
        "orgId": org_id,
        "surface": surface,
        "parameters": parameters,
        "acquisitionFunction": acquisition_fn,
        "constraints": constraints,
        "totalObservations": 0,
        "bestParameters": None,
        "bestTarget": None,
    }

    space["_optimizer"] = _build_optimizer(space)
    _spaces[space_id] = space
    logger.info("Created space %s for org %s surface %s", space_id, org_id, surface)
    return _get_space_response(space)


def get_space(space_id: str) -> dict:
    """Get space configuration."""
    if space_id not in _spaces:
        raise KeyError(f"Space {space_id} not found")
    return _get_space_response(_spaces[space_id])


def observe(space_id: str, parameters: dict[str, float],
            target: float, metadata: Optional[dict] = None) -> dict:
    """Register an observation (known data point)."""
    if space_id not in _spaces:
        raise KeyError(f"Space {space_id} not found")

    space = _spaces[space_id]
    optimizer: BayesianOptimization = space["_optimizer"]

    # Register the observation using probe
    optimizer.register(params=parameters, target=target)
    space["totalObservations"] += 1

    # Update best if this is better
    if space["bestTarget"] is None or target > space["bestTarget"]:
        space["bestTarget"] = target
        space["bestParameters"] = parameters.copy()

    obs_id = f"obs_{uuid.uuid4().hex[:12]}"
    logger.info("Observation registered in space %s: target=%.4f (total=%d)",
                space_id, target, space["totalObservations"])

    return {
        "id": obs_id,
        "spaceId": space_id,
        "totalObservations": space["totalObservations"],
    }


def suggest(space_id: str) -> dict:
    """Get the next parameter suggestion using acquisition function."""
    if space_id not in _spaces:
        raise KeyError(f"Space {space_id} not found")

    space = _spaces[space_id]
    optimizer: BayesianOptimization = space["_optimizer"]

    if space["totalObservations"] < 2:
        raise ValueError(
            f"Need at least 2 observations to suggest (have {space['totalObservations']})"
        )

    # Map acquisition function name
    acq_map = {"ei": "ei", "ucb": "ucb", "poi": "poi"}
    acq_kind = acq_map.get(space["acquisitionFunction"], "ei")

    utility = UtilityFunction(kind=acq_kind, kappa=2.576, xi=0.01)
    suggestion = optimizer.suggest(utility)

    # Calculate acquisition value at suggested point
    acq_value = float(utility.utility(
        [list(suggestion.values())],
        optimizer._gp,
        optimizer.max["target"] if optimizer.res else 0,
    )[0]) if optimizer.res else 0.0

    # Expected improvement estimate
    ei = max(0.0, acq_value)

    result = {
        "suggestedParameters": suggestion,
        "expectedImprovement": round(ei, 6),
        "acquisitionValue": round(acq_value, 6),
        "iteration": space["totalObservations"],
    }

    logger.info("Suggestion for space %s: %s", space_id, suggestion)
    return result


def maximise(space_id: str, init_points: int = 5, n_iterations: int = 25,
             callback_url: Optional[str] = None) -> dict:
    """Start an async maximisation run."""
    if space_id not in _spaces:
        raise KeyError(f"Space {space_id} not found")

    job_id = f"bo_job_{uuid.uuid4().hex[:12]}"
    job = {
        "jobId": job_id,
        "spaceId": space_id,
        "engine": "bo",
        "status": "running",
        "currentIteration": 0,
        "bestParameters": None,
        "bestTarget": None,
        "error": None,
    }
    _jobs[job_id] = job

    # Run in background thread
    def _run():
        try:
            space = _spaces[space_id]
            optimizer: BayesianOptimization = space["_optimizer"]

            # We need a real function for maximize — use a placeholder
            # In practice, the function is evaluated externally via observe()
            # For maximise, we do sequential suggest + probe cycles
            utility = UtilityFunction(kind="ei", kappa=2.576, xi=0.01)

            for i in range(init_points + n_iterations):
                job["currentIteration"] = i + 1
                if i < init_points:
                    # Random exploration
                    point = optimizer.suggest(utility) if optimizer.res else {
                        k: (v["min"] + v["max"]) / 2
                        for k, v in space["parameters"].items()
                    }
                else:
                    point = optimizer.suggest(utility)
                # Note: in real usage, we'd call back to Synthex to evaluate
                # For now, the point is registered when Synthex calls observe()

            job["status"] = "completed"
            if optimizer.max and "params" in optimizer.max:
                job["bestParameters"] = optimizer.max["params"]
                job["bestTarget"] = optimizer.max["target"]

            logger.info("Maximise job %s completed", job_id)
        except Exception as e:
            job["status"] = "failed"
            job["error"] = str(e)
            logger.error("Maximise job %s failed: %s", job_id, e)

    thread = Thread(target=_run, daemon=True)
    thread.start()

    return {"jobId": job_id, "status": "running"}


def get_job_status(job_id: str) -> dict:
    """Get the status of a maximisation job."""
    if job_id not in _jobs:
        raise KeyError(f"Job {job_id} not found")
    return _jobs[job_id]


def _get_space_response(space: dict) -> dict:
    """Build a safe response dict (excludes internal optimizer object)."""
    return {
        "spaceId": space["spaceId"],
        "orgId": space["orgId"],
        "surface": space["surface"],
        "parameters": space["parameters"],
        "acquisitionFunction": space["acquisitionFunction"],
        "totalObservations": space["totalObservations"],
        "bestParameters": space["bestParameters"],
        "bestTarget": space["bestTarget"],
    }
