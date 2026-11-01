
CREATE TYPE public.app_role AS ENUM ('ti','tecnico');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT 'Usuário',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perfis visiveis" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "editar proprio perfil" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver proprio papel" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'perfil')::public.app_role, 'tecnico'));
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.ctos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  bairro text NOT NULL DEFAULT 'Centro',
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  portas_total int NOT NULL DEFAULT 16,
  portas_ocupadas int NOT NULL DEFAULT 0,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ctos TO authenticated;
GRANT ALL ON public.ctos TO service_role;
ALTER TABLE public.ctos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver ctos" ON public.ctos FOR SELECT TO authenticated USING (ativa OR public.has_role(auth.uid(),'ti'));
CREATE POLICY "ti cria ctos" ON public.ctos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'ti'));
CREATE POLICY "ti edita ctos" ON public.ctos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'ti'));

CREATE SEQUENCE public.servico_seq START 1041;
CREATE TABLE public.tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id text NOT NULL UNIQUE DEFAULT ('SV-' || nextval('public.servico_seq')),
  tipo text NOT NULL,
  cto_id uuid NOT NULL REFERENCES public.ctos(id),
  cliente text NOT NULL,
  endereco text NOT NULL DEFAULT '',
  data date NOT NULL DEFAULT current_date,
  horario time NOT NULL DEFAULT '08:00',
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','andamento','concluida')),
  problema boolean NOT NULL DEFAULT false,
  tecnico text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT USAGE ON SEQUENCE public.servico_seq TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tarefas TO authenticated;
GRANT ALL ON public.tarefas TO service_role;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver tarefas" ON public.tarefas FOR SELECT TO authenticated USING (true);
CREATE POLICY "criar tarefas" ON public.tarefas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "atualizar tarefas" ON public.tarefas FOR UPDATE TO authenticated USING (true);

CREATE TABLE public.historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid REFERENCES public.tarefas(id),
  servico_id text,
  cto_id uuid REFERENCES public.ctos(id),
  cto_codigo text NOT NULL,
  tecnico text NOT NULL,
  acao text NOT NULL,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.historico TO authenticated;
GRANT ALL ON public.historico TO service_role;
ALTER TABLE public.historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver historico" ON public.historico FOR SELECT TO authenticated USING (true);

