# Página da Play Store — Letra Minuto (português do Brasil)

Textos e respostas para copiar no Play Console. As imagens: `../icon-512.png`,
`feature-graphic.png` (1024 × 500, nesta pasta), `../listing/pt/` (as cinco
capturas com legenda a enviar, 1080 × 1920) e `../screenshots/pt/` (as
capturas brutas a partir das quais elas são montadas). Para gerá-las de novo:
`scripts/render-store.sh`.

## Página principal (português do Brasil)

**Nome** (máx. 30 caracteres)
> Letra Minuto

**Descrição curta** (máx. 80 caracteres)
> O bom e velho Stop, turbinado: uma letra, 60 segundos. Desafie seus amigos!

**Descrição completa** (máx. 4.000 caracteres)

> O bom e velho Stop, ou Adedonha, em versão relâmpago. Cai uma letra, aparece
> um tema, o cronômetro dispara: países com B, animais com M, profissões com
> P… Você tem sessenta segundos para achar o máximo que conseguir.
>
> DESAFIE SEUS AMIGOS
> Convide até sete amigos para a mesma partida: mesmas letras, mesmos temas,
> cada um joga quando quiser. Ranking, troféus e revanche.
>
> PODERES PARA TRAPACEAR UM POUCO
> Troque de letra, veja o próximo tema chegando, deixe passar dois erros… Dez
> poderes para conquistar: descubra sua combinação favorita.
>
> NOVOS TEMAS A CADA NÍVEL
> Ganhe novos temas para um desafio ainda maior: frutas e legumes, profissões,
> esportes, partes do corpo, cidades, marcas…
>
> PARA OS MAIS VICIADOS
> As palavras mais raras valem até três vezes mais: venha descobri-las, ou
> sugira as suas.
>
> • Sem cadastro, conta opcional
> • Um único anúncio curto, ao escolher um novo tema
> • Dá para jogar off-line no modo solo
> • Em sete idiomas

**Categoria do app**: Jogo › Palavras
**Tags** (no máximo 5, da lista do Play Console): Palavras, Quiz,
Conhecimentos gerais, Um jogador, Multijogador
**Endereço de e-mail de contato**: fongue.jeremy@gmail.com (público na página)
**Política de privacidade** (um único endereço para todo o app):
https://jfongue.github.io/lettre-minute/confidentialite.html, ou seja,
`VITE_PRIVACY_URL`; a tradução em português fica em
https://jfongue.github.io/lettre-minute/confidentialite.pt.html, e as duas
páginas apontam uma para a outra

## Conteúdo do app (Play Console › Política › Conteúdo do app)

| Seção | Resposta |
| --- | --- |
| Acesso ao app | Nenhuma restrição: tudo é acessível sem fazer login |
| Anúncios | **Sim**: um intersticial do AdMob depois de cada escolha de categoria a partir da segunda |
| Classificação do conteúdo (IARC) | Categoria “Jogo”; não para todas as perguntas (violência, medo, sexualidade, jogos de azar, linguagem, drogas, compras digitais); **interações entre usuários: sim** (nome de jogador, avatar e pontuações visíveis no ranking, entre amigos e nos desafios; nenhuma troca de mensagens, nenhum texto livre compartilhado além do nome). Resultado esperado: PEGI 3 / Livre, com o aviso “Interação do usuário” |
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
- Forma de solicitar a exclusão: **sim**, no app (Menu › Perfil › Apagar meus
  dados) e em
  https://jfongue.github.io/lettre-minute/confidentialite.pt.html#effacer

| Tipo de dados (Play) | O que é aqui | Coletado | Compartilhado | Processamento temporário | Obrigatório | Finalidade |
| --- | --- | --- | --- | --- | --- | --- |
| Informações pessoais › IDs do usuário | O identificador anônimo do Supabase | Sim | Não | Não | Sim | Funcionalidade do app |
| Informações pessoais › Nome | Nome de jogador, escolhido ao criar a conta, visível para os outros jogadores | Sim | Não | Não | Não (conta opcional) | Funcionalidade do app, gerenciamento da conta |
| Informações pessoais › Endereço de e-mail | Login e código de redefinição de senha (digitado ou enviado pelo Google) | Sim | Não | Não | Não (conta opcional) | Funcionalidade do app, gerenciamento da conta |
| Informações pessoais › Outras informações | Lista de amigos, desafios | Sim | Não | Não | Não | Funcionalidade do app |
| Dispositivo ou outros IDs | Token de notificação do Firebase (desafios) | Sim | Não | Não | Não (o jogador aceita as notificações) | Funcionalidade do app |
| Atividade no app › Outras ações | Partidas, pontuações, palavras jogadas, XP | Sim | Não | Não | Sim | Funcionalidade do app |
| Atividade no app › Outro conteúdo gerado pelo usuário | Palavras sugeridas para o dicionário | Sim | Não | Não | Não (o jogador escolhe sugerir) | Funcionalidade do app |
| Local › Local aproximado | Deduzido do endereço IP pelo AdMob | Sim | Sim | Não | Sim | Publicidade, análise, prevenção contra fraudes |
| Dispositivo ou outros IDs | ID de publicidade (AdMob) | Sim | Sim | Não | Sim | Publicidade, análise, prevenção contra fraudes |
| Atividade no app › Interações com o app | Exibições e toques no anúncio (AdMob) | Sim | Sim | Não | Sim | Publicidade, análise, prevenção contra fraudes |
| Informações e desempenho do app › Registros de falhas, Diagnóstico | Enviados pelo SDK do AdMob | Sim | Sim | Não | Sim | Análise, prevenção contra fraudes |

Todo o resto (local exato, contatos, fotos, número de telefone): **não
coletado**. A senha só é guardada em forma de hash, pelo Supabase Auth.

## Exclusão de conta (Play Console › Política › Exclusão de dados)

- O app permite criar uma conta? **Sim**: uma conta anônima é criada
  automaticamente, e o jogador pode dar um nome a ela (nome, e-mail, senha,
  ou Google). A exclusão apaga uma e outra
- Link de exclusão fora do app:
  https://jfongue.github.io/lettre-minute/confidentialite.pt.html#effacer
- Exclusão parcial dos dados sem excluir a conta: não oferecida
