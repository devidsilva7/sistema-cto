import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Crosshair, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CtoMap } from "@/components/CtoMap";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  distanciaM,
  formatarDistancia,
  mensagemErro,
  normalizar,
  posicaoAtual,
  RAIO_DUPLICADA_M,
  type Cto,
} from "@/lib/fgtech";

const campo =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary";

/** Cadastro e edição de CTO (somente TI — o banco também bloqueia os demais perfis). */
export function CtoForm({
  cto,
  todas,
  onSaved,
}: {
  cto?: Cto;
  todas: Cto[];
  onSaved: (c: Cto) => void;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    codigo: cto?.codigo ?? "",
    nome: cto?.nome ?? "",
    bairro: cto?.bairro ?? "",
    endereco: cto?.endereco ?? "",
    lat: cto ? String(cto.lat) : "",
    lng: cto ? String(cto.lng) : "",
    observacoes: cto?.observacoes ?? "",
    portasConhecidas: cto ? cto.portas_total != null : true,
    portas_total: cto?.portas_total != null ? String(cto.portas_total) : "16",
    portas_ocupadas: cto?.portas_ocupadas != null ? String(cto.portas_ocupadas) : "0",
    conferida: false,
  });
  const [aceitaProxima, setAceitaProxima] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const lat = Number(f.lat.replace(",", "."));
  const lng = Number(f.lng.replace(",", "."));
  const coordOk = f.lat !== "" && f.lng !== "" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const outras = todas.filter((c) => c.id !== cto?.id);
  const inicio = todas[0];
  const focoMapa = useMemo(
    () => (coordOk ? { lat, lng } : inicio ? { lat: inicio.lat, lng: inicio.lng, zoom: 14 } : null),
    [coordOk, lat, lng, inicio],
  );
  const proxima = coordOk
    ? outras.find((c) => distanciaM(c, { lat, lng }) < RAIO_DUPLICADA_M)
    : undefined;
  const mesmoCodigo = f.codigo.trim()
    ? outras.find((c) => normalizar(c.codigo) === normalizar(f.codigo))
    : undefined;

  async function usarGps() {
    try {
      const p = await posicaoAtual();
      setF((s) => ({ ...s, lat: p.lat.toFixed(6), lng: p.lng.toFixed(6) }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    const total = Number(f.portas_total);
    const ocup = Number(f.portas_ocupadas);
    if (!f.codigo.trim() || !f.bairro.trim()) return setErro("Informe o código e o bairro.");
    if (mesmoCodigo) return setErro(`Já existe a CTO ${mesmoCodigo.codigo} com esse código.`);
    if (!coordOk) return setErro("Informe latitude e longitude válidas (ou toque no mapa).");
    if (proxima && !aceitaProxima)
      return setErro("Confirme que não é a mesma CTO já cadastrada no local.");
    if (
      f.portasConhecidas &&
      (!Number.isInteger(total) ||
        total <= 0 ||
        !Number.isInteger(ocup) ||
        ocup < 0 ||
        ocup > total)
    ) {
      return setErro(
        "Portas inválidas: o total deve ser maior que zero e as ocupadas não podem passar do total.",
      );
    }
    const dados = {
      codigo: f.codigo.trim(),
      nome: f.nome.trim() || null,
      bairro: f.bairro.trim(),
      endereco: f.endereco.trim() || null,
      lat,
      lng,
      observacoes: f.observacoes.trim() || null,
      portas_total: f.portasConhecidas ? total : null,
      portas_ocupadas: f.portasConhecidas ? ocup : null,
      ...(cto && f.conferida && f.portasConhecidas
        ? { portas_atualizadas_em: new Date().toISOString() }
        : {}),
    };
    setSalvando(true);
    const res = cto
      ? await supabase.from("ctos").update(dados).eq("id", cto.id).select().single()
      : await supabase.from("ctos").insert(dados).select().single();
    setSalvando(false);
    if (res.error) return setErro(mensagemErro(res.error));
    await qc.invalidateQueries({ queryKey: ["ctos"] });
    await qc.invalidateQueries({ queryKey: ["historico"] });
    toast.success(cto ? "CTO atualizada." : "CTO cadastrada.");
    onSaved(res.data);
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="codigo" label="Código *">
          <input
            id="codigo"
            className={campo}
            value={f.codigo}
            onChange={(e) => set("codigo", e.target.value)}
            required
          />
          {mesmoCodigo && (
            <p className="mt-1 text-xs text-danger">Já existe: {mesmoCodigo.codigo}</p>
          )}
        </Campo>
        <Campo id="nome" label="Nome">
          <input
            id="nome"
            className={campo}
            value={f.nome}
            onChange={(e) => set("nome", e.target.value)}
          />
        </Campo>
        <Campo id="bairro" label="Bairro *">
          <input
            id="bairro"
            className={campo}
            value={f.bairro}
            onChange={(e) => set("bairro", e.target.value)}
            required
          />
        </Campo>
        <Campo id="endereco" label="Endereço / referência">
          <input
            id="endereco"
            className={campo}
            value={f.endereco}
            onChange={(e) => set("endereco", e.target.value)}
          />
        </Campo>
      </div>

      <fieldset className="rounded-2xl border p-3">
        <legend className="px-1 text-sm font-semibold">Localização *</legend>
        <div className="grid grid-cols-2 gap-3">
          <Campo id="lat" label="Latitude">
            <input
              id="lat"
              inputMode="decimal"
              className={campo}
              value={f.lat}
              onChange={(e) => set("lat", e.target.value)}
            />
          </Campo>
          <Campo id="lng" label="Longitude">
            <input
              id="lng"
              inputMode="decimal"
              className={campo}
              value={f.lng}
              onChange={(e) => set("lng", e.target.value)}
            />
          </Campo>
        </div>
        <Button type="button" variant="outline" className="mt-3 w-full" onClick={usarGps}>
          <Crosshair /> Usar minha localização atual
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Ou toque no mapa para posicionar a CTO.
        </p>
        <div className="mt-2 h-56 overflow-hidden rounded-xl border">
          <CtoMap
            ctos={outras}
            pin={coordOk ? { lat, lng, label: "Nova posição" } : null}
            focus={focoMapa}
            onMapClick={(p) =>
              setF((s) => ({ ...s, lat: p.lat.toFixed(6), lng: p.lng.toFixed(6) }))
            }
            className="picking"
          />
        </div>
        {proxima && (
          <div className="mt-3 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm">
            <p className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />A{" "}
              {proxima.codigo} está a {formatarDistancia(distanciaM(proxima, { lat, lng }))} deste
              ponto. Pode ser a mesma CTO.
            </p>
            <label className="mt-2 flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={aceitaProxima}
                onChange={(e) => setAceitaProxima(e.target.checked)}
                className="size-5 accent-[var(--primary)]"
              />
              Confirmo que é outra CTO
            </label>
          </div>
        )}
      </fieldset>

      <fieldset className="rounded-2xl border p-3">
        <legend className="px-1 text-sm font-semibold">Portas</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={f.portasConhecidas}
            onChange={(e) => set("portasConhecidas", e.target.checked)}
            className="size-5 accent-[var(--primary)]"
          />
          Tenho a contagem de portas confirmada
        </label>
        {f.portasConhecidas ? (
          <>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Campo id="ptotal" label="Total de portas">
                <input
                  id="ptotal"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  className={campo}
                  value={f.portas_total}
                  onChange={(e) => set("portas_total", e.target.value)}
                />
              </Campo>
              <Campo id="pocup" label="Portas ocupadas">
                <input
                  id="pocup"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className={campo}
                  value={f.portas_ocupadas}
                  onChange={(e) => set("portas_ocupadas", e.target.value)}
                />
              </Campo>
            </div>
            {cto?.portas_total != null && (
              <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={f.conferida}
                  onChange={(e) => set("conferida", e.target.checked)}
                  className="size-5 accent-[var(--primary)]"
                />
                Marcar contagem como conferida agora (mesmo sem alteração)
              </label>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Os técnicos verão o aviso “Portas não confirmadas” até a contagem ser registrada.
          </p>
        )}
      </fieldset>

      <Campo id="obs" label="Observações">
        <Textarea
          id="obs"
          value={f.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
          rows={3}
        />
      </Campo>

      {erro && (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger"
        >
          {erro}
        </p>
      )}
      <Button type="submit" size="lg" disabled={salvando}>
        {salvando && <Loader2 className="animate-spin" />}{" "}
        {cto ? "Salvar alterações" : "Cadastrar CTO"}
      </Button>
    </form>
  );
}

function Campo({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}
