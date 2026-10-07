
// ==================== Adapter: oms-v430-mobile-landscape-desktop ====================
(()=>{
  const root=document.documentElement;
  let raf=0,last=null;

  const isTouchLandscape=()=>{
    let coarse=false,hoverNone=true,landscape=false;
    try{
      coarse=window.matchMedia('(pointer:coarse)').matches || (navigator.maxTouchPoints||0)>0;
      hoverNone=window.matchMedia('(hover:none)').matches;
      landscape=window.matchMedia('(orientation:landscape)').matches || window.innerWidth>window.innerHeight;
    }catch(e){
      coarse=(navigator.maxTouchPoints||0)>0;
      landscape=window.innerWidth>window.innerHeight;
    }
    // A real touch-first landscape device gets the desktop workspace. A hybrid
    // desktop with a mouse keeps its normal CSS desktop behavior.
    return !!(coarse&&hoverNone&&landscape);
  };

  const relayout=(desktopLandscape)=>{
    // Orientation is layout-only. Do not serialize/restore, recreate the model,
    // replace the project object, or touch history stacks.
    const keepTime=typeof model!=='undefined'?model.time:null;
    const keepSelected=typeof model!=='undefined'?model.selected:null;
    const keepProject=typeof model!=='undefined'?model.project:null;

    if(desktopLandscape){
      try{editorSplit?.clearManualSelectedSticky?.({restore:true})}catch(e){}
      try{editorSplit?.stopSelectedLayerFocusSession?.({restore:true})}catch(e){}
    }

    try{portraitSideControls?.sync?.({refit:false})}catch(e){}

    const main=document.querySelector('.editorMain');
    if(main&&desktopLandscape){
      main.classList.remove('fitCompositionLayout');
      main.style.removeProperty('grid-template-rows');
    }

    requestAnimationFrame(()=>{
      try{ui?.fit?.()}catch(e){}
      try{timeline?.rebuild?.()}catch(e){}
      try{renderer?.resize?.()}catch(e){}

      // Returning to portrait while an Inspector is already open should regain
      // the normal mobile Inspector focus rules without reopening the project.
      if(!desktopLandscape){
        try{
          if(editorSplit?.isDrawerOpen?.())editorSplit?.onDrawerOpened?.(false);
          else editorSplit?.afterFit?.();
        }catch(e){}
      }

      // Fail closed against any layout callback accidentally navigating state.
      if(typeof model!=='undefined'){
        if(model.project===keepProject){
          if(keepTime!=null)model.time=keepTime;
          model.selected=keepSelected;
        }
      }
      try{renderer?.render?.()}catch(e){}
      try{ui?.sync?.()}catch(e){}
    });
  };

  const sync=()=>{
    raf=0;
    const next=isTouchLandscape();
    if(next===last)return;
    last=next;
    root.classList.toggle('omsMobileLandscapeDesktop',next);
    root.dataset.workspaceMode=next?'desktop-landscape':'responsive';
    relayout(next);
  };

  const schedule=()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(sync);
  };

  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
  try{screen.orientation?.addEventListener?.('change',schedule)}catch(e){}
  try{window.matchMedia('(orientation:landscape)').addEventListener?.('change',schedule)}catch(e){}

  // Resolve after the original editor controllers have initialized.
  schedule();
})();

