import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { iniciais, usuariosQuery, type Perfil, type Usuario } from "@/lib/fgtech";
import { alterarPerfil, criarUsuario, redefinirSenha } from "@/lib/usuarios.functions";

const campo =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary";

export function Usuarios({ meuId }: { meuId: string }) {
  const usuarios = useQuery(usuariosQuery);
  return (
    <div className="mt-2 grid gap-4 lg:grid-cols-[1fr_22rem]">
      <section>
        <h2 className="mb-2 font-bold">Usuários</h2>
        {usuarios.isLoading ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : (
          <ul className="flex flex-col gap-2">
            {usuarios.data?.map((u) => (
              <LinhaUsuario key={u.id} u={u} eu={u.id === meuId} />
            ))}
          </ul>
        )}
      </section>
      <NovoUsuario />
    </div>
  );
}

function LinhaUsuario({ u, eu }: { u: Usuario; eu: boolean }) {
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState(false);

  async function mudarPerfil(perfil: Perfil) {
    setSalvando(true);
    try {
      await alterarPerfil({ data: { userId: u.id, perfil } });
      toast.success(`${u.nome} agora é ${perfil === "ti" ? "TI" : "Técnico"}.`);
      qc.invalidateQueries({ queryKey: ["usuarios"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function novaSenha() {
    const senha = window.prompt(`Nova senha para ${u.nome} (mínimo 8 caracteres):`);
    if (!senha) return;
    try {
      await redefinirSenha({ data: { userId: u.id, senha } });
      toast.success("Senha redefinida. Informe a nova senha ao usuário.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <li className="surface flex flex-wrap items-center gap-3 p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-bold">
        {iniciais(u.nome)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">
          {u.nome}{" "}
          {eu && <span className="text-xs font-semibold text-muted-foreground">(você)</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">{u.email ?? "—"}</p>
      </div>
      <select
        aria-label={`Perfil de ${u.nome}`}
        className="h-10 rounded-xl border border-input bg-background px-2 text-sm"
        value={u.perfil}
        disabled={salvando || eu}
        onChange={(e) => mudarPerfil(e.target.value as Perfil)}
      >
        <option value="tecnico">Técnico</option>
        <option value="ti">TI</option>
      </select>
      <Button
        variant="ghost"
        size="icon"
        onClick={novaSenha}
        aria-label={`Redefinir senha de ${u.nome}`}
        title="Redefinir senha"
      >
        <KeyRound />
      </Button>
    </li>
  );
}

function NovoUsuario() {
  const qc = useQueryClient();
  const [f, setF] = useState({ nome: "", email: "", senha: "", perfil: "tecnico" as Perfil });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    if (f.senha.length < 8) return setErro("A senha precisa ter ao menos 8 caracteres.");
    setSalvando(true);
    try {
      await criarUsuario({ data: f });
      toast.success(`Usuário ${f.nome} criado.`);
      setF({ nome: "", email: "", senha: "", perfil: "tecnico" });
      qc.invalidateQueries({ queryKey: ["usuarios"] });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="surface flex h-fit flex-col gap-3 p-4" noValidate>
      <h2 className="flex items-center gap-2 font-bold">
        <UserPlus className="size-5 text-primary" aria-hidden /> Novo usuário
      </h2>
      <div>
        <label htmlFor="u-nome" className="mb-1.5 block text-sm font-semibold">
          Nome
        </label>
        <input
          id="u-nome"
          className={campo}
          value={f.nome}
          onChange={(e) => setF({ ...f, nome: e.target.value })}
        />
      </div>
      <div>
        <label htmlFor="u-email" className="mb-1.5 block text-sm font-semibold">
          E-mail
        </label>
        <input
          id="u-email"
          type="email"
          className={campo}
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
        />
      </div>
      <div>
        <label htmlFor="u-senha" className="mb-1.5 block text-sm font-semibold">
          Senha provisória
        </label>
        <input
          id="u-senha"
          type="text"
          autoComplete="new-password"
          className={campo}
          value={f.senha}
          onChange={(e) => setF({ ...f, senha: e.target.value })}
        />
      </div>
      <div>
        <label htmlFor="u-perfil" className="mb-1.5 block text-sm font-semibold">
          Perfil
        </label>
        <select
          id="u-perfil"
          className={campo}
          value={f.perfil}
          onChange={(e) => setF({ ...f, perfil: e.target.value as Perfil })}
        >
          <option value="tecnico">Técnico (consulta CTOs e registra serviços)</option>
          <option value="ti">TI (gerencia CTOs e usuários)</option>
        </select>
      </div>
      {erro && (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger"
        >
          {erro}
        </p>
      )}
      <Button type="submit" disabled={salvando}>
        {salvando && <Loader2 className="animate-spin" />} Criar usuário
      </Button>
    </form>
  );
}
