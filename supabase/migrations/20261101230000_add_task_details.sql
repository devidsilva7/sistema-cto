ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS titulo text,
  ADD COLUMN IF NOT EXISTS descricao_problema text,
  ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'media';

UPDATE public.tarefas
SET titulo = tipo
WHERE titulo IS NULL OR btrim(titulo) = '';

ALTER TABLE public.tarefas
  ALTER COLUMN titulo SET DEFAULT 'Tarefa',
  ALTER COLUMN titulo SET NOT NULL;

ALTER TABLE public.historico
  DROP CONSTRAINT IF EXISTS historico_categoria_check;
ALTER TABLE public.historico
  ADD CONSTRAINT historico_categoria_check
  CHECK (categoria IN ('servico', 'problema', 'cadastro', 'alteracao', 'status', 'tarefa'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tarefas_prioridade_check'
      AND conrelid = 'public.tarefas'::regclass
  ) THEN
    ALTER TABLE public.tarefas
      ADD CONSTRAINT tarefas_prioridade_check
      CHECK (prioridade IN ('baixa', 'media', 'alta', 'critica'));
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.registrar_historico_status_tarefa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _ator text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _ator := COALESCE(public.nome_usuario_atual(), NEW.tecnico);
    INSERT INTO public.historico (
      acao, categoria, cto_codigo, cto_id, descricao, servico_id, tarefa_id, tecnico, usuario_id
    )
    SELECT
      'Tarefa criada', 'tarefa', c.codigo, c.id, NEW.descricao_problema,
      NEW.servico_id, NEW.id, _ator, auth.uid()
    FROM public.ctos AS c
    WHERE c.id = NEW.cto_id;
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    _ator := COALESCE(public.nome_usuario_atual(), NEW.tecnico);
    INSERT INTO public.historico (
      acao, categoria, cto_codigo, cto_id, descricao, servico_id, tarefa_id, tecnico, usuario_id
    )
    SELECT
      'Status alterado', 'status', c.codigo, c.id,
      format('Status alterado de %s para %s.', OLD.status, NEW.status),
      NEW.servico_id, NEW.id, _ator, auth.uid()
    FROM public.ctos AS c
    WHERE c.id = NEW.cto_id;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tarefas_historico_apos_criacao ON public.tarefas;
CREATE TRIGGER tarefas_historico_apos_criacao
AFTER INSERT ON public.tarefas
FOR EACH ROW
EXECUTE FUNCTION public.registrar_historico_status_tarefa();

DROP TRIGGER IF EXISTS tarefas_historico_apos_status ON public.tarefas;
CREATE TRIGGER tarefas_historico_apos_status
AFTER UPDATE OF status ON public.tarefas
FOR EACH ROW
EXECUTE FUNCTION public.registrar_historico_status_tarefa();

CREATE OR REPLACE FUNCTION public.alterar_status_tarefa(_tarefa text, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _item public.tarefas%ROWTYPE;
  _nome text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'É necessário estar autenticado.';
  END IF;
  IF _status IS NULL OR _status NOT IN ('pendente', 'andamento', 'concluida') THEN
    RAISE EXCEPTION 'Status de tarefa inválido.';
  END IF;

  SELECT * INTO _item
  FROM public.tarefas
  WHERE id::text = _tarefa
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarefa não encontrada.';
  END IF;

  _nome := public.nome_usuario_atual();
  IF NOT COALESCE(public.has_role(auth.uid(), 'ti'::public.app_role), false)
     AND _item.tecnico IS DISTINCT FROM _nome THEN
    RAISE EXCEPTION 'Você não tem permissão para alterar esta tarefa.';
  END IF;

  UPDATE public.tarefas SET status = _status WHERE id = _item.id;
END
$$;

REVOKE ALL ON FUNCTION public.alterar_status_tarefa(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.alterar_status_tarefa(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.criar_tarefa(
  _titulo text,
  _tipo text,
  _descricao_problema text,
  _prioridade text,
  _tecnico text,
  _cto_id uuid,
  _cliente text,
  _data date,
  _horario time
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _nova public.tarefas%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL
     OR NOT COALESCE(public.has_role(auth.uid(), 'ti'::public.app_role), false) THEN
    RAISE EXCEPTION 'Somente a equipe de TI pode cadastrar tarefas.';
  END IF;
  IF _titulo IS NULL OR btrim(_titulo) = '' OR length(_titulo) > 120 THEN
    RAISE EXCEPTION 'Informe um título válido (até 120 caracteres).';
  END IF;
  IF _tipo IS NULL OR btrim(_tipo) = '' THEN
    RAISE EXCEPTION 'Informe o tipo de serviço.';
  END IF;
  IF _prioridade IS NULL OR _prioridade NOT IN ('baixa', 'media', 'alta', 'critica') THEN
    RAISE EXCEPTION 'Prioridade inválida.';
  END IF;
  IF _tecnico IS NULL OR btrim(_tecnico) = '' OR NOT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.nome = _tecnico
      AND NOT COALESCE(public.has_role(p.id, 'ti'::public.app_role), false)
  ) THEN
    RAISE EXCEPTION 'Selecione um técnico cadastrado.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ctos AS c WHERE c.id = _cto_id AND c.ativa
  ) THEN
    RAISE EXCEPTION 'Selecione uma CTO ativa.';
  END IF;

  INSERT INTO public.tarefas (
    titulo, tipo, descricao_problema, prioridade, tecnico, cto_id, cliente,
    endereco, data, horario, problema, status
  )
  SELECT
    btrim(_titulo), btrim(_tipo), NULLIF(btrim(_descricao_problema), ''), _prioridade,
    btrim(_tecnico), c.id, COALESCE(NULLIF(btrim(_cliente), ''), 'Atendimento CTO'),
    COALESCE(c.endereco, c.bairro, ''), COALESCE(_data, CURRENT_DATE),
    COALESCE(_horario, TIME '09:00'), NULLIF(btrim(_descricao_problema), '') IS NOT NULL,
    'pendente'
  FROM public.ctos AS c
  WHERE c.id = _cto_id
  RETURNING * INTO _nova;

  RETURN _nova.id::text;
END
$$;

REVOKE ALL ON FUNCTION public.criar_tarefa(text, text, text, text, text, uuid, text, date, time) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_tarefa(text, text, text, text, text, uuid, text, date, time) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-photos',
  'task-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "Authenticated users can read task photos" ON storage.objects;
CREATE POLICY "Authenticated users can read task photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'task-photos'
    AND (
      public.has_role(auth.uid(), 'ti'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.tarefas AS t
        WHERE t.id::text = (storage.foldername(name))[1]
          AND t.tecnico = public.nome_usuario_atual()
      )
    )
  );

DROP POLICY IF EXISTS "Authenticated users can upload task photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload task photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-photos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'ti'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.tarefas AS t
        WHERE t.id::text = (storage.foldername(name))[1]
          AND t.tecnico = public.nome_usuario_atual()
      )
    )
  );

DROP POLICY IF EXISTS "Task owners can delete task photos" ON storage.objects;
CREATE POLICY "Task owners can delete task photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'task-photos'
    AND (
      public.has_role(auth.uid(), 'ti'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.tarefas AS t
        WHERE t.id::text = (storage.foldername(name))[1]
          AND t.tecnico = public.nome_usuario_atual()
      )
    )
  );
