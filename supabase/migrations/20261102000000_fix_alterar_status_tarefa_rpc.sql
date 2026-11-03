DROP FUNCTION IF EXISTS public.alterar_status_tarefa(text, text);

CREATE FUNCTION public.alterar_status_tarefa(_status text, _tarefa text)
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

NOTIFY pgrst, 'reload schema';
