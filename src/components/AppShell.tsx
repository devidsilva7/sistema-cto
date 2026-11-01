import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  ClipboardList,
  History,
  LogOut,
  MapPinned,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { iniciais, meQuery } from "@/lib/fgtech";
import { cn } from "@/lib/utils";

type Item = {
  to: "/mapa" | "/dashboard" | "/historico" | "/gestao";
  label: string;
  icon: LucideIcon;
  ti?: boolean;
};

const ITENS: Item[] = [
  { to: "/mapa", label: "Mapa de CTOs", icon: MapPinned },
  { to: "/dashboard", label: "Tarefas", icon: ClipboardList },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/gestao", label: "Gestão TI", icon: Settings2, ti: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const me = useQuery(meQuery);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const itens = ITENS.filter((i) => !i.ti || me.data?.perfil === "ti");

  async function sair() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar p-4 md:flex">
        <img
          src="/logocto.png"
          alt="FGTECH"
          className="h-auto w-full object-contain px-2"
          width={1280}
          height={277}
        />
        <p className="eyebrow mt-1 px-2 text-primary-soft">CTO Maps</p>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Menu principal">
          {itens.map((i) => (
            <Link
              key={i.to}
              to={i.to}
              className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-primary/15 !text-primary" }}
            >
              <i.icon className="size-5" aria-hidden /> {i.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-2xl border bg-card p-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/20 text-sm font-bold text-primary">
            {iniciais(me.data?.nome ?? "")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{me.data?.nome}</p>
            <p className="text-xs text-muted-foreground">
              {me.data?.perfil === "ti" ? "TI (Administrador)" : "Técnico"}
            </p>
          </div>
          <button
            onClick={sair}
            className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[1000] flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:hidden">
          <img src="/logocto.png" alt="FGTECH" className="h-7 w-auto" width={1280} height={277} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{me.data?.nome}</span>
            <button
              onClick={sair}
              className="grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-secondary"
              aria-label="Sair"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        </header>
        <main className="flex min-h-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-[1000] flex border-t bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Menu principal"
      >
        {itens.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            className={cn(
              "flex h-[4.5rem] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground",
            )}
            activeProps={{ className: "!text-primary" }}
          >
            <i.icon className="size-6" aria-hidden />
            {i.label.replace(" de CTOs", "").replace(" TI", "")}
          </Link>
        ))}
      </nav>
    </div>
  );
}
