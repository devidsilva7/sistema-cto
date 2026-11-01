import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Cto = Tables<"ctos">;
export type Tarefa = Tables<"tarefas">;
export type Historico = Tables<"historico">;
export type Perfil = "ti" | "tecnico";
export type Me = { id: string; email: string; nome: string; perfil: Perfil };

export const TIPOS_SERVICO = [
  "Nova Instalação",
  "Troca de Porta",
  "Manutenção Preventiva",
] as const;
export const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendentes",
  andamento: "Em desenvolvimento",
  concluida: "Concluídas",
};

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<Me> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Sem sessão");
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("nome").eq("id", u.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
    ]);
    const perfil: Perfil = r?.some((x) => x.role === "ti") ? "ti" : "tecnico";
    return { id: u.user.id, email: u.user.email ?? "", nome: p?.nome ?? "Usuário", perfil };
  },
});

export const ctosQuery = queryOptions({
  queryKey: ["ctos"],
  queryFn: async () => {
    const { data, error } = await supabase.from("ctos").select("*").order("codigo");
    if (error) throw error;
    return data;
  },
});

export const tarefasQuery = queryOptions({
  queryKey: ["tarefas"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("tarefas")
      .select("*")
      .order("data")
      .order("horario");
    if (error) throw error;
    return data;
  },
});

export const historicoQuery = queryOptions({
  queryKey: ["historico"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("historico")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return data;
  },
});

