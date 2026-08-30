import { getFavorites, setFavorites, getHistory, setHistory, getSettings, setSettings, exportAll, importAll } from './storage.js';
import { dubApi } from './api.js';

const $ = id => document.getElementById(id);
const els = {
  urlForm:$('urlForm'), urlInput:$('urlInput'), backBtn:$('backBtn'), forwardBtn:$('forwardBtn'), refreshBtn:$('refreshBtn'),
  homeBtn:$('homeBtn'), favoriteBtn:$('favoriteBtn'), favoritesBtn:$('favoritesBtn'), historyBtn:$('historyBtn'), dubToggle:$('dubToggle'),
  homeView:$('homeView'), browserView:$('browserView'), browserFrame:$('browserFrame'), frameFallback:$('frameFallback'),
  openExternalBtn:$('openExternalBtn'), openDirectBtn:$('openDirectBtn'), quickTests:$('quickTests'),
  homeFavorites:$('homeFavorites'), clearFavoritesBtn:$('clearFavoritesBtn'), pageStatus:$('pageStatus'), dubStatus:$('dubStatus'),
  sidePanel:$('sidePanel'), panelBackdrop:$('panelBackdrop'), panelTitle:$('panelTitle'), panelContent:$('panelContent'), closePanelBtn:$('closePanelBtn'),
  settingsBtn:$('settingsBtn'), settingsDialog:$('settingsDialog'), sourceLang:$('sourceLang'), targetLang:$('targetLang'), voiceStyle:$('voiceStyle'),
  sourceVolume:$('sourceVolume'), sourceVolumeOut:$('sourceVolumeOut'), dubVolume:$('dubVolume'), dubVolumeOut:$('dubVolumeOut'), showSubtitles:$('showSubtitles'),
  saveSettingsBtn:$('saveSettingsBtn'), exportBtn:$('exportBtn'), importInput:$('importInput'), toast:$('toast')
};

let favorites=getFavorites(), historyItems=getHistory(), settings=getSettings();
let navStack=[], navIndex=-1, currentUrl='', displayedUrl='', frameLoadTimer=null, activeDubSession=null;

const blockedHosts = [
  /(^|\.)youtube\.com$/i, /(^|\.)youtu\.be$/i, /(^|\.)google\./i,
  /(^|\.)facebook\.com$/i, /(^|\.)instagram\.com$/i, /(^|\.)tiktok\.com$/i,
  /(^|\.)x\.com$/i, /(^|\.)twitter\.com$/i, /(^|\.)netflix\.com$/i,
  /(^|\.)xhamster\.com$/i, /(^|\.)xhaccess\.com$/i
];