// ==================== Adapter: oms-v431-desktop-canvas-split-menu-fit ====================
(()=>{
  const root=document.documentElement;
  const STORAGE_KEY='omsDesktopLandscapePreviewRatio';
  const MIN_PREVIEW=220;
  const MIN_TIMELINE=260;
  let handle=null;
  let raf=0;
  let originalPositionLayerActions=null;

  const inDesktopLandscape=()=>root.classList.contains('omsMobileLandscapeDesktop');
  const editorMain=()=>document.querySelector('.editorMain');
  const timelineArea=()=>document.querySelector('.timelineArea');

  function ensureHandle(){
    const ta=timelineArea();
    if(!ta)return null;
    if(handle&&handle.isConnected)return handle;
    handle=document.createElement('button');
    handle.type='button';
    handle.id='desktopCanvasSplitHandle';
    handle.setAttribute('aria-label','Geser lebar canvas dan timeline');
    handle.setAttribute('title','Geser untuk mengatur lebar canvas');
    handle.innerHTML='<span class="desktopCanvasSplitGrip" aria-hidden="true"><i></i></span>';
    ta.appendChild(handle);

    let active=false,startX=0,startPreview=0;
    const onMove=(clientX)=>{
      const main=editorMain();
      if(!main)return;
      const rect=main.getBoundingClientRect();
      const delta=clientX-startX;
      const maxPreview=Math.max(MIN_PREVIEW,rect.width-MIN_TIMELINE);
      const next=Math.max(MIN_PREVIEW,Math.min(maxPreview,startPreview+delta));
      const ratio=Math.max(.26,Math.min(.74,next/Math.max(1,rect.width)));
      try{localStorage.setItem(STORAGE_KEY,String(ratio))}catch(e){}
      applySplit(ratio);
    };
    const move=(ev)=>{if(!active)return;ev.preventDefault();onMove(ev.clientX)};
    const up=(ev)=>{
      if(!active)return;
      active=false;
      handle.classList.remove('dragging');
      try{handle.releasePointerCapture(ev.pointerId)}catch(e){}
      window.removeEventListener('pointermove',move,true);
      window.removeEventListener('pointerup',up,true);
      window.removeEventListener('pointercancel',up,true);
      try{ui?.fit?.()}catch(e){}
      try{timeline?.rebuild?.()}catch(e){}
      try{renderer?.resize?.()}catch(e){}
      try{renderer?.render?.()}catch(e){}
    };
    handle.addEventListener('pointerdown',ev=>{
      if(!inDesktopLandscape())return;
      const main=editorMain();
      if(!main)return;
      ev.preventDefault();
      active=true;
      startX=ev.clientX;
      startPreview=previewWidth(main);
      handle.classList.add('dragging');
      try{handle.setPointerCapture(ev.pointerId)}catch(e){}
      window.addEventListener('pointermove',move,true);
      window.addEventListener('pointerup',up,true);
      window.addEventListener('pointercancel',up,true);
    },{passive:false});
    return handle;
  }

  function previewWidth(main){
    const cs=getComputedStyle(main);
    const cols=(cs.gridTemplateColumns||'').split(' ');
    if(cols.length>=2){
      const first=parseFloat(cols[0]);
      if(Number.isFinite(first)&&first>0)return first;
    }
    const rect=main.getBoundingClientRect();
    let ratio=.47;
    try{ratio=parseFloat(localStorage.getItem(STORAGE_KEY))||ratio}catch(e){}
    return rect.width*ratio;
  }

  function applySplit(ratio){
    const main=editorMain();
    if(!main)return;
    if(!inDesktopLandscape()){
      main.style.removeProperty('grid-template-columns');
      return;
    }
    const rect=main.getBoundingClientRect();
    const safeRatio=Math.max(.26,Math.min(.74,Number.isFinite(ratio)?ratio:.47));
    const preview=Math.max(MIN_PREVIEW,Math.min(Math.max(MIN_PREVIEW,rect.width-MIN_TIMELINE),rect.width*safeRatio));
    main.style.setProperty('grid-template-columns',`${Math.round(preview)}px minmax(0,1fr)`,'important');
  }

  function fitLayerActionsPopup(){
    const popup=document.getElementById('layerActionsPopup');
    if(!popup)return;
    popup.style.left='50%';
    popup.style.top='50%';
    popup.style.transform='translate(-50%,-50%)';
    popup.style.width=`${Math.min(344,window.innerWidth-28)}px`;
    popup.style.maxHeight=`${Math.max(200,window.innerHeight-24)}px`;
  }

  function sync(){
    // V4.41: the toolbar controller below is the sole horizontal-split owner.
    // Do not create or run the superseded timeline-edge handle/controller.
    const legacy=document.getElementById('desktopCanvasSplitHandle');
    if(legacy)legacy.remove();
    if(document.getElementById('layerActionsShade')&&!document.getElementById('layerActionsShade').classList.contains('hidden')&&inDesktopLandscape())fitLayerActionsPopup();
  }

  function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(sync)}

  function patchLayerActionsPosition(){
    if(typeof ui==='undefined'||!ui||originalPositionLayerActions)return;
    originalPositionLayerActions=ui.positionLayerActions?.bind(ui);
    if(!originalPositionLayerActions)return;
    ui.positionLayerActions=function(){
      if(inDesktopLandscape())return fitLayerActionsPopup();
      const popup=document.getElementById('layerActionsPopup');
      if(popup)popup.style.removeProperty('transform');
      return originalPositionLayerActions();
    };
  }

  patchLayerActionsPosition();
  schedule();
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
  try{screen.orientation?.addEventListener?.('change',schedule)}catch(e){}
  setTimeout(()=>{patchLayerActionsPosition();schedule()},0);
})();

