import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronRight, Loader2, Lock, Plus, Search } from "lucide-react";
import { CtoForm } from "@/components/CtoForm";
import { PortasBadge } from "@/components/CtoPortas";
import { ImportarKmz } from "@/components/gestao/ImportarKmz";
import { Usuarios } from "@/components/gestao/Usuarios";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { capacidade, ctosQuery, filtrarCtos, meQuery, portasDesatualizadas } from "@/lib/fgtech";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/gestao")({
  head: () => ({ meta: [{ title: "Gestão TI · FGTECH CTO Maps" }] }),
  component: GestaoPage,
});

function GestaoPage() {
  const me = useQuery(meQuery);
  if (me.isLoading) return <Loader2 className="m-8 size-6 animate-spin text-muted-foreground" />;
  if (me.data?.perfil !== "ti") {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <Lock className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-bold">Acesso restrito à equipe de TI.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-8">
      <h1 className="text-2xl font-extrabold">Gestão TI</h1>
      <p className="text-sm text-muted-foreground">
        Cadastro de CTOs, importação do KMZ e usuários.
      </p>
      <Tabs defaultValue="ctos" className="mt-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="ctos">CTOs</TabsTrigger>
          <TabsTrigger value="kmz">Importar KMZ</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
        </TabsList>
        <TabsContent value="ctos">
          <ListaGestao />
        </TabsContent>
        <TabsContent value="kmz">
          <ImportarKmz />
        </TabsContent>
        <TabsContent value="usuarios">
          <Usuarios meuId={me.data.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const FILTROS = [
  { id: "ativas", label: "Ativas" },
  { id: "sem-portas", label: "Portas não confirmadas" },
  { id: "desatualizadas", label: "Contagem antiga" },
  { id: "lotadas", label: "Lotadas" },
  { id: "desativadas", label: "Desativadas" },
  { id: "todas", label: "Todas" },
] as const;

function ListaGestao() {
  const ctos = useQuery(ctosQuery);
  const [termo, setTermo] = useState("");
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("ativas");
  const [nova, setNova] = useState(false);
  const todas = useMemo(() => ctos.data ?? [], [ctos.data]);

  const contagem = useMemo(() => {
    const ativas = todas.filter((c) => c.ativa);
    return {
      ativas: ativas.length,
      "sem-portas": ativas.filter((c) => capacidade(c) === "desconhecida").length,
      desatualizadas: ativas.filter((c) => portasDesatualizadas(c)).length,
      lotadas: ativas.filter((c) => capacidade(c) === "lotada").length,
      desativadas: todas.length - ativas.length,
      todas: todas.length,
    };
  }, [todas]);

  const lista = filtrarCtos(todas, termo).filter((c) => {
    switch (filtro) {
      case "ativas":
        return c.ativa;
      case "sem-portas":
        return c.ativa && capacidade(c) === "desconhecida";
      case "desatualizadas":
        return c.ativa && portasDesatualizadas(c);
      case "lotadas":
        return c.ativa && capacidade(c) === "lotada";
      case "desativadas":
        return !c.ativa;
      default:
        return true;
    }
  });

  return (
    <div className="mt-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar por código, nome, bairro"
            aria-label="Buscar CTO"
            className="h-11 w-full rounded-xl border border-input bg-card pl-11 pr-4 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary"
          />
        </div>
        <Button onClick={() => setNova(true)}>
          <Plus /> Nova CTO
        </Button>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar CTOs">
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
            {f.label} ({contagem[f.id]})
          </button>
        ))}
      </div>

      {ctos.isLoading ? (
        <Loader2 className="mt-6 size-6 animate-spin text-muted-foreground" />
      ) : lista.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Nenhuma CTO neste filtro.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {lista.map((c) => (
            <li key={c.id}>
              <Link
                to="/ctos/$id"
                params={{ id: c.id }}
                className={cn(
                  "surface flex items-center gap-3 p-3 hover:bg-secondary",
                  !c.ativa && "opacity-60",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">
                    {c.codigo}
                    {c.origem === "kmz" && (
                      <span className="ml-2 text-xs font-semibold text-muted-foreground">KMZ</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[c.nome, c.bairro, c.endereco].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <PortasBadge cto={c} />
                  {!c.ativa && (
                    <span className="text-xs font-bold text-muted-foreground">Desativada</span>
                  )}
                  {c.ativa && portasDesatualizadas(c) && (
                    <span className="text-xs text-primary">Contagem antiga</span>
                  )}
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={nova} onOpenChange={setNova}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova CTO</DialogTitle>
          </DialogHeader>
          <CtoForm todas={todas} onSaved={() => setNova(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
