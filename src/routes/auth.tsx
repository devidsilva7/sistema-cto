import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Lock, Mail, ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logo from "@/assets/fgtech-logo.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · FGTECH CTO Maps" },
      { name: "description", content: "Acesse o FGTECH CTO Maps com as credenciais fornecidas pela FGTECH." },
      { property: "og:title", content: "Entrar · FGTECH CTO Maps" },
      { property: "og:description", content: "Acesso para técnicos de campo e TI da FGTECH." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function FiberLines() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 600 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <g fill="none" strokeLinecap="round">
        <path d="M-40 620 C 160 520, 260 700, 640 420" className="stroke-primary" strokeOpacity=".55" strokeWidth="2" />
        <path d="M-40 660 C 180 560, 300 740, 640 470" className="stroke-primary-soft" strokeOpacity=".35" strokeWidth="1.2" />
        <path d="M-40 180 C 200 300, 340 80, 640 220" className="stroke-foreground" strokeOpacity=".18" strokeWidth="1" />
        <path d="M-40 230 C 220 340, 360 130, 640 270" className="stroke-primary" strokeOpacity=".3" strokeWidth="1.4" />
        <path d="M-40 720 C 220 640, 380 800, 640 600" className="stroke-foreground" strokeOpacity=".12" strokeWidth="1" />
      </g>
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setCarregando(false);
    if (error) {
      setErro("E-mail ou senha incorretos. Confira os dados e tente novamente.");
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      {/* Metade esquerda / faixa mobile */}
      <div className="login-bg relative flex h-[170px] shrink-0 items-center justify-center overflow-hidden md:h-auto md:w-1/2">
        <FiberLines />
        <div className="relative flex flex-col items-center text-center">
          <img src={logo} alt="FGTECH" width={1024} height={1024} className="h-28 w-28 object-contain md:h-56 md:w-56" />
          <h1 className="mt-2 hidden text-4xl font-extrabold tracking-tight md:block">CTO Maps</h1>
          <p className="eyebrow mt-3 hidden text-primary-soft md:block">Fibra óptica &amp; campo</p>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-40 bg-gradient-to-r from-transparent to-background md:block" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-background md:hidden" />
      </div>

      {/* Metade direita */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-8">
        <form
          onSubmit={entrar}
          className="surface w-full max-w-md border-primary/30 p-6 sm:p-8"
          noValidate
        >
          <h2 className="font-display text-3xl font-bold">Acesse sua conta</h2>
          <p className="mt-2 text-sm text-muted-foreground">Entre com as credenciais fornecidas pela FGTECH.</p>

          <label htmlFor="email" className="mt-7 block text-sm font-semibold">E-mail</label>
          <div className="relative mt-2">
            <Mail className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@fgtech.com.br"
              className="h-12 w-full rounded-xl border border-input bg-background pl-11 pr-4 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary"
            />
          </div>

          <label htmlFor="senha" className="mt-5 block text-sm font-semibold">Senha</label>
          <div className="relative mt-2">
            <Lock className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id="senha"
              type={mostrar ? "text" : "password"}
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              className="h-12 w-full rounded-xl border border-input bg-background pl-11 pr-12 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary"
            />
            <button
              type="button"
              onClick={() => setMostrar((v) => !v)}
              aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
            >
              {mostrar ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>

          {erro && (
            <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
              {erro}
            </p>
          )}

          <Button type="submit" size="lg" className="mt-6 w-full" disabled={carregando}>
            {carregando && <Loader2 className="animate-spin" />} Entrar
          </Button>

          <div className="my-6 h-px bg-border" />
          <p className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            Esqueceu a senha? Solicite a redefinição ao administrador da FGTECH.
          </p>
        </form>
        <p className="mt-6 text-xs text-muted-foreground">© 2026 FGTECH · CTO Maps</p>
      </div>
    </div>
  );
}
