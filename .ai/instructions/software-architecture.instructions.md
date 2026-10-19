# Instrução de arquitetura de software

Estas instruções definem a arquitetura inicial do backend da rede social OG Lab. Consulte-as ao criar, alterar ou revisar código e documentação de arquitetura.

## Objetivos e tecnologias

- O projeto é um backend monolítico em Node.js e TypeScript. Use a versão estável mais recente do TypeScript que seja compatível com as dependências e ferramentas escolhidas.
- Supabase é o primeiro serviço externo. Mantenha a integração substituível e permita adicionar provedores externos sem levar detalhes do fornecedor para as regras de negócio.
- O sistema terá cache em memória e Redis. Trate-os como implementações substituíveis, não como dependências diretas do domínio. A política, a precedência, os TTLs e a estratégia de invalidação ainda precisam ser decididos; não invente esses requisitos.
- Não assuma framework HTTP, biblioteca de DI, biblioteca de testes, estrutura de diretórios de código ou ferramenta de build até que o projeto as escolha.

## Camadas e responsabilidades

O fluxo de dependências parte da entrada da aplicação e segue para dentro:

`rotas/entrada → domain → repositories → clients/adapters → serviços externos`

1. **Rotas/entrada:** recebem e validam a entrada de transporte, chamam o caso de uso/domain apropriado e traduzem o resultado para a resposta de transporte. Não implementam regras de negócio nem acessam diretamente repositories ou clients.
2. **Domain:** implementa regras e casos de uso do negócio. Recebe por injeção os repositories necessários, sem conhecer protocolos, SDKs ou modelos específicos de fornecedores.
3. **Repositories:** adaptam os contratos de acesso a dados e serviços às necessidades do negócio. Recebem por injeção os clients necessários; convertem dados externos para contratos usados pelo domínio e mantêm detalhes de integração fora dele.
4. **Clients/adapters:** encapsulam comunicação com serviços externos, como consultas ao Supabase por REST, GraphQL ou banco de dados, e implementações de cache em memória e Redis. Não contêm regras de negócio.

Use o fluxo de feed como exemplo: a rota de feed chama o domínio/caso de uso de feed; esse domínio usa o repository de feed injetado; o repository chama o client do Supabase injetado e adapta a resposta ao contrato esperado pelo domínio.

## Injeção e direção de dependências

- Injete as dependências necessárias em cada camada; evite singletons implícitos, acesso global a serviços e service locators.
- A camada de entrada depende do domínio; o domínio depende de contratos de repositories; repositories dependem de contratos de clients/adapters. Implementações concretas ficam nas bordas.
- Construa e conecte as implementações concretas em um ponto de composição da aplicação. Não espalhe a criação de dependências pelas regras de negócio.
- Mantenha os contratos pequenos e orientados aos casos de uso dos consumidores. Evite expor SDKs ou tipos de fornecedor através das camadas.
- Se uma decisão sobre localização ou contrato de uma abstração não estiver definida, mantenha a separação acima e registre a dúvida em vez de assumir uma regra de negócio.

## Testes

- Todo arquivo de código de produção deve ter testes unitários; arquivos `index` que apenas reexportam módulos estão excluídos.
- A meta é 100% de cobertura de statements, branches, functions e lines para o código de produção incluído na cobertura. Não exclua código para atingir a meta; somente os barrels de reexportação puros podem ficar de fora.
- Teste regras de domínio isoladamente, substituindo repositories por doubles injetados; teste repositories com clients substituídos; teste clients com dependências externas isoladas sempre que viável.
- Inclua caminhos de sucesso, falha e limites relevantes. Cobertura não substitui asserções sobre comportamento.
- Antes de alterar configurações de cobertura ou adicionar ferramentas, confira a configuração existente e preserve os padrões adotados pelo projeto.
