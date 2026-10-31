import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FGTECH CTO Maps" },
      { name: "description", content: "Mapa de CTOs, tarefas do dia e registro de serviços da FGTECH." },
      { property: "og:title", content: "FGTECH CTO Maps" },
      { property: "og:description", content: "Mapa de CTOs, tarefas do dia e registro de serviços da FGTECH." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
