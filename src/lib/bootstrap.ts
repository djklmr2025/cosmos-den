(function () {
  if (typeof Response === 'undefined') return;

  const origJson = (Response.prototype as any).json as any;
  if ((Response.prototype as any).__safeJsonPatched) return;
  Object.defineProperty(Response.prototype, '__safeJsonPatched', { value: true, configurable: false });

  (Response.prototype as any).json = async function () {
    try {
      return await origJson.call(this);
    } catch (err) {
      try {
        const ct = this.headers.get('content-type') || '';
        const text = await this.clone().text();

        if (ct.includes('application/json') && text.trim().length > 0) {
          try {
            return JSON.parse(text);
          } catch {
            return { raw: text };
          }
        }

        if (text.trim().length === 0) return {};

        try {
          return JSON.parse(text);
        } catch {
          return { raw: text };
        }
      } catch {
        return {};
      }
    }
  };
})();