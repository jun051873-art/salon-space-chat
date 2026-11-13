from pathlib import Path
import re,cssselect2,tinycss2,lxml.html
root=Path(__file__).resolve().parent.parent
source=(root/'admin.html').read_text()
matcher=cssselect2.Matcher()
def rules(tokens):
 for rule in tokens:
  if rule.type!='qualified-rule':continue
  try: selectors=cssselect2.compile_selector_list(tinycss2.serialize(rule.prelude))
  except cssselect2.SelectorError:continue
  decs=tinycss2.parse_declaration_list(rule.content,skip_whitespace=True,skip_comments=True)
  for selector in selectors:matcher.add_selector(selector,decs)
for m in re.finditer(r'<style[^>]*>(.*?)</style>|<link[^>]*href="\./([^"?]+\.css)(?:\?[^"]*)?"[^>]*>',source,re.S):
 rules(tinycss2.parse_stylesheet(m[1] if m[1] is not None else (root/m[2]).read_text(),skip_whitespace=True,skip_comments=True))
for shape in ['circle','capsule','rounded','none']:
 for layout in ['grid','list','mosaic','editorial']:
  doc=lxml.html.fromstring(f'<html data-icon-shape="{shape}" data-salon-layout="{layout}"><body class="adminApp"><div class="ownerTools162"><section class="toolGroup"><div class="toolCells"><button class="toolItem"><span><svg></svg></span><b>商品管理</b></button></div></section></div></body></html>')
  vals={}
  for el in cssselect2.ElementWrapper.from_html_root(doc).iter_subtree():
   v={}
   for spec,order,pseudo,decs in matcher.match(el):
    if pseudo:continue
    for d in decs:
     if d.type!='declaration':continue
     key=(d.important,spec,order)
     if d.lower_name not in v or key>=v[d.lower_name][0]:v[d.lower_name]=(key,tinycss2.serialize(d.value).strip())
   vals[el.etree_element.tag]={k:v[1] for k,v in v.items()}
  assert 'salon-icon' in vals['svg']['color'],vals['svg']
  assert 'salon-icon-width' in vals['span']['width'],vals['span']
  assert 'salon-icon-radius' in vals['span']['border-radius']
  assert vals['span']['background']=='transparent' if shape=='none' else 'salon-icon-fill' in vals['span']['background']
  assert 'salon-icon-text' in vals['b']['color']
  if layout=='list':assert vals['div']['grid-template-columns']=='1fr', vals['div']
print('PASS production stylesheet cascade: 4 icon shapes × 4 layouts; fill, stroke, text and sizing stay configurable')
