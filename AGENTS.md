# OG Lab Backend

Este repositório contém o backend monolítico em Node.js da rede social OG Lab. Este arquivo é o ponto de entrada para agentes de programação de qualquer fornecedor: antes de trabalhar no projeto, leia as instruções de arquitetura em [`.ai/instructions/software-architecture.instructions.md`](.ai/instructions/software-architecture.instructions.md). Para perguntas, análises ou decisões sobre a arquitetura, consulte também a skill [`.ai/skills/architecture-consultation/SKILL.md`](.ai/skills/architecture-consultation/SKILL.md).

## Diretrizes do projeto

- O backend será desenvolvido em TypeScript, usando a versão estável mais recente compatível com as dependências e ferramentas adotadas pelo projeto.
- Supabase é o primeiro serviço externo; a arquitetura deve permitir adicionar outros serviços sem acoplar regras de negócio a fornecedores.
- Redis e cache em memória fazem parte dos requisitos de cache. A política de cache e os detalhes de implementação ainda não estão definidos; não presuma TTLs, estratégias ou precedência sem uma decisão explícita.
- Preserve a separação entre entrada/rotas, domínio, repositories e clients, descrita na instrução de arquitetura. Injete dependências explicitamente e monte o grafo de dependências em um ponto de composição.
- Todo arquivo de código de produção deve ter testes unitários. A meta é 100% de cobertura; arquivos `index` que apenas reexportam módulos são a única exceção. Mudanças futuras devem preservar essa meta e acrescentar testes para novos comportamentos e caminhos de erro.
- Não presuma framework HTTP, biblioteca de injeção de dependências, organização de pastas de código, biblioteca de testes, comandos de build ou convenções de API que ainda não tenham sido escolhidos. Consulte os arquivos e configurações existentes antes de propor ou adicionar ferramentas.
- Mantenha documentação, instruções e skills em português, salvo quando um formato ou identificador técnico exigir outro idioma.

## Uso por diferentes agentes

Considere este `AGENTS.md` e os documentos referenciados como as diretrizes compartilhadas do projeto, independentemente do fornecedor ou editor. Se uma ferramenta tiver um mecanismo próprio para instruções ou skills, use-o como mecanismo de descoberta, mas mantenha estes documentos como fonte de verdade e não duplique seu conteúdo.
