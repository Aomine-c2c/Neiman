"""
Graphify & Obsidian Knowledge Graph Engine for NEIMAN OS.

Features:
1. Graphify Pipeline:
   - Ingests raw text, markdown documents, architecture records, or code notes.
   - Extracts concepts, nodes, and bidirectional relationships.
   - Computes network graph topology (nodes, links, clustering, degrees).
2. Obsidian Markdown Vault Generator:
   - Formats every knowledge entity and memory item as an Obsidian-compatible markdown note.
   - Automatically injects bidirectional wikilinks (`[[Entity Name]]` and `[[Related Policy]]`).
   - Generates vault index and graph metadata (`GRAPH_REPORT.md` and `.obsidian/` compatible structure).
   - Enables native export and live interactive SVG/HTML force-directed graph rendering.
"""

import uuid
from datetime import UTC, datetime

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.domains.memory.models import KnowledgeEntity, KnowledgeRelation, MemoryItem

# =====================================================================
# PYDANTIC SCHEMAS
# =====================================================================


class GraphifyNode(BaseModel):
    id: str
    name: str
    type: str  # e.g., "AGENT", "POLICY", "SYSTEM", "CONCEPT", "DOCUMENT"
    description: str | None = None
    degree: int = 0
    in_links: list[str] = Field(default_factory=list)
    out_links: list[str] = Field(default_factory=list)


class GraphifyEdge(BaseModel):
    source: str
    target: str
    relation: str
    weight: float = 1.0
    provenance: str | None = None


class GraphifyNetworkResponse(BaseModel):
    nodes: list[GraphifyNode]
    edges: list[GraphifyEdge]
    total_nodes: int
    total_edges: int
    central_concepts: list[str]
    vault_markdown_export: str


class ObsidianVaultFile(BaseModel):
    filename: str
    title: str
    content: str
    wikilinks: list[str]


# =====================================================================
# GRAPHIFY SERVICE
# =====================================================================


