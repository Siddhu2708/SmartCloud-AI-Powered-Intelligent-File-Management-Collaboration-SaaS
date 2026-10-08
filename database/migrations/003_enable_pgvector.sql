-- ============================================================
-- Enable pgvector extension and create vector search RPC
-- SmartCloud Migration 003
-- 
-- This migration:
-- 1. Enables the pgvector PostgreSQL extension (for vector operations)
-- 2. Creates an RPC function for efficient vector similarity search
-- ============================================================

-- Enable pgvector extension (requires superuser or cloud provider support)
create extension if not exists vector;

-- Create index on embedding column for faster vector search
create index if not exists document_chunks_embedding_idx 
on public.document_chunks using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- ============================================================
-- RPC Function: search_document_chunks
-- 
-- Performs cosine similarity search over embeddings.
-- Returns results sorted by similarity (highest first).
-- Filters by owner_id for data privacy.
-- ============================================================

create or replace function public.search_document_chunks(
    query_embedding vector,
    user_id uuid,
    "limit" int default 5
)
returns table (
    file_id uuid,
    chunk_index integer,
    content text,
    similarity float8
) as $$
begin
    return query
    select
        dc.file_id,
        dc.chunk_index,
        dc.content,
        (1 - (dc.embedding <=> query_embedding) / 2)::float8 as similarity
    from public.document_chunks dc
    where dc.owner_id = user_id
    order by dc.embedding <=> query_embedding
    limit "limit";
end;
$$ language plpgsql;

-- ============================================================
-- Grant execute permission to authenticated users
-- ============================================================

grant execute on function public.search_document_chunks(vector, uuid, int) 
to authenticated;
