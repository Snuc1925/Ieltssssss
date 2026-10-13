"""Gộp các PDF theo chủ đề (mỗi file đã xếp theo question type) thành một file, kèm mục lục (bookmark)."""
import glob, sys
from pypdf import PdfWriter, PdfReader

ORDER = [('Education', 'Education'), ('Environment-Energy', 'Environment & Energy'), ('Health-Sport', 'Health & Sport'),
         ('Transport-Housing-Cities', 'Transport, Housing & Cities'), ('Technology-Science', 'Technology & Science'),
         ('Travel-Tourism', 'Travel & Tourism'), ('Economy-Business', 'Economy & Business'), ('Media-Advertising', 'Media & Advertising'),
         ('Work-Careers', 'Work & Careers'), ('Arts-Culture', 'Arts & Culture'), ('Family-Society', 'Family & Society'),
         ('Crime-Law', 'Crime & Law'), ('Government-Politics', 'Government & Politics')]
d = sys.argv[1] if len(sys.argv) > 1 else 'exports'
w = PdfWriter()
total = 0
for base, name in ORDER:
    fs = glob.glob(f'{d}/{base}-*-essays.pdf')
    if not fs: print('thiếu', base); continue
    r = PdfReader(fs[0]); start = len(w.pages)
    w.append(r); n = fs[0].split('-')[-2]
    w.add_outline_item(f'{name} ({n} bài)', start); total += int(n)
out = f'{d}/IELTS-Writing-Task2-All-{total}-essays.pdf'
w.write(out); print(out, len(w.pages), 'trang')
