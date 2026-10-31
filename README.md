# Cto Field Compass

Crie uma aplicação web mobile-first chamada "FGTECH CTO Maps", para técnicos de campo e administradores de TI de um provedor de fibra óptica localizarem CTOs (Caixas de Terminação Óptica), acompanharem as tarefas do dia e registrarem os serviços realizados. Todo o texto da interface deve estar em português do Brasil. Use React, Tailwind, Supabase (login e banco de dados) e Leaflet com tiles do OpenStreetMap para o mapa.

## Identidade visual
- Tema escuro. Fundo preto-esverdeado (#070B09), cartões #101A15, bordas sutis #1F3128, texto branco e texto secundário #8AA399.
- Cor de destaque da FGTECH: laranja vibrante #F97316 (botões principais, alertas, tarefas pendentes, marcadores de CTO lotada). Verde esmeralda #10B981 só para estados de sucesso: tarefa concluída e CTO com boa disponibilidade de portas. Vermelho (#EF4444) só para tarefa atrasada.
- Fonte Manrope no sistema inteiro e Playfair Display (serifa) no título do login.
- Cartões com cantos bem arredondados, elevação suave e botões com mais de 44px de altura para toque no celular.
- Use ícones de linha (lucide-react). Não use emojis na interface.
- Use a logo anexada da FGTECH no login e no menu lateral, sem fundo.

## 1. Tela de login (dividida em duas metades)
- Esquerda: fundo escuro com degradê e brilho laranja, linhas curvas de fibra óptica em laranja e branco, logo da FGTECH centralizada, abaixo o título "CTO Maps" e o subtítulo "FIBRA ÓPTICA & CAMPO" em letras espaçadas na cor laranja clara. O fundo se funde ao preto da metade direita.
- Direita: cartão centralizado com borda laranja translúcida, título "Acesse sua conta" em Playfair Display, subtítulo "Entre com as credenciais fornecidas pela FGTECH.", campo E-mail com ícone de envelope, campo Senha com ícone de cadeado e botão de mostrar/ocultar senha (olho / olho riscado), botão laranja "Entrar" com largura total, uma linha divisória e a nota com ícone de escudo: "Esqueceu a senha? Solicite a redefinição ao administrador da FGTECH.". Abaixo do cartão, o rodapé "© 2026 FGTECH · CTO Maps".
- Se o e-mail ou a senha estiverem errados, mostre a mensagem "E-mail ou senha incorretos. Confira os dados e tente novamente."
- Crie o usuário inicial admin123@gmail.com com senha admin123 e perfil TI (Administrador).
- No celular, a metade esquerda vira uma faixa no topo (170px) só com a logo.

## 2. Layout interno
- Menu lateral esquerdo com a logo e duas seções. "Rotina": Dashboard, Tarefas (com contador de tarefas em aberto), Mapa de CTOs. "Gestão": Histórico, Relatórios (só TI) e Configurações. No celular, vira uma barra de navegação inferior.
- Barra superior: saudação "Bom dia/Boa tarde/Boa noite, [Nome]" com a data por extenso e a hora (ex.: "sexta-feira, 30 de outubro de 2026 · 22:50"), busca global (código da CTO, cliente, endereço ou ID do serviço), sino com o número de alertas (tarefas atrasadas + serviços com problema) e avatar com nome e perfil do usuário.

## 3. Dashboard (resumo do dia)
- Linha de status "Hoje": "✓ Tudo em dia" em verde, ou "⚠ X atrasada(s) · Y com problema" em laranja. Use ícones, não emojis.
- Quatro cartões de métricas com ícone: Serviços em andamento, CTOs cadastradas, Tarefas atrasadas, Tarefas concluídas.
- Barra de filtros: Toda a equipe, Todas as situações (Atrasadas / Vencem hoje ou amanhã / Concluídas), Todos os bairros, Qualquer data (Hoje / Amanhã / Atrasadas) e o botão laranja "+ Nova tarefa". Abaixo, a legenda de cores: vermelho = urgente (atrasada), laranja = importante (hoje ou amanhã), verde = concluída.
- Quadro Kanban com três colunas: Pendentes, Em desenvolvimento e Concluídas. Cada coluna tem um ponto colorido, o contador e o link "Ver tudo →". Cada cartão de tarefa mostra o avatar do técnico (iniciais), o tipo de serviço (Nova Instalação, Troca de Porta, Manutenção Preventiva), o código da CTO, o horário, o ID do serviço (ex.: SV-1041), o nome do cliente, o endereço, a data em uma pílula, um selo laranja "Problema" quando houver, e a borda esquerda colorida conforme a urgência.
- Abaixo, abas: "Instalações de CTO", "Problemas", "Atrasos" e "Equipe", cada uma com contador. O painel lista os itens com data/hora, tipo, CTO, cliente, técnico e um selo (Atrasada / Hoje / Em N dia(s)). A aba Equipe mostra, por técnico, quantas tarefas estão em aberto e quantas foram concluídas.

## 4. Detalhes da tarefa (gaveta lateral ao clicar no cartão)
1. Mapa de prévia com a CTO destacada, o código, o bairro e as coordenadas.
2. Portas livres x ocupadas com barra de progresso.
3. Botão "Navegar até a CTO", que abre a rota no Google Maps com destino nas coordenadas.
4. Formulário "Registrar serviço": descrição do que foi feito, portas ocupadas (+/−), situação (Em desenvolvimento / Concluída). Ao salvar, grava no histórico o técnico e a data/hora automáticas, atualiza as portas da CTO e muda a coluna da tarefa.
5. Botão verde "Compartilhar no WhatsApp", com resumo formatado do serviço (ID, tipo, CTO, cliente, endereço, ação, portas, técnico e data/hora) via wa.me.
6. Botão "Reportar problema nesta CTO": marca a tarefa com problema, grava no histórico e atualiza o resumo do dashboard e o sino.
- "+ Nova tarefa" abre a mesma gaveta com: tipo de serviço, CTO destino, cliente, endereço, horário e quando (hoje/amanhã).

## 5. Mapa de CTOs
- Mapa em tela cheia (Leaflet) com marcadores personalizados: verde para boa disponibilidade de portas (25% ou mais livres), laranja para lotada/alerta, cinza para CTO desativada (só aparece para TI). Cada marcador mostra o número da CTO.
- Toque no marcador abre um cartão com o código, o bairro, as portas livres de total, o botão "Navegar" e, para TI, "Desativar/Reativar".
- Botão laranja "Localizar próximas": usa o GPS do celular, centraliza o mapa na posição do técnico (ponto azul) e lista as 3 CTOs mais próximas com a distância em metros e as portas livres.
- Filtros por capacidade (boa / lotada), bairro e código da CTO.

## 6. Histórico, Relatórios e Configurações
- Histórico: tabela com serviço, CTO, técnico, data/hora e ação, com busca.
- Relatórios (só TI): serviços concluídos, CTOs com capacidade baixa, CTOs ativas, registros no histórico e barras de serviços por tipo.
- Configurações (só TI):
  - Importação de arquivo KMZ/KML exportado do IXC Fiberdocs InMap: ler os pontos (Placemark), mostrar uma prévia com "nova" ou "duplicada" (duplicada = mesmo código ou a menos de 5 m de outra CTO), e botão "Importar novas" para gravar em lote.
  - Formulário "Nova CTO" (código, bairro, latitude, longitude, portas).
  - Tabela de CTOs com botão Desativar/Reativar. A CTO desativada mantém todo o histórico de serviços.
- Controle por perfil: só TI cadastra, edita, desativa CTOs e importa KMZ. O técnico vê as tarefas, o mapa e registra serviços.

## Dados de exemplo (para a primeira versão)
10 CTOs em Aracati-CE, com códigos CTO-ARAC-01 a CTO-ARAC-10, nos bairros Centro, Farias Brito, Santa Teresa e Cumbe, com 8 ou 16 portas e ocupações variadas (algumas lotadas). Cerca de 8 tarefas distribuídas entre os dois técnicos Rafael Lima e Diego Alves, com uma tarefa atrasada e uma com problema (CTO lotada), para o dashboard mostrar os alertas.

## Requisitos
- Responsivo, com prioridade para o celular. Foco visível no teclado e respeito a prefers-reduced-motion.
- Toasts de confirmação para as ações (registro salvo, CTO desativada, problema reportado).
- Salve tudo no Supabase (CTOs, tarefas, histórico, perfis) com autenticação e regras de acesso por perfil (TI e Técnico).

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3a76a14e-b173-5fc5-857b-388cbde4de53).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
