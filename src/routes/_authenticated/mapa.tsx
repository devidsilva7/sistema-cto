import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronRight, Crosshair, Loader2, MapPin, Navigation, Search, X } from "lucide-react";
import { toast } from "sonner";
import { CtoMap } from "@/components/CtoMap";
import { PortasBadge } from "@/components/CtoPortas";
import { Button } from "@/components/ui/button";
import {
  buscarEndereco,
  capacidade,
  ctosQuery,
  distanciaM,
  filtrarCtos,
  formatarDistancia,
  linkRota,
  maisProximas,
  posicaoAtual,
  type Cto,
  type ResultadoEndereco,
} from "@/lib/fgtech";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mapa")({
  head: () => ({ meta: [{ title: "Mapa de CTOs · FGTECH CTO Maps" }] }),
  component: MapaPage,
});

type Referencia = { lat: number; lng: number; label: string; tipo: "gps" | "endereco" };

function MapaPage() {
  const ctos = useQuery(ctosQuery);
  const [termo, setTermo] = useState("");
  const [ref, setRef] = useState<Referencia | null>(null);
  const [enderecos, setEnderecos] = useState<ResultadoEndereco[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [localizando, setLocalizando] = useState(false);
  const [soLivres, setSoLivres] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  const todas = useMemo(() => ctos.data ?? [], [ctos.data]);
  const ativas = useMemo(
    () => todas.filter((c) => c.ativa && (!soLivres || ["boa", "baixa"].includes(capacidade(c)))),
    [todas, soLivres],
  );
  const sel = todas.find((c) => c.id === selId) ?? null;

  // Centraliza no conjunto de CTOs na primeira carga
  useEffect(() => {
    if (focus || !todas.length) return;
    const lat = todas.reduce((s, c) => s + c.lat, 0) / todas.length;
    const lng = todas.reduce((s, c) => s + c.lng, 0) / todas.length;
    setFocus({ lat, lng, zoom: 14 });
  }, [todas, focus]);

  const encontradas = termo.trim() ? filtrarCtos(todas, termo).slice(0, 30) : [];
  const proximas = ref ? maisProximas(ativas, ref, 5) : [];

  function selecionar(c: Cto) {
    setSelId(c.id);
    setFocus({ lat: c.lat, lng: c.lng, zoom: 18 });
  }

  async function localizar() {
    setLocalizando(true);
    try {
      const p = await posicaoAtual();
      setRef({ ...p, label: "Sua localização", tipo: "gps" });
      setEnderecos(null);
      setFocus({ ...p, zoom: 17 });
      setSelId(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLocalizando(false);
    }
  }

  async function pesquisarEndereco(e?: FormEvent) {
    e?.preventDefault();
    const q = termo.trim();
    if (q.length < 3) return;
    setBuscando(true);
    try {
      const centro = focus ?? undefined;
      const r = await buscarEndereco(q, centro ? { lat: centro.lat, lng: centro.lng } : undefined);
      setEnderecos(r);
      if (!r.length)
        toast.info("Nenhum endereço encontrado. Tente incluir número, bairro e cidade.");
    } catch {
      toast.error("Não foi possível buscar o endereço agora.");
    } finally {
      setBuscando(false);
    }
  }

  function escolherEndereco(r: ResultadoEndereco) {
    setRef({ lat: r.lat, lng: r.lng, label: r.nome, tipo: "endereco" });
    setEnderecos(null);
    setTermo("");
    setSelId(null);
    setFocus({ lat: r.lat, lng: r.lng, zoom: 17 });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:h-dvh md:flex-row">
      <section className="order-2 flex flex-col gap-3 p-4 md:order-1 md:w-[24rem] md:shrink-0 md:overflow-y-auto md:border-r">
        <form onSubmit={pesquisarEndereco} role="search" className="flex flex-col gap-2">
          <label htmlFor="busca" className="text-sm font-semibold">
            Buscar CTO ou endereço
          </label>
          <div className="relative">
            <Search
              className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="busca"
              value={termo}
              onChange={(e) => {
                setTermo(e.target.value);
                setEnderecos(null);
              }}
              placeholder="Código, nome da CTO ou endereço"
              autoComplete="off"
              className="h-12 w-full rounded-xl border border-input bg-card pl-11 pr-11 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary"
            />
            {termo && (
              <button
                type="button"
                onClick={() => {
                  setTermo("");
                  setEnderecos(null);
                }}
                className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground"
                aria-label="Limpar busca"
              >
                <X className="size-5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" onClick={localizar} disabled={localizando}>
              {localizando ? <Loader2 className="animate-spin" /> : <Crosshair />} Perto de mim
            </Button>
            <Button type="submit" variant="outline" disabled={buscando || termo.trim().length < 3}>
              {buscando ? <Loader2 className="animate-spin" /> : <MapPin />} Buscar endereço
            </Button>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={soLivres}
              onChange={(e) => setSoLivres(e.target.checked)}
              className="size-5 accent-[var(--primary)]"
            />
            Mostrar só CTOs com portas livres confirmadas
          </label>
        </form>

        {enderecos && enderecos.length > 0 && (
          <div className="surface divide-y overflow-hidden">
            <p className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Endereços
            </p>
            {enderecos.map((r) => (
              <button
                key={`${r.lat},${r.lng}`}
                onClick={() => escolherEndereco(r)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-secondary"
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-info" aria-hidden /> {r.nome}
              </button>
            ))}
          </div>
        )}

        {sel && (
          <CartaoCto
            cto={sel}
            dist={ref ? distanciaM(ref, sel) : null}
            onFechar={() => setSelId(null)}
          />
        )}

        {termo.trim() ? (
          <ListaCtos
            titulo={`CTOs encontradas (${encontradas.length})`}
            vazio="Nenhuma CTO com esse código ou nome. Se for um endereço, toque em Buscar endereço."
            itens={encontradas.map((c) => ({ cto: c, dist: ref ? distanciaM(ref, c) : null }))}
            selId={selId}
            onSel={selecionar}
          />
        ) : ref ? (
          <>
            <div className="flex items-start justify-between gap-2 rounded-xl bg-info/10 p-3 text-sm">
              <p className="min-w-0">
                <span className="block text-xs font-bold uppercase tracking-wider text-info">
                  {ref.tipo === "gps" ? "Perto de você" : "Perto do endereço"}
                </span>
                <span className="line-clamp-2">{ref.label}</span>
              </p>
              <button
                onClick={() => setRef(null)}
                className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
                aria-label="Limpar referência"
              >
                <X className="size-4" />
              </button>
            </div>
            <ListaCtos
              titulo="CTOs mais próximas"
              vazio="Nenhuma CTO ativa encontrada."
              itens={proximas}
              selId={selId}
              onSel={selecionar}
            />
          </>
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Toque em <strong className="text-foreground">Perto de mim</strong> para listar as CTOs
            mais próximas, pesquise um endereço ou digite o código da CTO. Também é possível tocar
            nos marcadores do mapa.
          </p>
        )}

        <Legenda />
      </section>

      <div className="order-1 h-[52dvh] shrink-0 md:order-2 md:h-auto md:flex-1">
        {ctos.isLoading ? (
          <div className="grid h-full place-items-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <CtoMap
            ctos={soLivres ? ativas : todas}
            selectedId={selId}
            onSelect={selecionar}
            userPos={ref?.tipo === "gps" ? ref : null}
            pin={ref?.tipo === "endereco" ? ref : null}
            focus={focus}
          />
        )}
      </div>
    </div>
  );
}

function CartaoCto({
  cto,
  dist,
  onFechar,
}: {
  cto: Cto;
  dist: number | null;
  onFechar: () => void;
}) {
  return (
    <article className="surface border-primary/40 p-4" aria-live="polite">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-extrabold">{cto.codigo}</h2>
          <p className="truncate text-sm text-muted-foreground">
            {[cto.nome, cto.bairro].filter(Boolean).join(" · ")}
            {dist != null && ` · ${formatarDistancia(dist)}`}
          </p>
        </div>
        <button
          onClick={onFechar}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <PortasBadge cto={cto} />
        {!cto.ativa && (
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold">
            Desativada
          </span>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button asChild>
          <Link to="/ctos/$id" params={{ id: cto.id }}>
            Abrir / registrar
          </Link>
        </Button>
        <Button asChild variant="outline">
          <a href={linkRota(cto)} target="_blank" rel="noreferrer">
            <Navigation /> Navegar
          </a>
        </Button>
      </div>
    </article>
  );
}

function ListaCtos({
  titulo,
  vazio,
  itens,
  selId,
  onSel,
}: {
  titulo: string;
  vazio: string;
  itens: { cto: Cto; dist: number | null }[];
  selId: string | null;
  onSel: (c: Cto) => void;
}) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {titulo}
      </h2>
      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {itens.map(({ cto, dist }) => (
            <li key={cto.id}>
              <button
                onClick={() => onSel(cto)}
                className={cn(
                  "surface flex w-full items-center gap-3 p-3 text-left hover:bg-secondary",
                  cto.id === selId && "border-primary",
                  !cto.ativa && "opacity-60",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{cto.codigo}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[cto.nome, cto.bairro].filter(Boolean).join(" · ")}
                    {!cto.ativa && " · Desativada"}
                  </p>
                  <PortasBadge cto={cto} className="mt-1.5" />
                </div>
                {dist != null && (
                  <span className="shrink-0 text-sm font-bold text-info">
                    {formatarDistancia(dist)}
                  </span>
                )}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Legenda() {
  const itens = [
    ["bg-success", "Boa disponibilidade (25% ou mais livres)"],
    ["bg-primary", "Poucas portas ou lotada"],
    ["bg-secondary border border-foreground", "Portas não confirmadas"],
  ] as const;
  return (
    <ul
      className="mt-auto flex flex-col gap-1.5 pt-2 text-xs text-muted-foreground"
      aria-label="Legenda do mapa"
    >
      {itens.map(([cor, txt]) => (
        <li key={txt} className="flex items-center gap-2">
          <span className={cn("size-3 rounded-full", cor)} aria-hidden /> {txt}
        </li>
      ))}
    </ul>
  );
}
