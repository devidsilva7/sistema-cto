import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Cto = Tables<"ctos">;
export type Tarefa = Tables<"tarefas">;
export type Historico = Tables<"historico">;
export type Perfil = "ti" | "tecnico";
export type Me = { id: string; email: string; nome: string; perfil: Perfil };

export const TIPOS_SERVICO = ["Nova Instalação", "Troca de Porta", "Manutenção Preventiva"] as const;
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
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
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
  const dia = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
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
export function portasLivres(c: Pick<Cto, "portas_total" | "portas_ocupadas">) {
  return Math.max(0, c.portas_total - c.portas_ocupadas);
}
/** Boa disponibilidade = 25% ou mais das portas livres. */
export function capacidadeBoa(c: Pick<Cto, "portas_total" | "portas_ocupadas">) {
  return c.portas_total > 0 && portasLivres(c) / c.portas_total >= 0.25;
}
export function numeroCto(codigo: string) {
  const m = codigo.match(/(\d+)\s*$/);
  return m ? String(Number(m[1])) : codigo.slice(-2);
}
export function distanciaM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toR = (x: number) => (x * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
export function linkRota(c: { lat: number; lng: number }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=driving`;
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
    `*Portas:* ${p.portas}/${p.cto.portas_total} ocupadas`,
    `*Técnico:* ${p.tecnico}`,
    `*Data/hora:* ${q.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`,
  ].join("\n");
}

/* ---------- KML / KMZ ---------- */
export type PontoImportado = {
  codigo: string;
  bairro: string;
  lat: number;
  lng: number;
  portas_total: number;
  situacao: "nova" | "duplicada";
  motivo?: string;
};

export function parseKml(text: string): Omit<PontoImportado, "situacao" | "motivo">[] {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  const out: Omit<PontoImportado, "situacao" | "motivo">[] = [];
  doc.querySelectorAll("Placemark").forEach((pm, i) => {
    const coords = pm.querySelector("Point coordinates")?.textContent?.trim();
    if (!coords) return;
    const [lng, lat] = coords.split(/[\s,]+/).map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const nome = pm.querySelector("name")?.textContent?.trim() || `CTO-IMP-${i + 1}`;
    const desc = pm.querySelector("description")?.textContent ?? "";
    const dados: Record<string, string> = {};
    pm.querySelectorAll("ExtendedData Data").forEach((d) => {
      dados[(d.getAttribute("name") ?? "").toLowerCase()] = d.querySelector("value")?.textContent?.trim() ?? "";
    });
    const portasTxt = dados["portas"] ?? dados["capacidade"] ?? desc.match(/(\d+)\s*portas/i)?.[1];
    const portas = Number(portasTxt) || 16;
    out.push({ codigo: nome, bairro: dados["bairro"] || "Importado", lat, lng, portas_total: portas });
  });
  return out;
}

export async function lerArquivoMapa(file: File) {
  if (file.name.toLowerCase().endsWith(".kmz")) {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(file);
    const kml = Object.values(zip.files).find((f) => f.name.toLowerCase().endsWith(".kml"));
    if (!kml) throw new Error("Nenhum arquivo KML dentro do KMZ.");
    return parseKml(await kml.async("text"));
  }
  return parseKml(await file.text());
}

/** Duplicada = mesmo código ou a menos de 5 m de outra CTO (existente ou já na lista). */
export function classificarPontos(
  pontos: Omit<PontoImportado, "situacao" | "motivo">[],
  existentes: Pick<Cto, "codigo" | "lat" | "lng">[],
): PontoImportado[] {
  const aceitos: { codigo: string; lat: number; lng: number }[] = [...existentes];
  return pontos.map((p) => {
    const mesmoCodigo = aceitos.find((e) => e.codigo.toLowerCase() === p.codigo.toLowerCase());
    if (mesmoCodigo) return { ...p, situacao: "duplicada", motivo: "Mesmo código" };
    const perto = aceitos.find((e) => distanciaM(e, p) < 5);
    if (perto) return { ...p, situacao: "duplicada", motivo: `A menos de 5 m de ${perto.codigo}` };
    aceitos.push(p);
    return { ...p, situacao: "nova" };
  });
}
