-- CTOs: dados extras, portas opcionais (não confirmadas) e controle de atualização
ALTER TABLE public.ctos
  ADD COLUMN nome text,
  ADD COLUMN endereco text,
  ADD COLUMN observacoes text,
  ADD COLUMN origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','kmz')),
  ADD COLUMN ref_externa text,
  ADD COLUMN portas_atualizadas_em timestamptz,
  ADD COLUMN portas_atualizadas_por text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Portas desconhecidas ficam NULL (nunca presumir capacidade)
ALTER TABLE public.ctos
  ALTER COLUMN portas_total DROP NOT NULL,
  ALTER COLUMN portas_total DROP DEFAULT,
  ALTER COLUMN portas_ocupadas DROP NOT NULL,
  ALTER COLUMN portas_ocupadas DROP DEFAULT;
ALTER TABLE public.ctos ADD CONSTRAINT ctos_portas_validas CHECK (
  (portas_total IS NULL OR portas_total > 0)
  AND (portas_ocupadas IS NULL OR portas_ocupadas >= 0)
  AND (portas_total IS NULL OR portas_ocupadas IS NULL OR portas_ocupadas <= portas_total)
);

-- Evitar duplicadas: código único sem diferenciar maiúsculas/espaços e referência externa (KMZ) única
CREATE UNIQUE INDEX ctos_codigo_unico ON public.ctos (lower(btrim(codigo)));
CREATE UNIQUE INDEX ctos_ref_externa_unica ON public.ctos (ref_externa) WHERE ref_externa IS NOT NULL;

UPDATE public.ctos SET portas_atualizadas_em = created_at, portas_atualizadas_por = 'Dados iniciais'
WHERE portas_total IS NOT NULL;

-- Perfis com e-mail (para a TI gerenciar usuários)
ALTER TABLE public.profiles ADD COLUMN email text;
UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE u.id = p.id;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'perfil')::public.app_role, 'tecnico'));
  RETURN NEW;
END $$;

CREATE POLICY "ti ve papeis" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'ti'));

-- Histórico: categoria, autor e portas informadas pelo técnico. Sem UPDATE/DELETE: registros são permanentes.
ALTER TABLE public.historico
  ADD COLUMN categoria text NOT NULL DEFAULT 'servico' CHECK (categoria IN ('servico','problema','cadastro','alteracao','status')),
  ADD COLUMN usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN portas_utilizadas text,
  ADD COLUMN portas_ocupadas_obs int CHECK (portas_ocupadas_obs IS NULL OR portas_ocupadas_obs >= 0);
UPDATE public.historico SET categoria = CASE
  WHEN acao = 'Problema reportado' THEN 'problema'
  WHEN acao IN ('CTO desativada','CTO reativada') THEN 'status'
  ELSE 'servico' END;
CREATE INDEX historico_cto_idx ON public.historico (cto_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.nome_usuario_atual()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT nome FROM public.profiles WHERE id = auth.uid()), 'Sistema')
$$;

-- Carimba data/autor da contagem de portas
CREATE OR REPLACE FUNCTION public.ctos_antes_salvar()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.codigo := btrim(NEW.codigo);
  IF TG_OP = 'INSERT' THEN
    IF NEW.portas_total IS NOT NULL THEN
      NEW.portas_atualizadas_em := now();
      NEW.portas_atualizadas_por := public.nome_usuario_atual();
    ELSE
      NEW.portas_atualizadas_em := NULL;
      NEW.portas_atualizadas_por := NULL;
    END IF;
  ELSE
    NEW.updated_at := now();
    IF NEW.portas_total IS DISTINCT FROM OLD.portas_total
       OR NEW.portas_ocupadas IS DISTINCT FROM OLD.portas_ocupadas
       OR NEW.portas_atualizadas_em IS DISTINCT FROM OLD.portas_atualizadas_em THEN
      NEW.portas_atualizadas_em := CASE WHEN NEW.portas_total IS NULL THEN NULL ELSE now() END;
      NEW.portas_atualizadas_por := CASE WHEN NEW.portas_total IS NULL THEN NULL ELSE public.nome_usuario_atual() END;
    ELSE
      NEW.portas_atualizadas_por := OLD.portas_atualizadas_por;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ctos_antes_salvar BEFORE INSERT OR UPDATE ON public.ctos
