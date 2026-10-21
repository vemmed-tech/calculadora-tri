# Calculadora TRI — VemMED

Página de captura independente em Astro, no padrão visual das demais iscas VemMED.

## Desenvolvimento
```bash
npm install
npm run dev
```
Abra o endereço exibido no terminal (normalmente http://localhost:4321).
Para usar outra porta: `npm run dev -- --port 4325`.

## Build e testes
```bash
npm test
npm run build
npm run preview
```

## GitHub e Vercel
Envie o conteúdo desta pasta para um repositório próprio. Na Vercel, use o preset Astro, comando de build `npm run build` e diretório de saída `dist`. Não envie `node_modules`, `dist` ou `.astro`.
Não há variáveis de ambiente obrigatórias nem servidor para hospedar: o formulário envia diretamente para o Bubble.

## Cadastro
Endpoint: `https://flashmedradarquestoes.bubbleapps.io/api/1.1/wf/sign_up_calculadora`.

Corpo JSON:
```json
{
  "nome": "Ana",
  "email": "ana@example.com",
  "celular": "11987654321",
  "produto": "Calculadora TRI",
  "sobrenome": "Souza"
}
```

Após uma resposta HTTP de sucesso (e sem status de erro no JSON), o navegador abre `https://spp.vemmed.com/obrigado?email=ana%40example.com&produto=calculadora_tri`.
A página de captura não executa o cálculo de TRI; ela envia o cadastro ao Bubble e abre a página compartilhada de obrigado após a confirmação.
A API precisa aceitar POST JSON público com esses cinco campos e permitir CORS para o domínio da página. Nenhuma chave privada é colocada no navegador.
Esta nova isca não reutiliza um ID de formulário do Mautic de outro produto: só o endpoint do Bubble foi informado. Para adicionar Mautic será necessário o formulário específico da calculadora.

A logo, o favicon, as fontes e os identificadores de rastreamento são reaproveitados do layout existente.
Os testes simulam requisições; não criam cadastros de teste na produção. O recebimento real pelo Bubble precisa ser confirmado em um cadastro autorizado.

