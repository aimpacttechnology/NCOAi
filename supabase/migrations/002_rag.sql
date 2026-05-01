-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Document chunks table for RAG
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id          bigserial PRIMARY KEY,
  doc_name    text NOT NULL,
  chunk_index int  NOT NULL,
  content     text NOT NULL,
  embedding   vector(512),
  created_at  timestamptz DEFAULT now()
);

-- IVFFlat index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON public.document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for quick lookup by doc name
CREATE INDEX IF NOT EXISTS document_chunks_doc_name_idx
  ON public.document_chunks (doc_name);

-- Semantic search function
CREATE OR REPLACE FUNCTION search_doc_chunks(
  query_embedding vector(512),
  match_count     int DEFAULT 5,
  min_similarity  float DEFAULT 0.3
)
RETURNS TABLE (
  id         bigint,
  doc_name   text,
  content    text,
  similarity float
)
LANGUAGE sql STABLE AS $$
  SELECT
    id,
    doc_name,
    content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM public.document_chunks
  WHERE embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) >= min_similarity
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
