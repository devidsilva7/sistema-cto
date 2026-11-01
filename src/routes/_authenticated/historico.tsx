import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { RegistroItem } from "@/components/RegistroItem";
import { ctosQuery, historicoQuery, normalizar } from "@/lib/fgtech";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({ meta: [{ title: "Histórico · FGTECH CTO Maps" }] }),
  component: HistoricoPage,
});

const FILTROS = [
  { id: "todos", label: "Todos" },
  { id: "servico", label: "Serviços" },
  { id: "problema", label: "Problemas" },
  { id: "ti", label: "Alterações da TI" },
] as const;

function HistoricoPage() {
  const hist = useQuery(historicoQuery);
  const ctos = useQuery(ctosQuery);
  const [termo, setTermo] = useState("");
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("todos");
  const ctoById = useMemo(() => new Map((ctos.data ?? []).map((c) => [c.id, c])), [ctos.data]);

  const lista = useMemo(() => {
    const q = normalizar(termo);
    return (hist.data ?? []).filter((h) => {
      if (filtro === "servico" && h.categoria !== "servico") return false;
      if (filtro === "problema" && h.categoria !== "problema") return false;
      if (filtro === "ti" && !["cadastro", "alteracao", "status"].includes(h.categoria))
        return false;
      if (!q) return true;
      return normalizar(
        [h.cto_codigo, h.tecnico, h.acao, h.descricao, h.servico_id].filter(Boolean).join(" "),
      ).includes(q);
    });
  }, [hist.data, termo, filtro]);

  return (
    <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
      <h1 className="text-2xl font-extrabold">Histórico</h1>
      <p className="text-sm text-muted-foreground">
        Serviços registrados pelos técnicos e alterações feitas pela TI.
      </p>

      <div className="relative mt-4">
        <Search
          className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar por CTO, técnico ou descrição"
          aria-label="Buscar no histórico"
          className="h-12 w-full rounded-xl border border-input bg-card pl-11 pr-4 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary"
        />
      </div>
      <div
        className="mt-3 flex gap-2 overflow-x-auto pb-1"
        role="group"
        aria-label="Filtrar registros"
      >
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            aria-pressed={filtro === f.id}
            className={cn(
              "h-10 shrink-0 rounded-full border px-4 text-sm font-semibold",
              filtro === f.id
                ? "border-primary bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-secondary",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {hist.isLoading ? (
        <Loader2 className="mt-6 size-6 animate-spin text-muted-foreground" />
      ) : (
        <>
          <p className="mt-4 text-xs text-muted-foreground">
            {lista.length} registro(s)
            {hist.data?.length === 500 && " · mostrando os 500 mais recentes"}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {lista.map((h) => (
              <RegistroItem
                key={h.id}
                r={h}
                cto={h.cto_id ? ctoById.get(h.cto_id) : undefined}
                mostrarCto
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
