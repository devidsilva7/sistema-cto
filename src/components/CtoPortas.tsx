import { AlertTriangle, CircleHelp } from "lucide-react";
import {
  capacidade,
  dataHora,
  DIAS_PORTAS_VALIDAS,
  portasDesatualizadas,
  portasLivres,
  type Cto,
  type Historico,
} from "@/lib/fgtech";
import { cn } from "@/lib/utils";

const COR = {
  boa: "bg-success/15 text-success",
  baixa: "bg-primary/15 text-primary",
  lotada: "bg-primary text-primary-foreground",
  desconhecida: "bg-secondary text-muted-foreground",
} as const;

export function PortasBadge({ cto, className }: { cto: Cto; className?: string }) {
  const cap = capacidade(cto);
  const livres = portasLivres(cto);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
        COR[cap],
        className,
      )}
    >
      {cap === "desconhecida" ? (
        <>
          <CircleHelp className="size-3.5" aria-hidden /> Portas não confirmadas
        </>
      ) : cap === "lotada" ? (
        `Lotada · 0/${cto.portas_total}`
      ) : (
        `${livres}/${cto.portas_total} livres`
      )}
    </span>
  );
}

/** Painel completo de portas: deixa claro quando a informação não é confiável. */
export function PortasPainel({ cto, ultimoRelato }: { cto: Cto; ultimoRelato?: Historico | null }) {
  const cap = capacidade(cto);
  const livres = portasLivres(cto);
  const relatoNovo =
    ultimoRelato?.portas_ocupadas_obs != null &&
    (!cto.portas_atualizadas_em ||
      new Date(ultimoRelato.created_at) > new Date(cto.portas_atualizadas_em)) &&
    ultimoRelato.portas_ocupadas_obs !== cto.portas_ocupadas;

  return (
    <section className="surface p-4" aria-labelledby="portas-titulo">
      <h2 id="portas-titulo" className="font-bold">
        Portas
      </h2>
      {cap === "desconhecida" ? (
        <div
          role="status"
          className="mt-3 flex gap-3 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm"
        >
          <CircleHelp className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <p>
            <strong className="block">Disponibilidade de portas não confirmada.</strong>A TI ainda
            não registrou a ocupação desta CTO. Confira no local antes de confirmar a instalação ao
            cliente.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-end justify-between">
            <p>
              <span
                className={cn(
                  "text-4xl font-extrabold",
                  cap === "boa" ? "text-success" : "text-primary",
                )}
              >
                {livres}
              </span>
              <span className="ml-1 text-muted-foreground">livres de {cto.portas_total}</span>
            </p>
            <p className="text-sm text-muted-foreground">{cto.portas_ocupadas} ocupadas</p>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-secondary" aria-hidden>
            <div
              className={cn("h-full rounded-full", cap === "boa" ? "bg-success" : "bg-primary")}
              style={{ width: `${((cto.portas_ocupadas ?? 0) / (cto.portas_total ?? 1)) * 100}%` }}
            />
          </div>
          {cto.portas_atualizadas_em && (
            <p className="mt-2 text-xs text-muted-foreground">
              Conferido por {cto.portas_atualizadas_por ?? "TI"} em{" "}
              {dataHora(cto.portas_atualizadas_em)}
            </p>
          )}
          {portasDesatualizadas(cto) && (
            <p
              role="status"
              className="mt-3 flex gap-2 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              Contagem com mais de {DIAS_PORTAS_VALIDAS} dias. Pode estar desatualizada; confira no
              local.
            </p>
          )}
        </>
      )}
      {relatoNovo && ultimoRelato && (
        <p
          role="status"
          className="mt-3 flex gap-2 rounded-xl border border-info/40 bg-info/10 p-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          {ultimoRelato.tecnico} contou {ultimoRelato.portas_ocupadas_obs} porta(s) ocupada(s) no
          local em {dataHora(ultimoRelato.created_at)}. Aguardando confirmação da TI.
        </p>
      )}
    </section>
  );
}
