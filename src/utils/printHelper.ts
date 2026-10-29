/**
 * Dedicated, robust print helper for browser and Android environments.
 * Provides isolated paged printing for bills, receipts, and consumer cards.
 */

export interface PrintOptions {
  documentTitle?: string;
  paperSize?: 'A4' | 'POS80' | 'A5';
  onAfterPrint?: () => void;
}

export function printDocument(elementId: string, options: PrintOptions = {}): boolean {
  const targetElement = document.getElementById(elementId);
  if (!targetElement) {
    console.warn(`[PrintHelper] Element #${elementId} not found. Triggering direct window.print()`);
    window.focus();
    window.print();
    return false;
  }

  const { documentTitle = 'Drinking Water Bill', paperSize = 'A4', onAfterPrint } = options;

  // Add contextual class to main document body for CSS @media print isolation
  const printClass = elementId.includes('receipt') ? 'is-printing-receipt' : 'is-printing-bill';
  document.body.classList.add(printClass);

  const cleanup = () => {
    document.body.classList.remove('is-printing-bill');
    document.body.classList.remove('is-printing-receipt');
    if (onAfterPrint) onAfterPrint();
  };

  // Setup afterprint listener on main window
  const afterPrintHandler = () => {
    cleanup();
    window.removeEventListener('afterprint', afterPrintHandler);
  };
  window.addEventListener('afterprint', afterPrintHandler);

  // Strategy 1: Hidden Iframe Print (Isolates strictly the target element, prevents background leaking)
  try {
    let printIframe = document.getElementById('app-print-frame') as HTMLIFrameElement;
    if (!printIframe) {
      printIframe = document.createElement('iframe');
      printIframe.id = 'app-print-frame';
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = '0';
      printIframe.style.visibility = 'hidden';
      printIframe.setAttribute('aria-hidden', 'true');
      document.body.appendChild(printIframe);
    }

    const frameDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
    if (frameDoc && printIframe.contentWindow) {
      // Gather existing styles
      const styleNodes = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((el) => el.outerHTML)
        .join('\n');

      const pageMargin = paperSize === 'POS80' ? '2mm' : '8mm';

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="ne">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>${documentTitle}</title>
            ${styleNodes}
            <style>
              @page {
                size: ${paperSize === 'POS80' ? '80mm auto' : paperSize === 'A5' ? 'A5' : 'A4'};
                margin: ${pageMargin};
              }
              html, body {
                background: #ffffff !important;
                color: #0f172a !important;
                margin: 0 !important;
                padding: ${paperSize === 'POS80' ? '4px' : '12px'} !important;
                font-family: 'Inter', 'Mukta', system-ui, -apple-system, sans-serif !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              #printable-bill, #printable-receipt, #printable-consumer-card {
                width: 100% !important;
                max-width: ${paperSize === 'POS80' ? '76mm' : '100%'} !important;
                margin: 0 auto !important;
                border: none !important;
                box-shadow: none !important;
              }
              .print\\:hidden, .no-print {
                display: none !important;
              }
            </style>
          </head>
          <body>
            ${targetElement.outerHTML}
          </body>
        </html>
      `;

      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();

      // Wait briefly for images and fonts in the iframe to layout
      setTimeout(() => {
        try {
          printIframe.contentWindow?.focus();
          printIframe.contentWindow?.print();
          // Safety cleanup
          setTimeout(cleanup, 2000);
        } catch (framePrintErr) {
          console.warn('[PrintHelper] Iframe print invocation fallback:', framePrintErr);
          window.focus();
          window.print();
          setTimeout(cleanup, 2000);
        }
      }, 350);

      return true;
    }
  } catch (err) {
    console.warn('[PrintHelper] Iframe creation caught error, falling back to window.print():', err);
  }

  // Strategy 2: Direct Window Print Fallback
  window.focus();
  window.print();
  setTimeout(cleanup, 2000);
  return true;
}
