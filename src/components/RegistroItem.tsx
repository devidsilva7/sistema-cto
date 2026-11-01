import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Pencil,
  PlusCircle,
  Power,
  Share2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  dataHora,
  linkWhatsApp,
  textoRegistroWhatsApp,
  type Cto,
  type Historico,
} from "@/lib/fgtech";
import { cn } from "@/lib/utils";

type Estilo = { icon: LucideIcon; cor: string; rotulo: string };
const SERVICO: Estilo = { icon: Wrench, cor: "text-success bg-success/15", rotulo: "Serviço" };
const ICONE: Record<string, Estilo | undefined> = {
  servico: SERVICO,
  problema: { icon: AlertTriangle, cor: "text-primary bg-primary/15", rotulo: "Problema" },
  cadastro: { icon: PlusCircle, cor: "text-info bg-info/15", rotulo: "Cadastro" },
  alteracao: { icon: Pencil, cor: "text-info bg-info/15", rotulo: "Alteração TI" },
  status: { icon: Power, cor: "text-muted-foreground bg-secondary", rotulo: "Situação" },
};

export function RegistroItem({
  r,
  cto,
  mostrarCto,
}: {
  r: Historico;
  cto?: Cto | undefined;
  mostrarCto?: boolean;
}) {
  const tipo = ICONE[r.categoria] ?? SERVICO;
  return (
    <li className="surface flex gap-3 p-3">
      <span
        className={cn("grid size-9 shrink-0 place-items-center rounded-full", tipo.cor)}
        title={tipo.rotulo}
      >
        <tipo.icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="font-bold">{r.acao}</p>
          <time className="text-xs text-muted-foreground" dateTime={r.created_at}>
            {dataHora(r.created_at)}
          </time>
        </div>
        <p className="text-xs text-muted-foreground">
          {mostrarCto &&
            (r.cto_id ? (
              <Link
                to="/ctos/$id"
                params={{ id: r.cto_id }}
                className="font-semibold text-primary-soft hover:underline"
              >
                {r.cto_codigo}
              </Link>
            ) : (
              <span className="font-semibold">{r.cto_codigo}</span>
            ))}
          {mostrarCto && " · "}
          {r.tecnico}
          {r.servico_id && ` · ${r.servico_id}`}
        </p>
        {r.descricao && <p className="mt-1.5 whitespace-pre-line text-sm">{r.descricao}</p>}
        {(r.portas_utilizadas || r.portas_ocupadas_obs != null) && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {r.portas_utilizadas && <>Portas: {r.portas_utilizadas}</>}
            {r.portas_utilizadas && r.portas_ocupadas_obs != null && " · "}
            {r.portas_ocupadas_obs != null && <>Ocupadas no local: {r.portas_ocupadas_obs}</>}
          </p>
        )}
        {cto && r.categoria === "servico" && (
          <a
            href={linkWhatsApp(textoRegistroWhatsApp(r, cto))}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-success hover:underline"
          >
            <Share2 className="size-3.5" aria-hidden /> Compartilhar no WhatsApp
          </a>
        )}
      </div>
    </li>
  );
}
