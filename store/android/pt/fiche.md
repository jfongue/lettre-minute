# Página da Play Store — Letra Minuto (português do Brasil)

Textos e respostas para copiar no Play Console. As imagens: `../icon-512.png`,
`feature-graphic.png` (1024 × 500, nesta pasta), `../listing/pt/` (as oito
capturas com legenda a enviar, 1080 × 1920) e `../screenshots/pt/` (as
capturas brutas a partir das quais elas são montadas). Para gerá-las de novo:
`scripts/render-store.sh`.

## Página principal (português do Brasil)

**Nome** (máx. 30 caracteres)
> Letra Minuto

**Descrição curta** (máx. 80 caracteres)
> Uma letra, uma categoria, 60 segundos. Quanto mais rara a palavra, mais pontos.

**Descrição completa** (máx. 4.000 caracteres)

> Cai uma letra, aparece uma categoria, o cronômetro dispara. Países com B,
> animais com M, cores com V… Você tem sessenta segundos para escrever o
> máximo de palavras que conseguir, e as que ninguém lembra valem mais.
>
> O jogo confere cada palavra enquanto você digita, com um dicionário de mais
> de 35 mil palavras em português construído a partir do Wikidata e do
> Wikcionário. “Gatos” vale como “gato”, e um erro de digitação passa:
> “Alemnaha” vale como “Alemanha”.
>
> PALAVRAS RARAS VALEM MAIS
> Uma palavra que todo mundo escreve vale 10 pontos. Uma palavra que ninguém
> encontra vale até três vezes mais. E o bônus se desgasta se você repetir a
> mesma palavra em toda partida: é preciso variar.
>
> NÃO PARE
> Cada palavra certa em sequência aumenta o multiplicador, até ×2. Pular
> custa cinco segundos e zera a sequência.
>
> DESAFIE SEUS AMIGOS
> Até oito jogadores na mesma partida: mesmas letras, mesmas categorias, cada
> um quando quiser dentro de 24 horas. Enquanto você joga, as pontuações de
> quem jogou antes avançam como se fosse ao vivo. No final vale a regra do
> Stop: uma palavra que outro jogador também achou vale só metade. Ranking,
> troféus e revanche, se der vontade.
>
> DEZ PODERES
> Escreva “psiu” e o cronômetro para. Escreva “Joker” e o jogo acha uma
> palavra por você. Troque de letra, veja a próxima categoria chegando,
> deixe passar dois erros… Um poder novo a cada dois níveis, e dois para
> levar em cada partida.
>
> SUBA DE NÍVEL
> Cada ponto dá experiência, e cada nível oferece três categorias novas, das
> quais você fica com uma: frutas e legumes, profissões, esportes, partes do
> corpo, materiais, capitais, marcas… No caminho, quarenta avatares animados e
> trinta cores para desbloquear.
>
> SUBA NO RANKING
> Melhor partida do dia, da semana, e a caça às descobertas: as palavras que
> ninguém tinha escrito nos últimos sete dias.
>
> FAÇA O DICIONÁRIO CRESCER
> Falta uma palavra? Sugira com um toque. Aprovada por três moderadores, ela
> entra no dicionário, e você ganha 150 XP.
>
> • Sem cadastro: a conta é opcional (e-mail ou Google)
> • Um único anúncio, curto, ao escolher uma nova categoria
> • Dá para jogar off-line no modo solo
> • Em sete idiomas, cada um com seu próprio dicionário: francês, inglês,
>   espanhol, alemão, italiano, holandês, português
> • Música e sons tocados ao vivo, tema claro e escuro
> • Seus dados são apagados com um toque, pelo menu

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