-- Registrar serviço (técnico e data automáticos)
CREATE OR REPLACE FUNCTION public.registrar_servico(_tarefa uuid, _descricao text, _portas int, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.tarefas; c public.ctos; nome text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  IF _status NOT IN ('andamento','concluida') THEN RAISE EXCEPTION 'situação inválida'; END IF;
  SELECT * INTO t FROM tarefas WHERE id = _tarefa;
  SELECT * INTO c FROM ctos WHERE id = t.cto_id;
  IF _portas < 0 OR _portas > c.portas_total THEN RAISE EXCEPTION 'portas inválidas'; END IF;
  SELECT p.nome INTO nome FROM profiles p WHERE p.id = auth.uid();
  UPDATE ctos SET portas_ocupadas = _portas WHERE id = c.id;
  UPDATE tarefas SET status = _status WHERE id = t.id;
  INSERT INTO historico (tarefa_id, servico_id, cto_id, cto_codigo, tecnico, acao, descricao)
  VALUES (t.id, t.servico_id, c.id, c.codigo, COALESCE(nome,'Usuário'),
    CASE WHEN _status='concluida' THEN 'Serviço concluído' ELSE 'Serviço em desenvolvimento' END || ' · ' || _portas || '/' || c.portas_total || ' portas', _descricao);
END $$;

CREATE OR REPLACE FUNCTION public.reportar_problema(_tarefa uuid, _descricao text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.tarefas; c public.ctos; nome text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  SELECT * INTO t FROM tarefas WHERE id = _tarefa;
  SELECT * INTO c FROM ctos WHERE id = t.cto_id;
  SELECT p.nome INTO nome FROM profiles p WHERE p.id = auth.uid();
  UPDATE tarefas SET problema = true WHERE id = t.id;
  INSERT INTO historico (tarefa_id, servico_id, cto_id, cto_codigo, tecnico, acao, descricao)
  VALUES (t.id, t.servico_id, c.id, c.codigo, COALESCE(nome,'Usuário'), 'Problema reportado', _descricao);
END $$;

CREATE OR REPLACE FUNCTION public.alternar_cto(_cto uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.ctos; nome text;
BEGIN
  IF NOT public.has_role(auth.uid(),'ti') THEN RAISE EXCEPTION 'apenas TI'; END IF;
  UPDATE ctos SET ativa = NOT ativa WHERE id = _cto RETURNING * INTO c;
  SELECT p.nome INTO nome FROM profiles p WHERE p.id = auth.uid();
  INSERT INTO historico (cto_id, cto_codigo, tecnico, acao) VALUES (c.id, c.codigo, COALESCE(nome,'TI'), CASE WHEN c.ativa THEN 'CTO reativada' ELSE 'CTO desativada' END);
  RETURN c.ativa;
END $$;

REVOKE EXECUTE ON FUNCTION public.registrar_servico, public.reportar_problema, public.alternar_cto FROM anon, public;
GRANT EXECUTE ON FUNCTION public.registrar_servico, public.reportar_problema, public.alternar_cto TO authenticated;

-- Dados de exemplo
INSERT INTO public.ctos (codigo,bairro,lat,lng,portas_total,portas_ocupadas) VALUES
('CTO-ARAC-01','Centro',-4.5617,-37.7697,16,9),
('CTO-ARAC-02','Centro',-4.5640,-37.7722,16,15),
('CTO-ARAC-03','Centro',-4.5596,-37.7675,8,4),
('CTO-ARAC-04','Farias Brito',-4.5672,-37.7655,16,6),
('CTO-ARAC-05','Farias Brito',-4.5701,-37.7690,8,8),
('CTO-ARAC-06','Santa Teresa',-4.5555,-37.7740,16,11),
('CTO-ARAC-07','Santa Teresa',-4.5530,-37.7710,8,3),
('CTO-ARAC-08','Santa Teresa',-4.5578,-37.7765,16,14),
('CTO-ARAC-09','Cumbe',-4.5085,-37.7040,8,7),
('CTO-ARAC-10','Cumbe',-4.5060,-37.7012,16,5);

INSERT INTO public.tarefas (tipo,cto_id,cliente,endereco,data,horario,status,problema,tecnico)
SELECT v.tipo,(SELECT id FROM public.ctos WHERE codigo=v.cto),v.cliente,v.endereco,current_date+v.dia,v.hora::time,v.status,v.problema,v.tec
FROM (VALUES
('Nova Instalação','CTO-ARAC-04','Maria do Socorro Lima','Rua Cel. Alexanderlino, 210',-2,'09:00','pendente',false,'Rafael Lima'),
('Troca de Porta','CTO-ARAC-05','José Airton Freitas','Rua Santos Dumont, 88',0,'10:30','pendente',true,'Diego Alves'),
('Nova Instalação','CTO-ARAC-01','Ana Cláudia Rocha','Rua Grande, 455',0,'14:00','pendente',false,'Rafael Lima'),
('Manutenção Preventiva','CTO-ARAC-06','Condomínio Santa Teresa','Av. Cel. Pompeu, 1200',1,'08:30','pendente',false,'Diego Alves'),
('Nova Instalação','CTO-ARAC-07','Francisco Holanda','Rua do Rosário, 32',0,'11:00','andamento',false,'Rafael Lima'),
('Troca de Porta','CTO-ARAC-03','Pousada Canoa','Travessa da Matriz, 17',0,'15:30','andamento',false,'Diego Alves'),
('Manutenção Preventiva','CTO-ARAC-10','Escola Cumbe','Estrada do Cumbe, s/n',-1,'09:30','concluida',false,'Diego Alves'),
('Nova Instalação','CTO-ARAC-09','Raimunda Pereira','Rua da Praia, 74',-1,'16:00','concluida',false,'Rafael Lima')
) AS v(tipo,cto,cliente,endereco,dia,hora,status,problema,tec);

INSERT INTO public.historico (tarefa_id,servico_id,cto_id,cto_codigo,tecnico,acao,descricao,created_at)
SELECT t.id,t.servico_id,c.id,c.codigo,t.tecnico,'Serviço concluído · '||c.portas_ocupadas||'/'||c.portas_total||' portas','Serviço finalizado e testado com o cliente.',(t.data + t.horario)::timestamptz + interval '1 hour'
FROM public.tarefas t JOIN public.ctos c ON c.id=t.cto_id WHERE t.status='concluida';
INSERT INTO public.historico (tarefa_id,servico_id,cto_id,cto_codigo,tecnico,acao,descricao)
SELECT t.id,t.servico_id,c.id,c.codigo,t.tecnico,'Problema reportado','CTO lotada, sem porta livre para o cliente.'
FROM public.tarefas t JOIN public.ctos c ON c.id=t.cto_id WHERE t.problema;

-- Usuário inicial TI
DO $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
  VALUES ('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated','admin123@gmail.com',extensions.crypt('admin123',extensions.gen_salt('bf')),now(),
    '{"provider":"email","providers":["email"]}','{"nome":"Administrador","perfil":"ti"}',now(),now(),'','','','');
  INSERT INTO auth.identities (id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
  VALUES (gen_random_uuid(),uid,uid::text,jsonb_build_object('sub',uid::text,'email','admin123@gmail.com','email_verified',true),'email',now(),now(),now());
END $$;