function normalizeInput(value){
  const v=value.trim(); if(!v) return '';
  if(/^https?:\/\//i.test(v)) return v;
  if(/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(v)) return `https://${v}`;
  return `https://www.google.com/search?q=${encodeURIComponent(v)}`;
}
function domainName(url){ try{return new URL(url).hostname.replace(/^www\./,'');}catch{return url;} }
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function showToast(msg){els.toast.textContent=msg;els.toast.classList.remove('hidden');clearTimeout(showToast.t);showToast.t=setTimeout(()=>els.toast.classList.add('hidden'),2200);}

function youtubeEmbedUrl(url){
  try{
    const u=new URL(url); let id='';
    if(/(^|\.)youtu\.be$/i.test(u.hostname)) id=u.pathname.split('/').filter(Boolean)[0]||'';
    if(/(^|\.)youtube\.com$/i.test(u.hostname)){
      if(u.pathname==='/watch') id=u.searchParams.get('v')||'';
      const m=u.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/); if(m) id=m[1];
    }
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?playsinline=1` : '';
  }catch{return '';}
}
function hostUsuallyBlocks(url){
  try{const h=new URL(url).hostname; return blockedHosts.some(re=>re.test(h));}catch{return false;}
}
function showFallback(message='เว็บไซต์นี้ไม่อนุญาตให้แสดงในหน้าอื่น'){
  clearTimeout(frameLoadTimer);
  els.browserFrame.classList.add('hidden');
  els.frameFallback.classList.remove('hidden');
  els.pageStatus.textContent=message;
}
function showFrame(){els.frameFallback.classList.add('hidden');els.browserFrame.classList.remove('hidden');}

function updateNavButtons(){
  els.backBtn.disabled=navIndex<=0; els.forwardBtn.disabled=navIndex<0||navIndex>=navStack.length-1;
  const isFav=favorites.some(x=>x.url===currentUrl); if(els.favoriteBtn.firstChild) els.favoriteBtn.firstChild.textContent=isFav?'★ ':'☆ ';
}
function addHistory(url){const now=new Date().toISOString();historyItems=[{url,title:domainName(url),visitedAt:now},...historyItems.filter(x=>x.url!==url)].slice(0,500);setHistory(historyItems);}

async function openUrl(url,{push=true}={}){
  const normalized=normalizeInput(url); if(!normalized) return;
  currentUrl=normalized; displayedUrl=''; els.urlInput.value=normalized;
  els.homeView.classList.add('hidden'); els.browserView.classList.remove('hidden');
  els.pageStatus.textContent=`กำลังเปิด ${domainName(normalized)}…`;
  if(push){navStack=navStack.slice(0,navIndex+1);navStack.push(normalized);navIndex=navStack.length-1;}
  addHistory(normalized); updateNavButtons(); clearTimeout(frameLoadTimer);

  const ytEmbed=youtubeEmbedUrl(normalized);
  if(ytEmbed){
    displayedUrl=ytEmbed; showFrame(); els.pageStatus.textContent='YouTube: เปิดโหมดวิดีโอ Embed';
    els.browserFrame.src=ytEmbed;
  } else if(hostUsuallyBlocks(normalized)){
    els.browserFrame.src='about:blank';
    showFallback(`${domainName(normalized)} จำกัดการฝัง/วิดีโอในเว็บอื่น — ใช้ “เปิดตรง ↗”`);
  } else {
    displayedUrl=normalized; showFrame(); els.browserFrame.src=normalized;
    frameLoadTimer=setTimeout(()=>showFallback('เว็บไซต์อาจบล็อกการฝังหน้าเว็บ — ลอง “เปิดตรง ↗”'),7000);
  }
  if(settings.dubEnabled) await startDubIfPossible();
}

async function startDubIfPossible(){
  els.dubStatus.textContent='พากย์ไทย: กำลังเตรียม';
  if(!dubApi.configured){els.dubStatus.textContent='พากย์ไทย: รอ backend';showToast('โครงพากย์พร้อมแล้ว แต่ยังไม่ได้เชื่อม backend');return;}
  try{
    activeDubSession=await dubApi.createSession({url:currentUrl,sourceLang:settings.sourceLang,targetLang:settings.targetLang,voiceStyle:settings.voiceStyle,sourceVolume:settings.sourceVolume,dubVolume:settings.dubVolume,showSubtitles:settings.showSubtitles});
    els.dubStatus.textContent='พากย์ไทย: ทำงาน';
  } catch(err){
    const msg=String(err?.message||'');
    if(/ไม่มีคำบรรยาย|no_captions|STT/i.test(msg)) els.dubStatus.textContent='พากย์ไทย: ไม่มีซับ → ต้องใช้ STT';
    else if(hostUsuallyBlocks(currentUrl) && !youtubeEmbedUrl(currentUrl)) els.dubStatus.textContent='พากย์ไทย: เว็บนี้ต้องเปิดตรง';
    else els.dubStatus.textContent='พากย์ไทย: ผิดพลาด';
    showToast(msg || 'เริ่มพากย์ไม่สำเร็จ');
  }
}
async function stopDub(){if(activeDubSession?.id) await dubApi.stopSession(activeDubSession.id).catch(()=>{});activeDubSession=null;els.dubStatus.textContent='พากย์ไทย: ปิด';}
function showHome(){currentUrl='';displayedUrl='';els.urlInput.value='';els.browserFrame.src='about:blank';els.browserView.classList.add('hidden');els.homeView.classList.remove('hidden');renderHomeFavorites();updateNavButtons();}

function renderHomeFavorites(){
  if(!favorites.length){els.homeFavorites.innerHTML='<div class="site-card"><h3>ยังไม่มีเว็บไซต์ที่บันทึก</h3><p>เปิดเว็บไซต์แล้วกด ☆ บันทึก</p></div>';return;}
  els.homeFavorites.innerHTML=favorites.map((f,i)=>`<article class="site-card"><h3>${escapeHtml(f.title||domainName(f.url))}</h3><p>${escapeHtml(f.url)}</p><div class="actions"><button data-open-fav="${i}">เปิด</button><button data-remove-fav="${i}">ลบ</button></div></article>`).join('');
}
function openPanel(kind){
  els.sidePanel.classList.remove('hidden');els.panelBackdrop.classList.remove('hidden');els.sidePanel.setAttribute('aria-hidden','false');
  if(kind==='favorites'){
    els.panelTitle.textContent='รายการโปรด';els.panelContent.innerHTML=favorites.length?favorites.map((x,i)=>`<div class="list-item"><button data-panel-fav="${i}"><strong>${escapeHtml(x.title||domainName(x.url))}</strong><div class="meta">${escapeHtml(x.url)}</div></button></div>`).join(''):'<p>ยังไม่มีรายการโปรด</p>';
  } else {
    els.panelTitle.textContent='ประวัติ';els.panelContent.innerHTML=historyItems.length?historyItems.map((x,i)=>`<div class="list-item"><button data-panel-history="${i}"><strong>${escapeHtml(x.title||domainName(x.url))}</strong><div class="meta">${escapeHtml(x.url)}<br>${new Date(x.visitedAt).toLocaleString('th-TH')}</div></button></div>`).join(''):'<p>ยังไม่มีประวัติ</p>';
  }
}
function closePanel(){els.sidePanel.classList.add('hidden');els.panelBackdrop.classList.add('hidden');els.sidePanel.setAttribute('aria-hidden','true');}
function loadSettingsUI(){
  els.dubToggle.checked=settings.dubEnabled;els.sourceLang.value=settings.sourceLang;els.targetLang.value=settings.targetLang;els.voiceStyle.value=settings.voiceStyle;
  els.sourceVolume.value=settings.sourceVolume;els.dubVolume.value=settings.dubVolume;els.showSubtitles.checked=settings.showSubtitles;
  els.sourceVolumeOut.value=`${settings.sourceVolume}%`;els.dubVolumeOut.value=`${settings.dubVolume}%`;els.dubStatus.textContent=settings.dubEnabled?'พากย์ไทย: รอ backend':'พากย์ไทย: ปิด';
}

els.urlForm.addEventListener('submit',e=>{e.preventDefault();openUrl(els.urlInput.value);});
els.backBtn.addEventListener('click',()=>{if(navIndex>0){navIndex--;openUrl(navStack[navIndex],{push:false});}});
els.forwardBtn.addEventListener('click',()=>{if(navIndex<navStack.length-1){navIndex++;openUrl(navStack[navIndex],{push:false});}});
els.refreshBtn.addEventListener('click',()=>{if(currentUrl) openUrl(currentUrl,{push:false});});
els.homeBtn.addEventListener('click',showHome);
els.favoriteBtn.addEventListener('click',()=>{if(!currentUrl)return showToast('ยังไม่มี URL ให้บันทึก');const idx=favorites.findIndex(x=>x.url===currentUrl);if(idx>=0){favorites.splice(idx,1);showToast('ลบออกจากรายการโปรดแล้ว');}else{favorites.unshift({url:currentUrl,title:domainName(currentUrl),createdAt:new Date().toISOString()});showToast('บันทึกแล้ว');}setFavorites(favorites);renderHomeFavorites();updateNavButtons();});
els.favoritesBtn.addEventListener('click',()=>openPanel('favorites'));els.historyBtn.addEventListener('click',()=>openPanel('history'));els.closePanelBtn.addEventListener('click',closePanel);els.panelBackdrop.addEventListener('click',closePanel);
els.panelContent.addEventListener('click',e=>{const f=e.target.closest('[data-panel-fav]'),h=e.target.closest('[data-panel-history]');if(f){const x=favorites[Number(f.dataset.panelFav)];closePanel();openUrl(x.url);}if(h){const x=historyItems[Number(h.dataset.panelHistory)];closePanel();openUrl(x.url);}});
els.homeFavorites.addEventListener('click',e=>{const o=e.target.closest('[data-open-fav]'),r=e.target.closest('[data-remove-fav]');if(o)openUrl(favorites[Number(o.dataset.openFav)].url);if(r){favorites.splice(Number(r.dataset.removeFav),1);setFavorites(favorites);renderHomeFavorites();}});
els.clearFavoritesBtn.addEventListener('click',()=>{if(confirm('ล้างรายการโปรดทั้งหมด?')){favorites=[];setFavorites([]);renderHomeFavorites();}});
els.quickTests?.addEventListener('click',e=>{const b=e.target.closest('[data-test-url]');if(b)openUrl(b.dataset.testUrl);});
els.browserFrame.addEventListener('load',()=>{if(!displayedUrl||displayedUrl==='about:blank') return;clearTimeout(frameLoadTimer);if(youtubeEmbedUrl(currentUrl)) els.pageStatus.textContent='YouTube: วิดีโอพร้อมเล่น';else els.pageStatus.textContent=`เปิด ${domainName(currentUrl)} (หากเป็นหน้าขาวให้กด “เปิดตรง ↗”)`;});
const openDirect=()=>{if(currentUrl) window.open(currentUrl,'_blank','noopener');};els.openExternalBtn?.addEventListener('click',openDirect);els.openDirectBtn?.addEventListener('click',openDirect);

els.dubToggle.addEventListener('change',async()=>{settings.dubEnabled=els.dubToggle.checked;setSettings(settings);if(settings.dubEnabled&&currentUrl)await startDubIfPossible();else await stopDub();});
els.settingsBtn.addEventListener('click',()=>{loadSettingsUI();els.settingsDialog.showModal();});els.sourceVolume.addEventListener('input',()=>els.sourceVolumeOut.value=`${els.sourceVolume.value}%`);els.dubVolume.addEventListener('input',()=>els.dubVolumeOut.value=`${els.dubVolume.value}%`);
els.saveSettingsBtn.addEventListener('click',()=>{settings={...settings,sourceLang:els.sourceLang.value,targetLang:els.targetLang.value,voiceStyle:els.voiceStyle.value,sourceVolume:Number(els.sourceVolume.value),dubVolume:Number(els.dubVolume.value),showSubtitles:els.showSubtitles.checked};setSettings(settings);showToast('บันทึกการตั้งค่าแล้ว');});
els.exportBtn.addEventListener('click',()=>{const blob=new Blob([JSON.stringify(exportAll(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`ai-browser-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);});
els.importInput.addEventListener('change',async()=>{const file=els.importInput.files?.[0];if(!file)return;try{importAll(JSON.parse(await file.text()));favorites=getFavorites();historyItems=getHistory();settings=getSettings();loadSettingsUI();renderHomeFavorites();showToast('นำเข้าข้อมูลแล้ว');}catch(err){showToast(`นำเข้าไม่สำเร็จ: ${err.message}`);}finally{els.importInput.value='';}});

if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
loadSettingsUI();renderHomeFavorites();updateNavButtons();