export const historicoCtoQuery = (ctoId: string) =>
  queryOptions({
    queryKey: ["historico", "cto", ctoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historico")
        .select("*")
        .eq("cto_id", ctoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export type Usuario = { id: string; nome: string; email: string | null; perfil: Perfil };
export const usuariosQuery = queryOptions({
  queryKey: ["usuarios"],
  queryFn: async (): Promise<Usuario[]> => {
    const [{ data: p, error }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id,nome,email").order("nome"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    if (error) throw error;
    const ti = new Set((r ?? []).filter((x) => x.role === "ti").map((x) => x.user_id));
    return (p ?? []).map((u) => ({ ...u, perfil: ti.has(u.id) ? "ti" : "tecnico" }));
  },
});

/** Mensagem legível para erros do Supabase (inclui as exceções das funções do banco). */
export function mensagemErro(e: unknown) {
  const err = e as { message?: string; code?: string } | null;
  if (err?.code === "23505") return "Já existe uma CTO com esse código.";
  if (err?.code === "42501") return "Você não tem permissão para esta ação.";
  const m = err?.message ?? "Erro inesperado.";
  return m.charAt(0).toUpperCase() + m.slice(1);
}

/* ---------- datas ---------- */
export function isoLocal(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
export function diasAte(data: string, hoje = new Date()) {
  const a = new Date(data + "T00:00:00");
  const b = new Date(isoLocal(hoje) + "T00:00:00");
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
export type Urgencia = "atrasada" | "importante" | "concluida" | "normal";
export function urgencia(t: Pick<Tarefa, "status" | "data">, hoje = new Date()): Urgencia {
  if (t.status === "concluida") return "concluida";
  const d = diasAte(t.data, hoje);
  if (d < 0) return "atrasada";
  if (d <= 1) return "importante";
  return "normal";
}
export function seloPrazo(t: Pick<Tarefa, "status" | "data">, hoje = new Date()) {
  if (t.status === "concluida") return "Concluída";
  const d = diasAte(t.data, hoje);
  if (d < 0) return "Atrasada";
  if (d === 0) return "Hoje";
  return `Em ${d} dia${d > 1 ? "s" : ""}`;
}
export function dataCurta(data: string) {
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}
export function hora(h: string) {
  return h.slice(0, 5);
}
export function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
export function saudacao(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}
export function dataExtenso(d = new Date()) {
  const dia = d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const h = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dia} · ${h}`;
}
export function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/* ---------- CTOs ---------- */
export const SERVICOS_CTO = [
  "Instalação de cliente",
  "Manutenção",
  "Troca de porta",
  "Retirada de cliente",
  "Vistoria",
  "Outro",
] as const;

/** Após esse prazo sem conferência, a contagem de portas é sinalizada como possivelmente desatualizada. */
export const DIAS_PORTAS_VALIDAS = 90;

type PortasCto = Pick<Cto, "portas_total" | "portas_ocupadas">;

export function portasConhecidas(
  c: PortasCto,
): c is PortasCto & { portas_total: number; portas_ocupadas: number } {
  return c.portas_total != null && c.portas_ocupadas != null;
}
export function portasLivres(c: PortasCto) {
  return portasConhecidas(c) ? Math.max(0, c.portas_total - c.portas_ocupadas) : null;
}
export type Capacidade = "boa" | "baixa" | "lotada" | "desconhecida";
/** Boa disponibilidade = 25% ou mais das portas livres. */
export function capacidade(c: PortasCto): Capacidade {
  const livres = portasLivres(c);
  if (livres == null || !c.portas_total) return "desconhecida";
  if (livres === 0) return "lotada";
  return livres / c.portas_total >= 0.25 ? "boa" : "baixa";
}
export function portasDesatualizadas(c: Pick<Cto, "portas_atualizadas_em">, hoje = new Date()) {
  if (!c.portas_atualizadas_em) return false;
  return (
    hoje.getTime() - new Date(c.portas_atualizadas_em).getTime() > DIAS_PORTAS_VALIDAS * 86400000
  );
}
export function resumoPortas(c: PortasCto) {
  const livres = portasLivres(c);
  return livres == null ? "Portas não confirmadas" : `${livres} de ${c.portas_total} livres`;
}
export function nomeCto(c: Pick<Cto, "codigo" | "nome">) {
  return c.nome && c.nome !== c.codigo ? `${c.codigo} · ${c.nome}` : c.codigo;
}
export function numeroCto(codigo: string) {
  const m = codigo.match(/(\d+)\s*$/);
  return m ? String(Number(m[1])) : codigo.slice(-2);
}
export function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
/** Busca por código, nome, bairro ou endereço, ignorando acentos e maiúsculas. */
export function filtrarCtos<T extends Pick<Cto, "codigo" | "nome" | "bairro" | "endereco">>(
  ctos: T[],
  termo: string,
) {
  const q = normalizar(termo);
  if (!q) return ctos;
  const qCompacto = q.replace(/[\s-]/g, "");
  return ctos.filter((c) => {
    const alvo = normalizar([c.codigo, c.nome, c.bairro, c.endereco].filter(Boolean).join(" "));
    return alvo.includes(q) || normalizar(c.codigo).replace(/[\s-]/g, "").includes(qCompacto);
  });
}
export function distanciaM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toR = (x: number) => (x * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
export function formatarDistancia(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}
export function maisProximas<T extends { lat: number; lng: number }>(
  ctos: T[],
  ref: { lat: number; lng: number },
  n = 5,
) {
  return ctos
    .map((c) => ({ cto: c, dist: distanciaM(ref, c) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, n);
}
export function linkRota(c: { lat: number; lng: number }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=driving`;
}
export function linkMapa(c: { lat: number; lng: number }) {
  return `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
}
export function linkWhatsApp(texto: string) {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

export function textoWhatsApp(p: {
  tarefa: Tarefa;
  cto: Cto;
  acao: string;
  portas: number;
  tecnico: string;
  quando?: Date;
}) {
  const q = p.quando ?? new Date();
  return [
    `*FGTECH · Registro de serviço*`,
    `*ID:* ${p.tarefa.servico_id}`,
    `*Tipo:* ${p.tarefa.tipo}`,
    `*CTO:* ${p.cto.codigo} (${p.cto.bairro})`,
    `*Cliente:* ${p.tarefa.cliente}`,
    `*Endereço:* ${p.tarefa.endereco}`,
    `*Ação:* ${p.acao}`,
    `*Portas:* ${p.portas}${p.cto.portas_total != null ? `/${p.cto.portas_total}` : ""} ocupadas`,
    `*Técnico:* ${p.tecnico}`,
    `*Data/hora:* ${q.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`,
  ].join("\n");
}

/** Resumo de um registro do histórico da CTO para compartilhar no WhatsApp. */
export function textoRegistroWhatsApp(
  r: Pick<
    Historico,
    "acao" | "descricao" | "portas_utilizadas" | "portas_ocupadas_obs" | "tecnico" | "created_at"
  >,
  cto: Pick<Cto, "codigo" | "nome" | "bairro" | "lat" | "lng">,
) {
  return [
    `*FGTECH · Serviço na CTO*`,
    `*CTO:* ${nomeCto(cto)} (${cto.bairro})`,
    `*Serviço:* ${r.acao}`,
    r.descricao ? `*O que foi feito:* ${r.descricao}` : null,
    r.portas_utilizadas ? `*Portas utilizadas/alteradas:* ${r.portas_utilizadas}` : null,
    r.portas_ocupadas_obs != null ? `*Portas ocupadas no local:* ${r.portas_ocupadas_obs}` : null,
    `*Técnico:* ${r.tecnico}`,
    `*Data/hora:* ${dataHora(r.created_at)}`,
    `*Localização:* ${linkMapa(cto)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function textoCtoWhatsApp(c: Cto) {
  return [
    `*FGTECH · ${nomeCto(c)}*`,
    `*Bairro:* ${c.bairro}`,
    c.endereco ? `*Endereço:* ${c.endereco}` : null,
    `*Portas:* ${resumoPortas(c)}`,
    `*Localização:* ${linkMapa(c)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/* ---------- Busca de endereço (OpenStreetMap / Nominatim) ---------- */
export type ResultadoEndereco = { nome: string; lat: number; lng: number };

export async function buscarEndereco(
  q: string,
  perto?: { lat: number; lng: number },
): Promise<ResultadoEndereco[]> {
  const params = new URLSearchParams({
    format: "jsonv2",
    q,
    limit: "5",
    countrycodes: "br",
    "accept-language": "pt-BR",
  });
  if (perto) {
    const d = 0.25; // ~25 km: prioriza resultados na região das CTOs, sem excluir os demais
    params.set("viewbox", `${perto.lng - d},${perto.lat + d},${perto.lng + d},${perto.lat - d}`);
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Falha na busca de endereço");
  const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return data.map((r) => ({ nome: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
}

export function posicaoAtual(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Este aparelho não oferece localização."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? "Permita o acesso à localização no navegador para encontrar CTOs próximas."
              : "Não foi possível obter sua localização. Tente novamente em local aberto.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}

/* ---------- KML / KMZ ---------- */
export type PontoKml = {
  ref: string | null;
  codigo: string;
  pasta: string;
  lat: number;
  lng: number;
  descricao: string;
  dados: Record<string, string>;
  portas_total: number | null;
  portas_ocupadas: number | null;
  bairro: string | null;
};

export type ResumoKml = {
  pontos: PontoKml[];
  totalPlacemarks: number;
  semPonto: number;
  pastas: string[];
  campos: string[];
  temDescricao: boolean;
  temPortas: boolean;
};

function filhoDireto(el: Element, tag: string) {
  return Array.from(el.children).find((c) => c.localName === tag) ?? null;
}

function textoDescricao(html: string) {
  if (!html.includes("<")) return html.trim();
  const d = new DOMParser().parseFromString(html, "text/html");
  return (d.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

function inteiro(v: string | undefined) {
  if (!v) return null;
  const m = v.match(/\d+/);
  return m ? Number(m[0]) : null;
}

/**
 * Lê os Placemarks de ponto do KML. Não presume portas: só preenche quando o arquivo traz
 * explicitamente um campo de portas/capacidade (ExtendedData).
 */
export function parseKml(text: string): ResumoKml {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Arquivo KML inválido.");
  const placemarks = Array.from(doc.getElementsByTagName("Placemark"));
  const pontos: PontoKml[] = [];
  const campos = new Set<string>();
  const pastas = new Set<string>();
  let semPonto = 0;
  let temDescricao = false;

  placemarks.forEach((pm, i) => {
    const point = pm.getElementsByTagName("Point")[0];
    const coords = point?.getElementsByTagName("coordinates")[0]?.textContent?.trim();
    const partes = coords?.split(/[\s,]+/).map(Number) ?? [];
    const lng = partes[0];
    const lat = partes[1];
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      semPonto++;
      return;
    }
    const nomes: string[] = [];
    for (let p = pm.parentElement; p; p = p.parentElement) {
      if (p.localName === "Folder") {
        const n = filhoDireto(p, "name")?.textContent?.trim();
        if (n) nomes.unshift(n);
      }
    }
    const pasta = nomes.join(" / ") || "(sem pasta)";
    pastas.add(pasta);

    const dados: Record<string, string> = {};
    Array.from(pm.getElementsByTagName("Data")).forEach((d) => {
      const k = d.getAttribute("name");
      if (k) dados[k] = d.getElementsByTagName("value")[0]?.textContent?.trim() ?? "";
    });
    Array.from(pm.getElementsByTagName("SimpleData")).forEach((d) => {
      const k = d.getAttribute("name");
      if (k) dados[k] = d.textContent?.trim() ?? "";
    });
    Object.keys(dados).forEach((k) => campos.add(k));

    const descricao = textoDescricao(filhoDireto(pm, "description")?.textContent ?? "");
    if (descricao) temDescricao = true;

    const chave = (re: RegExp) => Object.keys(dados).find((k) => re.test(normalizar(k)));
    const kTotal = chave(/^(portas?|qtd.?portas|total.?portas|portas.?total|capacidade)$/);
    const kOcup = chave(/ocupad|em.?uso|utilizad/);
    const kBairro = chave(/^bairro$/);
    const total = inteiro(kTotal ? dados[kTotal] : undefined);
    const ocup = inteiro(kOcup ? dados[kOcup] : undefined);

    pontos.push({
      ref: pm.getAttribute("id"),
      codigo: filhoDireto(pm, "name")?.textContent?.trim() || `SEM-NOME-${i + 1}`,
      pasta,
      lat,
      lng,
      descricao,
      dados,
      portas_total: total && total > 0 ? total : null,
      portas_ocupadas: total && ocup != null && ocup <= total ? ocup : null,
      bairro: kBairro ? dados[kBairro] || null : null,
    });
  });

  return {
    pontos,
    totalPlacemarks: placemarks.length,
    semPonto,
    pastas: [...pastas].sort(),
    campos: [...campos].sort(),
    temDescricao,
    temPortas: pontos.some((p) => p.portas_total != null),
  };
}

export async function lerArquivoMapa(file: File) {
  if (file.name.toLowerCase().endsWith(".kmz")) {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(file);
    const kml =
      zip.file(/(^|\/)doc\.kml$/i)[0] ??
      Object.values(zip.files).find((f) => f.name.toLowerCase().endsWith(".kml"));
    if (!kml) throw new Error("Nenhum arquivo KML dentro do KMZ.");
    return parseKml(await kml.async("text"));
  }
  return parseKml(await file.text());
}

export type SituacaoImport = "nova" | "mover" | "igual" | "duplicada" | "repetida";
export type PontoClassificado = PontoKml & {
  situacao: SituacaoImport;
  motivo?: string;
  existenteId?: string;
};

/** Raio usado para considerar dois pontos a mesma CTO. */
export const RAIO_DUPLICADA_M = 5;

/**
 * Classifica cada ponto do arquivo em relação às CTOs já cadastradas:
 * - mesma referência do KMZ ou mesmo código → atualização (ou nada a fazer, se no mesmo lugar);
 * - outro código a menos de 5 m → possível duplicada (não importa);
 * - código repetido no próprio arquivo → ignorado.
 */
export function classificarPontos(
  pontos: PontoKml[],
  existentes: Pick<Cto, "id" | "codigo" | "lat" | "lng" | "ref_externa">[],
): PontoClassificado[] {
  const porRef = new Map(existentes.filter((e) => e.ref_externa).map((e) => [e.ref_externa!, e]));
  const porCodigo = new Map(existentes.map((e) => [normalizar(e.codigo), e]));
  const vistos = new Set<string>();
  const novas: { codigo: string; lat: number; lng: number }[] = [];

  return pontos.map((p): PontoClassificado => {
    const cod = normalizar(p.codigo);
    if (vistos.has(cod))
      return { ...p, situacao: "repetida", motivo: "Código repetido no arquivo" };
    vistos.add(cod);

    const match = (p.ref && porRef.get(p.ref)) || porCodigo.get(cod);
    if (match) {
      const d = distanciaM(match, p);
      return d < 1
        ? {
            ...p,
            situacao: "igual",
            existenteId: match.id,
            motivo: `Já cadastrada (${match.codigo})`,
          }
        : {
            ...p,
            situacao: "mover",
            existenteId: match.id,
            motivo: `${match.codigo}: localização difere ${formatarDistancia(d)}`,
          };
    }
    const perto = [...existentes, ...novas].find((e) => distanciaM(e, p) < RAIO_DUPLICADA_M);
    if (perto)
      return {
        ...p,
        situacao: "duplicada",
        motivo: `A menos de ${RAIO_DUPLICADA_M} m de ${perto.codigo}`,
      };
    novas.push(p);
    return { ...p, situacao: "nova" };
  });
}
