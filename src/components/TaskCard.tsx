import { AlertTriangle, Clock, MapPin } from "lucide-react";
import { dataCurta, hora, iniciais, urgencia, type Cto, type Tarefa } from "@/lib/fgtech";
import { cn } from "@/lib/utils";

const BORDA = {
  atrasada: "border-l-danger",
  importante: "border-l-primary",
  concluida: "border-l-success",
  normal: "border-l-border",
} as const;

export function TaskCard({ t, cto, onClick }: { t: Tarefa; cto?: Cto; onClick: () => void }) {
  const u = urgencia(t);
  return (
    <button
      onClick={onClick}
      className={cn(
        "surface w-full border-l-4 p-4 text-left transition-colors hover:bg-secondary",
        BORDA[u],
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold" title={t.tecnico}>
          {iniciais(t.tecnico)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-bold">{t.tipo}</p>
            <span className="text-xs font-semibold text-muted-foreground">{t.servico_id}</span>
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-semibold text-primary-soft">{cto?.codigo ?? "—"}</span>
            <Clock className="size-3.5" aria-hidden /> {hora(t.horario)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold">{t.cliente}</p>
      <p className="mt-0.5 flex items-start gap-1.5 text-xs text-muted-foreground">
        <MapPin className="mt-px size-3.5 shrink-0" aria-hidden /> {t.endereco}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            u === "atrasada" && "bg-danger/15 text-danger",
            u === "importante" && "bg-primary/15 text-primary",
            u === "concluida" && "bg-success/15 text-success",
            u === "normal" && "bg-secondary text-muted-foreground",
          )}
        >
          {dataCurta(t.data)}
        </span>
        {t.problema && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
            <AlertTriangle className="size-3.5" aria-hidden /> Problema
          </span>
        )}
      </div>
    </button>
  );
}