// ==================== Adapter: oms-v432-desktop-toolbar-split-autofit ====================
(()=>{
  // V4.41 — one horizontal split controller for desktop PC and the existing
  // mobile-landscape desktop workspace. EditorSplitController stays vertical.
  const root=document.documentElement;
  const STORAGE_KEY='omsDesktopCanvasSplitRatioV441A';
  const LEGACY_STORAGE_KEY='omsDesktopLandscapePreviewRatio';
  const MIN_PREVIEW=240;
  const MIN_TIMELINE=320;
  let btn=null;
  let raf=0;
  let fitRAF=0;
  let timelineFitRAF=0;
  let timelineFitReleaseRAF=0;
  let splitKeepTime=0;
  let splitKeepZoomScale=1;
  let splitPreserveUserZoom=false;
  let mainResizeObserver=null;
  let desktopCanvasSplitRatio=null;
  let originalPositionLayerActions=null;

  const inMobileLandscapeDesktop=()=>root.classList.contains('omsMobileLandscapeDesktop');
  const isDesktopPC=()=>window.matchMedia('(min-width:900px)').matches;
  const horizontalSplitEnabled=()=>isDesktopPC()||inMobileLandscapeDesktop();
  const editorMain=()=>document.querySelector('.editorMain');
  const transportToolbar=()=>document.querySelector('.transportBalanced');

  function readRatio(){
    if(Number.isFinite(desktopCanvasSplitRatio))return desktopCanvasSplitRatio;
    let value=NaN;
    try{value=parseFloat(sessionStorage.getItem(STORAGE_KEY))}catch(e){}
    // Preserve the former mobile-landscape ratio only when that layout is active;
    // a phone split must not become the first-run desktop-PC split.
    if(!Number.isFinite(value)&&inMobileLandscapeDesktop()){
      try{value=parseFloat(localStorage.getItem(LEGACY_STORAGE_KEY))}catch(e){}
    }
    desktopCanvasSplitRatio=Number.isFinite(value)?Math.max(.1,Math.min(.9,value)):NaN;
    return desktopCanvasSplitRatio;
  }

  function rememberRatio(value){
    desktopCanvasSplitRatio=Math.max(.1,Math.min(.9,value));
    try{sessionStorage.setItem(STORAGE_KEY,String(desktopCanvasSplitRatio))}catch(e){}
  }

  function beginTimelineSplitFit(){
    if(typeof timeline==='undefined'||!timeline||!model?.project)return;
    // V5.68 — synchronize the restored project BEFORE arming the responsive
    // split fit. syncProjectZoom() intentionally disables initialFitActive when
    // it sees a different project id. In legacy projects that ordering could
    // cancel the splitter's first live-fit pass and resurrect the saved old
    // timeline geometry. Consuming the project switch first makes old and new
    // projects enter the exact same splitter path.
    try{timeline.syncProjectZoom?.()}catch(e){}
    splitKeepTime=clamp(+model.time||0,0,Math.max(0,+model.project.duration||0));
    splitKeepZoomScale=timeline.projectTimelineZoomScale?.(model.project)??1;
    // V5.120 — a completed pinch writes a non-default viewport-relative zoom
    // scale. On mobile landscape that explicit user zoom must survive the
    // three-line splitter. V5.119 always forced scale=1 during splitter drag,
    // which was safe before pinch but discarded the user's zoom and could let
    // ruler/scroll geometry diverge from the centered playhead afterwards.
    splitPreserveUserZoom=inMobileLandscapeDesktop()&&Math.abs(splitKeepZoomScale-1)>.0001;
    timeline._desktopSplitResizeActive=true;
    timeline._desktopSplitResizeTime=splitKeepTime;
    timeline._mobileLandscapeSplitKeepScale=splitKeepZoomScale;
    timeline._mobileLandscapeSplitPreserveUserZoom=splitPreserveUserZoom;
    // Mobile landscape uses the same visible three-line splitter as desktop,
    // but Chromium delivers substantially more intermediate resize callbacks on
    // touch. Mark only that path so its geometry is owned by this transaction;
    // the already-stable desktop-PC behavior remains unchanged.
    timeline._mobileLandscapeSplitResizeActive=inMobileLandscapeDesktop();
    if(timeline._mobileLandscapeSplitResizeActive)timeline._mobileLandscapeSplitSuppressUntil=0;
    // With the default zoom, preserve the established responsive 2-second-fit
    // splitter behavior. After a user pinch on mobile landscape, keep the
    // explicit viewport-relative scale instead of re-arming initial fit.
    timeline.initialFitSeconds=2;
    timeline.initialFitActive=!splitPreserveUserZoom;
    cancelAnimationFrame(timelineFitReleaseRAF);
    timelineFitReleaseRAF=0;
  }

  function scheduleTimelineSplitFit(){
    if(typeof timeline==='undefined'||!timeline?._desktopSplitResizeActive||!model?.project)return;
    cancelAnimationFrame(timelineFitRAF);
    timelineFitRAF=requestAnimationFrame(()=>{
      timelineFitRAF=0;
      if(!timeline._desktopSplitResizeActive||!model?.project)return;
      const keep=clamp(splitKeepTime,0,Math.max(0,+model.project.duration||0));
      model.time=keep;
      timeline._desktopSplitResizeTime=keep;
      timeline.initialFitSeconds=2;
      const preserveMobileZoom=!!timeline._mobileLandscapeSplitResizeActive&&
        !!timeline._mobileLandscapeSplitPreserveUserZoom;
      if(preserveMobileZoom){
        // The pinch scale is dimensionless relative to the CURRENT viewport.
        // Reapply that same scale after every splitter width change so px/s,
        // center padding, ruler and scroll are rebuilt from one coherent width.
        timeline.initialFitActive=false;
        if(model.project)model.project.timelineZoomScale=timeline._mobileLandscapeSplitKeepScale||splitKeepZoomScale||1;
        timeline.applyViewportRelativeProjectZoom?.({persist:true,rebuild:true});
      }else{
        timeline.initialFitActive=true;
        // applyInitialSecondsFit rebuilds ruler/tracks with the NEW centerPad and
        // NEW px/s. This is the piece browser-resize had but the internal splitter
        // lacked, which caused the fixed 50% playhead to appear over another tick.
        timeline.applyInitialSecondsFit?.({persist:true,rebuild:true});
        // At default mobile zoom, commit scale=1 for the NEW viewport so a stale
        // project value cannot be replayed by a delayed ResizeObserver.
        if(timeline._mobileLandscapeSplitResizeActive){
          try{timeline.persistProjectTimelineZoom?.(timeline.px,{scale:1})}catch(e){}
        }
      }
      model.time=keep;
      const sc=document.getElementById('timelineScroll');
      if(sc&&timeline.isCentered?.()){
        timeline.syncingScroll=true;
        const target=keep*timeline.px;
        sc.scrollLeft=target;
        timeline.lastScrollLeft=target;
        requestAnimationFrame(()=>{
          timeline.syncingScroll=false;
          timeline.updatePlayhead?.();
        });
      }else{
        timeline.updatePlayhead?.();
      }
    });
  }

  function endTimelineSplitFit(){
    if(typeof timeline==='undefined'||!timeline?._desktopSplitResizeActive)return;
    // Final pass after layout settles, then keep the guard alive for one more
    // animation frame so Chromium's delayed resize-scroll cannot scrub time.
    scheduleTimelineSplitFit();
    cancelAnimationFrame(timelineFitReleaseRAF);
    const mobileLandscapeTxn=!!timeline._mobileLandscapeSplitResizeActive;
    timelineFitReleaseRAF=requestAnimationFrame(()=>{
      timelineFitReleaseRAF=requestAnimationFrame(()=>{
        if(typeof timeline==='undefined'||!timeline)return;
        const keep=clamp(splitKeepTime,0,Math.max(0,+model.project?.duration||0));
        model.time=keep;
        timeline._desktopSplitResizeTime=keep;

        if(mobileLandscapeTxn){
          // Android landscape needs one authoritative final build after the CSS
          // grid width has stopped changing. Keep the transaction flag active
          // during this rebuild so scroll events cannot reinterpret the layout
          // clamp as a user scrub.
          timeline.initialFitSeconds=2;
          const preserveMobileZoom=!!timeline._mobileLandscapeSplitPreserveUserZoom;
          if(preserveMobileZoom){
            timeline.initialFitActive=false;
            if(model.project)model.project.timelineZoomScale=timeline._mobileLandscapeSplitKeepScale||splitKeepZoomScale||1;
            timeline.applyViewportRelativeProjectZoom?.({persist:true,rebuild:true});
          }else{
            timeline.initialFitActive=true;
            timeline.applyInitialSecondsFit?.({persist:true,rebuild:true});
            try{timeline.persistProjectTimelineZoom?.(timeline.px,{scale:1})}catch(e){}
          }
          model.time=keep;
          const sc=document.getElementById('timelineScroll');
          if(sc&&timeline.isCentered?.()){
            const target=keep*timeline.px;
            timeline.syncingScroll=true;
            sc.scrollLeft=target;
            timeline.lastScrollLeft=target;
          }
          // Ignore late Android ResizeObserver deliveries briefly. The final
          // geometry above is authoritative for this completed drag.
          timeline._mobileLandscapeSplitSuppressUntil=performance.now()+220;
        }

        timeline.updatePlayhead?.();
        timeline._desktopSplitResizeActive=false;
        timeline._mobileLandscapeSplitResizeActive=false;
        timeline._mobileLandscapeSplitPreserveUserZoom=false;
        timeline._mobileLandscapeSplitKeepScale=1;
        splitPreserveUserZoom=false;
        splitKeepZoomScale=1;
        timelineFitReleaseRAF=0;
        requestAnimationFrame(()=>{
          if(typeof timeline==='undefined'||!timeline)return;
          timeline.syncingScroll=false;
          model.time=keep;
          timeline.updatePlayhead?.();
        });
      });
    });
  }

  function fitPopup(){
    const popup=document.getElementById('layerActionsPopup');
    if(!popup)return;
    popup.style.left='50%';
    popup.style.top='50%';
    popup.style.transform='translate(-50%,-50%)';
    popup.style.width=`${Math.min(322, window.innerWidth - 20)}px`;
    popup.style.maxHeight=`${Math.max(210, window.innerHeight - 12)}px`;
  }

  function ensureToolbarHandle(){
    const host=transportToolbar();
    if(!host)return null;
    if(btn&&btn.isConnected)return btn;
    btn=document.createElement('button');
    btn.type='button';
    btn.id='desktopCanvasSplitToolbarBtn';
    btn.setAttribute('aria-label','Geser lebar canvas dan timeline');
    btn.setAttribute('title','Geser untuk mengatur lebar canvas dan timeline');
    btn.innerHTML='<span class="desktopCanvasSplitGripV" aria-hidden="true"><i></i></span>';
    host.appendChild(btn);

    let active=false,activePointerId=null,startX=0,startPreview=0;
    const move=(ev)=>{
      if(!active||ev.pointerId!==activePointerId)return;
      ev.preventDefault();
      const main=editorMain();
      if(!main)return;
      const rect=main.getBoundingClientRect();
      const delta=ev.clientX-startX;
      const raw=startPreview+delta;
      const next=clampPreviewPx(raw,rect.width);
      const ratio=next/Math.max(1,rect.width);
      applySplit(ratio,{ensureFit:false});
      refitCanvasAfterLayout();
      scheduleTimelineSplitFit();
    };
    const up=(ev)=>{
      if(!active||ev.pointerId!==activePointerId)return;
      active=false;
      btn.classList.remove('dragging');
      try{btn.releasePointerCapture(ev.pointerId)}catch(e){}
      activePointerId=null;
      window.removeEventListener('pointermove',move,true);
      window.removeEventListener('pointerup',up,true);
      window.removeEventListener('pointercancel',up,true);
      // The column width is final now. Synchronize center padding and the
      // scrollable end immediately so a fast Jump Start/End click cannot use
      // geometry from before the drag.
      try{timeline?.rebuild?.()}catch(e){}
      refitAfterLayout();
      endTimelineSplitFit();
    };
    btn.addEventListener('pointerdown',ev=>{
      if(!horizontalSplitEnabled())return;
      if(ev.pointerType==='mouse'&&ev.button!==0)return;
      if(active)return;
      const main=editorMain();
      if(!main)return;
      ev.preventDefault();
      const rect=main.getBoundingClientRect();
      active=true;
      activePointerId=ev.pointerId;
      startX=ev.clientX;
      startPreview=currentPreviewPx(rect.width);
      beginTimelineSplitFit();
      btn.classList.add('dragging');
      try{btn.setPointerCapture(ev.pointerId)}catch(e){}
      window.addEventListener('pointermove',move,true);
      window.addEventListener('pointerup',up,true);
      window.addEventListener('pointercancel',up,true);
    },{passive:false});
    return btn;
  }

  function getProjectAspect(){
    const p=(typeof model!=='undefined' && model && model.project)?model.project:null;
    if(!p)return 16/9;
    const w=Math.max(1,+p.width||1);
    const h=Math.max(1,+p.height||1);
    return w/h;
  }

  function clampPreviewPx(px,totalW){
    const maxPreview=Math.max(MIN_PREVIEW, totalW - MIN_TIMELINE);
    return Math.max(MIN_PREVIEW, Math.min(maxPreview, px));
  }

  function desiredPreviewPx(totalW){
    const main=editorMain();
    if(!main)return clampPreviewPx(totalW*.48,totalW);
    const h=main.getBoundingClientRect().height || main.clientHeight || 0;
    const aspect=getProjectAspect();
    // Viewport is preview height minus preview toolbar, with a small padding margin.
    const viewportH=Math.max(120,h - 44);
    const desired=viewportH*aspect + 12;
    return clampPreviewPx(desired,totalW);
  }

  function currentPreviewPx(totalW){
    const savedRatio=readRatio();
    if(Number.isFinite(savedRatio))return clampPreviewPx(totalW*savedRatio,totalW);
    const main=editorMain();
    if(main){
      const cols=(getComputedStyle(main).gridTemplateColumns||'').trim().split(/\s+/);
      if(cols.length>=2){
        const first=parseFloat(cols[0]);
        if(Number.isFinite(first)&&first>0)return clampPreviewPx(first,totalW);
      }
    }
    return clampPreviewPx(totalW*.47,totalW);
  }

  function applySplit(ratio,{ensureFit=true}={}){
    const main=editorMain();
    if(!main)return;
    if(!horizontalSplitEnabled()){
      main.style.removeProperty('grid-template-columns');
      return;
    }
    const rect=main.getBoundingClientRect();
    if(rect.width<MIN_PREVIEW+MIN_TIMELINE)return;
    const totalW=Math.max(1,rect.width);
    let previewPx;
    if(Number.isFinite(ratio))previewPx=clampPreviewPx(totalW*ratio,totalW);
    else previewPx=currentPreviewPx(totalW);
    // Keep the existing mobile-landscape first-fit policy. Desktop PC starts
    // from its own CSS grid ratio and lets the canvas zoom fit inside it.
    if(ensureFit&&inMobileLandscapeDesktop()){
      const desired=desiredPreviewPx(totalW);
      previewPx=Math.max(previewPx,desired);
    }
    previewPx=clampPreviewPx(previewPx,totalW);
    const ratioToSave=previewPx/totalW;
    rememberRatio(ratioToSave);
    main.style.setProperty('grid-template-columns', `${Math.round(previewPx)}px minmax(0,1fr)`, 'important');
    if(ensureFit)refitAfterLayout();
  }

  function refitCanvasAfterLayout(){
    cancelAnimationFrame(fitRAF);
    fitRAF=requestAnimationFrame(()=>{
      fitRAF=0;
      try{ui?.applyCompositionFitZoom?.()}catch(e){}
      try{renderer?.resize?.()}catch(e){}
      try{renderer?.render?.()}catch(e){}
    });
  }

  function refitAfterLayout(){
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        try{ui?.applyCompositionFitZoom?.()}catch(e){}
        try{ui?.fit?.()}catch(e){}
        try{timeline?.rebuild?.()}catch(e){}
        try{renderer?.resize?.()}catch(e){}
        try{renderer?.render?.()}catch(e){}
      });
    });
  }

  function patchLayerActionsPosition(){
    if(typeof ui==='undefined'||!ui||originalPositionLayerActions)return;
    originalPositionLayerActions=ui.positionLayerActions?.bind(ui);
    if(!originalPositionLayerActions)return;
    ui.positionLayerActions=function(){
      if(inMobileLandscapeDesktop())return fitPopup();
      const popup=document.getElementById('layerActionsPopup');
      if(popup){
        popup.style.removeProperty('left');
        popup.style.removeProperty('top');
        popup.style.removeProperty('transform');
        popup.style.removeProperty('max-height');
        popup.style.removeProperty('width');
      }
      return originalPositionLayerActions();
    };
  }

  function sync(){
    ensureToolbarHandle();
    const legacy=document.getElementById('desktopCanvasSplitHandle');
    if(legacy)legacy.style.display='none';
    if(horizontalSplitEnabled()){
      if(btn)btn.style.display='flex';
      applySplit(NaN,{ensureFit:true});
      if(inMobileLandscapeDesktop()&&document.getElementById('layerActionsShade')&&!document.getElementById('layerActionsShade').classList.contains('hidden'))fitPopup();
    }else{
      if(btn)btn.style.display='none';
      const main=editorMain();
      if(main)main.style.removeProperty('grid-template-columns');
    }
  }
  function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(sync)}

  ensureToolbarHandle();
  patchLayerActionsPosition();
  schedule();
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
  try{screen.orientation?.addEventListener?.('change',schedule)}catch(e){}
  const modeObserver=new MutationObserver(schedule);
  modeObserver.observe(root,{attributes:true,attributeFilter:['class']});
  if(typeof ResizeObserver!=='undefined'){
    const main=editorMain();
    if(main){
      mainResizeObserver=new ResizeObserver(entries=>{
        if(entries.some(entry=>entry.contentRect.width>=MIN_PREVIEW+MIN_TIMELINE))schedule();
      });
      mainResizeObserver.observe(main);
    }
  }
  window.DesktopCanvasSplitController={
    get ratio(){return desktopCanvasSplitRatio},
    get enabled(){return horizontalSplitEnabled()},
    applyRatio(value){applySplit(Number(value),{ensureFit:true})}
  };
  setTimeout(()=>{patchLayerActionsPosition();schedule()},0);
})();

