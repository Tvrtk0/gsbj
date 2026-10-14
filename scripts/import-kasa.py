#!/usr/bin/env python3
"""
Import the shop's price list export from the till ("kasa") into src/data/kasa.json, which the
site publishes as the daily machine-readable price list (/cjenik, NN 101/2026).

    npm run cjenik:import -- ~/Desktop/Cjenik_s_usporedbom_cijena_na_dan_10092026.xls

Run it whenever prices change; until then each day's list is republished unchanged.

Anchor prices ("dodatna cijena") come from the export's CIJENA_10092026 column. An article that
column shows as 0 wasn't sold on 10.9.2026, so its anchor is its price on the day it was
introduced: the first import that contains it. Anchors already recorded are never changed.

Needs xlrd for the old .xls format:  pip3 install xlrd
"""
import datetime
import json
import os
import sys

try:
    import xlrd
except ImportError:
    sys.exit('Needs xlrd to read .xls files: pip3 install xlrd')

OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'kasa.json')
ANCHOR_DATE = '2026-09-10'
# Known introduction dates for articles whose anchor column is 0
KNOWN_INTRODUCED = {'0075': '2026-09-30'}  # E-CIG. TIK TOK 8K = web "Početni paket Magic 8k", added 30.9.

UNITS = {'kokom': 'kom', 'pac': 'pak', '': 'kom'}


def main(path):
    sheet = xlrd.open_workbook(path).sheet_by_index(0)
    header = [str(sheet.cell_value(0, c)).strip() for c in range(sheet.ncols)]
    col = {name: header.index(name) for name in ('SIFRA_ROBE', 'NAZIV_ROBE_USLUGE', 'JMJ', 'MPC', 'CIJENA_10092026')}

    previous = {}
    if os.path.exists(OUT):
        previous = {a['code']: a for a in json.load(open(OUT, encoding='utf-8'))['articles']}

    today = datetime.date.today().isoformat()
    articles, new_intro = [], []
    for r in range(1, sheet.nrows):
        cell = lambda name: sheet.cell_value(r, col[name])
        code = str(cell('SIFRA_ROBE')).strip()
        if isinstance(sheet.cell_value(r, col['SIFRA_ROBE']), float):
            code = str(int(cell('SIFRA_ROBE')))  # numeric cells come back as floats
        price = round(float(cell('MPC') or 0), 2)
        if not code or price <= 0:
            continue
        unit = str(cell('JMJ')).strip().lower()
        unit = UNITS.get(unit, unit)

        kept = previous.get(code)
        if kept:
            anchor, anchor_date = kept['anchor'], kept['anchorDate']
        elif float(cell('CIJENA_10092026') or 0) > 0:
            anchor, anchor_date = round(float(cell('CIJENA_10092026')), 2), ANCHOR_DATE
        else:
            anchor, anchor_date = price, KNOWN_INTRODUCED.get(code, today)
            new_intro.append((code, str(cell('NAZIV_ROBE_USLUGE')).strip(), anchor_date))

        articles.append({
            'code': code,
            'name': ' '.join(str(cell('NAZIV_ROBE_USLUGE')).split()),
            'unit': unit,
            'price': price,
            'anchor': anchor,
            'anchorDate': anchor_date,
        })

    articles.sort(key=lambda a: (a['name'].lower(), a['code']))
    data = {'source': os.path.basename(path), 'importedAt': today, 'articles': articles}
    # One article per line, so a re-import's git diff shows exactly which prices changed
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('{\n')
        f.write(f' "source": {json.dumps(data["source"], ensure_ascii=False)},\n')
        f.write(f' "importedAt": {json.dumps(today)},\n')
        f.write(' "articles": [\n')
        f.write(',\n'.join('  ' + json.dumps(a, ensure_ascii=False) for a in articles))
        f.write('\n ]\n}\n')

    changed = sum(1 for a in articles if a['code'] in previous and previous[a['code']]['price'] != a['price'])
    print(f'{len(articles)} articles -> src/data/kasa.json ({changed} price changes since last import)')
    for code, name, date in new_intro:
        print(f'  new since 10.9.2026, anchored on {date}: {code} {name}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(os.path.expanduser(sys.argv[1]))
