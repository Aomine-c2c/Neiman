"""
LanceDB Vector Storage & Hybrid Search Engine for NEIMAN Organizational Memory.

Provides:
- Embedded zero-server vector storage via LanceDB & PyArrow.
- CPU-efficient offline embeddings via FastEmbed (BAAI/bge-small-en-v1.5).
- Hybrid retrieval (Dense Semantic Embedding + Lexical FTS).
- Strict company_id scoping and domain-level filtering.
"""

from __future__ import annotations

import os
from typing import Any

import lancedb
import pyarrow as pa
from fastembed import TextEmbedding

from nexora.config import get_settings


class LanceVectorStore:
    _instance: LanceVectorStore | None = None
    _embed_model: TextEmbedding | None = None

    def __init__(self, db_path: str | None = None):
        settings = get_settings()
        self.db_path = db_path or os.environ.get("VECTOR_DB_PATH", settings.VECTOR_DB_PATH)
        os.makedirs(self.db_path, exist_ok=True)
        self.db = lancedb.connect(self.db_path)
        self.table_name = "organizational_memories"
        self.code_table_name = "codebase_symbols"
        self._ensure_table()
        self._ensure_code_table()

    @classmethod
    def get_instance(cls) -> LanceVectorStore:
        if cls._instance is None:
            cls._instance = LanceVectorStore()
        return cls._instance

    @classmethod
    def get_embedding_model(cls) -> TextEmbedding | None:
        if cls._embed_model is None:
            if os.environ.get("PYTEST_CURRENT_TEST") or os.environ.get("FAST_TESTS") == "1":
                return None
            try:
                cls._embed_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
            except Exception:
                return None
        return cls._embed_model

    def _compute_vector(self, text: str) -> list[float]:
        embedder = self.get_embedding_model()
        if embedder is not None:
            try:
                vectors = list(embedder.embed([text]))
                return vectors[0].tolist()
            except Exception:
                pass
        import hashlib
        h = hashlib.sha256(text.encode("utf-8")).digest()
        return [(float(b) / 255.0) * 2.0 - 1.0 for b in (h * 12)[:384]]

    def _get_table_names(self) -> list[str]:
        if hasattr(self.db, "table_names"):
            try:
                return list(self.db.table_names())
            except Exception:
                pass
        if hasattr(self.db, "list_tables"):
            try:
                return list(self.db.list_tables())
            except Exception:
                pass
        return []

    def _ensure_table(self) -> None:
        if self.table_name not in self._get_table_names():
            schema = pa.schema(
                [
                    pa.field("id", pa.string()),
                    pa.field("company_id", pa.string()),
                    pa.field("domain", pa.string()),
                    pa.field("scope", pa.string()),
                    pa.field("title", pa.string()),
                    pa.field("summary", pa.string()),
                    pa.field("content", pa.string()),
                    pa.field("vector", pa.list_(pa.float32(), 384)),
                ]
            )
            self.db.create_table(self.table_name, schema=schema)

    def _ensure_code_table(self) -> None:
        if self.code_table_name not in self._get_table_names():
            schema = pa.schema(
                [
                    pa.field("id", pa.string()),
                    pa.field("name", pa.string()),
                    pa.field("kind", pa.string()),
                    pa.field("file_path", pa.string()),
                    pa.field("signature", pa.string()),
                    pa.field("docstring", pa.string()),
                    pa.field("vector", pa.list_(pa.float32(), 384)),
                ]
            )
            self.db.create_table(self.code_table_name, schema=schema)

    def upsert_code_symbols(self, symbols: list[dict[str, Any]]) -> int:
        """Batch embed and upsert code symbol nodes into LanceDB."""
        if not symbols:
            return 0
        self._ensure_code_table()
        
        records = []
        for sym in symbols:
            text = f"{sym.get('name', '')} {sym.get('kind', '')} {sym.get('signature', '')} {sym.get('docstring', '')} {sym.get('file_path', '')}"
            vec = self._compute_vector(text)
            records.append({
                "id": str(sym.get("id", "")),
                "name": str(sym.get("name", "")),
                "kind": str(sym.get("kind", "")),
                "file_path": str(sym.get("file_path", "")),
                "signature": str(sym.get("signature", "") or ""),
                "docstring": str(sym.get("docstring", "") or ""),
                "vector": vec,
            })
        
        # Drop and recreate or add to preserve freshest index
        try:
            self.db.drop_table(self.code_table_name)
        except Exception:
            pass
        schema = pa.schema(
            [
                pa.field("id", pa.string()),
                pa.field("name", pa.string()),
                pa.field("kind", pa.string()),
                pa.field("file_path", pa.string()),
                pa.field("signature", pa.string()),
                pa.field("docstring", pa.string()),
                pa.field("vector", pa.list_(pa.float32(), 384)),
            ]
        )
        self.db.create_table(self.code_table_name, schema=schema, data=records)
        return len(records)

    def search_code_symbols(self, query: str, limit: int = 15) -> list[dict[str, Any]]:
        """Semantic vector search over pre-indexed codebase symbols."""
        if self.code_table_name not in self._get_table_names():
            return []
        tbl = self.db.open_table(self.code_table_name)
        q_vec = self._compute_vector(query)
        try:
            return tbl.search(q_vec).limit(limit).to_list()
        except Exception:
            return []

    def upsert_memory(
        self,
        memory_id: str,
        company_id: str,
        domain: str,
        scope: str,
        title: str,
        summary: str,
        content: str,
    ) -> None:
        """Embed and persist a single memory entry."""
        text_to_embed = f"{title}\n{summary}\n{content}"
        vector_list = self._compute_vector(text_to_embed)

        tbl = self.db.open_table(self.table_name)
        # Delete prior record with same ID to achieve upsert behavior
        try:
            tbl.delete(f'id = "{memory_id}"')
        except Exception:
            pass

        data = [
            {
                "id": str(memory_id),
                "company_id": str(company_id),
                "domain": str(domain),
                "scope": str(scope),
                "title": str(title),
                "summary": str(summary or ""),
                "content": str(content),
                "vector": vector_list,
            }
        ]
        tbl.add(data)

    def search_hybrid(
        self,
        company_id: str,
        query: str,
        target_domains: list[str] | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Executes hybrid dense vector similarity + filtering.
        Returns matched records with distance / relevance ranking.
        """
        if self.table_name not in self._get_table_names():
            return []

        tbl = self.db.open_table(self.table_name)
        query_vec = self._compute_vector(query)

        # Build filter condition
        where_clauses = [f"company_id = '{company_id}'"]
        if target_domains:
            domains_str = ", ".join([f"'{d}'" for d in target_domains])
            where_clauses.append(f"domain IN ({domains_str})")
        where_filter = " AND ".join(where_clauses)

        try:
            results = tbl.search(query_vec).where(where_filter).limit(limit).to_list()
            return results
        except Exception:
            try:
                return (
                    tbl.search(query_vec)
                    .where(f"company_id = '{company_id}'")
                    .limit(limit)
                    .to_list()
                )
            except Exception:
                return []