// ==================== Adapter: oms-v433-transport-center-split-fix ====================
(()=>{
  let raf=0;
  const root=document.documentElement;

  function normalizeTransport(){
    const transport=document.querySelector('.transportBalanced');
    if(!transport)return;

    // V4.35+ owns playback/navigation placement. V4.33 is retained only for
    // the independent desktop split handle. It must never re-parent transport
    // buttons in response to timeline mutations, resize, or orientation.
    const splitBtn=document.getElementById('desktopCanvasSplitToolbarBtn');
    if(splitBtn){
      if(splitBtn.parentElement!==transport)transport.appendChild(splitBtn);
      const enabled=root.classList.contains('omsMobileLandscapeDesktop')||window.matchMedia('(min-width:900px)').matches;
      splitBtn.style.display=enabled?'flex':'none';
    }

    const legacy=document.getElementById('desktopCanvasSplitHandle');
    if(legacy)legacy.style.display='none';
  }

  function schedule(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(normalizeTransport);
  }

  schedule();
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
  document.addEventListener('DOMContentLoaded',schedule,{once:true});
  try{screen.orientation?.addEventListener?.('change',schedule)}catch(e){}
  const mo=new MutationObserver(schedule);
  // Only global layout-mode changes matter here. Timeline DOM churn from
  // pinch zoom / ruler rebuild is intentionally excluded.
  mo.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  setTimeout(schedule,0);
  setTimeout(schedule,120);
})();

