# Página da Play Store — Lettre Minute (português do Brasil)

Textos e respostas para copiar no Play Console. As imagens ficam um nível
acima: `../icon-512.png`, `../feature-graphic.png` (1024 × 500),
`../screenshots/` (1080 × 1920, claro e escuro). Para gerá-las de novo:
`scripts/render-store.sh`.

## Página principal (português do Brasil)

**Nome** (máx. 30 caracteres)
> Lettre Minute

**Descrição curta** (máx. 80 caracteres)
> Uma letra, uma categoria, 60 segundos. Quanto mais rara a palavra, mais pontos.

**Descrição completa** (máx. 4.000 caracteres)

> Cai uma letra, aparece uma categoria, o cronômetro começa. Países com B,
> animais com M, cores com V… Você tem sessenta segundos para escrever o
> máximo de palavras que conseguir.
>
> O jogo confere cada palavra enquanto você digita, com um dicionário de mais
> de {WORD_COUNT} palavras construído a partir do Wikidata e do Wikcionário.
> “Gatos” vale como “gato”, e um erro de digitação passa: “Alemnaha” vale
> como “Alemanha”.
>
> PALAVRAS RARAS VALEM MAIS
> Uma palavra que todo mundo escreve vale 10 pontos. Uma palavra que ninguém
> encontra vale até três vezes mais. E o bônus se desgasta se você repetir a
> mesma palavra em toda partida: é preciso variar.
>
> NÃO PARE
> Cada palavra validada em sequência aumenta o multiplicador, até ×2. Pular
> custa cinco segundos e zera a sequência.
>
> SUBA DE NÍVEL
> Cada ponto dá experiência, e cada nível desbloqueia uma nova categoria:
> frutas e legumes, profissões, esportes, partes do corpo, materiais,
> capitais, marcas, insetos…
>
> FAÇA O DICIONÁRIO CRESCER
> Falta uma palavra? Sugira com um toque. Quando três jogadores pedem, ela
> entra no dicionário, e você ganha 150 XP.
>
> • Sem cadastro
> • Um único anúncio, curto, ao escolher uma nova categoria
> • Dá para jogar off-line
> • Tema claro e escuro
> • Seus dados são apagados com um toque na tela inicial

**Categoria do app**: Jogo › Palavras
**Tags**: Palavras, Quiz, Um jogador, Conhecimentos gerais
**Endereço de e-mail de contato**: a preencher (público na página)
**Política de privacidade**: o endereço público de
`store/privacy/confidentialite.pt.html` depois de publicada (hoje
`VITE_PRIVACY_URL` é a página em francês)

## Conteúdo do app (Play Console › Política › Conteúdo do app)

| Seção | Resposta |
| --- | --- |
| Acesso ao app | Nenhuma restrição: tudo é acessível sem fazer login |
| Anúncios | **Sim**: um intersticial do AdMob depois de cada escolha de categoria a partir da segunda |
| Classificação do conteúdo (IARC) | Categoria “Jogo”; não para todas as perguntas (violência, medo, sexualidade, jogos de azar, linguagem, drogas, compras digitais); os jogadores não trocam mensagens e não compartilham nada entre si. Resultado esperado: PEGI 3 / Livre |
| Público-alvo | 13 anos ou mais. Escolher uma faixa abaixo de 13 anos faz o app entrar no programa Famílias e em seus requisitos adicionais |
| App de notícias | Não |
| Apps governamentais / de saúde / financeiros | Não |
| ID de publicidade | **Sim**, pelo SDK do AdMob; finalidades: publicidade, análise, prevenção contra fraudes. A permissão `AD_ID` é adicionada ao manifesto pelo SDK |

## Segurança dos dados

As linhas do Supabase só valem se o build incluir as chaves dele; as linhas do
AdMob valem para todo build Android, já que o SDK de anúncios está sempre
nele. As declarações do AdMob seguem o guia “Segurança dos dados” da Ajuda do
AdMob, a reler a cada atualização do SDK.

- Coleta ou compartilhamento de dados: **sim, coleta** e **sim,
  compartilhamento** (com o Google, para publicidade)
- Dados criptografados em trânsito: **sim** (HTTPS para o Supabase e o
  Google)
- Forma de solicitar a exclusão: **sim**, no app (início › Apagar meus
  dados) e em `VITE_PRIVACY_URL#effacer`

| Tipo de dados (Play) | O que é aqui | Coletado | Compartilhado | Processamento temporário | Obrigatório | Finalidade |
| --- | --- | --- | --- | --- | --- | --- |
| Informações pessoais › IDs do usuário | O identificador anônimo do Supabase | Sim | Não | Não | Sim | Funcionalidade do app |
| Atividade no app › Outras ações | Partidas, pontuações, palavras jogadas, XP | Sim | Não | Não | Sim | Funcionalidade do app |
| Atividade no app › Outro conteúdo gerado pelo usuário | Palavras sugeridas para o dicionário | Sim | Não | Não | Não (o jogador escolhe sugerir) | Funcionalidade do app |
| Local › Local aproximado | Deduzido do endereço IP pelo AdMob | Sim | Sim | Não | Sim | Publicidade, análise, prevenção contra fraudes |
| Dispositivo ou outros IDs | ID de publicidade (AdMob) | Sim | Sim | Não | Sim | Publicidade, análise, prevenção contra fraudes |
| Atividade no app › Interações com o app | Exibições e toques no anúncio (AdMob) | Sim | Sim | Não | Sim | Publicidade, análise, prevenção contra fraudes |
| Informações e desempenho do app › Diagnóstico, Registros de falhas | Enviados pelo SDK do AdMob | Sim | Sim | Não | Sim | Análise, prevenção contra fraudes |

Todo o resto (local exato, contatos, fotos, e-mail, nome): **não coletado**.

## Exclusão de conta (Play Console › Política › Exclusão de dados)

- O app permite criar uma conta? **Sim**, uma conta anônima é criada
  automaticamente
- Link de exclusão fora do app: `VITE_PRIVACY_URL#effacer`
- Exclusão parcial dos dados sem excluir a conta: não oferecida
