import{a as o,e as t,g as r,_ as a,l as s}from"./index-55db424e.js";import{P as l}from"./page-21062680.js";const n=()=>(o.managers.appStateManager.pushToState("authState",{_:"authStateSignedIn"}),t.requestedServerLanguage||t.getCacheLangPack().then(e=>{e.local&&t.getLangPack(e.lang_code)}),i.pageEl.style.display="",r(),Promise.all([a(()=>import("./appDialogsManager-98d86545.js"),["./appDialogsManager-98d86545.js","./avatar-9548d2ca.js","./button-d617d270.js","./index-55db424e.js","./index-5c4b8e53.css","./page-21062680.js","./wrapEmojiText-b6556074.js","./scrollable-8e639525.js","./putPreloader-57526610.js","./htmlToSpan-f8875352.js","./countryInputField-f93f47c8.js","./textToSvgURL-c6ebb454.js","./codeInputField-9094318f.js","./appDialogsManager-dc588fa7.css"],import.meta.url),s(),"requestVideoFrameCallback"in HTMLVideoElement.prototype?Promise.resolve():a(()=>import("./requestVideoFrameCallbackPolyfill-d3040205.js"),[],import.meta.url)]).then(([e])=>{e.default.start(),setTimeout(()=>{document.getElementById("auth-pages").remove()},1e3)})),i=new l("page-chats",!1,n);export{i as default};
//# sourceMappingURL=pageIm-cf5006d3.js.map