// ==================== Adapter: oms-v435-play-anchored-transport ====================
(()=>{
  class TransportGeometryController{
    constructor(){
      this.navIds=['jumpStart','prevKey','nextKey','jumpEnd'];
      this.raf=0;
      this.verifyRaf=0;
      this.layoutCount=0;
      this.lastReason='initial';
      this.lastDiagnostics=null;
      this.rootObserver=null;
      this.resizeObserver=null;
      this.boundResize=()=>this.schedule('resize');
      this.boundOrientation=()=>this.schedule('orientation');
      this.install();
    }

    clamp(v,a,b){return Math.max(a,Math.min(b,v))}
    centerX(rect){return rect.left+rect.width/2}
    centerY(rect){return rect.top+rect.height/2}
    rect(el){
      const r=el.getBoundingClientRect();
      return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,cx:this.centerX(r),cy:this.centerY(r)}
    }
    transport(){return document.querySelector('.transportBalanced')}
    vertical(transport){return !!transport?.closest('.portraitRightRail')}

    clearInlineControl(el){
      if(!el)return;
      el.classList.remove('omsPlayAnchoredNav','omsPlayheadAnchoredControl');
      ['left','top','right','bottom','position','transform','z-index'].forEach(p=>el.style.removeProperty(p));
    }

    ensureDock(transport){
      let dock=document.getElementById('transportRightDock');
      if(!dock){
        dock=document.createElement('div');
        dock.id='transportRightDock';
        dock.className='transportRightDock';
      }
      if(dock.parentElement!==transport)transport.appendChild(dock);
      return dock;
    }

    arrangeRightDock(transport,right,vertical){
      const dock=this.ensureDock(transport);
      const audio=document.getElementById('audioToggle');
      const actions=document.getElementById('layerActionsBtn');
      if(vertical){
        if(audio&&audio.parentElement!==right)right.appendChild(audio);
        if(actions&&actions.parentElement!==right)right.appendChild(actions);
        dock.style.display='none';
        right.classList.remove('omsRightDockDetached');
        return dock;
      }
      if(audio&&audio.parentElement!==dock)dock.appendChild(audio);
      if(actions&&actions.parentElement!==dock)dock.appendChild(actions);
      dock.style.display='flex';
      right.classList.add('omsRightDockDetached');
      return dock;
    }

    restorePortraitSideRail(transport,left,center,right,play,nav,record){
      nav.forEach(el=>this.clearInlineControl(el));
      this.clearInlineControl(play);
      const [jumpStart,prevKey,nextKey,jumpEnd]=nav;
      if(record&&record.parentElement!==left)left.prepend(record);
      if(jumpStart&&jumpStart.parentElement!==left)left.appendChild(jumpStart);
      if(prevKey&&prevKey.parentElement!==left)left.appendChild(prevKey);
      if(play&&play.parentElement!==center)center.appendChild(play);
      if(nextKey&&nextKey.parentElement!==right)right.prepend(nextKey);
      if(jumpEnd&&jumpEnd.parentElement!==right){
        if(nextKey?.nextSibling)right.insertBefore(jumpEnd,nextKey.nextSibling);
        else right.prepend(jumpEnd);
      }
      left.classList.remove('omsPlayAnchorEmpty');
    }

    renderedScale(el,rect){
      const sx=rect.width/Math.max(1,el.offsetWidth||rect.width);
      const sy=rect.height/Math.max(1,el.offsetHeight||rect.height);
      return{x:Number.isFinite(sx)&&sx>0?sx:1,y:Number.isFinite(sy)&&sy>0?sy:1}
    }

    writeControl(el,left,top){
      el.style.setProperty('left',`${left}px`,'important');
      el.style.setProperty('top',`${top}px`,'important');
      el.style.setProperty('right','auto','important');
      el.style.setProperty('bottom','auto','important');
    }

    correctRenderedCenters(controls,targets,scale){
      let corrected=false;
      controls.forEach((el,i)=>{
        const r=el.getBoundingClientRect();
        const delta=targets[i]-(r.left+r.width/2);
        if(Math.abs(delta)<.001)return;
        const current=parseFloat(el.style.left)||0;
        el.style.setProperty('left',`${current+delta/scale.x}px`,'important');
        corrected=true;
      });
      return corrected;
    }

    visibleGeometry(el){
      const svg=el?.querySelector('svg');
      const paths=[...(svg?.querySelectorAll('path')||[])];
      if(!svg)return null;
      const sr=this.rect(svg);
      if(!paths.length)return{svg:sr,visible:null};
      const rects=paths.map(p=>p.getBoundingClientRect());
      const visible={
        left:Math.min(...rects.map(r=>r.left)),right:Math.max(...rects.map(r=>r.right)),
        top:Math.min(...rects.map(r=>r.top)),bottom:Math.max(...rects.map(r=>r.bottom))
      };
      visible.width=visible.right-visible.left;
      visible.height=visible.bottom-visible.top;
      visible.cx=visible.left+visible.width/2;
      visible.cy=visible.top+visible.height/2;
      return{svg:sr,visible}
    }

    markLayout(transport){
      this.layoutCount++;
      transport.dataset.omsTransportController='geometry';
      transport.dataset.omsTransportLayoutCount=String(this.layoutCount);
      transport.dataset.omsTransportLayoutReason=this.lastReason;
    }

    diagnostics(){
      const playhead=document.getElementById('playhead');
      const play=document.getElementById('playBtn');
      const nav=this.navIds.map(id=>document.getElementById(id));
      if(!playhead||!play||nav.some(el=>!el))return null;
      const ph=this.rect(playhead),pr=this.rect(play),nr=nav.map(el=>this.rect(el));
      const geometry=Object.fromEntries([play,...nav].map(el=>[el.id,this.visibleGeometry(el)]));
      return{
        layoutCount:this.layoutCount,
        reason:this.lastReason,
        devicePixelRatio:window.devicePixelRatio||1,
        playhead:ph,
        controls:Object.fromEntries([[play.id,pr],...nav.map((el,i)=>[el.id,nr[i]])]),
        deltas:{
          play:pr.cx-ph.cx,
          nearLeft:ph.cx-nr[1].cx,nearRight:nr[2].cx-ph.cx,
          nearSymmetry:(ph.cx-nr[1].cx)-(nr[2].cx-ph.cx),
          farLeft:ph.cx-nr[0].cx,farRight:nr[3].cx-ph.cx,
          farSymmetry:(ph.cx-nr[0].cx)-(nr[3].cx-ph.cx)
        },
        geometry,
        parents:Object.fromEntries([play,...nav].map(el=>[el.id,el.parentElement?.className||el.parentElement?.id||null]))
      }
    }

    arrange(){
      this.raf=0;
      const transport=this.transport();
      const left=transport?.querySelector('.transportLeft');
      const center=transport?.querySelector('.transportCenter');
      const right=transport?.querySelector('.transportRight');
      const play=document.getElementById('playBtn');
      const record=document.getElementById('preRenderRecordBtn');
      const playhead=document.getElementById('playhead');
      const timelineArea=document.querySelector('.timelineArea');
      const nav=this.navIds.map(id=>document.getElementById(id));
      if(!transport||!left||!center||!right||!play||!playhead||!timelineArea||nav.some(el=>!el))return;

      const vertical=this.vertical(transport);
      this.arrangeRightDock(transport,right,vertical);
      if(vertical){
        this.restorePortraitSideRail(transport,left,center,right,play,nav,record);
        this.markLayout(transport);
        this.lastDiagnostics=this.diagnostics();
        return;
      }

      // Hidden editors have zero-sized layout boxes. ResizeObserver will wake
      // this controller when the real toolbar becomes measurable again.
      const preTR=transport.getBoundingClientRect();
      const preAR=timelineArea.getBoundingClientRect();
      if(preTR.width<2||preTR.height<2||preAR.width<2||preAR.height<2)return;

      if(record&&record.parentElement!==transport)transport.appendChild(record);
      [play,...nav].forEach(el=>{
        if(el.parentElement!==transport)transport.appendChild(el);
        el.classList.add('omsPlayheadAnchoredControl');
      });
      nav.forEach(el=>el.classList.add('omsPlayAnchoredNav'));
      left.classList.add('omsPlayAnchorEmpty');

      const cluster=document.getElementById('transportPlaybackCluster');
      if(cluster&&cluster!==center&&cluster.children.length===0)cluster.style.display='none';

      const tr=transport.getBoundingClientRect();
      const phr=playhead.getBoundingClientRect();
      if(!tr.width||!tr.height||!Number.isFinite(phr.left))return;
      const scale=this.renderedScale(transport,tr);
      const anchorViewportX=phr.left+phr.width/2;
      const anchorLocalX=(anchorViewportX-tr.left)/scale.x;
      const anchorLocalY=(tr.height/2)/scale.y;

      // Independent controls only limit available room. They never define center.
      const split=document.getElementById('desktopCanvasSplitToolbarBtn');
      let leftSafeViewport=tr.left+8*scale.x;
      if(split&&getComputedStyle(split).display!=='none'){
        const sr=split.getBoundingClientRect();
        leftSafeViewport=Math.max(leftSafeViewport,sr.right+6*scale.x);
      }
      if(record&&getComputedStyle(record).display!=='none'){
        const rr=record.getBoundingClientRect();
        if(rr.width>0&&rr.height>0)leftSafeViewport=Math.max(leftSafeViewport,rr.right+6*scale.x);
      }
      const dock=document.getElementById('transportRightDock');
      const dr=dock?.getBoundingClientRect();
      let rightSafeViewport=tr.right-8*scale.x;
      if(dr&&dr.width>0&&dr.height>0)rightSafeViewport=Math.min(rightSafeViewport,dr.left-6*scale.x);

      const sideRoomLocal=Math.max(58,Math.min(
        (anchorViewportX-leftSafeViewport)/scale.x,
        (rightSafeViewport-anchorViewportX)/scale.x
      ));
      const buttonW=Math.max(30,nav[0].getBoundingClientRect().width/scale.x||34);
      const maxFar=Math.max(54,sideRoomLocal-buttonW/2-3);
      const far=this.clamp(88,54,maxFar);
      const near=Math.min(46,Math.max(32,far*.52));

      const controls=[play,...nav];
      const localPositions=[anchorLocalX,anchorLocalX-far,anchorLocalX-near,anchorLocalX+near,anchorLocalX+far];
      controls.forEach((el,i)=>this.writeControl(el,localPositions[i],anchorLocalY));

      // Close the loop using actual rendered button centers. This resolves the
      // browser's 1/64 CSS-pixel quantization without a device-specific offset.
      const targets=[anchorViewportX,anchorViewportX-far*scale.x,anchorViewportX-near*scale.x,anchorViewportX+near*scale.x,anchorViewportX+far*scale.x];
      this.correctRenderedCenters(controls,targets,scale);
      this.correctRenderedCenters(controls,targets,scale);

      this.markLayout(transport);
      cancelAnimationFrame(this.verifyRaf);
      this.verifyRaf=requestAnimationFrame(()=>{this.lastDiagnostics=this.diagnostics()});
    }

    schedule(reason='layout'){
      this.lastReason=reason;
      cancelAnimationFrame(this.raf);
      this.raf=requestAnimationFrame(()=>requestAnimationFrame(()=>this.arrange()));
    }

    install(){
      window.addEventListener('resize',this.boundResize,{passive:true});
      window.addEventListener('orientationchange',this.boundOrientation,{passive:true});
      try{screen.orientation?.addEventListener?.('change',this.boundOrientation)}catch(e){}
      document.addEventListener('DOMContentLoaded',()=>this.schedule('dom-ready'),{once:true});

      const observedTransport=this.transport();
      if(observedTransport&&'ResizeObserver' in window){
        this.resizeObserver=new ResizeObserver(entries=>{
          const box=entries?.[0]?.contentRect;
          if(box&&box.width>1&&box.height>1)this.schedule('transport-resize');
        });
        this.resizeObserver.observe(observedTransport);
      }

      // Only global layout-mode changes are observed. Timeline/ruler/track/time
      // mutations are deliberately outside this controller's wake-up graph.
      this.rootObserver=new MutationObserver(()=>this.schedule('layout-mode'));
      this.rootObserver.observe(document.documentElement,{attributes:true,attributeFilter:['class']});

      this.schedule('initial');
      setTimeout(()=>this.schedule('initial-visible'),120);
      setTimeout(()=>this.schedule('initial-settled'),360);
    }
  }

  window.TransportGeometryController=TransportGeometryController;
  window.omsTransportGeometryController=new TransportGeometryController();
  window.omsMeasureTransportGeometry=()=>window.omsTransportGeometryController?.diagnostics?.();
})();

