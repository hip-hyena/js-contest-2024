import{a as o,e as t,g as r,_ as a,l as s}from"./index-LZ-Qulde.js";import{P as l}from"./page-AvUSG5kB.js";const n=()=>(o.managers.appStateManager.pushToState("authState",{_:"authStateSignedIn"}),t.requestedServerLanguage||t.getCacheLangPack().then(e=>{e.local&&t.getLangPack(e.lang_code)}),i.pageEl.style.display="",r(),Promise.all([a(()=>import("./appDialogsManager-cdsnB2wb.js"),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13]),import.meta.url),s(),"requestVideoFrameCallback"in HTMLVideoElement.prototype?Promise.resolve():a(()=>import("./requestVideoFrameCallbackPolyfill-GsYXQx88.js"),__vite__mapDeps([]),import.meta.url)]).then(([e])=>{e.default.start(),setTimeout(()=>{document.getElementById("auth-pages").remove()},1e3)})),i=new l("page-chats",!1,n);export{i as default};
//# sourceMappingURL=pageIm-3IPlN02F.js.map
function __vite__mapDeps(indexes) {
  if (!__vite__mapDeps.viteFileDeps) {
    __vite__mapDeps.viteFileDeps = ["./appDialogsManager-cdsnB2wb.js","./avatar-YjI-LNiq.js","./button-HtigMRvs.js","./index-LZ-Qulde.js","./index-x4a6QeJM.css","./page-AvUSG5kB.js","./wrapEmojiText-8QibrKUG.js","./scrollable-27afSTcq.js","./putPreloader-fTco7niY.js","./htmlToSpan-p_Z7NKZR.js","./countryInputField-ey7HLg59.js","./textToSvgURL-Z4O-nL1S.js","./codeInputField-CSTf7PZU.js","./appDialogsManager-6QNcK96s.css"]
  }
  return indexes.map((i) => __vite__mapDeps.viteFileDeps[i])
}