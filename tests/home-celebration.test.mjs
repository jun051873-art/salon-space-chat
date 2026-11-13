import assert from 'node:assert/strict';
import {homeCelebration,normalizeCelebration} from '../home-celebration.js';
const c={enabled:true,birthday:true,automatic:true};
const at=s=>new Date(s+'T12:00:00+08:00');
assert.equal(homeCelebration({}, {},at('2026-12-25')),null);
assert.equal(homeCelebration(c,{},at('2026-12-25')).effect,'snow');
assert.equal(homeCelebration(c,{birthMonth:12,birthDay:25},at('2026-12-25')).effect,'gifts');
assert.equal(homeCelebration(c,{},new Date('2026-12-31T16:01:00Z')).day,'2027-01-01');
for(const [day,effect]of [['2026-02-17','newyear'],['2026-03-03','lanterns'],['2026-06-19','dragonboat'],['2026-09-25','midautumn']])assert.equal(homeCelebration(c,{},at(day))?.effect,effect,day);
const manual={...c,manual:true,effect:'petals',start:'2026-12-24',end:'2026-12-26'};
assert.equal(homeCelebration(manual,{},at('2026-12-25')).effect,'petals');
assert.equal(homeCelebration(manual,{birthMonth:12,birthDay:25},at('2026-12-25')).effect,'gifts');
assert.equal(homeCelebration({...c,automatic:false},{},at('2026-12-25')),null);
assert.equal(homeCelebration({...c,solar:true},{},at('2026-11-13')).effect,'moon');
assert.equal(normalizeCelebration({effect:'<script>'}).effect,'gifts');
console.log('PASS home effect date boundaries, Taiwan timezone, lunar festivals, birthday priority, manual range and independent switches');

// 2026/2027 anchors checked against Hong Kong Observatory annual conversion tables.
for(const [date,effect] of [['2026-02-16','newyear'],['2027-02-05','newyear'],['2027-02-06','newyear'],['2027-06-09','dragonboat'],['2027-09-15','midautumn'],['2026-10-31','halloween']])assert.equal(homeCelebration(c,{},at(date))?.effect,effect,date);
const cross={...c,manual:true,start:'2026-12-20',end:'2027-01-05',effect:'petals'};
assert.equal(homeCelebration(cross,{},at('2027-01-01')).effect,'petals');
assert.equal(homeCelebration(cross,{},at('2027-01-06')),null);
assert.equal(homeCelebration({...c,festivals:{halloween:false}},{},at('2026-10-31')),null);
assert.equal(normalizeCelebration({start:'2026-02-30'}).start,'');
assert.equal(homeCelebration(c,{birthMonth:2,birthDay:29},at('2028-02-29')).effect,'gifts');
assert.equal(homeCelebration(c,{birthMonth:2,birthDay:29},at('2027-02-28')),null);
console.log('PASS New Year Eve, 2027 lunar anchors, cross-year schedule, disabled holiday, invalid date, leap birthday');