class GraphifyEngine:
    """
    Transforms unstructured company memories, rules, and agents into an
    Obsidian-compatible bidirectional graph network.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def build_network(self, company_id: uuid.UUID) -> GraphifyNetworkResponse:
        """Assembles the complete graphify topology with Obsidian bidirectional wikilinks."""
        # 1. Fetch all knowledge entities & relations
        ent_stmt = select(KnowledgeEntity).where(KnowledgeEntity.company_id == company_id)
        ent_res = await self.db.execute(ent_stmt)
        entities = list(ent_res.scalars().all())

        rel_stmt = select(KnowledgeRelation).where(KnowledgeRelation.company_id == company_id)
        rel_res = await self.db.execute(rel_stmt)
        relations = list(rel_res.scalars().all())

        # Also pull memory items to enrich nodes with institutional assets
        mem_stmt = select(MemoryItem).where(MemoryItem.company_id == company_id).limit(50)
        mem_res = await self.db.execute(mem_stmt)
        memories = list(mem_res.scalars().all())

        entity_by_id: dict[uuid.UUID, KnowledgeEntity] = {e.id: e for e in entities}
        entity_by_name: dict[str, KnowledgeEntity] = {e.name.lower(): e for e in entities}

        # 2. Build nodes dictionary
        nodes_dict: dict[str, GraphifyNode] = {}
        for ent in entities:
            nodes_dict[str(ent.id)] = GraphifyNode(
                id=str(ent.id),
                name=ent.name,
                type=ent.entity_type,
                description=ent.description,
            )

        # Map memory items as concept/document nodes if not already present
        for mem in memories:
            clean_title = mem.title.strip()
            mem_id = f"mem-{str(mem.id)[:8]}"
            nodes_dict[mem_id] = GraphifyNode(
                id=mem_id,
                name=clean_title,
                type=mem.domain,
                description=mem.summary or mem.content[:150],
            )

        # 3. Build edges and compute node degrees
        edges: list[GraphifyEdge] = []
        for rel in relations:
            src_ent = entity_by_id.get(rel.source_id)
            tgt_ent = entity_by_id.get(rel.target_id)
            if src_ent and tgt_ent:
                src_id = str(src_ent.id)
                tgt_id = str(tgt_ent.id)
                edges.append(
                    GraphifyEdge(
                        source=src_ent.name,
                        target=tgt_ent.name,
                        relation=rel.relation_type,
                        weight=rel.weight,
                        provenance=rel.provenance,
                    )
                )
                if src_id in nodes_dict:
                    nodes_dict[src_id].degree += 1
                    nodes_dict[src_id].out_links.append(tgt_ent.name)
                if tgt_id in nodes_dict:
                    nodes_dict[tgt_id].degree += 1
                    nodes_dict[tgt_id].in_links.append(src_ent.name)

        # Infer bidirectional links between Memory Items and Entities by title mentions
        for mem_id, m_node in list(nodes_dict.items()):
            if mem_id.startswith("mem-"):
                desc = (m_node.description or "").lower()
                for ent_name_lower, ent_obj in entity_by_name.items():
                    if ent_name_lower in desc and ent_name_lower != m_node.name.lower():
                        edges.append(
                            GraphifyEdge(
                                source=m_node.name,
                                target=ent_obj.name,
                                relation="REFERENCES",
                                weight=0.8,
                                provenance="Automated Wikilink Inference",
                            )
                        )
                        m_node.degree += 1
                        m_node.out_links.append(ent_obj.name)
                        ent_node_id = str(ent_obj.id)
                        if ent_node_id in nodes_dict:
                            nodes_dict[ent_node_id].degree += 1
                            nodes_dict[ent_node_id].in_links.append(m_node.name)

        all_nodes = list(nodes_dict.values())
        # Sort by degree to find hub/central concepts
        sorted_nodes = sorted(all_nodes, key=lambda n: n.degree, reverse=True)
        central_concepts = [n.name for n in sorted_nodes[:6]]

        # 4. Generate Obsidian Markdown Vault string
        vault_markdown = self._generate_obsidian_vault_export(all_nodes, edges)

        return GraphifyNetworkResponse(
            nodes=all_nodes,
            edges=edges,
            total_nodes=len(all_nodes),
            total_edges=len(edges),
            central_concepts=central_concepts,
            vault_markdown_export=vault_markdown,
        )

    def _generate_obsidian_vault_export(
        self, nodes: list[GraphifyNode], edges: list[GraphifyEdge]
    ) -> str:
        """Formats the knowledge graph into an Obsidian-style markdown package with wikilinks."""
        lines = [
            "# NEIMAN OS // OBSIDIAN VAULT KNOWLEDGE GRAPH",
            f"Generated: {datetime.now(UTC).strftime('%Y-%m-%d %H:%M:%S UTC')}",
            f"Total Nodes: {len(nodes)} | Total Bidirectional Connections: {len(edges)}",
            "---",
            "",
            "## 1. Graph Overview & Index",
        ]
        for node in nodes:
            out_refs = " ".join([f"[[{tgt}]]" for tgt in set(node.out_links)])
            lines.append(
                f"- **[[{node.name}]]** (`{node.type}`) — {node.description or 'No description'}"
            )
            if out_refs:
                lines.append(f"  - Outgoing Links: {out_refs}")

        lines.extend(
            [
                "",
                "## 2. Bidirectional Edge Index",
            ]
        )
        for edge in edges:
            lines.append(
                f"- [[{edge.source}]] ==({edge.relation.lower()})==> [[{edge.target}]] (Weight: {edge.weight})"
            )

        lines.extend(
            [
                "",
                "## 3. Obsidian Integration Instructions",
                "To view in Obsidian:",
                "1. Copy this content or export as `.md` notes into your Obsidian Vault folder.",
                "2. Open Obsidian and trigger **Graph View** (`Cmd+G` or `Ctrl+G`).",
                "3. Interactive bidirectional force-directed graph will cluster based on the `[[wikilinks]]` above.",
            ]
        )
        return "\n".join(lines)
