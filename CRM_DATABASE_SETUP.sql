BEGIN;

CREATE TABLE IF NOT EXISTS public.entity_grant_pipeline (
    id BIGSERIAL PRIMARY KEY,
    entity_id INTEGER NOT NULL,
    grant_id INTEGER NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'detectada',
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (entity_id, grant_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_grant_pipeline_entity
ON public.entity_grant_pipeline (entity_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_entity_grant_pipeline_status
ON public.entity_grant_pipeline (entity_id, status);

CREATE TABLE IF NOT EXISTS public.entity_grant_pipeline_history (
    id BIGSERIAL PRIMARY KEY,
    pipeline_id BIGINT NOT NULL,
    from_status VARCHAR(64),
    to_status VARCHAR(64) NOT NULL,
    changed_by TEXT,
    notes TEXT,
    changed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_grant_pipeline_history_pipeline
ON public.entity_grant_pipeline_history (pipeline_id, changed_at DESC);

ALTER TABLE IF EXISTS public.entity_documents
    ADD COLUMN IF NOT EXISTS document_type_code VARCHAR(64);

ALTER TABLE IF EXISTS public.entity_documents
    ADD COLUMN IF NOT EXISTS mime_type TEXT;

ALTER TABLE IF EXISTS public.entity_documents
    ADD COLUMN IF NOT EXISTS uploaded_by TEXT;

ALTER TABLE IF EXISTS public.entity_documents
    ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_entity_documents_entity_type_current
ON public.entity_documents (entity_id, document_type_code, is_current, upload_date DESC);

CREATE TABLE IF NOT EXISTS public.corporate_document_catalog (
    code VARCHAR(64) PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.entity_corporate_documents (
    id BIGSERIAL PRIMARY KEY,
    entity_id INTEGER NOT NULL,
    document_type_code VARCHAR(64) NOT NULL,
    original_filename TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    s3_bucket TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'uploaded',
    uploaded_by TEXT,
    upload_date TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at DATE,
    is_current BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_entity_corporate_documents_entity
ON public.entity_corporate_documents (entity_id, upload_date DESC);

CREATE INDEX IF NOT EXISTS idx_entity_corporate_documents_entity_type
ON public.entity_corporate_documents (entity_id, document_type_code, is_current);

INSERT INTO public.corporate_document_catalog (code, label, description, display_order, is_required)
VALUES
    ('pick_deck', 'Pick deck', 'Presentacion corporativa o deck comercial para entender mejor la propuesta de valor.', 1, TRUE),
    ('escrituras_empresa', 'Escrituras de la empresa', 'Documento de constitucion o escrituras inscritas de la sociedad.', 2, TRUE),
    ('modelo_200', 'Modelo 200', 'Ultimo impuesto de sociedades presentado.', 3, TRUE),
    ('vida_laboral_empresa', 'Vida Laboral de la empresa', 'Informe actualizado de la vida laboral de la empresa.', 4, TRUE),
    ('idc', 'IDC', 'Informe de datos para la cotizacion o IDC actualizado.', 5, TRUE),
    ('tarjeta_identificacion_fiscal', 'Tarjeta de identificacion fiscal', 'Tarjeta acreditativa del NIF de la empresa.', 6, TRUE),
    ('certificado_situacion_censal', 'Certificado de situacion censal', 'Certificado actualizado de situacion censal de la AEAT.', 7, TRUE),
    ('poderes', 'Poderes', 'Poderes o documento acreditativo de la representacion.', 8, TRUE),
    ('modelo_036', 'Modelo 036', 'Modelo 036 de alta o modificaciones censales.', 9, TRUE)
ON CONFLICT (code) DO UPDATE SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    is_required = EXCLUDED.is_required;

COMMIT;
