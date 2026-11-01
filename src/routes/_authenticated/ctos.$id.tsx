import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Loader2,
  MapPin,
  Navigation,
  Pencil,
  RotateCcw,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CtoMap } from "@/components/CtoMap";
import { CtoForm } from "@/components/CtoForm";
import { PortasBadge, PortasPainel } from "@/components/CtoPortas";
import { RegistroItem } from "@/components/RegistroItem";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ctosQuery,
  historicoCtoQuery,
  linkRota,
  linkWhatsApp,
  meQuery,
  mensagemErro,
  SERVICOS_CTO,
  textoCtoWhatsApp,
  textoRegistroWhatsApp,
  type Cto,
  type Historico,
} from "@/lib/fgtech";

export const Route = createFileRoute("/_authenticated/ctos/$id")({
  head: () => ({ meta: [{ title: "CTO · FGTECH CTO Maps" }] }),
  component: CtoPage,
});

function CtoPage() {
  const { id } = Route.useParams();
  const me = useQuery(meQuery);
  const ctos = useQuery(ctosQuery);
  const hist = useQuery(historicoCtoQuery(id));
  const qc = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [confirmarStatus, setConfirmarStatus] = useState(false);
  const cto = ctos.data?.find((c) => c.id === id);
  const ti = me.data?.perfil === "ti";
  const foco = useMemo(() => (cto ? { lat: cto.lat, lng: cto.lng, zoom: 17 } : null), [cto]);

  if (ctos.isLoading) {
    return (
      <div className="grid flex-1 place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!cto) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="font-bold">CTO não encontrada.</p>
        <Button asChild className="mt-4">
          <Link to="/mapa">Voltar ao mapa</Link>
        </Button>
      </div>
    );
  }

  const ultimoRelato = hist.data?.find((h) => h.portas_ocupadas_obs != null) ?? null;

  async function aplicarRelato(r: Historico) {
    const { error } = await supabase
      .from("ctos")
      .update({ portas_ocupadas: r.portas_ocupadas_obs })
      .eq("id", id);
    if (error) {
      toast.error(mensagemErro(error));
      return;
    }
    toast.success("Contagem de portas atualizada.");
    qc.invalidateQueries({ queryKey: ["ctos"] });
    qc.invalidateQueries({ queryKey: ["historico"] });
  }

  async function alternarStatus() {
    const { data, error } = await supabase.rpc("alternar_cto", { _cto: id });
    setConfirmarStatus(false);
    if (error) {
      toast.error(mensagemErro(error));
      return;
    }
    toast.success(data ? "CTO reativada." : "CTO desativada. O histórico foi mantido.");
    qc.invalidateQueries({ queryKey: ["ctos"] });
    qc.invalidateQueries({ queryKey: ["historico"] });
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-8">
      <Link
        to="/mapa"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Mapa
      </Link>

      <header className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold md:text-3xl">{cto.codigo}</h1>
          <p className="text-muted-foreground">
            {[cto.nome, cto.bairro].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <PortasBadge cto={cto} />
            {cto.ativa ? (
              <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-bold text-success">
                Ativa
              </span>
            ) : (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold">
                Desativada
              </span>
            )}
          </div>
        </div>
        {ti && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditando(true)}>
              <Pencil /> Editar
            </Button>
            <Button
              variant={cto.ativa ? "warn" : "success"}
              onClick={() => setConfirmarStatus(true)}
            >
              {cto.ativa ? <Ban /> : <RotateCcw />} {cto.ativa ? "Desativar" : "Reativar"}
            </Button>
          </div>
        )}
      </header>

      {!cto.ativa && (
        <p role="status" className="mt-4 rounded-xl border bg-secondary p-3 text-sm">
          Esta CTO está desativada e não aparece para os técnicos. O histórico continua disponível.
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <section className="surface overflow-hidden">
            <div className="h-48">
              <CtoMap ctos={[cto]} selectedId={cto.id} focus={foco} interactive={false} />
            </div>
            <div className="p-4">
              {cto.endereco && (
                <p className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />{" "}
                  {cto.endereco}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {cto.lat.toFixed(6)}, {cto.lng.toFixed(6)}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button asChild>
                  <a href={linkRota(cto)} target="_blank" rel="noreferrer">
                    <Navigation /> Navegar
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={linkWhatsApp(textoCtoWhatsApp(cto))} target="_blank" rel="noreferrer">
                    <Share2 /> Compartilhar
                  </a>
                </Button>
              </div>
              {cto.observacoes && (
                <p className="mt-3 whitespace-pre-line rounded-xl bg-secondary p-3 text-sm">
                  {cto.observacoes}
                </p>
              )}
            </div>
          </section>

          <PortasPainel cto={cto} ultimoRelato={ultimoRelato} />
          {ti &&
            ultimoRelato?.portas_ocupadas_obs != null &&
            ultimoRelato.portas_ocupadas_obs !== cto.portas_ocupadas &&
            cto.portas_total != null &&
            ultimoRelato.portas_ocupadas_obs <= cto.portas_total && (
              <Button variant="outline" onClick={() => aplicarRelato(ultimoRelato)}>
                <CheckCircle2 /> Aplicar contagem do técnico ({ultimoRelato.portas_ocupadas_obs}{" "}
                ocupadas)
              </Button>
            )}
        </div>

        <div className="flex flex-col gap-4">
          {cto.ativa && <RegistrarServico cto={cto} tecnico={me.data?.nome ?? ""} />}

          <section aria-labelledby="hist-titulo">
            <h2 id="hist-titulo" className="mb-2 font-bold">
              Histórico da CTO
            </h2>
            {hist.isLoading ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : !hist.data?.length ? (
              <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {hist.data.map((h) => (
                  <RegistroItem key={h.id} r={h} cto={cto} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <Dialog open={editando} onOpenChange={setEditando}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar {cto.codigo}</DialogTitle>
          </DialogHeader>
          <CtoForm cto={cto} todas={ctos.data ?? []} onSaved={() => setEditando(false)} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarStatus} onOpenChange={setConfirmarStatus}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {cto.ativa ? `Desativar ${cto.codigo}?` : `Reativar ${cto.codigo}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cto.ativa
                ? "A CTO deixará de aparecer para os técnicos. Todo o histórico de serviços será mantido."
                : "A CTO voltará a aparecer no mapa dos técnicos."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={alternarStatus}>
              {cto.ativa ? "Desativar" : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const campo =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary";

function RegistrarServico({ cto, tecnico }: { cto: Cto; tecnico: string }) {
  const qc = useQueryClient();
  const [servico, setServico] = useState<string>(SERVICOS_CTO[0]);
  const [descricao, setDescricao] = useState("");
  const [portas, setPortas] = useState("");
  const [ocupadas, setOcupadas] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState<Historico | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    if (!descricao.trim()) return setErro("Descreva o que foi feito.");
    const obs = ocupadas.trim() === "" ? null : Number(ocupadas);
    if (
      obs != null &&
      (!Number.isInteger(obs) || obs < 0 || (cto.portas_total != null && obs > cto.portas_total))
    ) {
      return setErro(
        `Portas ocupadas deve ser um número entre 0 e ${cto.portas_total ?? "o total da CTO"}.`,
      );
    }
    setSalvando(true);
    const { data: novoId, error } = await supabase.rpc("registrar_servico_cto", {
      _cto: cto.id,
      _servico: servico,
      _descricao: descricao,
      _portas_utilizadas: portas || null,
      _portas_ocupadas_obs: obs,
    });
    if (error) {
      setSalvando(false);
      return setErro(mensagemErro(error));
    }
    const { data: reg } = await supabase.from("historico").select("*").eq("id", novoId).single();
    setSalvando(false);
    setSalvo(reg);
    setDescricao("");
    setPortas("");
    setOcupadas("");
    toast.success("Serviço registrado no histórico da CTO.");
    qc.invalidateQueries({ queryKey: ["historico"] });
  }

  if (salvo) {
    return (
      <section className="surface border-success/40 p-4" aria-live="polite">
        <p className="flex items-center gap-2 font-bold text-success">
          <CheckCircle2 className="size-5" /> Serviço registrado
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {salvo.acao} · {salvo.tecnico}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button asChild variant="success">
            <a
              href={linkWhatsApp(textoRegistroWhatsApp(salvo, cto))}
              target="_blank"
              rel="noreferrer"
            >
              <Share2 /> Compartilhar no WhatsApp
            </a>
          </Button>
          <Button variant="outline" onClick={() => setSalvo(null)}>
            Novo registro
          </Button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={salvar} className="surface flex flex-col gap-3 p-4" noValidate>
      <h2 className="font-bold">Registrar serviço</h2>
      <div>
        <label htmlFor="servico" className="mb-1.5 block text-sm font-semibold">
          Serviço realizado
        </label>
        <select
          id="servico"
          className={campo}
          value={servico}
          onChange={(e) => setServico(e.target.value)}
        >
          {SERVICOS_CTO.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="descricao" className="mb-1.5 block text-sm font-semibold">
          O que foi feito *
        </label>
        <Textarea
          id="descricao"
          rows={3}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: Ativado cliente João Silva, fusão refeita, sinal -19 dBm."
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="portas" className="mb-1.5 block text-sm font-semibold">
            Portas usadas/alteradas
          </label>
          <input
            id="portas"
            className={campo}
            value={portas}
            onChange={(e) => setPortas(e.target.value)}
            placeholder="Ex.: 5, 7"
          />
        </div>
        <div>
          <label htmlFor="ocupadas" className="mb-1.5 block text-sm font-semibold">
            Ocupadas no local
          </label>
          <input
            id="ocupadas"
            type="number"
            inputMode="numeric"
            min={0}
            max={cto.portas_total ?? undefined}
            className={campo}
            value={ocupadas}
            onChange={(e) => setOcupadas(e.target.value)}
            placeholder={cto.portas_total != null ? `de ${cto.portas_total}` : "Opcional"}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Será registrado como <strong className="text-foreground">{tecnico || "você"}</strong>, com
        data e hora atuais. A contagem informada fica no histórico para a TI confirmar.
      </p>
      {erro && (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger"
        >
          {erro}
        </p>
      )}
      <Button type="submit" size="lg" disabled={salvando}>
        {salvando && <Loader2 className="animate-spin" />} Salvar registro
      </Button>
    </form>
  );
}
