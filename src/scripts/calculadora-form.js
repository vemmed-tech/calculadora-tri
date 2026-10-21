export const BUBBLE_ENDPOINT = 'https://flashmedradarquestoes.bubbleapps.io/api/1.1/wf/sign_up_calculadora';
export const MAUTIC_FORM_ID = '23';
export const PRODUCT = 'Calculadora TRI';
export const PRODUCT_SLUG = 'calculadora_tri';

const FIELD_LABELS = {
  nome_completo1: ['nome'],
  sobrenome: ['sobrenome'],
  email: ['email', 'e-mail'],
  telefone: ['celular', 'telefone'],
};

function getField(form, field) {
  const named = form.elements.namedItem(`mauticform[${field}]`);
  if (named?.value !== undefined) return named;

  const labels = FIELD_LABELS[field] ?? [];
  for (const row of form.querySelectorAll?.('.mauticform-row') ?? []) {
    const label = row.querySelector('.mauticform-label')?.textContent
      ?.toLowerCase().replace(/[^a-záéíóúãõâêôç]/g, '');
    if (labels.some((candidate) => label === candidate.replace(/[^a-záéíóúãõâêôç]/g, ''))) {
      return row.querySelector('input, select, textarea');
    }
  }
  return null;
}

export function createPayload(form) {
  const value = (field) => String(getField(form, field)?.value ?? '').trim();
  return {
    nome: value('nome_completo1'),
    email: value('email'),
    celular: value('telefone').replace(/\D/g, ''),
    produto: PRODUCT,
    sobrenome: value('sobrenome'),
  };
}

export function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return '(' + digits;
  const prefixLength = digits.length > 10 ? 5 : 4;
  const number = digits.slice(2);
  return '(' + digits.slice(0, 2) + ') ' + (number.length > prefixLength ? number.slice(0, prefixLength) + '-' + number.slice(prefixLength) : number);
}

export function thankYouUrl(redirect, email, base) {
  if (!redirect) return redirect;
  const destination = new URL(redirect, base);
  destination.searchParams.set('email', email);
  destination.searchParams.set('produto', PRODUCT_SLUG);
  return destination.href;
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

export function attachBubbleSubmission(form, {
  sdk = () => window.MauticSDK,
  callbacks = (window.MauticFormCallback ??= {}),
  request = window.fetch.bind(window),
} = {}) {
  if (form.dataset.bubbleIntegrated) return;
  form.dataset.bubbleIntegrated = 'true';
  const formName = form.getAttribute('data-mautic-form');
  const button = form.querySelector('button[type="submit"]');
  const error = form.querySelector('.mauticform-error') || document.querySelector('#cadastro > .mauticform-error');
  const fields = ['nome_completo1', 'sobrenome', 'email', 'telefone']
    .map((field) => getField(form, field))
    .filter(Boolean);
  let pending = false;
  let delivered = null;
  let restoreControls = () => {};

  const showError = (message) => {
    if (!error) return;
    error.setAttribute('role', 'alert');
    error.textContent = message;
  };

  const callback = (callbacks[formName] ??= {});
  const previousResponseStart = callback.onResponseStart;
  callback.onResponseStart = function (response) {
    previousResponseStart?.call(this, response);
    if ((response?.success === true || response?.success === 1) && !response.errorMessage &&
        !Object.keys(response.validationErrors ?? {}).length && delivered && response.redirect) {
      const payload = JSON.parse(delivered);
      response.redirect = thankYouUrl(response.redirect, payload.email, form.ownerDocument?.baseURI);
    }
  };

  const previousResponseEnd = callback.onResponseEnd;
  callback.onResponseEnd = function (response) {
    pending = false;
    restoreControls();
    return previousResponseEnd?.call(this, response);
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (pending) return;
    const mautic = typeof sdk === 'function' ? sdk() : sdk;
    if (!mautic || !form.reportValidity()) {
      if (!mautic) showError('O formulário ainda está carregando. Aguarde um momento e tente novamente.');
      return;
    }
    if (!mautic.validateForm(formName, false)) return;

    const payload = createPayload(form);
    if (!payload.nome || !payload.sobrenome || !payload.email || !/^\d{10,11}$/.test(payload.celular)) {
      showError('Confira seu nome, sobrenome, e-mail e celular com DDD antes de continuar.');
      return;
    }

    const body = JSON.stringify(payload);
    const previousReadOnly = fields.map((field) => field.readOnly);
    const previousButton = button && { disabled: button.disabled, html: button.innerHTML };
    restoreControls = () => {
      fields.forEach((field, index) => { field.readOnly = previousReadOnly[index]; });
      if (button && previousButton) {
        button.disabled = previousButton.disabled;
        button.innerHTML = previousButton.html;
      }
    };
    fields.forEach((field) => { field.readOnly = true; });
    if (button) {
      button.disabled = true;
      button.textContent = 'Enviando…';
    }
    pending = true;
    showError('');

    try {
      if (body !== delivered) {
        await sendRegistration(payload, request);
        delivered = body;
      }
      restoreControls();
      if (!mautic.validateForm(formName, true)) {
        pending = false;
        restoreControls();
      }
    } catch (failure) {
      pending = false;
      restoreControls();
      showError('Não foi possível concluir seu cadastro agora. Tente novamente em instantes.');
      console.error('Falha no envio ao Bubble:', failure);
    }
  }, true);
}

export function integrateBubbleForm() {
  const configureForm = (form) => {
    if (!form) return false;
    const name = getField(form, 'nome_completo1');
    const surname = getField(form, 'sobrenome');
    const email = getField(form, 'email');
    const phone = getField(form, 'telefone');
    const phoneLabel = phone?.closest('.mauticform-row')?.querySelector('.mauticform-label');

    if (form.dataset.vemmedConfigured) {
      attachBubbleSubmission(form);
      return true;
    }
    form.dataset.vemmedConfigured = 'true';
    if (name) name.autocomplete = 'given-name';
    if (surname) surname.autocomplete = 'family-name';
    if (email) email.autocomplete = 'email';
    if (phone) {
      phone.autocomplete = 'tel-national';
      phone.inputMode = 'tel';
      phone.placeholder = '(11) 99999-9999';
      phone.maxLength = 15;
      phone.pattern = '\\(\\d{2}\\) \\d{4,5}-\\d{4}';
      phone.closest('.mauticform-row')?.classList.add('mauticform-phone-row');
      phone.addEventListener('input', () => { phone.value = formatPhone(phone.value); });
      const help = document.createElement('span');
      help.id = `${form.id || MAUTIC_FORM_ID}_telefone_help`;
      help.className = 'mauticform-helpmessage sr-only';
      help.textContent = 'Digite DDD e número de celular, com até 11 dígitos.';
      phone.insertAdjacentElement('afterend', help);
      phone.setAttribute('aria-describedby', help.id);
    }
    if (phoneLabel) phoneLabel.textContent = 'Celular';
    attachBubbleSubmission(form);
    return true;
  };

  const attach = () => configureForm(document.querySelector('#cadastro .mauticform_wrapper form[data-mautic-form]'));
  if (attach()) return;
  const observer = new MutationObserver(() => {
    if (attach()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 20000);
}
