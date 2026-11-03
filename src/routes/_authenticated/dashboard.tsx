import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  MapPinned,
  Play,
  Plus,
  RadioTower,
} from "lucide-react";
import { toast } from "sonner";
import { TaskCard } from "@/components/TaskCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  capacidade,
  ctosQuery,
  dataExtenso,
  meQuery,
  mensagemErro,
  saudacao,
  tarefasQuery,
  TIPOS_SERVICO,
  urgencia,
  type Tarefa,
} from "@/lib/fgtech";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · FGTECH CTO Maps" }] }),
  component: Dashboard,
});

const COLUNAS = [
  { id: "pendente", titulo: "Pendentes", bolinha: "bg-primary" },
  { id: "andamento", titulo: "Em desenvolvimento", bolinha: "bg-info" },
  { id: "concluida", titulo: "Concluídas", bolinha: "bg-success" },
] as const;
type StatusFiltro = "todas" | (typeof COLUNAS)[number]["id"];

function Dashboard() {
  const me = useQuery(meQuery);
  const tarefas = useQuery(tarefasQuery);
  const ctos = useQuery(ctosQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ctoFiltro, setCtoFiltro] = useState("todas");
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("todas");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [emAtendimento, setEmAtendimento] = useState<Set<string>>(() => new Set());

  const listaTarefas = tarefas.data ?? [];
  const listaCtos = ctos.data ?? [];
  const atrasadas = listaTarefas.filter(
    (t) => t.status !== "concluida" && urgencia(t) === "atrasada",
  );
  const criticas = listaTarefas.filter(
    (t) =>
      t.status !== "concluida" &&
      (t.prioridade === "critica" || (t.problema && urgencia(t) !== "concluida")),
  );
  const alertaIds = new Set([...atrasadas, ...criticas].map((t) => t.id));
  const indicadores = [
    {
      label: "CTOs ativas",
      valor: listaCtos.filter((c) => c.ativa).length,
      icon: RadioTower,
      cor: "text-success",
    },
    {
      label: "CTOs cadastradas",
      valor: listaCtos.length,
      icon: MapPinned,
      cor: "text-info",
    },
    {
      label: "Atrasadas / críticas",
      valor: alertaIds.size,
      icon: AlertTriangle,
      cor: "text-danger",
    },
    {
      label: "Tarefas concluídas",
      valor: listaTarefas.filter((t) => t.status === "concluida").length,
      icon: CheckCircle2,
      cor: "text-success",
    },
  ];
  const ctosCriticas = listaCtos.filter(
    (c) => c.ativa && (capacidade(c) === "lotada" || capacidade(c) === "baixa"),
  );
  const inicializando = tarefas.isLoading || ctos.isLoading || me.isLoading;
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const tarefasFiltradas = listaTarefas.filter((t) => {
    const cto = listaCtos.find((c) => c.id === t.cto_id);
    if (ctoFiltro !== "todas" && t.cto_id !== ctoFiltro) return false;
    if (statusFiltro !== "todas" && t.status !== statusFiltro) return false;
    if (tipoFiltro !== "todos" && t.tipo !== tipoFiltro) return false;
    if (!termo) return true;
    return [
      t.titulo,
      t.tipo,
      t.descricao_problema,
      t.cliente,
      t.endereco,
      t.servico_id,
      t.tecnico,
      cto?.codigo,
      cto?.nome,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(termo);
  });

  function abrirDetalhes(tarefa: Tarefa) {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      void navigate({
        to: "/tarefas",
        search: { criar: false, tarefa: tarefa.id },
      });
    }, 220);
  }

  async function iniciarAtendimento(tarefa: Tarefa) {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    if (tarefa.status !== "pendente") return;
    if (emAtendimento.has(tarefa.id)) return;
    setEmAtendimento((atual) => new Set(atual).add(tarefa.id));
    try {
      const { error } = await supabase.rpc("alterar_status_tarefa", {
        _tarefa: tarefa.id,
        _status: "andamento",
      });
      if (error) {
        toast.error(mensagemErro(error));
        return;
      }
      await qc.invalidateQueries({ queryKey: ["tarefas"] });
      await qc.invalidateQueries({ queryKey: ["historico"] });
      toast.success("Tarefa movida para Em desenvolvimento.");
    } finally {
      setEmAtendimento((atual) => {
        const proximo = new Set(atual);
        proximo.delete(tarefa.id);
        return proximo;
      });
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow text-primary-soft">Visão geral</p>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">
            {saudacao()}, {me.data?.nome ?? "Administrador"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{dataExtenso()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-xs font-bold",
              alertaIds.size ? "bg-danger/15 text-danger" : "bg-success/15 text-success",
            )}
          >
            {inicializando ? null : alertaIds.size ? (
              <AlertTriangle className="size-4" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            HOJE ·{" "}
            {inicializando
              ? "Carregando"
              : alertaIds.size
                ? `${atrasadas.length} atrasada(s) · ${criticas.length} crítica(s)`
                : "Tudo em dia"}
          </span>
          {me.data?.perfil === "ti" && (
            <Button asChild>
              <Link to="/tarefas" search={{ criar: true, tarefa: undefined }}>
                <Plus /> Nova tarefa
              </Link>
            </Button>
          )}
          {me.data?.perfil === "ti" && (
            <Button asChild variant="outline">
              <Link to="/gestao" search={{ nova: true }}>
                <Plus /> Cadastrar CTO
              </Link>
            </Button>
          )}
        </div>
      </header>

      <section
        className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Indicadores do sistema"
      >
        {indicadores.map((item) => (
          <article key={item.label} className="surface min-w-0 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-muted-foreground">{item.label}</p>
              <item.icon className={cn("size-5 shrink-0", item.cor)} aria-hidden />
            </div>
            <p className="mt-3 text-3xl font-extrabold">{inicializando ? "—" : item.valor}</p>
          </article>
        ))}
      </section>

      <section className="mt-7" aria-labelledby="tarefas-heading">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 id="tarefas-heading" className="text-xl font-extrabold">
              Tarefas da equipe
            </h2>
            <p className="text-sm text-muted-foreground">
              {tarefasFiltradas.length} tarefa(s) correspondem aos filtros.
            </p>
          </div>
          <Link
            to="/tarefas"
            search={{ criar: false, tarefa: undefined }}
            className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-primary hover:underline"
          >
            Abrir quadro completo <ArrowUpRight className="size-4" />
          </Link>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.5fr]">
          <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted-foreground">
            Filtrar por CTO
            <Select value={ctoFiltro} onValueChange={setCtoFiltro}>
              <SelectTrigger className="h-11 bg-card text-sm text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="app-theme-portal">
                <SelectItem value="todas">Todas as CTOs</SelectItem>
                {listaCtos.map((cto) => (
                  <SelectItem key={cto.id} value={cto.id}>
                    {cto.codigo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted-foreground">
            Situação / status
            <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as StatusFiltro)}>
              <SelectTrigger className="h-11 bg-card text-sm text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="app-theme-portal">
                <SelectItem value="todas">Todas as situações</SelectItem>
                {COLUNAS.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted-foreground">
            Tipo de serviço
            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger className="h-11 bg-card text-sm text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="app-theme-portal">
                <SelectItem value="todos">Todos os serviços</SelectItem>
                {TIPOS_SERVICO.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {tipo}
                  </SelectItem>
                ))}
                {[...new Set(listaTarefas.map((t) => t.tipo))]
                  .filter((tipo) => !TIPOS_SERVICO.includes(tipo as (typeof TIPOS_SERVICO)[number]))
                  .map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted-foreground">
            Buscar por palavra-chave
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Título, problema, cliente, técnico..."
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary"
            />
          </label>
        </div>

        {tarefas.isError || ctos.isError ? (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-danger/40 p-4 text-sm text-danger"
          >
            Não foi possível carregar as tarefas ou CTOs. Tente atualizar a página.
          </p>
        ) : inicializando ? (
          <p className="mt-5 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Carregando tarefas e CTOs...
          </p>
        ) : (
          <div className="mt-5 grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {COLUNAS.map((coluna) => {
              const lista = tarefasFiltradas.filter((tarefa) => tarefa.status === coluna.id);
              return (
                <section
                  key={coluna.id}
                  className="min-w-0 rounded-2xl border bg-card/40 p-3 sm:p-4"
                >
                  <header className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="flex min-w-0 items-center gap-2 font-bold">
                      <span className={cn("size-2.5 shrink-0 rounded-full", coluna.bolinha)} />
                      <span className="truncate">{coluna.titulo}</span>
                    </h3>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold">
                      {lista.length}
                    </span>
                  </header>
                  <div className="flex flex-col gap-3">
                    {lista.map((tarefa) => (
                      <div key={tarefa.id}>
                        <TaskCard
                          t={tarefa}
                          cto={listaCtos.find((cto) => cto.id === tarefa.cto_id)}
                          compact
                          onClick={() => abrirDetalhes(tarefa)}
                          onDoubleClick={() => void iniciarAtendimento(tarefa)}
                        />
                        {tarefa.status === "pendente" && (
                          <button
                            type="button"
                            onClick={() => void iniciarAtendimento(tarefa)}
                            className="mt-1 inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary/10"
                            aria-label={`Iniciar atendimento: ${tarefa.titulo || tarefa.tipo}`}
                          >
                            <Play className="size-3.5" /> Iniciar atendimento
                          </button>
                        )}
                      </div>
                    ))}
                    {!lista.length && (
                      <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                        Nenhuma tarefa nesta etapa.
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="surface p-4 sm:p-5">
          <h2 className="font-bold">Alertas de atendimento</h2>
          <p className="text-sm text-muted-foreground">
            {atrasadas.length} atrasada(s) · {criticas.length} crítica(s) ou com problema
          </p>
          <Button asChild variant="outline" className="mt-3 w-full">
            <Link to="/tarefas" search={{ criar: false, tarefa: undefined }}>
              Ver quadro de tarefas <ArrowUpRight />
            </Link>
          </Button>
        </article>
        <article className="surface p-4 sm:p-5">
          <h2 className="font-bold">CTOs que precisam de atenção</h2>
          <p className="text-sm text-muted-foreground">
            {ctosCriticas.length} ativas com poucas portas ou lotadas
          </p>
          <Button asChild variant="outline" className="mt-3 w-full">
            <Link to="/mapa" search={{ criticas: true }}>
              Ver CTOs críticas no mapa <ArrowUpRight />
            </Link>
          </Button>
        </article>
      </section>
    </div>
  );
}
