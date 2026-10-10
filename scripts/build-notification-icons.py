"""Build two recognisable, mask-safe PWA symbols in four notification colours."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / 'icons'
OUT.mkdir(exist_ok=True)
PALETTES = {'teal': ('#26B5B2', '#075D86'), 'violet': ('#AB82EF', '#573399'),
            'rose': ('#EF879D', '#A22A5E'), 'amber': ('#F4B459', '#AD581A')}

def symbol(draw, role, fill, scale):
    def box(values): return tuple(round(v*scale) for v in values)
    def line(points, width=14): draw.line([box(p) for p in points], fill=fill, width=round(width*scale), joint='curve')
    if role == 'customer':
        draw.rounded_rectangle(box((127,148,385,337)), radius=round(49*scale), fill=fill)
        draw.polygon([box(p) for p in [(159,306),(159,383),(238,331)]], fill=fill)
    else:
        draw.rounded_rectangle(box((146,217,366,360)), radius=round(16*scale), fill=fill)
        draw.polygon([box(p) for p in [(124,222),(157,143),(355,143),(388,222)]], fill=fill)

for role in ['admin', 'customer']:
    for name,(a,b) in PALETTES.items():
        a=tuple(bytes.fromhex(a[1:]));b=tuple(bytes.fromhex(b[1:]))
        image=Image.new('RGB',(1024,1024));d=ImageDraw.Draw(image)
        for y in range(1024):
            t=y/1023;colour=tuple(round(x*(1-t)+z*t) for x,z in zip(a,b))
            d.line((0,y,1024,y),fill=colour)
        symbol(d,role,'#FFFDF8',2)
        if role=='customer':
            for x in (202,256,310):d.ellipse((x*2-12,241*2-12,x*2+12,241*2+12),fill=b)
        else:
            d.rounded_rectangle((230*2,267*2,282*2,360*2),radius=10,fill=b)
            for x in (182,230,278,326):d.line((x*2,157*2,(x-10)*2,210*2),fill=b,width=9)
        for size in (192,512):image.resize((size,size),Image.Resampling.LANCZOS).save(OUT/f'{role}-{name}-{size}.png',optimize=True)
    badge=Image.new('RGBA',(384,384));symbol(ImageDraw.Draw(badge),role,'white',384/512)
    badge.resize((96,96),Image.Resampling.LANCZOS).save(OUT/f'{role}-badge.png',optimize=True)
