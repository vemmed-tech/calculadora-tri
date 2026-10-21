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
Formulário Mautic ID `23` e endpoint Bubble: `https://flashmedradarquestoes.bubbleapps.io/api/1.1/wf/sign_up_calculadora`.

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

Após o Bubble confirmar o cadastro, o formulário Mautic é enviado e o navegador segue o destino configurado nele, com os parâmetros `email` e `produto=calculadora_tri`.
A página de captura não executa o cálculo de TRI; ela envia o cadastro ao Bubble e ao Mautic. A API Bubble precisa aceitar POST JSON público com esses cinco campos e permitir CORS para o domínio da página. Nenhuma chave privada é colocada no navegador.

A logo, o favicon, as fontes e os identificadores de rastreamento são reaproveitados do layout existente.
Os testes simulam requisições; não criam cadastros de teste na produção. O recebimento real pelo Bubble precisa ser confirmado em um cadastro autorizado.

