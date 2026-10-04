"""In một file HTML ra PDF A4 (dùng Playwright). Cách dùng: python html-to-pdf.py <file.html> [file.pdf]"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

src = pathlib.Path(sys.argv[1]).resolve()
dst = pathlib.Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else src.with_suffix('.pdf')
footer = ('<div style="font-size:8px;width:100%;text-align:center;color:#888">'
          '<span class="pageNumber"></span> / <span class="totalPages"></span></div>')
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(src.as_uri())
    page.wait_for_timeout(500)
    page.pdf(path=str(dst), format='A4', print_background=True, prefer_css_page_size=True,
             display_header_footer=True, header_template='<span></span>', footer_template=footer,
             margin={'top': '16mm', 'bottom': '16mm', 'left': '14mm', 'right': '14mm'})
    browser.close()
print('PDF:', dst.name)
