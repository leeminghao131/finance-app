import React,{useEffect,useId,useMemo,useRef,useState} from "react";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";
import {orbitGeometry,orbitCurve} from "./financeTransferOrbit.js";

// Stage 4 visual-only selector. All existing Transfer writes and financial math remain in App.
export default function FinanceTransferCorners({
  methods=[],fromMethod,toMethod,onFrom,onTo,
  amount,onAmountChange,disabled=false,
}){
  const {language}=useFinanceLanguage(),zh=language==="zh";
  const {nodes,count,radius,center,size}=useMemo(()=>orbitGeometry(methods),[methods]);
  const [pendingSource,setPendingSource]=useState(null);
  const [drag,setDrag]=useState(null);
  const [hoverTarget,setHoverTarget]=useState(null);
  const [needsScroll,setNeedsScroll]=useState(false);
  const pointerRef=useRef(null),viewportRef=useRef(null),stageRef=useRef(null);
  const previousPairRef=useRef(null),suppressClickRef=useRef(false),suppressTimerRef=useRef(null);
  const stableId=useId().replace(/:/g,"");
  const wireId="mh-transfer-wire-"+stableId,glowId="mh-transfer-glow-"+stableId;
  useEffect(()=>()=>{
    if(suppressTimerRef.current)window.clearTimeout(suppressTimerRef.current);
  },[]);
  useEffect(()=>{
    const viewport=viewportRef.current;
    if(!viewport)return undefined;
    const measure=()=>{
      setNeedsScroll(viewport.scrollWidth>viewport.clientWidth+2);
      viewport.scrollLeft=Math.max(0,(viewport.scrollWidth-viewport.clientWidth)/2);
    };
    measure();window.addEventListener("resize",measure);
    return ()=>window.removeEventListener("resize",measure);
  },[size]);
  useEffect(()=>{
    if(pendingSource&&!nodes.some(node=>node.method===pendingSource))setPendingSource(null);
  },[pendingSource,nodes]);
  const locate=event=>{
    const rect=stageRef.current?.getBoundingClientRect();
    return rect?{x:event.clientX-rect.left,y:event.clientY-rect.top}:null;
  };
  const nearNode=point=>{
    if(!point)return null;
    return nodes.find(node=>Math.abs(point.x-node.x)<=57&&Math.abs(point.y-node.y)<=38)?.method||null;
  };
  const beginSource=method=>{
    if(disabled)return;
    previousPairRef.current={from:fromMethod,to:toMethod};
    setPendingSource(method);
    onFrom(method);onTo("");
  };
  const selectMethod=method=>{
    if(disabled)return;
    if(!pendingSource){beginSource(method);return;}
    if(method===pendingSource){
      const last=previousPairRef.current;
      if(last){onFrom(last.from);onTo(last.to);}
      setPendingSource(null);previousPairRef.current=null;
      return;
    }
    onFrom(pendingSource);onTo(method);
    setPendingSource(null);previousPairRef.current=null;
  };
  const pointerDown=(event,method)=>{
    if(disabled||event.button!==0||event.isPrimary===false)return;
    pointerRef.current={id:event.pointerId,method,x:event.clientX,y:event.clientY,moved:false};
    try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* Regular click remains available. */}
  };
  const pointerMove=event=>{
    const pointer=pointerRef.current;
    if(!pointer||pointer.id!==event.pointerId)return;
    if(!pointer.moved&&Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)<7)return;
    pointer.moved=true;
    const point=locate(event);
    if(point){
      setDrag({from:pointer.method,...point});
      const target=nearNode(point);
      setHoverTarget(target!==pointer.method?target:null);
    }
    if(event.cancelable)event.preventDefault();
  };
  const pointerFinish=(event,cancelled=false)=>{
    const pointer=pointerRef.current;
    if(!pointer||pointer.id!==event.pointerId)return;
    if(!cancelled&&pointer.moved){
      const target=nearNode(locate(event));
      if(target&&target!==pointer.method){
        onFrom(pointer.method);onTo(target);
        setPendingSource(null);previousPairRef.current=null;
      }else beginSource(pointer.method);
      suppressClickRef.current=true;
      if(suppressTimerRef.current)window.clearTimeout(suppressTimerRef.current);
      suppressTimerRef.current=window.setTimeout(()=>{suppressClickRef.current=false;},210);
    }
    pointerRef.current=null;setDrag(null);setHoverTarget(null);
  };
  const source=nodes.find(node=>node.method===(drag?.from||pendingSource||fromMethod));
  const target=nodes.find(node=>node.method===toMethod);
  const drawnPath=!pendingSource&&!drag&&source&&target&&source.method!==target.method?
    orbitCurve(source,target,center):"";
  const dragPath=drag&&source?orbitCurve(source,drag,center):"";
  const waiting=pendingSource!==null;
  return <section className="mh-transfer-orbit" aria-label={zh?"圆环转账选择器":"Circular money transfer selector"}>
    <div className="mh-transfer-orbit__topline">
      <p>{zh?"转账轨道":"TRANSFER ORBIT"} <span aria-hidden="true">✦</span></p>
      <span>{count} {zh?"个付款方式":"methods"}</span>
    </div>
    <p className="mh-transfer-orbit__help">
      {zh?"点击转出账户，再点击转入账户；也可以按住账户拖出一条资金流线。":
        "Select the source then the destination, or drag a flowing line between methods."}
    </p>
    <div ref={viewportRef} className="mh-transfer-orbit__viewport"
      tabIndex={needsScroll?0:undefined}
      aria-label={zh?"可横向滑动的账户圆环":"Horizontally scrollable method orbit"}>
      <div ref={stageRef} className="mh-transfer-orbit__stage" style={{width:size,height:size}}>
        <svg viewBox={"0 0 "+size+" "+size} className="mh-transfer-orbit__svg" aria-hidden="true">
          <defs>
            <linearGradient id={wireId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f8d593"/><stop offset="48%" stopColor="#f3a65d"/>
              <stop offset="100%" stopColor="#77e5d4"/>
            </linearGradient>
            <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <circle cx={center} cy={center} r={radius} className="mh-transfer-orbit__track"/>
          <circle cx={center} cy={center} r={Math.max(40,radius-9)} className="mh-transfer-orbit__ticks"/>
          <circle cx={center} cy={center} r={radius+14} className="mh-transfer-orbit__outer"/>
          {nodes.map(node=><g key={node.method}>
            <line x1={center} y1={center} x2={node.x} y2={node.y} className="mh-transfer-orbit__spoke"/>
            <circle cx={node.x} cy={node.y} r="4.5" className="mh-transfer-orbit__stud"/>
          </g>)}
          {drawnPath&&<g>
            <path d={drawnPath} className="mh-transfer-orbit__wire-glow" stroke={"url(#"+wireId+")"} filter={"url(#"+glowId+")"}/>
            <path d={drawnPath} className="mh-transfer-orbit__wire" stroke={"url(#"+wireId+")"}/>
          </g>}
          {dragPath&&<g>
            <path d={dragPath} className="mh-transfer-orbit__wire-glow" stroke={"url(#"+wireId+")"} filter={"url(#"+glowId+")"}/>
            <path d={dragPath} className="mh-transfer-orbit__wire mh-transfer-orbit__wire--drag" stroke={"url(#"+wireId+")"}/>
            <circle cx={drag.x} cy={drag.y} r="7" fill="#e2b879" fillOpacity=".35"/>
            <circle cx={drag.x} cy={drag.y} r="3.5" fill="#fef3c7"/>
          </g>}
        </svg>
        {nodes.map(node=>{
          const activeFrom=fromMethod===node.method||pendingSource===node.method||drag?.from===node.method;
          const activeTo=(!pendingSource&&toMethod===node.method)||hoverTarget===node.method;
          return <button key={node.method} type="button" title={node.method}
            data-transfer-method={node.method} disabled={disabled}
            aria-pressed={activeFrom||activeTo}
            aria-label={node.method+(activeFrom?" — From":activeTo?" — To":"")}
            className={"mh-transfer-orbit__node"+(activeFrom?" is-source":"")+(activeTo?" is-target":"")+
              (hoverTarget===node.method?" is-hover-target":"")}
            style={{left:node.x,top:node.y}}
            onPointerDown={e=>pointerDown(e,node.method)}
            onPointerMove={pointerMove}
            onPointerUp={e=>pointerFinish(e)}
            onPointerCancel={e=>pointerFinish(e,true)}
            onClick={()=>{if(!suppressClickRef.current)selectMethod(node.method);}}>
            <span className="mh-transfer-orbit__node-glyph" aria-hidden="true">◆</span>
            <span className="mh-transfer-orbit__node-name" data-i18n-ignore>{node.method}</span>
            {(activeFrom||activeTo)&&<span className="mh-transfer-orbit__node-role">
              {activeFrom?(zh?"转出":"FROM"):(zh?"转入":"TO")}
            </span>}
          </button>;
        })}
        <label className="mh-transfer-orbit__core">
          <span className="mh-transfer-orbit__core-caption">{zh?"转账金额":"TRANSFER AMOUNT"}</span>
          <span className="mh-transfer-orbit__core-currency">RM</span>
          <input type="text" inputMode="numeric" required disabled={disabled}
            aria-label={zh?"转账金额（分位键盘）":"Transfer amount (cents keypad)"}
            title={zh?"输入2455代表RM24.55":"2455 means RM24.55"}
            value={amount === "0.00" ? "" : amount}
            onChange={e=>onAmountChange(e.target.value)}
            onFocus={e=>e.target.select()}
            className="mh-transfer-orbit__amount"/>

        </label>
      </div>
    </div>
    {needsScroll&&<p className="mh-transfer-orbit__scroll-hint">{zh?
      "账户较多：可横向滑动查看整个圆环。":"More methods: scroll horizontally to view the complete ring."}</p>}
    <div role="status" aria-live="polite" className="mh-transfer-orbit__selection">
      <div><small>{zh?"从":"FROM"}</small><strong data-i18n-ignore>{pendingSource||fromMethod||"—"}</strong></div>
      <span className="mh-transfer-orbit__direction" aria-hidden="true">⇢</span>
      <div><small>{zh?"到":"TO"}</small><strong data-i18n-ignore>{waiting?(zh?"请选择":"Select…"):toMethod||"—"}</strong></div>
    </div>

  </section>;
}
