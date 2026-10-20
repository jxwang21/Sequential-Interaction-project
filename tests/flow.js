/* End-to-end check of the whole sequence (order, locking, wrong-input retry, persistent paper, ending, restart).
   Usage:  python3 -m http.server 8123 --directory docs &  then  SHOTS=/tmp node tests/flow.js [url]
   Needs the `playwright` package and a Chromium (set CHROME=/path/to/chrome if it is not auto-detected). */
const { chromium } = require('playwright');
const H = require('./helpers');
const SH=(process.env.SHOTS||'.')+'/';
const URL=process.argv[2]||'http://localhost:8123/index.html';  // serve /docs first, e.g. python3 -m http.server 8123 --directory docs
const results=[];
function check(name,ok,extra){results.push([ok,name,extra||'']);console.log((ok?'PASS ':'FAIL ')+name+(extra?'  -> '+extra:''));}
(async()=>{
  const b=await chromium.launch({...(process.env.CHROME?{executablePath:process.env.CHROME}:{}),args:['--no-sandbox']});
  const p=await b.newPage({viewport:{width:1100,height:800}});
  const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push(String(e)));p.on('requestfailed',r=>errs.push('REQFAIL '+r.url()));
  await p.goto(URL); await p.waitForTimeout(700);

  const st=()=>p.evaluate(()=>({
    label:document.getElementById('step-label').textContent,
    step:document.getElementById('paper').dataset.step,
    phase:document.getElementById('paper').dataset.phase,
    prog:[...document.querySelectorAll('#progress li')].map(l=>l.dataset.state).join(','),
    stamps:[...document.querySelectorAll('#stamps .stamp')].map(s=>s.classList.contains('on')?1:0).join(''),
    scenes:[...document.querySelectorAll('#scene-host > .scene-root')].map(e=>e.className).join('|'),
    status:document.getElementById('status').dataset.mode,
    hint:document.getElementById('hint').textContent
  }));
  const press=async(sel)=>{await p.locator(sel).first().click();await p.waitForTimeout(60)};
  const waitPhase=(ph,step,t=15000)=>p.waitForFunction(([ph,step])=>{const d=document.getElementById('paper').dataset;return d.phase===ph&&(!step||d.step===step)},[ph,step],{timeout:t});

  // tag the paper element to prove it is never replaced
  await p.evaluate(()=>{window.__paper=document.getElementById('paper');window.__paper.__tag='same-paper'});
  const samePaper=()=>p.evaluate(()=>document.getElementById('paper')===window.__paper&&window.__paper.__tag==='same-paper'&&document.querySelectorAll('#paper').length===1);

  let s=await st();
  check('start: Step 1 of 4',s.label==='Step 1 of 4');
  check('start: progress current/locked',s.prog==='current,locked,locked,locked',s.prog);
  check('start: only step 1 mounted',s.scenes==='scene-root s1',s.scenes);
  check('start: no stamps',s.stamps==='0000');
  check('start: hint present',s.hint.length>10,s.hint);
  check('start: later scenes have no DOM (.s2/.s3/.s4 absent)',await p.locator('.s2,.s3,.s4').count()===0);

  // ---- STEP 1: incomplete (2 of 3 correct), then wrong, then complete
  // frames: 0 dots, 1 triangles, 2 eye ; answer triangles, eye, dots
  await press('.s1 .frame:nth-child(2)'); await press('.s1 .frame:nth-child(3)');
  await p.waitForTimeout(500);
  s=await st();
  check('S1 incomplete (2/3): stays on step 1, no stamp, no next scene',s.step==='1'&&s.stamps==='0000'&&s.scenes==='scene-root s1'&&s.phase==='playing',JSON.stringify(s));
  check('S1 incomplete: two frames pressed in',await p.locator('.s1 .frame.on').count()===2);
  // wrong 3rd press (triangles already on is ignored; press nothing wrong here) -> test wrong later via reset
  // wrong: press dots? that is correct. So make a wrong first by restarting the order:
  await p.locator('#restart').click(); await p.waitForTimeout(900);
  s=await st();
  check('Restart mid-step 1 gives fresh step 1',s.step==='1'&&await p.locator('.s1 .frame.on').count()===0&&s.stamps==='0000');
  await press('.s1 .frame:nth-child(1)'); // dots first = wrong
  await p.waitForTimeout(100);
  check('S1 wrong press darkens frame (.err)',await p.locator('.s1 .frame.err').count()===1);
  await p.waitForTimeout(1500);
  s=await st();
  check('S1 wrong: progress cleared, retry possible, still step 1',s.step==='1'&&await p.locator('.s1 .frame.on').count()===0&&s.stamps==='0000'&&s.scenes==='scene-root s1');
  await press('.s1 .frame:nth-child(2)'); await press('.s1 .frame:nth-child(3)'); await press('.s1 .frame:nth-child(1)');
  await p.waitForTimeout(700);
  s=await st();
  check('S1 final press: step still 1 while success feedback plays',s.step==='1'&&s.phase==='playing'&&s.stamps==='0000',JSON.stringify({ph:s.phase,st:s.stamps}));
  await p.screenshot({path:SH+'s1-open.png'});
  await waitPhase('completing','1');
  s=await st();
  check('S1 success: stamp 1 earned + "Completed" shown',s.stamps==='1000'&&s.status==='completed'&&await p.locator('.s1 .clock.open').count()===1,JSON.stringify(s));
  await p.screenshot({path:SH+'s1-completed.png'});
  await waitPhase('playing','2');
  s=await st();
  check('Auto-advance to step 2 (no click)',s.label==='Step 2 of 4'&&s.scenes==='scene-root s2'&&s.prog==='done,current,locked,locked',JSON.stringify(s));
  check('Stamp 1 persists on step 2',s.stamps==='1000');
  check('Same paper element after step change',await samePaper());
  check('Step 1 scene removed from DOM',await p.locator('.s1').count()===0);
  await p.waitForTimeout(600); await p.screenshot({path:SH+'s2.png'});

  // ---- STEP 2: route up,right,down,left
  await press('.s2 .btn[data-dir=up]'); await p.waitForTimeout(1100);
  await press('.s2 .btn[data-dir=right]'); await p.waitForTimeout(1100);
  s=await st();
  check('S2 incomplete (2/4): stays on step 2',s.step==='2'&&s.stamps==='1000'&&s.scenes==='scene-root s2');
  check('S2 two dots filled, city at 30deg',await p.locator('.s2 .mark.on').count()===2&&await p.evaluate(()=>document.getElementById('city').style.getPropertyValue('--a'))==='30deg');
  await press('.s2 .btn[data-dir=up]'); // wrong (expected down)
  await p.waitForTimeout(100);
  const errNow=await p.locator('.s2 .btn.err').count()===1;
  await p.waitForTimeout(450);
  check('S2 wrong: button shows .err, then dots cleared',errNow&&await p.locator('.s2 .mark.on').count()===0);
  await p.waitForTimeout(2000);
  s=await st();
  check('S2 wrong: city returned to 0deg, still step 2, stamp 1 kept',await p.evaluate(()=>document.getElementById('city').style.getPropertyValue('--a'))==='0deg'&&s.step==='2'&&s.stamps==='1000');
  for(const d of ['up','right','down','left']){await press('.s2 .btn[data-dir='+d+']');await p.waitForTimeout(1050);}
  await p.waitForTimeout(500);
  s=await st();
  check('S2 last press: still step 2 while door opens',s.step==='2'&&s.phase==='playing',s.phase);
  await waitPhase('completing','2');
  s=await st();
  check('S2 success: door open, stamp 2, Completed',s.stamps==='1100'&&s.status==='completed'&&await p.locator('.s2 .door.open').count()===1);
  await p.screenshot({path:SH+'s2-completed.png'});
  await waitPhase('playing','3');
  s=await st();
  check('Auto-advance to step 3; stamps 1-2 persist',s.label==='Step 3 of 4'&&s.stamps==='1100'&&s.scenes==='scene-root s3',JSON.stringify(s));
  check('Same paper after step 3',await samePaper());
  await p.waitForTimeout(600); await p.screenshot({path:SH+'s3.png'});

  // ---- STEP 3: drag five of ten letters into five slots (word AWAKE)
  const topOpacity=()=>p.evaluate(()=>+getComputedStyle(document.getElementById('top')).opacity);
  let id=await H.idsFor(p);
  await H.dragToSlot(p,id.A1,0); await H.settle(p); await H.dragToSlot(p,id.W,1); await H.settle(p);
  s=await st();
  check('S3 incomplete (2/5 placed): stays on step 3, no judgement, top hidden',s.step==='3'&&s.stamps==='1100'&&s.phase==='playing'&&await topOpacity()<0.05&&await p.locator('#msg.show').count()===0);
  await H.dragToSlot(p,id.M,2); await H.settle(p); await H.dragToSlot(p,id.O,3); await H.settle(p); await H.dragToSlot(p,id.N,4);
  await p.waitForTimeout(500);
  check('S3 wrong word: "Not quite. Try again." shown',await p.locator('#msg.show').count()===1);
  await p.waitForTimeout(2200);
  s=await st();
  check('S3 wrong word: letters back in rack, top hidden, still step 3, stamps kept',s.step==='3'&&s.stamps==='1100'&&(await H.tileInfo(p)).every(t=>t.loc.startsWith('rack'))&&await topOpacity()<0.05,JSON.stringify(s));
  id=await H.idsFor(p);
  await H.fillAwake(p);
  await p.waitForTimeout(300);
  s=await st();
  check('S3 right word placed: step 3 still playing while the top rises',s.step==='3'&&s.phase==='playing');
  await p.screenshot({path:SH+'s3-rising.png'});
  await waitPhase('completing','3',12000);
  s=await st();
  check('S3 success: top risen, stamp 3, Completed',s.stamps==='1110'&&s.status==='completed'&&await p.evaluate(()=>+getComputedStyle(document.getElementById('top')).opacity)>0.95,JSON.stringify(s));
  await waitPhase('playing','4');
  s=await st();
  check('Auto-advance to step 4; stamps 1-3 persist',s.label==='Step 4 of 4'&&s.stamps==='1110'&&s.scenes==='scene-root s4'&&s.prog==='done,done,done,current',JSON.stringify(s));
  check('Step 4 hint is "Tap to spin. Pause to reveal each number."',s.hint==='Tap to spin. Pause to reveal each number.',s.hint);
  check('Same paper after step 4',await samePaper());
  await p.waitForTimeout(600); await p.screenshot({path:SH+'s4.png'});

  // ---- STEP 4: spin the top to enter 3 -> 1 -> 7 (clock 3:17 is the clue)
  check('S4: clock 3:17, three empty slots, the top; old number buttons gone',await p.locator('.s4 [aria-label="Clock showing 3:17"]').count()===1&&await p.locator('.s4 .slot').count()===3&&(await p.locator('#scene').getAttribute('data-entered'))===''&&await p.locator('.s4 .mark, .s4 #marks').count()===0);
  await H.enterDigit(p,2);                      // wrong first digit (2 instead of 3)
  await p.waitForTimeout(200);
  check('S4 wrong digit: "Wrong sequence. Try again." shown',(await p.locator('#msg').textContent())==='Wrong sequence. Try again.'&&await p.locator('#msg.show').count()===1);
  await p.waitForTimeout(1500);
  s=await st();
  check('S4 wrong digit: slots cleared, still step 4, stamps 1-3 kept',(await p.locator('#scene').getAttribute('data-entered'))===''&&s.step==='4'&&s.phase==='playing'&&s.stamps==='1110'&&s.scenes==='scene-root s4',JSON.stringify(s));
  await H.enterDigit(p,3); await p.waitForTimeout(500); await H.enterDigit(p,1); await p.waitForTimeout(500);
  s=await st();
  check('S4: 3 then 1 entered correctly, step 4 still playing (code incomplete)',(await p.locator('#scene').getAttribute('data-entered'))==='3,1'&&s.phase==='playing'&&s.stamps==='1110');
  await H.enterDigit(p,7);
  await waitPhase('completing','4',8000);
  s=await st();
  check('S4 success (3,1,7): stamp 4 + Completed',s.stamps==='1111'&&s.status==='completed',JSON.stringify(s));
  await waitPhase('ended','4');
  s=await st();
  const endTxt=await p.locator('#ending-text').textContent();
  check('Ending: "All steps completed" visible with 4 stamps',endTxt==='All steps completed'&&s.status==='ended'&&s.stamps==='1111'&&s.prog==='done,done,done,done',JSON.stringify(s));
  check('Ending: "Start again" button visible',await p.locator('#again').isVisible()&&await p.locator('#again').textContent()==='Start again');
  check('Ending: same paper',await samePaper());
  await p.screenshot({path:SH+'end.png'});

  // ---- Start again => step 1, clean
  await p.locator('#again').click(); await p.waitForTimeout(900);
  s=await st();
  check('Start again: back to step 1, stamps cleared, only s1 mounted',s.label==='Step 1 of 4'&&s.stamps==='0000'&&s.scenes==='scene-root s1'&&s.prog==='current,locked,locked,locked'&&s.status==='none',JSON.stringify(s));
  check('Start again: fresh step 1 inputs (no frames on, clock closed)',await p.locator('.s1 .frame.on').count()===0&&await p.locator('.s1 .clock.open').count()===0);
  check('Start again: ending hidden',!(await p.locator('#again').isVisible()));
  check('Start again: same paper',await samePaper());

  // ---- global Restart from step 2 with a stamp
  for(const i of [2,3,1]) await press('.s1 .frame:nth-child('+i+')');
  // wait for step 2
  await waitPhase('playing','2',15000);
  await p.waitForTimeout(500);
  await p.locator('#restart').click(); await p.waitForTimeout(900);
  s=await st();
  check('Restart from step 2: back to step 1, stamps cleared',s.label==='Step 1 of 4'&&s.stamps==='0000'&&s.scenes==='scene-root s1',JSON.stringify(s));
  // restart during a completing animation: no stale advance
  for(const i of [2,3,1]) await press('.s1 .frame:nth-child('+i+')');
  await waitPhase('completing','1');
  await p.locator('#restart').click(); await p.waitForTimeout(3500);
  s=await st();
  check('Restart during "Completed": no stale advance to step 2',s.label==='Step 1 of 4'&&s.scenes==='scene-root s1'&&s.stamps==='0000',JSON.stringify(s));
  check('No console/page/network errors',errs.length===0,JSON.stringify(errs));
  const fails=results.filter(r=>!r[0]);
  console.log('\n'+results.length+' checks, '+fails.length+' failed');
  await b.close();
  process.exit(fails.length?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2)});
