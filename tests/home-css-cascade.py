"""Regression: resolve real stylesheet cascade against the customer home DOM.
Run with Python + cssselect2, tinycss2, lxml. No cloud/customer writes.
"""
from pathlib import Path
import re
import cssselect2,tinycss2,lxml.html
root=Path(__file__).resolve().parent.parent
source=(root/'customer.html').read_text()
styles=[]
for m in re.finditer(r'<style[^>]*>(.*?)</style>|<link[^>]*href="\./([^"?]+\.css)(?:\?[^"]*)?"[^>]*>',source,re.S):
 styles.append(m[1] if m[1] is not None else (root/m[2]).read_text())
for width,height in [(320,568),(390,844),(430,932),(768,1024)]:
 for notice in ['', ' hasNotice']:
  doc=lxml.html.fromstring(source);body=doc.find('body');body.set('class','customerApp'+notice);body.set('data-page','inbox')
  inbox=doc.get_element_by_id('inbox');inbox.set('class','')
  cards=lxml.html.fragment_fromstring('<div id="homeCards" data-layout="mosaic" data-arrangement="four">'+''.join('<button class="homeMosaicTile topicTile topic-'+key+'">'+key+'</button>' for key in ['holidays','products','feature','board'])+'</div>');inbox.insert(0,cards)
  matcher=cssselect2.Matcher();order=0
  def rules(tokens):
   global order
   for rule in tokens:
    if rule.type=='at-rule' and rule.lower_at_keyword=='media' and rule.content:
     q=tinycss2.serialize(rule.prelude)
     checks=re.findall(r'(min|max)-(width|height)\s*:\s*(\d+)px',q)
     if all((width if axis=='width' else height)>=int(n) if kind=='min' else (width if axis=='width' else height)<=int(n) for kind,axis,n in checks):rules(tinycss2.parse_rule_list(rule.content,skip_whitespace=True,skip_comments=True))
    if rule.type!='qualified-rule':continue
    declarations=tinycss2.parse_declaration_list(rule.content,skip_whitespace=True,skip_comments=True)
    try:selectors=cssselect2.compile_selector_list(tinycss2.serialize(rule.prelude))
    except cssselect2.SelectorError:continue
    for selector in selectors:matcher.add_selector(selector,declarations)
  for style in styles:rules(tinycss2.parse_stylesheet(style,skip_whitespace=True,skip_comments=True))
  resolved={}
  for el in cssselect2.ElementWrapper.from_html_root(doc).iter_subtree():
   vals={}
   for specificity,order,pseudo,decs in matcher.match(el):
    if pseudo:continue
    for d in decs:
     if d.type!='declaration':continue
     key=(d.important,specificity,order);value=tinycss2.serialize(d.value).strip()
     names=[d.lower_name]
     if d.lower_name=='padding':names+=['padding-top']
     for name in names:
      if name not in vals or key>=vals[name][0]:vals[name]=(key,value)
   resolved[el.etree_element]={k:v[1] for k,v in vals.items()}
  header=resolved[doc.get_element_by_id('customerHeader')];assert header['transform']=='none',header
  shell=resolved[doc.get_element_by_id('customerAppShell')];assert '140px' not in shell['padding-top'],shell
  for card in cards:
   v=resolved[card];assert v['grid-column']=='auto' and v['grid-row']=='auto',(width,v)
   assert v['min-height']=='0' and v['height']=='100%',(width,v)
  assert resolved[cards]['grid-auto-rows']=='auto'
  entry=resolved[doc.get_element_by_id('enterChat')];assert entry['margin']=='0',entry
  print('PASS cascade',width,height,'marquee',bool(notice))
