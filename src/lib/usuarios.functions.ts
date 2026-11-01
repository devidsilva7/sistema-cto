import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// Gestão de usuários exige a chave de serviço, então roda só no servidor e apenas para a TI.
async function exigirTi(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "ti" });
  if (!data) throw new Error("Apenas a equipe de TI pode gerenciar usuários.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const perfil = z.enum(["ti", "tecnico"]);

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      nome: z.string().trim().min(2, "Informe o nome"),
      email: z.string().trim().email("E-mail inválido"),
      senha: z.string().min(8, "A senha precisa ter ao menos 8 caracteres"),
      perfil,
    }),
  )
  .handler(async ({ data, context }) => {
    const admin = await exigirTi(context.supabase, context.userId);
    const { error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome, perfil: data.perfil },
    });
    if (error) {
      throw new Error(
        /already|registered|exists/i.test(error.message)
          ? "Já existe um usuário com esse e-mail."
          : error.message,
      );
    }
    return { ok: true };
  });

export const alterarPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ userId: z.string().uuid(), perfil }))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId && data.perfil !== "ti") {
      throw new Error("Você não pode remover o seu próprio acesso de TI.");
    }
    const admin = await exigirTi(context.supabase, context.userId);
    const { error: e1 } = await admin.from("user_roles").delete().eq("user_id", data.userId);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await admin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.perfil });
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

export const redefinirSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      userId: z.string().uuid(),
      senha: z.string().min(8, "A senha precisa ter ao menos 8 caracteres"),
    }),
  )
  .handler(async ({ data, context }) => {
    const admin = await exigirTi(context.supabase, context.userId);
    const { error } = await admin.auth.admin.updateUserById(data.userId, { password: data.senha });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
