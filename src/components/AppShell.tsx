import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MapPinned,
  Moon,
  PlusSquare,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { iniciais, meQuery } from "@/lib/fgtech";
import {
  SheetClose,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type Item = {
  to: "/dashboard" | "/tarefas" | "/mapa" | "/historico" | "/gestao";
  label: string;
  icon: LucideIcon;
  ti?: boolean;
};

const ITENS: Item[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tarefas", label: "Tarefas", icon: ClipboardList },
  { to: "/mapa", label: "Mapa de CTOs", icon: MapPinned },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/gestao", label: "Cadastrar CTO", icon: PlusSquare, ti: true },
];

type Theme = "light" | "dark";
const THEME_STORAGE_KEY = "fgtech-cto-theme";

export function AppShell({ children }: { children: ReactNode }) {
  const me = useQuery(meQuery);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [theme, setTheme] = useState<Theme>("light");
  const [themeReady, setThemeReady] = useState(false);
  const itens = ITENS.filter((i) => !i.ti || me.data?.perfil === "ti");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    document.body.dataset["appTheme"] = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    return () => {
      delete document.body.dataset["appTheme"];
    };
  }, [theme, themeReady]);

  async function sair() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="app-theme flex min-h-dvh bg-background text-foreground" data-theme={theme}>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto border-r bg-sidebar p-4 md:flex">
        <img
          src="/logocto.png"
          alt="FGTECH"
          className="app-logo h-auto w-full object-contain px-2"
          width={1280}
          height={277}
        />
        <p className="eyebrow mt-1 px-2 text-primary-soft">CTO Maps</p>
        <ThemeToggle
          theme={theme}
          onToggle={() => setTheme(theme === "light" ? "dark" : "light")}
        />
        <nav className="mt-8 flex flex-col gap-1" aria-label="Menu principal">
          {itens.map((i) => (
            <ItemLink key={i.to} item={i} />
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
        <header className="sticky top-0 z-[1000] flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:hidden">
          <img
            src="/logocto.png"
            alt="FGTECH"
            className="app-logo h-7 w-auto"
            width={1280}
            height={277}
          />
          <div className="flex items-center gap-2">
            <ThemeToggle
              theme={theme}
              onToggle={() => setTheme(theme === "light" ? "dark" : "light")}
              compact
            />
            <span className="hidden max-w-32 truncate text-xs text-muted-foreground sm:block">
              {me.data?.nome}
            </span>
            <Sheet>
              <SheetTrigger asChild>
                <button
                  className="grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-secondary"
                  aria-label="Abrir menu principal"
                >
                  <Menu className="size-5" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="app-theme-portal flex flex-col overflow-y-auto bg-sidebar p-4 text-foreground"
                data-theme={theme}
              >
                <SheetHeader className="pr-8 text-left">
                  <img
                    src="/logocto.png"
                    alt="FGTECH"
                    className="app-logo h-auto w-44 object-contain"
                    width={1280}
                    height={277}
                  />
                  <SheetTitle className="eyebrow text-primary-soft">CTO Maps</SheetTitle>
                </SheetHeader>
                <ThemeToggle
                  theme={theme}
                  onToggle={() => setTheme(theme === "light" ? "dark" : "light")}
                />
                <nav className="mt-6 flex flex-col gap-1" aria-label="Menu principal">
                  {itens.map((i) => (
                    <ItemLink key={i.to} item={i} mobile />
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
                  >
                    <LogOut className="size-5" />
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>
        <main className="flex min-h-0 flex-1 flex-col bg-background">{children}</main>
      </div>
    </div>
  );
}

function ThemeToggle({
  theme,
  onToggle,
  compact = false,
}: {
  theme: Theme;
  onToggle: () => void;
  compact?: boolean;
}) {
  const isDark = theme === "dark";
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Ativar modo ${isDark ? "claro" : "escuro"}`}
      aria-pressed={isDark}
      title={`Ativar modo ${isDark ? "claro" : "escuro"}`}
      className={`flex h-11 items-center gap-3 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary ${compact ? "mt-0 w-11 justify-center px-0" : "mt-4 w-full"}`}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {!compact && <span>{isDark ? "Modo claro" : "Modo escuro"}</span>}
    </button>
  );
}

function ItemLink({ item, mobile = false }: { item: Item; mobile?: boolean }) {
  const className = `flex ${mobile ? "h-12" : "h-11"} items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground`;
  const activeProps = { className: "bg-primary/15 !text-primary" };
  const wrap = (link: ReactElement) => (mobile ? <SheetClose asChild>{link}</SheetClose> : link);
  const content = (
    <>
      <item.icon className="size-5" aria-hidden /> {item.label}
    </>
  );

  switch (item.to) {
    case "/tarefas":
      return wrap(
        <Link
          to="/tarefas"
          search={{ criar: false, tarefa: undefined }}
          className={className}
          activeProps={activeProps}
        >
          {content}
        </Link>,
      );
    case "/mapa":
      return wrap(
        <Link
          to="/mapa"
          search={{ criticas: false }}
          className={className}
          activeProps={activeProps}
        >
          {content}
        </Link>,
      );
    case "/gestao":
      return wrap(
        <Link to="/gestao" search={{ nova: false }} className={className} activeProps={activeProps}>
          {content}
        </Link>,
      );
    case "/dashboard":
      return wrap(
        <Link to="/dashboard" className={className} activeProps={activeProps}>
          {content}
        </Link>,
      );
    case "/historico":
      return wrap(
        <Link to="/historico" className={className} activeProps={activeProps}>
          {content}
        </Link>,
      );
  }
}