// ==================== Adapter: oms-v436-right-dock-audio-layer-actions ====================
(()=>{
  // V4.41 — right-dock ownership moved into TransportGeometryController.
  // Keep this legacy hook inert except for one startup scheduling request.
  window.omsTransportGeometryController?.schedule('right-dock-ready');
})();

// ==================== Adapter: oms-v437-svg-play-center-fix ====================
(()=>{
  const PLAY_SVG='<svg class="transportPlaySvg play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4L20 12L8 20Z"/></svg>';
  const PAUSE_SVG='<svg class="transportPlaySvg pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5V19M16 5V19"/></svg>';

  window.omsSetPlayButtonVisual=function omsSetPlayButtonVisual(playing){
    const btn=document.getElementById('playBtn');
    if(!btn)return;
    btn.innerHTML=playing?PAUSE_SVG:PLAY_SVG;
    btn.setAttribute('aria-label',playing?'Jeda':'Putar');
    btn.setAttribute('title',playing?'Jeda':'Putar');
    btn.dataset.playVisual=playing?'pause':'play';
  };

  // Triangle vertices are chosen so their centroid is exactly x=12, the
  // center of the 24x24 viewBox: (8 + 8 + 20) / 3 = 12.
  // V4.40 then places that button center on the rendered playhead X.
  const sync=()=>window.omsSetPlayButtonVisual?.(!!(typeof model!=='undefined'&&model.playing));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});
  else sync();
  setTimeout(sync,0);
})();