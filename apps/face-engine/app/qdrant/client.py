"""
Qdrant Vector Database Repository Module.

Isolates all Qdrant vector database interactions behind a repository abstraction.
Handles health checks, collection validation (512-D Cosine), registration idempotency,
ANN similarity searches, and graceful connection failure handling.
"""

import uuid
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from app.core.config import settings
from app.exceptions.custom import QdrantRepositoryException

logger = logging.getLogger(__name__)

class QdrantRepository:

    def __init__(self):
        self._client: Optional[QdrantClient] = None

    def get_client(self) -> QdrantClient:
        """Returns or lazily creates QdrantClient instance."""
        if self._client is None:
            try:
                api_key = settings.QDRANT_API_KEY if settings.QDRANT_API_KEY else None
                if settings.QDRANT_URL == ":memory:":
                    logger.info("Connecting to embedded in-memory Qdrant...")
                    self._client = QdrantClient(location=":memory:")
                elif settings.QDRANT_URL.startswith("local:"):
                    local_path = settings.QDRANT_URL[len("local:"):] or "./qdrant_storage"
                    logger.info(f"Connecting to embedded local Qdrant at {local_path}...")
                    self._client = QdrantClient(path=local_path)
                else:
                    logger.info(f"Connecting to Qdrant at {settings.QDRANT_URL}...")
                    self._client = QdrantClient(url=settings.QDRANT_URL, api_key=api_key)
                self.ensure_collection()
            except Exception as exc:
                logger.warning(f"Qdrant connection failed: {exc}")
                raise QdrantRepositoryException(f"Failed to connect to Qdrant: {str(exc)}") from exc
        return self._client

    def is_connected(self) -> bool:
        """Checks if Qdrant server is reachable."""
        try:
            client = self.get_client()
            client.get_collections()
            return True
        except Exception:
            return False

    def ensure_collection(self):
        """
        Validates or creates the Qdrant vector collection.
        Enforces 512 dimensions and Cosine distance metric.
        """
        try:
            client = self._client if self._client else self.get_client()
            collections = client.get_collections().collections
            exists = any(c.name == settings.QDRANT_COLLECTION for c in collections)

            if not exists:
                logger.info(f"Creating Qdrant collection '{settings.QDRANT_COLLECTION}' (size={settings.QDRANT_VECTOR_SIZE}, metric=Cosine)...")
                client.create_collection(
                    collection_name=settings.QDRANT_COLLECTION,
                    vectors_config=qmodels.VectorParams(
                        size=settings.QDRANT_VECTOR_SIZE,
                        distance=qmodels.Distance.COSINE
                    )
                )
                logger.info("Collection created successfully.")
            else:
                # Verify collection configuration
                collection_info = client.get_collection(collection_name=settings.QDRANT_COLLECTION)
                vec_size = collection_info.config.params.vectors.size
                if vec_size != settings.QDRANT_VECTOR_SIZE:
                    raise QdrantRepositoryException(
                        f"Incompatible Qdrant collection vector size: expected {settings.QDRANT_VECTOR_SIZE}, found {vec_size}."
                    )
        except QdrantRepositoryException:
            raise
        except Exception as exc:
            logger.warning(f"Could not verify Qdrant collection: {exc}")

    def upsert_student_vector(
        self,
        student_id: str,
        embedding: List[float],
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Upserts a student's 512-D face embedding vector into Qdrant.

        Handles registration idempotency:
        - If student already has an active point, replaces/updates it.
        - Otherwise creates a new point.
        """
        client = self.get_client()
        now_iso = datetime.now(timezone.utc).isoformat()

        # Check for existing point for student_id (Idempotency)
        point_id = None
        try:
            existing_search = client.scroll(
                collection_name=settings.QDRANT_COLLECTION,
                scroll_filter=qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="student_id",
                            match=qmodels.MatchValue(value=student_id)
                        )
                    ]
                ),
                limit=1
            )
            if existing_search[0]:
                point_id = str(existing_search[0][0].id)
                logger.info(f"Updating existing Qdrant point {point_id} for student {student_id}")
        except Exception as exc:
            logger.debug(f"Scroll filter check ignored: {exc}")

        if not point_id:
            point_id = str(uuid.uuid4())
            logger.info(f"Creating new Qdrant point {point_id} for student {student_id}")

        payload = {
            "student_id": student_id,
            "model_version": f"{settings.INSIGHTFACE_MODEL}-w600k_r50",
            "registered_at": now_iso,
            "is_active": True
        }
        if metadata:
            payload.update(metadata)

        try:
            client.upsert(
                collection_name=settings.QDRANT_COLLECTION,
                points=[
                    qmodels.PointStruct(
                        id=point_id,
                        vector=embedding,
                        payload=payload
                    )
                ]
            )
            return point_id
        except Exception as exc:
            logger.error(f"Failed to upsert vector into Qdrant: {exc}")
            raise QdrantRepositoryException(f"Qdrant vector storage error: {str(exc)}") from exc

    def search_similar_vectors(
        self,
        query_embedding: List[float],
        limit: int = 5,
        score_threshold: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Performs ANN vector similarity search against Qdrant collection.
        """
        client = self.get_client()
        threshold = score_threshold if score_threshold is not None else settings.SIMILARITY_THRESHOLD
        qfilter = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="is_active",
                    match=qmodels.MatchValue(value=True)
                )
            ]
        )

        try:
            if hasattr(client, "query_points"):
                resp = client.query_points(
                    collection_name=settings.QDRANT_COLLECTION,
                    query=query_embedding,
                    limit=limit,
                    score_threshold=threshold,
                    query_filter=qfilter,
                )
                results = resp.points
            else:
                results = client.search(
                    collection_name=settings.QDRANT_COLLECTION,
                    query_vector=query_embedding,
                    limit=limit,
                    score_threshold=threshold,
                    query_filter=qfilter,
                )

            matches = []
            for res in results:
                payload = res.payload if res.payload else {}
                matches.append({
                    "point_id": str(res.id),
                    "student_id": payload.get("student_id"),
                    "score": round(float(res.score), 4),
                    "payload": payload
                })
            return matches
        except Exception as exc:
            logger.error(f"Qdrant vector search failed: {exc}")
            raise QdrantRepositoryException(f"Qdrant search error: {str(exc)}") from exc


# Singleton instance
_repository_instance: Optional[QdrantRepository] = None

def get_qdrant_repository() -> QdrantRepository:
    """Returns singleton QdrantRepository instance."""
    global _repository_instance
    if _repository_instance is None:
        _repository_instance = QdrantRepository()
    return _repository_instance
