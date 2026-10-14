/* Step 4: ported from studies/ (see STUDY.md there). Gestures, timings and feedback are unchanged;
   changes: no per-step reset button, scene can be destroyed, and api.complete() fires once the success feedback has finished. */
(function () {
  var Scenes = (window.Scenes = window.Scenes || {});
  Scenes[4] = {
    html: `
<div class="stage">
<svg class="scene" id="scene" viewBox="0 0 360 400" role="img" aria-label="A stationary spinning top above three numbered marks">
  <defs>
    <filter id="soft2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>
    <filter id="soft3" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="soft25" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5"/></filter>
    <clipPath id="coneclip"><polygon points="20,52 100,52 60,148"/></clipPath>
  </defs>

  <!-- clock showing 3:17 -->
  <g transform="translate(132 4) scale(.8)">
    <circle cx="63" cy="64" r="52" fill="#000" stroke="none" opacity=".6" filter="url(#soft25)"/>
    <circle cx="60" cy="60" r="52" fill="#1d1d1d"/>
    <path d="M12 60 A48 48 0 0 1 60 12" stroke="#565656"/>
    <path d="M108 60 A48 48 0 0 1 60 108" stroke="#060606"/>
    <circle cx="60" cy="60" r="43" fill="#161616" stroke="#5e5e5e"/>
    <line x1="60" y1="19" x2="60" y2="26"/>
    <line x1="60" y1="19" x2="60" y2="26" transform="rotate(90 60 60)"/>
    <line x1="60" y1="19" x2="60" y2="26" transform="rotate(180 60 60)"/>
    <line x1="60" y1="19" x2="60" y2="26" transform="rotate(270 60 60)"/>
    <rect x="27" y="43" width="66" height="34" rx="3" fill="#0d0d0d" stroke="#5e5e5e"/>
    <g transform="translate(60 60) scale(.75) translate(-120 -83)" stroke="#dcdcdc">
      <path d="M85 66 H103 V100 H85 M92 83 H103"/>
      <circle cx="114" cy="76" r="1.8" fill="#dcdcdc" stroke="none"/>
      <circle cx="114" cy="90" r="1.8" fill="#dcdcdc" stroke="none"/>
      <path d="M126 66 V100 M126 66 L120 72"/>
      <path d="M137 66 H155 V100"/>
    </g>
  </g>

  <!-- top with contact shadow; tip at (180,256) -->
  <g transform="translate(120 108)">
    <ellipse cx="60" cy="152" rx="38" ry="8" fill="#000" stroke="none" opacity=".55" filter="url(#soft3)"/>
    <g id="top">
      <rect x="56" y="10" width="8" height="36" rx="1" fill="#1d1d1d"/>
      <g id="top-body">
        <polygon points="20,52 100,52 60,148" fill="#1d1d1d"/>
        <g clip-path="url(#coneclip)" stroke="none">
          <rect id="shine" x="-3" y="52" width="6" height="96" fill="#fff" opacity="0"/>
          <rect id="dusk" x="-5" y="52" width="10" height="96" fill="#000" opacity="0"/>
        </g>
        <path d="M24 60 L58 136" stroke="#565656"/>
        <path d="M31 70 Q60 82 89 70" stroke="#5e5e5e"/>
        <ellipse id="top-mark" cx="76" cy="81" rx="4.5" ry="4.5" fill="#2e2e2e" stroke="#f2f2f2"/>
      </g>
      <ellipse cx="60" cy="52" rx="40" ry="10" fill="#161616"/>
    </g>
  </g>

  <g id="marks"></g>
</svg>
</div>
`,
    mount: function (api) {
      var SEQ=[3,1,7], ORDER=[1,7,3];
      var DIGIT={1:"M44 28 V60 M36 36 L44 28",7:"M32 28 H56 L42 60",3:"M32 28 H56 V60 H32 M40 44 H56"};
      var NS="http://www.w3.org/2000/svg";
      var scene=document.getElementById("scene"), host=document.getElementById("marks");
      var marks=[];
      ORDER.forEach(function(n,i){
        var g=document.createElementNS(NS,"g");
        g.setAttribute("class","mark"); g.setAttribute("data-n",n);
        g.setAttribute("transform","translate("+(80+i*100-44)+" 296)");
        g.setAttribute("tabindex","0"); g.setAttribute("role","button"); g.setAttribute("aria-label","Mark "+n);
        g.innerHTML=
          '<rect class="m-shadow" x="11" y="12" width="76" height="76" rx="3" filter="url(#soft2)"/>'+
          '<g class="m-in">'+
            '<rect class="m-face" x="6" y="6" width="76" height="76" rx="3"/>'+
            '<path class="m-hl" d="M9 79 V9 H79"/><path class="m-sh" d="M79 9 V79 H9"/>'+
            '<rect class="m-plate" x="15" y="15" width="58" height="58" rx="2"/>'+
            '<path class="m-digit" d="'+DIGIT[n]+'"/>'+
          '</g>'+
          '<rect class="hit" x="6" y="6" width="76" height="76"/>';
        host.appendChild(g); marks.push(g);
      });

      var mark=document.getElementById("top-mark"), shine=document.getElementById("shine"), dusk=document.getElementById("dusk");
      var U0=1.2, R=16/Math.sin(U0), C0=Math.cos(U0), WMAX=7;
      var phi=0, raf=0, t0=0, last=0, p=0, locked=false, pressing=null, timers=[];

      function later(fn,ms){var t=setTimeout(function(){timers=timers.filter(function(x){return x!==t});fn()},ms);timers.push(t)}

      function draw(ph,ramp){
        var u=U0+ph, c=Math.cos(u), f=c>0?Math.min(1,c/C0):0;
        mark.setAttribute("cx",60+R*Math.sin(u));
        mark.setAttribute("cy",81+2.5*(c-C0));
        mark.setAttribute("rx",Math.max(.01,4.5*f));
        mark.setAttribute("opacity",f>0.04?1:0);
        var a=u+.9;
        shine.setAttribute("x",60+30*Math.sin(a)-3);
        shine.setAttribute("opacity",.15*Math.max(0,Math.cos(a))*ramp);
        var b=a+Math.PI;
        dusk.setAttribute("x",60+30*Math.sin(b)-5);
        dusk.setAttribute("opacity",.3*Math.max(0,Math.cos(b))*ramp);
      }
      function restoreTop(){
        mark.setAttribute("cx",76); mark.setAttribute("cy",81); mark.setAttribute("rx",4.5); mark.setAttribute("opacity",1);
        shine.setAttribute("opacity",0); dusk.setAttribute("opacity",0);
      }
      function frame(t){
        if(!t0){t0=last=t}
        var dt=Math.min(.05,(t-last)/1000); last=t;
        var q=Math.min(1,(t-t0)/600), w=WMAX*(1-(1-q)*(1-q));
        phi+=w*dt;
        draw(phi,Math.min(1,(t-t0)/300));
        raf=requestAnimationFrame(frame);
      }
      function startSpin(){t0=0;phi=0;raf=requestAnimationFrame(frame)}

      function choose(m,n){
        if(locked||m.classList.contains("active"))return;
        if(n===SEQ[p]){
          m.classList.add("active"); p++;
          if(p===SEQ.length){
            locked=true; scene.classList.add("locked"); m.classList.add("pulse");
            startSpin(); later(function(){m.classList.remove("pulse")},140);
            // let the spin-up (600ms) finish and the top be seen spinning
            later(api.complete,600+1300);
          }
        }else{
          locked=true; scene.classList.add("locked"); m.classList.add("error");
          later(function(){
            marks.forEach(function(x){x.classList.remove("active","error","down")});
            p=0; locked=false; scene.classList.remove("locked");
          },250);
        }
      }

      marks.forEach(function(m){
        var n=+m.getAttribute("data-n"), hit=m.querySelector(".hit");
        function inside(e){var r=hit.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom}
        m.addEventListener("pointerdown",function(e){
          if(locked||m.classList.contains("active")||(e.pointerType==="mouse"&&e.button!==0))return;
          pressing=m; m.classList.add("down");
          try{m.setPointerCapture(e.pointerId)}catch(_){}
          e.preventDefault();
        });
        m.addEventListener("pointermove",function(e){if(pressing===m)m.classList.toggle("down",inside(e))});
        m.addEventListener("pointerup",function(e){
          if(pressing!==m)return;
          pressing=null; var ok=inside(e); m.classList.remove("down");
          if(ok)choose(m,n);
        });
        m.addEventListener("pointercancel",function(){if(pressing===m)pressing=null;m.classList.remove("down")});
        m.addEventListener("contextmenu",function(e){e.preventDefault()});
        m.addEventListener("keydown",function(e){
          if((e.key==="Enter"||e.key===" ")&&!e.repeat&&!locked&&!m.classList.contains("active")){m.classList.add("down");e.preventDefault()}
        });
        m.addEventListener("keyup",function(e){
          if((e.key==="Enter"||e.key===" ")&&m.classList.contains("down")){m.classList.remove("down");choose(m,n)}
        });
        m.addEventListener("blur",function(){if(pressing!==m)m.classList.remove("down")});
      });

      return {
        destroy:function(){
          timers.forEach(clearTimeout); timers=[];
          cancelAnimationFrame(raf); raf=0;
          pressing=null;
        }
      };
    }
  };
})();
