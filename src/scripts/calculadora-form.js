export const BUBBLE_ENDPOINT = 'https://flashmedradarquestoes.bubbleapps.io/api/1.1/wf/sign_up_calculadora';
export const PRODUCT = 'Calculadora TRI';
export const PRODUCT_SLUG = 'calculadora_tri';

export function createPayload(form) {
  const value = (name) => String(form.elements.namedItem(name)?.value ?? '').trim();
  return { nome: value('nome'), email: value('email'), celular: value('celular').replace(/\D/g, ''), produto: PRODUCT, sobrenome: value('sobrenome') };
}

export function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return '(' + digits;
  const prefixLength = digits.length > 10 ? 5 : 4;
  const number = digits.slice(2);
  return '(' + digits.slice(0, 2) + ') ' + (number.length > prefixLength ? number.slice(0, prefixLength) + '-' + number.slice(prefixLength) : number);
}

export function thankYouUrl(email, base) {
  const url = new URL('/obrigado', base);
  url.searchParams.set('email', email);
  url.searchParams.set('produto', PRODUCT_SLUG);
  return url.href;
}

export async function sendRegistration(payload, request = globalThis.fetch) {
  const response = await request(BUBBLE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('Bubble HTTP ' + response.status);
  const text = await response.text();
  if (text) {
    const data = JSON.parse(text);
    if (data.status && data.status !== 'success') throw new Error('Bubble não confirmou o cadastro.');
  }
}

export function attachCalculatorForm(form, {
  request = globalThis.fetch.bind(globalThis),
  navigate = (url) => window.location.assign(url),
  base = window.location.href,
} = {}) {
  const phone = form.elements.namedItem('celular');
  const fields = ['nome', 'sobrenome', 'email', 'celular'].map((name) => form.elements.namedItem(name));
  const button = form.querySelector('button[type="submit"]');
  const error = form.querySelector('#form-error');
  button.disabled = false;
  let pending = false;
  phone.addEventListener('input', () => { phone.value = formatPhone(phone.value); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    const payload = createPayload(form);
    if (!payload.nome || !payload.sobrenome || !payload.email || !/^\d{10,11}$/.test(payload.celular)) {
      error.textContent = 'Confira seu nome, sobrenome, e-mail e celular com DDD antes de continuar.';
      return;
    }
    pending = true;
    error.textContent = '';
    const label = button.textContent;
    const readOnly = fields.map((field) => field.readOnly);
    fields.forEach((field) => { field.readOnly = true; });
    button.disabled = true;
    button.textContent = 'Enviando…';
    form.setAttribute('aria-busy', 'true');
    try {
      await sendRegistration(payload, request);
      navigate(thankYouUrl(payload.email, base));
    } catch {
      error.textContent = 'Não foi possível concluir seu cadastro agora. Tente novamente em instantes.';
      error.focus();
    } finally {
      pending = false;
      fields.forEach((field, index) => { field.readOnly = readOnly[index]; });
      button.disabled = false;
      button.textContent = label;
      form.removeAttribute('aria-busy');
    }
  });
}

