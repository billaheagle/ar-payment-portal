import type { Checkout } from './types';

export const escapeHtml = (value: string): string => {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll(`"`, '&quot;')
    .replaceAll(`'`, '&#39;');
};

// Plain browser JavaScript. No template literals inside: this whole block is itself a
// template literal on the server, so ${...} here would be evaluated on the server.
const CLIENT_SCRIPT = `
(function () {
  var body = document.body;
  var checkoutId = body.dataset.checkoutId;
  var embedded = body.dataset.embedded === '1';
  var result = document.getElementById('result');

  function notifyParent(type) {
    if (embedded) { window.parent.postMessage({ source: 'mock-psp', type: type, checkoutId: checkoutId }, '*') }
  }

  function pay(outcome) {
    var request = {
      outcome: outcome,
      duplicateWebhook: document.getElementById('duplicate').checked,
      delaySeconds: document.getElementById('delay').checked ? 15 : 0,
      suppressWebhook: document.getElementById('suppress').checked
    };
    document.querySelectorAll('.pay').forEach(function (b) { b.disabled = true; });
    fetch('/checkout/' + encodeURIComponent(checkoutId) + '/pay', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request)
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (r) {
        if (!r.ok) { result.textContent = r.data.error.message; return; }
        result.textContent = 'Payment ' + r.data.status.toLowerCase() + '.';
        notifyParent(r.data.status === 'SUCCEEDED' ? 'payment_succeeded' : 'payment_failed');
      });
  }

  var success = document.getElementById('pay-success');
  var decline = document.getElementById('pay-decline');
  var close = document.getElementById('close');
  if (success) success.addEventListener('click', function () { pay('success'); });
  if (decline) decline.addEventListener('click', function () { pay('decline'); });
  if (close) close.addEventListener('click', function () { notifyParent('closed'); });
})();
`;

export const renderCheckoutPage = (
  checkout: Checkout,
  open: boolean,
  embedded: boolean,
): string => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mock PSP checkout</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 420px; margin: 2rem auto; padding: 0 1rem; color: #1d2d3e; }
    .amount { font-size: 2rem; font-weight: 600; margin: .5rem 0 1.5rem; }
    label { display: block; margin: .4rem 0; }
    button { padding: .6rem 1rem; margin: 1rem .5rem 0 0; cursor: pointer; }
    .notice { padding: .8rem; background: #fff3cd; border-radius: 6px; }
  </style>
</head>
<body data-checkout-id="${escapeHtml(checkout.id)}" data-embedded="${embedded ? '1' : '0'}">
  <p>Reference <strong>${escapeHtml(checkout.reference)}</strong></p>
  <div class="amount">${escapeHtml(checkout.amount)} ${escapeHtml(checkout.currency)}</div>
  ${
    open
      ? `<fieldset>
    <legend>Test options</legend>
    <label><input type="checkbox" id="duplicate"> Send webhook twice</label>
    <label><input type="checkbox" id="delay"> Delay webhook 15 s</label>
    <label><input type="checkbox" id="suppress"> Do not send webhook</label>
  </fieldset>
  <button class="pay" id="pay-success">Pay (success)</button>
  <button class="pay" id="pay-decline">Pay (decline)</button>`
      : '<p class="notice">Checkout is no longer open</p>'
  }
  ${embedded ? '<button id="close">Close</button>' : ''}
  <p id="result" role="status"></p>
  <script>${CLIENT_SCRIPT}</script>
</body>
</html>`;