FOR EACH ROW EXECUTE FUNCTION public.ctos_antes_salvar();

-- Toda alteração no cadastro da CTO fica no histórico
CREATE OR REPLACE FUNCTION public.ctos_registrar_alteracao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  quem text := public.nome_usuario_atual();
  mud text[] := '{}';
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO historico (cto_id, cto_codigo, tecnico, usuario_id, categoria, acao)
    VALUES (NEW.id, NEW.codigo, quem, auth.uid(), 'cadastro',
      CASE WHEN NEW.origem = 'kmz' THEN 'CTO importada do KMZ' ELSE 'CTO cadastrada' END);
    RETURN NEW;
  END IF;

  IF NEW.ativa IS DISTINCT FROM OLD.ativa THEN
    INSERT INTO historico (cto_id, cto_codigo, tecnico, usuario_id, categoria, acao)
    VALUES (NEW.id, NEW.codigo, quem, auth.uid(), 'status',
      CASE WHEN NEW.ativa THEN 'CTO reativada' ELSE 'CTO desativada' END);
  END IF;

  IF NEW.codigo IS DISTINCT FROM OLD.codigo THEN mud := mud || format('Código: %s → %s', OLD.codigo, NEW.codigo); END IF;
  IF NEW.nome IS DISTINCT FROM OLD.nome THEN mud := mud || format('Nome: %s → %s', COALESCE(OLD.nome,'—'), COALESCE(NEW.nome,'—')); END IF;
  IF NEW.bairro IS DISTINCT FROM OLD.bairro THEN mud := mud || format('Bairro: %s → %s', OLD.bairro, NEW.bairro); END IF;
  IF NEW.endereco IS DISTINCT FROM OLD.endereco THEN mud := mud || format('Endereço: %s → %s', COALESCE(OLD.endereco,'—'), COALESCE(NEW.endereco,'—')); END IF;
  IF NEW.lat IS DISTINCT FROM OLD.lat OR NEW.lng IS DISTINCT FROM OLD.lng THEN
    mud := mud || format('Localização: %s, %s → %s, %s',
      round(OLD.lat::numeric, 6), round(OLD.lng::numeric, 6), round(NEW.lat::numeric, 6), round(NEW.lng::numeric, 6));
  END IF;
  IF NEW.portas_total IS DISTINCT FROM OLD.portas_total OR NEW.portas_ocupadas IS DISTINCT FROM OLD.portas_ocupadas THEN
    mud := mud || format('Portas ocupadas: %s/%s → %s/%s',
      COALESCE(OLD.portas_ocupadas::text,'?'), COALESCE(OLD.portas_total::text,'?'),
      COALESCE(NEW.portas_ocupadas::text,'?'), COALESCE(NEW.portas_total::text,'?'));
  ELSIF NEW.portas_atualizadas_em IS DISTINCT FROM OLD.portas_atualizadas_em AND NEW.portas_total IS NOT NULL THEN
    mud := mud || 'Contagem de portas conferida, sem alteração'::text;
  END IF;
  IF NEW.observacoes IS DISTINCT FROM OLD.observacoes THEN mud := mud || 'Observações atualizadas'::text; END IF;

  IF cardinality(mud) > 0 THEN
    INSERT INTO historico (cto_id, cto_codigo, tecnico, usuario_id, categoria, acao, descricao)
    VALUES (NEW.id, NEW.codigo, quem, auth.uid(), 'alteracao', 'Cadastro atualizado pela TI', array_to_string(mud, E'\n'));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ctos_registrar_alteracao AFTER INSERT OR UPDATE ON public.ctos
FOR EACH ROW EXECUTE FUNCTION public.ctos_registrar_alteracao();

