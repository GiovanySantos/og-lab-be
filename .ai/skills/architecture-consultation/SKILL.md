---
name: architecture-consultation
description: "Consultar ou explicar a arquitetura de software do backend OG Lab, avaliar em qual camada uma responsabilidade deve ficar e orientar fluxos de dependência entre rotas, domain, repositories, clients, Supabase e cache."
---

# Consulta de arquitetura

Use esta skill quando alguém pedir para explicar, avaliar ou aplicar a arquitetura do backend OG Lab, incluindo decisões sobre camadas, injeção de dependências, fluxo de dados, Supabase ou cache.

## Procedimento

1. Leia [a instrução de arquitetura](../../instructions/software-architecture.instructions.md) e use-a como fonte de verdade.
2. Identifique o fluxo ou a responsabilidade em questão e localize-a na camada adequada:
   - entrada/transporte e roteamento;
   - regras e casos de uso de negócio (`domain`);
   - adaptação de contratos e acesso a dados (`repositories`);
   - integração técnica com fornecedores e cache (`clients/adapters`).
3. Descreva o caminho da dependência e da chamada. Para o feed, por exemplo: rota → domínio de feed → repository de feed → client do Supabase.
4. Verifique se as dependências são injetadas e se detalhes externos permanecem nas bordas. Aponte acoplamentos entre camadas ou regras de negócio que tenham sido colocadas em clients ou rotas.
5. Diferencie decisões já estabelecidas de decisões em aberto. Não invente framework, biblioteca de DI, política de cache, TTL, invalidação, contrato de API ou organização física de código.
6. Ao recomendar uma mudança, indique os testes unitários que devem acompanhar a alteração, preservando a meta de 100% de cobertura definida na instrução.

## Limites

- Esta skill orienta consultas e decisões arquiteturais; não autoriza introduzir tecnologias ou políticas ainda não escolhidas.
- Quando várias soluções compatíveis forem possíveis, explique a opção mais simples e explicite as premissas, sem apresentar uma premissa como decisão já tomada.
