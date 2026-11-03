import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  MapPin,
  MapPinned,
  Navigation,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { CtoMap } from "@/components/CtoMap";
import { TaskCard } from "@/components/TaskCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  ctosQuery,
  dataHora,
  historicoCtoQuery,
  historicoTarefaQuery,
  isoLocal,
  linkRota,
  linkWhatsApp,
  mensagemErro,
  meQuery,
  nomeCto,
  portasLivres,
  resumoPortas,
  tarefasQuery,
  TIPOS_SERVICO,
  textoWhatsApp,
  type Cto,
  type Tarefa,
  usuariosQuery,
} from "@/lib/fgtech";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tarefas")({
  validateSearch: z.object({
    criar: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional(),
    tarefa: z.string().optional(),
  }),
  head: () => ({ meta: [{ title: "Tarefas · FGTECH CTO Maps" }] }),
  component: TarefasPage,
});

const STATUS = [
  { id: "pendente", label: "Pendentes", cor: "bg-primary" },
  { id: "andamento", label: "Em desenvolvimento", cor: "bg-info" },
  { id: "concluida", label: "Concluídas", cor: "bg-success" },
] as const;
type StatusTarefa = (typeof STATUS)[number]["id"];

function TarefasPage() {
  const qc = useQueryClient();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/tarefas" });
  const tarefas = useQuery(tarefasQuery);
  const ctos = useQuery(ctosQuery);
  const me = useQuery(meQuery);
  const usuarios = useQuery(usuariosQuery);
  const [criando, setCriando] = useState(false);
  const [selecionada, setSelecionada] = useState<Tarefa | null>(null);
  const [arrastada, setArrastada] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState("todas");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroCto, setFiltroCto] = useState("todas");
  const [busca, setBusca] = useState("");
  const ctoById = useMemo(() => new Map((ctos.data ?? []).map((c) => [c.id, c])), [ctos.data]);
  const lista = useMemo(() => tarefas.data ?? [], [tarefas.data]);
  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return lista.filter((tarefa) => {
      if (filtroStatus !== "todas" && tarefa.status !== filtroStatus) return false;
      if (filtroTipo !== "todos" && tarefa.tipo !== filtroTipo) return false;
      if (filtroCto !== "todas" && tarefa.cto_id !== filtroCto) return false;
      if (!termo) return true;
      const cto = ctoById.get(tarefa.cto_id);
      return [
        tarefa.titulo,
        tarefa.tipo,
        tarefa.cliente,
        tarefa.descricao_problema,
        tarefa.tecnico,
        cto?.codigo,
        cto?.bairro,
      ]
        .filter((valor): valor is string => Boolean(valor))
        .some((valor) => valor?.toLocaleLowerCase("pt-BR").includes(termo));
    });
  }, [busca, ctoById, filtroCto, filtroStatus, filtroTipo, lista]);
  const tarefaSelecionada = useMemo(
    () => lista.find((item) => item.id === selecionada?.id) ?? selecionada,
    [lista, selecionada],
  );

  useEffect(() => {
    const abrirCadastro = search.criar === true || search.criar === "true";
    if (abrirCadastro) setCriando(true);
    if (search.tarefa && tarefas.isLoading) return;
    if (search.tarefa) {
      const tarefa = lista.find((item) => item.id === search.tarefa);
      if (tarefa) setSelecionada(tarefa);
    }
    if (abrirCadastro || search.tarefa) {
      void navigate({ search: { criar: false, tarefa: undefined }, replace: true });
    }
  }, [lista, navigate, search.criar, search.tarefa, tarefas.isLoading]);

  async function mudarStatus(tarefa: Tarefa, status: StatusTarefa): Promise<boolean> {
    if (tarefa.status === status) return true;
    const { error } = await supabase.rpc("alterar_status_tarefa", {
      _tarefa: tarefa.id,
      _status: status,
    });
    if (error) {
      toast.error(mensagemErro(error));
      return false;
    }
    await qc.invalidateQueries({ queryKey: ["tarefas"] });
    await qc.invalidateQueries({ queryKey: ["historico"] });
    toast.success(
      `Tarefa movida para ${STATUS.find((s) => s.id === status)?.label.toLowerCase()}.`,
    );
    setSelecionada((atual) => (atual?.id === tarefa.id ? { ...atual, status } : atual));
    return true;
  }

  function iniciarArraste(event: DragEvent<HTMLDivElement>, tarefa: Tarefa) {
    setArrastada(tarefa.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", tarefa.id);
  }

  function soltar(event: DragEvent<HTMLElement>, status: StatusTarefa) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || arrastada;
    const tarefa = lista.find((item) => item.id === id);
    if (tarefa) void mudarStatus(tarefa, status);
    setArrastada(null);
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow text-primary-soft">Operação</p>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">Quadro de tarefas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe os atendimentos e mova cada tarefa conforme o andamento.
          </p>
        </div>
        {me.data?.perfil === "ti" && (
          <Button onClick={() => setCriando(true)}>
            <Plus /> Nova tarefa
          </Button>
        )}
      </header>

      <section
        className="surface mt-5 grid gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-4"
        aria-label="Filtros de tarefas"
      >
        <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
          Filtrar por CTO
          <Select value={filtroCto} onValueChange={setFiltroCto}>
            <SelectTrigger className="h-11 bg-background text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="app-theme-portal">
              <SelectItem value="todas">Todas as CTOs</SelectItem>
              {(ctos.data ?? []).map((cto) => (
                <SelectItem key={cto.id} value={cto.id}>
                  {nomeCto(cto)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
          Situação
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="h-11 bg-background text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="app-theme-portal">
              <SelectItem value="todas">Todas as situações</SelectItem>
              {STATUS.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
          Tipo de serviço
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="h-11 bg-background text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="app-theme-portal">
              <SelectItem value="todos">Todos os serviços</SelectItem>
              {TIPOS_SERVICO.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {tipo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
          Buscar tarefa
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Título, problema, técnico..."
            className={campo}
            type="search"
          />
        </label>
      </section>

      {tarefas.isLoading || ctos.isLoading ? (
        <div className="grid min-h-64 place-items-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : tarefas.isError || ctos.isError ? (
        <p role="alert" className="mt-6 rounded-xl border border-danger/40 p-4 text-sm text-danger">
          Não foi possível carregar tarefas ou CTOs. Atualize a página e tente novamente.
        </p>
      ) : (
        <div className="mt-6 grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {STATUS.map((status) => {
            const itens = listaFiltrada.filter((t) => t.status === status.id);
            return (
              <section
                key={status.id}
                className={cn(
                  "min-w-0 rounded-2xl border bg-card/50 p-3 sm:p-4",
                  arrastada && "border-dashed border-primary/60",
                )}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => soltar(event, status.id)}
                aria-label={`${status.label}: ${itens.length} tarefas`}
              >
                <header className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="flex min-w-0 items-center gap-2 font-bold">
                    <span className={cn("size-2.5 shrink-0 rounded-full", status.cor)} />
                    <span className="truncate">{status.label}</span>
                  </h2>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold">
                    {itens.length}
                  </span>
                </header>
                <div className="flex min-h-24 flex-col gap-3">
                  {itens.map((tarefa) => {
                    const indice = STATUS.findIndex((s) => s.id === tarefa.status);
                    const proximo = STATUS[indice + 1];
                    return (
                      <div
                        key={tarefa.id}
                        draggable
                        onDragStart={(event) => iniciarArraste(event, tarefa)}
                        onDragEnd={() => setArrastada(null)}
                        className={cn(arrastada === tarefa.id && "opacity-50")}
                      >
                        <TaskCard
                          t={tarefa}
                          cto={ctoById.get(tarefa.cto_id)}
                          onClick={() => setSelecionada(tarefa)}
                          onDoubleClick={() => {
                            if (tarefa.status === "pendente") {
                              void mudarStatus(tarefa, "andamento");
                            }
                          }}
                        />
                        {proximo && (
                          <button
                            type="button"
                            onClick={() => void mudarStatus(tarefa, proximo.id)}
                            className="mt-1 inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                            aria-label={`Mover ${tarefa.titulo || tarefa.tipo} para ${proximo.label}`}
                          >
                            Mover para {proximo.label} <ArrowRight className="size-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {!itens.length && (
                    <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                      Solte uma tarefa aqui ou nenhuma tarefa nesta etapa.
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {me.data?.perfil === "ti" && (
        <NovaTarefaDialog
          open={criando}
          onOpenChange={setCriando}
          ctos={ctos.data ?? []}
          tecnicos={(usuarios.data ?? []).filter((u) => u.perfil === "tecnico")}
          nomeAtual={me.data?.nome ?? ""}
          onCreated={async () => {
            await qc.invalidateQueries({ queryKey: ["tarefas"] });
            setCriando(false);
          }}
        />
      )}
      {tarefaSelecionada && (
        <DetalheTarefa
          tarefa={tarefaSelecionada}
          cto={ctoById.get(tarefaSelecionada.cto_id) ?? null}
          onClose={() => setSelecionada(null)}
          onStatusChange={(status) => mudarStatus(tarefaSelecionada, status)}
        />
      )}
    </div>
  );
}

function NovaTarefaDialog({
  open,
  onOpenChange,
  ctos,
  tecnicos,
  nomeAtual,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ctos: Cto[];
  tecnicos: { id: string; nome: string; email: string | null; perfil: string }[];
  nomeAtual: string;
  onCreated: () => Promise<void>;
}) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<string>(TIPOS_SERVICO[0]);
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [tecnico, setTecnico] = useState(nomeAtual);
  const [ctoId, setCtoId] = useState("");
  const [cliente, setCliente] = useState("");
  const [data, setData] = useState(isoLocal(new Date()));
  const [horario, setHorario] = useState("09:00");
  const [mapaAberto, setMapaAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const selecionada = ctos.find((c) => c.id === ctoId);

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    if (!titulo.trim() || !ctoId || !tecnico || !data || !horario) {
      setErro("Preencha título, responsável, data, horário e selecione uma CTO.");
      return;
    }
    setSalvando(true);
    const { error } = await supabase.rpc("criar_tarefa", {
      _titulo: titulo.trim(),
      _tipo: tipo,
      _descricao_problema: descricao.trim() || null,
      _prioridade: prioridade,
      _tecnico: tecnico,
      _cto_id: ctoId,
      _cliente: cliente.trim() || "Atendimento CTO",
      _data: data,
      _horario: horario,
    });
    setSalvando(false);
    if (error) {
      setErro(mensagemErro(error));
      return;
    }
    toast.success("Tarefa cadastrada.");
    setTitulo("");
    setDescricao("");
    setCliente("");
    setCtoId("");
    await onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="app-theme-portal max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={salvar}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Título *">
              <input
                className={campo}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
                maxLength={120}
              />
            </Campo>
            <Campo label="Tipo de serviço">
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-11 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="app-theme-portal">
                  {TIPOS_SERVICO.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </div>
          <Campo label="Descrição do problema / diagnóstico">
            <textarea
              className={`${campo} h-24 py-3`}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o defeito observado ou o serviço necessário."
              maxLength={2000}
            />
          </Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Prioridade">
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger className="h-11 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="app-theme-portal">
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Técnico responsável *">
              {tecnicos.length ? (
                <Select value={tecnico} onValueChange={setTecnico}>
                  <SelectTrigger className="h-11 bg-background">
                    <SelectValue placeholder="Selecione o técnico" />
                  </SelectTrigger>
                  <SelectContent className="app-theme-portal">
                    {tecnicos.map((u) => (
                      <SelectItem key={u.id} value={u.nome}>
                        {u.nome}
                      </SelectItem>
                    ))}
                    {tecnico && !tecnicos.some((u) => u.nome === tecnico) && (
                      <SelectItem value={tecnico}>{tecnico}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <input
                  className={campo}
                  value={tecnico}
                  onChange={(e) => setTecnico(e.target.value)}
                  required
                />
              )}
            </Campo>
            <Campo label="Cliente / solicitante">
              <input
                className={campo}
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Opcional"
              />
            </Campo>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Data *">
                <input
                  className={campo}
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  required
                />
              </Campo>
              <Campo label="Horário *">
                <input
                  className={campo}
                  type="time"
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  required
                />
              </Campo>
            </div>
          </div>
          <fieldset className="rounded-2xl border p-3">
            <legend className="px-1 text-sm font-semibold">Localização / CTO *</legend>
            <Select value={ctoId} onValueChange={setCtoId}>
              <SelectTrigger className="h-11 bg-background">
                <SelectValue placeholder="Selecione uma CTO cadastrada" />
              </SelectTrigger>
              <SelectContent className="app-theme-portal">
                {ctos
                  .filter((c) => c.ativa)
                  .map((cto) => (
                    <SelectItem key={cto.id} value={cto.id}>
                      {nomeCto(cto)} · {cto.bairro}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              className="mt-2 w-full"
              onClick={() => setMapaAberto((aberto) => !aberto)}
            >
              <MapPinned />
              {mapaAberto ? "Fechar mapa" : "Selecionar CTO pelo mapa"}
            </Button>
            {mapaAberto && (
              <>
                <p className="mt-2 text-xs text-muted-foreground">
                  Toque no marcador da CTO que será vinculada à tarefa.
                </p>
                <div className="mt-2 h-56 overflow-hidden rounded-xl border">
                  <CtoMap
                    ctos={ctos.filter((c) => c.ativa)}
                    selectedId={ctoId}
                    onSelect={(cto) => setCtoId(cto.id)}
                    focus={
                      selecionada ? { lat: selecionada.lat, lng: selecionada.lng, zoom: 14 } : null
                    }
                  />
                </div>
              </>
            )}
            {selecionada && (
              <div className="mt-3 overflow-hidden rounded-xl border">
                <div className="h-44">
                  <CtoMap
                    ctos={ctos.filter((c) => c.ativa)}
                    selectedId={selecionada.id}
                    focus={{ lat: selecionada.lat, lng: selecionada.lng, zoom: 16 }}
                    interactive={false}
                  />
                </div>
                <p className="p-2 text-xs text-muted-foreground">
                  {selecionada.endereco || selecionada.bairro} · {selecionada.lat.toFixed(5)},{" "}
                  {selecionada.lng.toFixed(5)}
                </p>
              </div>
            )}
            {!ctos.some((c) => c.ativa) && (
              <p className="mt-2 text-sm text-muted-foreground">
                Não há CTOs ativas cadastradas para vincular.
              </p>
            )}
          </fieldset>
          {erro && (
            <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">
              {erro}
            </p>
          )}
          <Button type="submit" disabled={salvando || !ctos.some((c) => c.ativa)}>
            {salvando && <Loader2 className="animate-spin" />} Cadastrar tarefa
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DetalheTarefa({
  tarefa,
  cto,
  onClose,
  onStatusChange,
}: {
  tarefa: Tarefa;
  cto: Cto | null;
  onClose: () => void;
  onStatusChange: (status: StatusTarefa) => Promise<boolean>;
}) {
  const historico = useQuery(historicoTarefaQuery(tarefa.id));
  const historicoCto = useQuery(historicoCtoQuery(cto?.id ?? ""));
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [erroFotos, setErroFotos] = useState("");
  const registros = useMemo(() => {
    const unicos = new Map(
      [...(historico.data ?? []), ...(historicoCto.data ?? [])].map((item) => [item.id, item]),
    );
    return [...unicos.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [historico.data, historicoCto.data]);
  useEffect(() => {
    let cancelado = false;
    async function carregarFotos() {
      const caminhos = [
        ...new Set(
          [...(historico.data ?? []), ...(historicoCto.data ?? [])]
            .flatMap((item) => [...(item.descricao ?? "").matchAll(/\[FOTO:([^\]]+)\]/g)])
            .map((match) => match[1])
            .filter((path): path is string => Boolean(path)),
        ),
      ];
      if (!caminhos.length) return;
      const resultados = await Promise.all(
        caminhos.map(async (path) => {
          const { data, error } = await supabase.storage
            .from("task-photos")
            .createSignedUrl(path, 3600);
          if (error) throw error;
          return [path, data.signedUrl] as const;
        }),
      );
      if (cancelado) return;
      setErroFotos("");
      setFotos((atuais) => ({ ...atuais, ...Object.fromEntries(resultados) }));
    }
    carregarFotos().catch((error: unknown) => {
      if (cancelado) return;
      setErroFotos(mensagemErro(error));
    });
    return () => {
      cancelado = true;
    };
  }, [historico.data, historicoCto.data]);
  const livre = cto ? portasLivres(cto) : null;
  const progresso =
    cto?.portas_total && cto.portas_ocupadas != null
      ? Math.min(100, (cto.portas_ocupadas / cto.portas_total) * 100)
      : null;

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="app-theme-portal max-h-[92dvh] overflow-y-auto text-foreground sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tarefa.titulo || tarefa.tipo}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-secondary px-3 py-1 font-semibold">
            {STATUS.find((s) => s.id === tarefa.status)?.label ?? tarefa.status}
          </span>
          <span className="rounded-full bg-primary/15 px-3 py-1 font-semibold text-primary">
            Prioridade {tarefa.prioridade}
          </span>
          {tarefa.problema && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-3 py-1 font-semibold text-danger">
              <AlertTriangle className="size-4" /> Problema reportado
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Info titulo="Tipo de serviço" valor={tarefa.tipo} />
          <Info titulo="Técnico responsável" valor={tarefa.tecnico} />
          <Info titulo="Cliente / solicitante" valor={tarefa.cliente} />
          <Info titulo="Serviço / atendimento" valor={tarefa.servico_id} />
          <Info titulo="Agendamento" valor={`${tarefa.data} · ${tarefa.horario.slice(0, 5)}`} />
          <Info titulo="Endereço" valor={tarefa.endereco || cto?.endereco || cto?.bairro || "—"} />
        </div>
        <section className="rounded-xl border p-3">
          <h3 className="text-sm font-bold">Problema / diagnóstico</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            {tarefa.descricao_problema ||
              (tarefa.problema
                ? "Problema reportado sem descrição."
                : "Sem diagnóstico registrado.")}
          </p>
        </section>
        {cto ? (
          <div className="space-y-3">
            <section className="rounded-xl border p-3">
              <h3 className="font-bold">{nomeCto(cto)}</h3>
              <p className="text-sm font-medium text-primary-soft">{cto.endereco || cto.bairro}</p>
              <p className="mt-1 text-xs text-foreground/80">
                {cto.lat.toFixed(6)}, {cto.lng.toFixed(6)} · {cto.ativa ? "Ativa" : "Desativada"}
              </p>
              <p className="mt-2 text-sm">
                Portas: {resumoPortas(cto)}
                {livre != null && cto.portas_ocupadas != null && (
                  <span> · {cto.portas_ocupadas} ocupadas</span>
                )}
              </p>
              {livre == null && (
                <p className="mt-2 rounded-lg bg-primary/10 p-2 text-xs font-semibold text-primary">
                  Disponibilidade de portas ainda não confirmada.
                </p>
              )}
              {progresso != null && (
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"
                  role="progressbar"
                  aria-label="Portas ocupadas"
                  aria-valuenow={progresso}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="h-full bg-primary" style={{ width: `${progresso}%` }} />
                </div>
              )}
              {cto.observacoes && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                  {cto.observacoes}
                </p>
              )}
              <div className="mt-3 h-44 overflow-hidden rounded-xl border">
                <CtoMap
                  ctos={[cto]}
                  selectedId={cto.id}
                  focus={{ lat: cto.lat, lng: cto.lng, zoom: 16 }}
                  interactive={false}
                />
              </div>
              <Button
                className="mt-4 w-full"
                onClick={(event) => {
                  event.preventDefault();
                  const destino = linkRota(cto);
                  const janela = window.open("about:blank", "_blank");
                  if (!janela) {
                    toast.error("Permita pop-ups para abrir as direções.");
                    return;
                  }
                  void (async () => {
                    if (tarefa.status === "pendente") {
                      const atualizado = await onStatusChange("andamento");
                      if (!atualizado) {
                        janela.close();
                        return;
                      }
                    }
                    janela.location.href = destino;
                  })();
                }}
              >
                <Navigation /> Ir para a localização / Iniciar atendimento
              </Button>
              <Button asChild variant="outline" className="mt-2 w-full">
                <a
                  href={linkWhatsApp(
                    textoWhatsApp({
                      tarefa,
                      cto,
                      acao: tarefa.descricao_problema || tarefa.tipo,
                      portas: cto.portas_ocupadas ?? 0,
                      tecnico: tarefa.tecnico,
                    }),
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  Compartilhar tarefa pelo WhatsApp
                </a>
              </Button>
            </section>
            <RegistrarServicoTarefa tarefa={tarefa} cto={cto} />
          </div>
        ) : (
          <p role="alert" className="text-sm text-danger">
            A CTO vinculada não foi encontrada.
          </p>
        )}
        <section>
          <h3 className="font-bold">Histórico da tarefa</h3>
          {historico.isLoading ? (
            <Loader2 className="mt-2 size-5 animate-spin text-muted-foreground" />
          ) : historico.isError || historicoCto.isError ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              Não foi possível carregar o histórico desta tarefa.
            </p>
          ) : registros.length ? (
            <ul className="mt-2 space-y-2">
              {registros.map((item) => (
                <li key={item.id} className="rounded-xl bg-secondary/60 p-3 text-sm">
                  <p className="font-semibold">{item.acao}</p>
                  <p className="text-xs text-foreground/80">
                    {item.tecnico} · {dataHora(item.created_at)}
                  </p>
                  {item.descricao && (
                    <p className="mt-1 whitespace-pre-wrap text-foreground">
                      {item.descricao.replace(/\n?\[FOTO:[^\]]+\]/g, "")}
                    </p>
                  )}
                  {[...(item.descricao ?? "").matchAll(/\[FOTO:([^\]]+)\]/g)].map((match) => {
                    const path = match[1];
                    return path && fotos[path] ? (
                      <a
                        key={path}
                        href={fotos[path]}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block"
                      >
                        <img
                          src={fotos[path]}
                          alt="Foto do atendimento"
                          className="max-h-56 rounded-lg border object-contain"
                        />
                      </a>
                    ) : null;
                  })}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-foreground">Nenhum registro de atendimento.</p>
          )}
          {erroFotos && (
            <p role="alert" className="mt-2 text-xs text-danger">
              Não foi possível carregar uma foto anexada: {erroFotos}
            </p>
          )}
        </section>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Select value={tarefa.status} onValueChange={(s) => onStatusChange(s as StatusTarefa)}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="app-theme-portal">
              {STATUS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {cto && (
            <Button asChild variant="outline">
              <Link to="/ctos/$id" params={{ id: cto.id }}>
                <MapPin /> Abrir detalhes da CTO
              </Link>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RegistrarServicoTarefa({ tarefa, cto }: { tarefa: Tarefa; cto: Cto }) {
  const qc = useQueryClient();
  const [descricao, setDescricao] = useState("");
  const [ocupadas, setOcupadas] = useState(
    cto.portas_ocupadas == null ? "" : String(cto.portas_ocupadas),
  );
  const [foto, setFoto] = useState<File | null>(null);
  const [status, setStatus] = useState<StatusTarefa>(
    tarefa.status === "concluida" ? "concluida" : "andamento",
  );
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    if (!descricao.trim()) {
      setErro("Descreva o serviço realizado.");
      return;
    }
    const portasObs = ocupadas.trim() ? Number(ocupadas) : null;
    if (
      portasObs != null &&
      (!Number.isInteger(portasObs) ||
        portasObs < 0 ||
        (cto.portas_total != null && portasObs > cto.portas_total))
    ) {
      setErro("Informe uma quantidade de portas ocupadas válida para esta CTO.");
      return;
    }

    setSalvando(true);
    let caminhoFoto: string | null = null;
    if (foto) {
      const extensao =
        foto.type === "image/png" ? "png" : foto.type === "image/webp" ? "webp" : "jpg";
      caminhoFoto = `${tarefa.id}/${crypto.randomUUID()}.${extensao}`;
      const { error: erroUpload } = await supabase.storage
        .from("task-photos")
        .upload(caminhoFoto, foto, { contentType: foto.type, upsert: false });
      if (erroUpload) {
        setSalvando(false);
        setErro(mensagemErro(erroUpload));
        return;
      }
    }

    const descricaoComFoto = caminhoFoto
      ? `${descricao.trim()}\n\n[FOTO:${caminhoFoto}]`
      : descricao.trim();
    const { error } = await supabase.rpc("registrar_servico_cto", {
      _cto: cto.id,
      _descricao: descricaoComFoto,
      _portas_ocupadas_obs: portasObs,
      _portas_utilizadas: null,
      _servico: tarefa.tipo,
    });
    if (error) {
      if (caminhoFoto) {
        const { error: erroRemocao } = await supabase.storage
          .from("task-photos")
          .remove([caminhoFoto]);
        if (erroRemocao) {
          setErro(
            `${mensagemErro(error)} A foto enviada também não pôde ser removida: ${mensagemErro(erroRemocao)}`,
          );
          setSalvando(false);
          return;
        }
      }
      setSalvando(false);
      setErro(mensagemErro(error));
      return;
    }

    if (status !== tarefa.status) {
      const resultado = await supabase.rpc("alterar_status_tarefa", {
        _tarefa: tarefa.id,
        _status: status,
      });
      if (resultado.error) {
        setSalvando(false);
        setErro(
          `O serviço foi registrado, mas não foi possível alterar o status: ${mensagemErro(resultado.error)}`,
        );
        await qc.invalidateQueries({ queryKey: ["historico"] });
        await qc.invalidateQueries({ queryKey: ["ctos"] });
        return;
      }
    }

    await Promise.all([
      qc.invalidateQueries({ queryKey: ["historico"] }),
      qc.invalidateQueries({ queryKey: ["ctos"] }),
      qc.invalidateQueries({ queryKey: ["tarefas"] }),
    ]);
    setSalvando(false);
    setDescricao("");
    setFoto(null);
    toast.success("Serviço registrado no histórico da CTO.");
  }

  return (
    <form onSubmit={salvar} className="rounded-xl border p-3">
      <h3 className="font-bold">Registrar serviço realizado</h3>
      <label className="mt-3 flex flex-col gap-1.5 text-sm font-semibold">
        Observações do atendimento *
        <textarea
          className={`${campo} h-24 py-3`}
          value={descricao}
          onChange={(event) => setDescricao(event.target.value)}
          required
          maxLength={3000}
          placeholder="Descreva o diagnóstico, serviço e observações."
        />
      </label>
      <label className="mt-3 flex flex-col gap-1.5 text-sm font-semibold">
        Foto do atendimento (opcional, até 5 MB)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1"
          onChange={(event) => {
            const arquivo = event.target.files?.[0] ?? null;
            if (arquivo && !["image/jpeg", "image/png", "image/webp"].includes(arquivo.type)) {
              setErro("Envie uma imagem JPG, PNG ou WEBP.");
              event.target.value = "";
              setFoto(null);
              return;
            }
            if (arquivo && arquivo.size > 5 * 1024 * 1024) {
              setErro("A imagem deve ter no máximo 5 MB.");
              event.target.value = "";
              setFoto(null);
              return;
            }
            setErro("");
            setFoto(arquivo);
          }}
        />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Portas ocupadas após o serviço
          <input
            className={campo}
            type="number"
            min="0"
            max={cto.portas_total ?? undefined}
            value={ocupadas}
            onChange={(event) => setOcupadas(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Situação da tarefa
          <Select value={status} onValueChange={(value) => setStatus(value as StatusTarefa)}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="app-theme-portal">
              {STATUS.filter((item) => item.id !== "pendente").map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
      {erro && (
        <p role="alert" className="mt-3 rounded-xl bg-danger/10 p-3 text-sm text-danger">
          {erro}
        </p>
      )}
      <Button type="submit" className="mt-3 w-full" disabled={salvando}>
        {salvando && <Loader2 className="animate-spin" />}
        Salvar atendimento
      </Button>
    </form>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold">
      {label}
      {children}
    </label>
  );
}

function Info({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-secondary/60 p-3">
      <p className="text-xs font-semibold text-foreground">{titulo}</p>
      <p className="mt-1 break-words text-sm font-semibold text-primary-soft">{valor || "—"}</p>
    </div>
  );
}

const campo =
  "h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary";
