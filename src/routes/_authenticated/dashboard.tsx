import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { TaskCard } from "@/components/TaskCard";
import {
  ctosQuery,
  meQuery,
  saudacao,
  dataExtenso,
  tarefasQuery,
  STATUS_LABEL,
} from "@/lib/fgtech";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · FGTECH CTO Maps" }] }),
  component: Dashboard,
});

function Dashboard() {
  const me = useQuery(meQuery);
  const tarefas = useQuery(tarefasQuery);
  const ctos = useQuery(ctosQuery);
  const [, setSel] = useState<string | null>(null);
  const ctoById = new Map((ctos.data ?? []).map((c) => [c.id, c]));

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <header>
        <h1 className="text-2xl font-extrabold">
          {saudacao()}, {me.data?.nome ?? ""}
        </h1>
        <p className="text-sm text-muted-foreground">{dataExtenso()}</p>
      </header>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {(["pendente", "andamento", "concluida"] as const).map((s) => (
          <section key={s} className="space-y-3">
            <h2 className="font-bold">{STATUS_LABEL[s]}</h2>
            {(tarefas.data ?? [])
              .filter((t) => t.status === s)
              .map((t) => (
                <TaskCard
                  key={t.id}
                  t={t}
                  cto={ctoById.get(t.cto_id)}
                  onClick={() => setSel(t.id)}
                />
              ))}
          </section>
        ))}
      </div>
    </div>
  );
}
