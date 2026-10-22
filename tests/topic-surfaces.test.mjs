import assert from 'node:assert/strict';
import {homeMosaicHTML} from '../home-mosaic.js';
import {normalizeTheme,normalizeSurfaces,surfaceVars} from '../salon-theme.js';
const esc=s=>String(s??'').replaceAll('<','&lt;').replaceAll('"','&quot;');
const state={sections:{products:true,events:true,notice:true},feature:{title:'主打'},notice:'公告',products:Array.from({length:40},(_,id)=>({id,title:'商品',image:'data:image/jpeg;base64,a'})),events:[{id:'a'},{id:'b'}],notices:[{id:'c'},{id:'d'}]};
const html=homeMosaicHTML(state,esc);
assert.equal((html.match(/<button/g)||[]).length,5);
assert.equal((html.match(/data-home-products/g)||[]).length,1);
assert.equal((html.match(/data-home-collection="events"/g)||[]).length,1);
assert.doesNotMatch(html,/<img|data-home-product=/);
assert.equal(homeMosaicHTML({...state,sections:{feature:false,products:false,events:false,notice:false,board:false}},esc),'');
assert.equal(homeMosaicHTML({sections:{products:true},products:[]},esc),'');
const safe=normalizeSurfaces({home:{start:'red;display:none',end:'#123456',ink:'#ffffff',opacity:400,blur:-4,radius:900,angle:700},'bad]{}':{start:'#000000'}});
assert.deepEqual(Object.keys(safe),['home']);assert.equal(safe.home.opacity,100);assert.equal(safe.home.blur,0);assert.equal(safe.home.radius,40);assert.equal(safe.home.angle,360);assert.equal(safe.home.start,'#f9f6f0');
const t=normalizeTheme({surfaces:safe});assert.deepEqual(normalizeTheme(t),t);safe.home.end='#000000';assert.equal(t.surfaces.home.end,'#123456');assert.equal(surfaceVars(t.surfaces.home)['--surface-ink'],'#ffffff');
console.log('PASS one entrance per topic, empty/disabled categories, no homepage images, bounded scoped theme settings and independent copies');

const tiles=normalizeSurfaces({tileFeature:{start:'#ffeedd'},tileProducts:{start:'#ddeecc'},holiday:{end:'#ccddee'}});assert.equal(tiles.tileFeature.start,'#ffeedd');assert.equal(tiles.tileProducts.start,'#ddeecc');assert.equal(tiles.holiday.end,'#ccddee');
