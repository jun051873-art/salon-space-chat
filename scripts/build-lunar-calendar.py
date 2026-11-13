"""Build the bundled calendar from official HKO Gregorian/Lunar tables.
Run: python scripts/build-lunar-calendar.py /path/to/downloaded/year.txt/files
Source: https://www.hko.gov.hk/en/gts/time/calendar/text/files/T{year}e.txt
2024/2041 supply boundary months; published coverage is 2025–2040.
"""
import sys,re,json,datetime,pathlib
root=pathlib.Path(sys.argv[1]);starts=[];previous=None;checks=[]
for year in range(2024,2042):
 for line in (root/f'{year}.txt').read_text().splitlines():
  m=re.match(r'(\d{4})/(\d+)/(\d+)\s+(.+?)\s{2,}',line)
  if not m:continue
  y,mo,d=map(int,m.group(1,2,3));date=datetime.date(y,mo,d);text=m[4];entry=re.match(r'(\d+)(?:st|nd|rd|th) Lunar Month',text)
  if entry:
   month=int(entry[1]);leap=month==previous;starts.append([date.isoformat(),month,int(leap)]);previous=month;day=1
  else:day=int(text)
  if starts and 2025<=year<=2040:
   start=datetime.date.fromisoformat(starts[-1][0]);assert (date-start).days+1==day,(date,text)
   checks.append([date.isoformat(),starts[-1][1],day,starts[-1][2]])
assert len(checks)==5844,len(checks)
header='// Generated from Hong Kong Observatory Gregorian–Lunar calendar conversion tables.\n// https://www.hko.gov.hk/en/gts/time/conversion.htm — years 2024–2041; runtime coverage 2025–2040.\n// Month starts include leap-month flags; never depend on device ICU calendar versions.\n'
pathlib.Path('home-lunar-calendar.js').write_text(header+'export const lunarMonthStarts='+json.dumps(starts,separators=(',',':'))+';\nexport const lunarCoverage=["2025-01-01","2040-12-31"];\n')
pathlib.Path('/tmp/p166-lunar-checks.json').write_text(json.dumps(checks))
print(f'Validated {len(checks)} official daily rows; {len(starts)} month boundaries bundled')
