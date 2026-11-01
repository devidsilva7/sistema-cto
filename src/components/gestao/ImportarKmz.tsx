import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleHelp, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  classificarPontos,
  ctosQuery,
  lerArquivoMapa,
  mensagemErro,
  normalizar,
  type PontoClassificado,
  type ResumoKml,
  type SituacaoImport,
} from "@/lib/fgtech";
import { cn } from "@/lib/utils";

const ROTULO: Record<SituacaoImport, { txt: string; cor: string }> = {
  nova: { txt: "Nova", cor: "bg-success/15 text-success" },
  mover: { txt: "Atualizar localização", cor: "bg-info/15 text-info" },
  igual: { txt: "Já cadastrada", cor: "bg-secondary text-muted-foreground" },
  duplicada: { txt: "Possível duplicada", cor: "bg-primary/15 text-primary" },
  repetida: { txt: "Repetida no arquivo", cor: "bg-secondary text-muted-foreground" },
};

const campo =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary";

export function ImportarKmz() {
  const ctos = useQuery(ctosQuery);
  const qc = useQueryClient();
  const [arquivo, setArquivo] = useState("");
  const [resumo, setResumo] = useState<ResumoKml | null>(null);
  const [lendo, setLendo] = useState(false);
  const [pastas, setPastas] = useState<Set<string>>(new Set());
  const [filtroNome, setFiltroNome] = useState("");
  const [bairroPadrao, setBairroPadrao] = useState("Não informado");
  const [atualizarLocal, setAtualizarLocal] = useState(true);
  const [importando, setImportando] = useState(false);

  async function ler(file: File) {
    setLendo(true);
    setResumo(null);
    try {
      const r = await lerArquivoMapa(file);
      setArquivo(file.name);
      setResumo(r);
      setPastas(new Set(r.pastas));
      if (!r.pontos.length)
        toast.error("Nenhum ponto (Placemark com coordenada) encontrado no arquivo.");
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível ler o arquivo.");
    } finally {
      setLendo(false);
    }
  }

  const classificados = useMemo(() => {
    if (!resumo) return [];
    const f = normalizar(filtroNome);
    const pontos = resumo.pontos.filter(
      (p) => pastas.has(p.pasta) && (!f || normalizar(p.codigo).includes(f)),
    );
    return classificarPontos(pontos, ctos.data ?? []);
  }, [resumo, pastas, filtroNome, ctos.data]);

  const contagem = useMemo(() => {
    const c: Record<SituacaoImport, number> = {
      nova: 0,
      mover: 0,
      igual: 0,
      duplicada: 0,
      repetida: 0,
    };
    classificados.forEach((p) => c[p.situacao]++);
    return c;
  }, [classificados]);

  const novas = classificados.filter((p) => p.situacao === "nova");
  const mover = atualizarLocal ? classificados.filter((p) => p.situacao === "mover") : [];

  async function importar() {
    setImportando(true);
    let inseridas = 0;
    let atualizadas = 0;
    const falhas: string[] = [];
    const linha = (p: PontoClassificado) => ({
      codigo: p.codigo,
      bairro: p.bairro || bairroPadrao.trim() || "Não informado",
      lat: p.lat,
      lng: p.lng,
      origem: "kmz",
      ref_externa: p.ref,
      portas_total: p.portas_total,
      portas_ocupadas: p.portas_ocupadas,
      observacoes: p.descricao ? p.descricao.slice(0, 1000) : null,
    });

    for (let i = 0; i < novas.length; i += 200) {
      const lote = novas.slice(i, i + 200);
      const { error } = await supabase.from("ctos").insert(lote.map(linha));
      if (!error) {
        inseridas += lote.length;
        continue;
      }
      // Lote recusado (ex.: duplicada criada ao mesmo tempo): tenta um a um para não perder o restante
      for (const p of lote) {
        const r = await supabase.from("ctos").insert(linha(p));
        if (r.error) falhas.push(`${p.codigo}: ${mensagemErro(r.error)}`);
        else inseridas++;
      }
    }
    for (const p of mover) {
      const { error } = await supabase
        .from("ctos")
        .update({ lat: p.lat, lng: p.lng, ...(p.ref ? { ref_externa: p.ref } : {}) })
        .eq("id", p.existenteId!);
      if (error) falhas.push(`${p.codigo}: ${mensagemErro(error)}`);
      else atualizadas++;
    }

    await qc.invalidateQueries({ queryKey: ["ctos"] });
    await qc.invalidateQueries({ queryKey: ["historico"] });
    setImportando(false);
    if (falhas.length) {
      toast.error(`${falhas.length} ponto(s) não importado(s)`, {
        description: falhas.slice(0, 5).join("\n"),
      });
    }
    toast.success(
      `Importação concluída: ${inseridas} nova(s), ${atualizadas} localização(ões) atualizada(s).`,
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-4">
      <section className="surface p-4">
        <h2 className="font-bold">Arquivo do IXC Fiberdocs InMap</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie o arquivo .kmz ou .kml exportado. Antes de gravar, o sistema mostra o que foi
          encontrado e evita duplicadas (mesmo código, mesma referência do arquivo ou outra CTO a
          menos de 5 m).
        </p>
        <label className="mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 text-center hover:bg-secondary focus-within:border-primary">
          {lendo ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <FileUp className="size-6 text-primary" aria-hidden />
          )}
          <span className="text-sm font-semibold">
            {arquivo || "Selecionar arquivo KMZ ou KML"}
          </span>
          <input
            type="file"
            accept=".kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) ler(f);
              e.target.value = "";
            }}
          />
        </label>
      </section>

      {resumo && (
        <>
          <section className="surface p-4" aria-labelledby="kmz-conteudo">
            <h2 id="kmz-conteudo" className="font-bold">
              O que o arquivo contém
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              <li>
                {resumo.totalPlacemarks} elemento(s); <strong>{resumo.pontos.length}</strong>{" "}
                ponto(s) com coordenada
                {resumo.semPonto > 0 &&
                  ` · ${resumo.semPonto} ignorado(s) por não serem pontos (cabos, áreas)`}
              </li>
              <li>Nome do ponto: usado como código da CTO</li>
              <li>
                Descrição:{" "}
                {resumo.temDescricao
                  ? "presente (será guardada nas observações)"
                  : "não encontrada"}
              </li>
              <li>Campos extras: {resumo.campos.length ? resumo.campos.join(", ") : "nenhum"}</li>
            </ul>
            {resumo.temPortas ? (
              <p className="mt-3 flex gap-2 rounded-xl bg-success/10 p-3 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                Alguns pontos trazem campo de portas. Esses valores serão importados; os demais
                ficam como não confirmados.
              </p>
            ) : (
              <p className="mt-3 flex gap-2 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm">
                <CircleHelp className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />O arquivo
                não informa portas. As CTOs importadas ficarão com “Portas não confirmadas” até a TI
                registrar a contagem.
              </p>
            )}
            {resumo.pontos[0] && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-semibold">
                  Ver dados do primeiro ponto
                </summary>
                <pre className="mt-2 max-h-60 overflow-auto rounded-xl bg-background p-3 text-xs">
                  {JSON.stringify(
                    {
                      nome: resumo.pontos[0].codigo,
                      pasta: resumo.pontos[0].pasta,
                      descricao: resumo.pontos[0].descricao,
                      ...resumo.pontos[0].dados,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            )}
          </section>

          <section className="surface flex flex-col gap-3 p-4">
            <h2 className="font-bold">O que importar</h2>
            {resumo.pastas.length > 1 && (
              <fieldset>
                <legend className="mb-1 text-sm font-semibold">Pastas do arquivo</legend>
                <div className="flex flex-col">
                  {resumo.pastas.map((p) => (
                    <label key={p} className="flex min-h-10 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={pastas.has(p)}
                        onChange={(e) => {
                          const n = new Set(pastas);
                          if (e.target.checked) n.add(p);
                          else n.delete(p);
                          setPastas(n);
                        }}
                        className="size-5 accent-[var(--primary)]"
                      />
                      {p} ({resumo.pontos.filter((x) => x.pasta === p).length})
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="kmz-filtro" className="mb-1.5 block text-sm font-semibold">
                  Só nomes que contenham
                </label>
                <input
                  id="kmz-filtro"
                  className={campo}
                  value={filtroNome}
                  onChange={(e) => setFiltroNome(e.target.value)}
                  placeholder="Ex.: CTO"
                />
              </div>
              <div>
                <label htmlFor="kmz-bairro" className="mb-1.5 block text-sm font-semibold">
                  Bairro para pontos sem bairro
                </label>
                <input
                  id="kmz-bairro"
                  className={campo}
                  value={bairroPadrao}
                  onChange={(e) => setBairroPadrao(e.target.value)}
                />
              </div>
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={atualizarLocal}
                onChange={(e) => setAtualizarLocal(e.target.checked)}
                className="size-5 accent-[var(--primary)]"
              />
              Atualizar a localização das CTOs já cadastradas que mudaram no arquivo
            </label>

            <div className="flex flex-wrap gap-2 text-xs">
              {(Object.keys(ROTULO) as SituacaoImport[]).map((s) => (
                <span key={s} className={cn("rounded-full px-2.5 py-1 font-bold", ROTULO[s].cor)}>
                  {ROTULO[s].txt}: {contagem[s]}
                </span>
              ))}
            </div>

            <Button
              size="lg"
              onClick={importar}
              disabled={importando || novas.length + mover.length === 0}
            >
              {importando && <Loader2 className="animate-spin" />}
              Importar {novas.length} nova(s){mover.length > 0 && ` e atualizar ${mover.length}`}
            </Button>
            {contagem.duplicada > 0 && (
              <p className="text-xs text-muted-foreground">
                Possíveis duplicadas não são importadas. Se forem CTOs diferentes, cadastre
                manualmente após conferir.
              </p>
            )}
          </section>

          <section aria-labelledby="kmz-previa">
            <h2 id="kmz-previa" className="mb-2 font-bold">
              Prévia ({classificados.length})
            </h2>
            <ul className="flex flex-col gap-1.5">
              {classificados.slice(0, 300).map((p, i) => (
                <li
                  key={`${p.codigo}-${i}`}
                  className="surface flex items-center gap-3 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.codigo}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.lat.toFixed(6)}, {p.lng.toFixed(6)}
                      {p.portas_total != null && ` · ${p.portas_total} portas`}
                      {p.motivo && ` · ${p.motivo}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                      ROTULO[p.situacao].cor,
                    )}
                  >
                    {ROTULO[p.situacao].txt}
                  </span>
                </li>
              ))}
            </ul>
            {classificados.length > 300 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Mostrando 300 de {classificados.length}.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
