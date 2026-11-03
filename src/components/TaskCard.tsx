import { AlertTriangle, Clock, MapPin } from "lucide-react";
import { dataCurta, hora, iniciais, urgencia, type Cto, type Tarefa } from "@/lib/fgtech";
import { cn } from "@/lib/utils";

const BORDA = {
  atrasada: "border-l-danger",
  importante: "border-l-primary",
  concluida: "border-l-success",
  normal: "border-l-border",
} as const;

export function TaskCard({
  t,
  cto,
  onClick,
  onDoubleClick,
  compact = false,
}: {
  t: Tarefa;
  cto?: Cto | undefined;
  onClick: () => void;
  onDoubleClick?: () => void;
  compact?: boolean;
}) {
  const u = urgencia(t);
  const concluida = t.status === "concluida";
  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={cn(
        "surface w-full border-l-4 p-4 text-left transition-colors hover:bg-secondary",
        BORDA[u],
        compact && "p-3",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold"
          title={t.tecnico}
        >
          {iniciais(t.tecnico)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className={cn("truncate font-bold", concluida && "line-through")}>
                {t.titulo || t.tipo}
              </p>
              {t.titulo && t.titulo !== t.tipo && (
                <p
                  className={cn(
                    "truncate text-xs text-muted-foreground",
                    concluida && "line-through",
                  )}
                >
                  {t.tipo}
                </p>
              )}
            </div>
            <span
              className={cn(
                "text-xs font-semibold text-muted-foreground",
                concluida && "line-through",
              )}
            >
              {t.servico_id}
            </span>
          </div>
          <p
            className={cn(
              "mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground",
              concluida && "line-through",
            )}
          >
            <span className="font-semibold text-primary-soft">{cto?.codigo ?? "—"}</span>
            <Clock className="size-3.5" aria-hidden /> {hora(t.horario)}
          </p>
        </div>
      </div>
      {!compact && (
        <p className={cn("mt-3 text-sm font-semibold", concluida && "line-through")}>{t.cliente}</p>
      )}
      {!compact && (
        <p
          className={cn(
            "mt-0.5 flex items-start gap-1.5 text-xs text-muted-foreground",
            concluida && "line-through",
          )}
        >
          <MapPin className="mt-px size-3.5 shrink-0" aria-hidden /> {t.endereco}
        </p>
      )}
      {compact && (
        <p
          className={cn(
            "mt-2 line-clamp-2 text-xs text-muted-foreground",
            concluida && "line-through",
          )}
        >
          {t.descricao_problema || t.endereco || t.cliente}
        </p>
      )}
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
        {t.prioridade === "critica" && (
          <span className="rounded-full bg-danger/15 px-2.5 py-1 text-xs font-bold text-danger">
            Crítica
          </span>
        )}
      </div>
    </button>
  );
}
