(function () {
  // Replaced by the server with the origin of PSP_PUBLIC_URL
  var PSP_ORIGIN = '__PSP_ORIGIN__';

  window.MockPsp = {
    mount: function (element, options) {
      var iframe = document.createElement('iframe');
      iframe.src = options.checkoutUrl + '?embedded=1';
      iframe.width = '100%';
      iframe.style.height = '420px';
      iframe.style.border = '0';
      element.appendChild(iframe);

      function onMessage(event) {
        if (
          event.origin === PSP_ORIGIN &&
          event.data &&
          event.data.source === 'mock-psp' &&
          event.source === iframe.contentWindow
        ) {
          options.onEvent(event.data);
        }
      }

      window.addEventListener('message', onMessage);

      return {
        unmount: function () {
          window.removeEventListener('message', onMessage);
          iframe.remove();
        },
      };
    },
  };
})();