-- Desativar/reativar (o histórico é gravado pelo trigger; a CTO nunca é apagada)
CREATE OR REPLACE FUNCTION public.alternar_cto(_cto uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.ctos;
BEGIN
  IF NOT public.has_role(auth.uid(),'ti') THEN RAISE EXCEPTION 'apenas TI'; END IF;
  UPDATE ctos SET ativa = NOT ativa WHERE id = _cto RETURNING * INTO c;
  IF c.id IS NULL THEN RAISE EXCEPTION 'CTO não encontrada'; END IF;
  RETURN c.ativa;
END $$;

-- Registro de serviço feito pelo técnico direto na CTO.
-- O técnico informa o que observou; a contagem oficial de portas só é alterada pela TI.
CREATE OR REPLACE FUNCTION public.registrar_servico_cto(
  _cto uuid, _servico text, _descricao text, _portas_utilizadas text, _portas_ocupadas_obs int
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.ctos; novo uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  SELECT * INTO c FROM ctos WHERE id = _cto;
  IF c.id IS NULL THEN RAISE EXCEPTION 'CTO não encontrada'; END IF;
  IF NOT c.ativa THEN RAISE EXCEPTION 'CTO desativada'; END IF;
  IF COALESCE(btrim(_servico),'') = '' THEN RAISE EXCEPTION 'informe o serviço realizado'; END IF;
  IF COALESCE(btrim(_descricao),'') = '' THEN RAISE EXCEPTION 'descreva o que foi feito'; END IF;
  IF _portas_ocupadas_obs IS NOT NULL AND (_portas_ocupadas_obs < 0 OR (c.portas_total IS NOT NULL AND _portas_ocupadas_obs > c.portas_total)) THEN
    RAISE EXCEPTION 'quantidade de portas inválida';
  END IF;
  INSERT INTO historico (cto_id, cto_codigo, tecnico, usuario_id, categoria, acao, descricao, portas_utilizadas, portas_ocupadas_obs)
  VALUES (c.id, c.codigo, public.nome_usuario_atual(), auth.uid(), 'servico', btrim(_servico), btrim(_descricao),
    NULLIF(btrim(COALESCE(_portas_utilizadas,'')),''), _portas_ocupadas_obs)
  RETURNING id INTO novo;
  RETURN novo;
END $$;

-- Fluxo de tarefas: técnico não altera mais a contagem oficial, apenas relata o que viu
CREATE OR REPLACE FUNCTION public.registrar_servico(_tarefa uuid, _descricao text, _portas int, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.tarefas; c public.ctos;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  IF _status NOT IN ('andamento','concluida') THEN RAISE EXCEPTION 'situação inválida'; END IF;
  SELECT * INTO t FROM tarefas WHERE id = _tarefa;
  IF t.id IS NULL THEN RAISE EXCEPTION 'tarefa não encontrada'; END IF;
  SELECT * INTO c FROM ctos WHERE id = t.cto_id;
  IF _portas IS NOT NULL AND (_portas < 0 OR (c.portas_total IS NOT NULL AND _portas > c.portas_total)) THEN
    RAISE EXCEPTION 'portas inválidas';
  END IF;
  UPDATE tarefas SET status = _status WHERE id = t.id;
  INSERT INTO historico (tarefa_id, servico_id, cto_id, cto_codigo, tecnico, usuario_id, categoria, acao, descricao, portas_ocupadas_obs)
  VALUES (t.id, t.servico_id, c.id, c.codigo, public.nome_usuario_atual(), auth.uid(), 'servico',
    t.tipo || CASE WHEN _status = 'concluida' THEN ' · concluído' ELSE ' · em desenvolvimento' END, _descricao, _portas);
END $$;

CREATE OR REPLACE FUNCTION public.reportar_problema(_tarefa uuid, _descricao text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.tarefas; c public.ctos;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  SELECT * INTO t FROM tarefas WHERE id = _tarefa;
  IF t.id IS NULL THEN RAISE EXCEPTION 'tarefa não encontrada'; END IF;
  SELECT * INTO c FROM ctos WHERE id = t.cto_id;
  UPDATE tarefas SET problema = true WHERE id = t.id;
  INSERT INTO historico (tarefa_id, servico_id, cto_id, cto_codigo, tecnico, usuario_id, categoria, acao, descricao)
  VALUES (t.id, t.servico_id, c.id, c.codigo, public.nome_usuario_atual(), auth.uid(), 'problema', 'Problema reportado', _descricao);
END $$;

REVOKE EXECUTE ON FUNCTION public.registrar_servico_cto, public.nome_usuario_atual FROM anon, public;
GRANT EXECUTE ON FUNCTION public.registrar_servico_cto, public.nome_usuario_atual TO authenticated;
