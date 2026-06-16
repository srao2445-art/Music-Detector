import { getSettings, getHomepage, listProjects, getProject, listArticles, getArticle } from "./firebase-services.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const params = new URLSearchParams(location.search);

function fallbackProjects(){return [
 {id:"neon-brand-system",title:"Neon Brand System",category:"Identity",summary:"A luminous creator identity kit for product launches.",tags:"Branding, Motion, Web",featured:true,content:"A complete visual system with future-facing art direction, campaign pages, and social launch assets."},
 {id:"immersive-portfolio",title:"Immersive Portfolio",category:"Web",summary:"A cinematic portfolio built around interaction and storytelling.",tags:"Portfolio, UX, Firebase",featured:true,content:"Responsive pages, polished case studies, and a lightweight CMS workflow."},
 {id:"creator-campaign",title:"Creator Campaign",category:"Content",summary:"Editorial and video assets for a multi-channel release.",tags:"Content, Strategy, Social",featured:true,content:"A flexible creative campaign designed to scale across channels."}
]}
function fallbackArticles(){return [
 {id:"building-premium-digital-presence",title:"Building a Premium Digital Presence",excerpt:"How creators can turn projects into a memorable studio narrative.",published:true,content:"A premium presence starts with clarity, consistent visuals, and a portfolio that makes every project easy to understand."},
 {id:"fast-static-sites",title:"Fast Static Sites with Firebase",excerpt:"Why a no-server CMS can be enough for many creator websites.",published:true,content:"Firebase Hosting, Auth, and Firestore are a strong combination for lightweight portfolio CMS experiences."}
]}
function cardProject(p){return `<a class="card reveal" href="project.html?id=${p.id}"><div class="thumb">${p.category||"Project"}</div><span class="tag">${p.category||"Studio"}</span><h3>${p.title}</h3><p class="muted">${p.summary||"A featured Creator Studio project."}</p></a>`}
function cardArticle(a){return `<a class="card reveal" href="article.html?id=${a.id}"><span class="tag">Article</span><h3>${a.title}</h3><p class="muted">${a.excerpt||"Read the latest studio notes."}</p></a>`}
function setText(sel, value){const el=$(sel); if(el) el.textContent=value}
function setMeta(settings){document.title=settings.seoTitle||settings.title; const m=$('meta[name="description"]'); if(m)m.content=settings.metaDescription||""; $$("[data-site-title]").forEach(e=>e.textContent=settings.title); $$("[data-logo]").forEach(e=>e.textContent=settings.logo); setText("[data-version]", settings.version);}
function shell(){document.body.insertAdjacentHTML("afterbegin",'<div class="particles"></div>'); const nav=$(".nav"); if(nav){addEventListener("scroll",()=>nav.classList.toggle("scrolled",scrollY>8)); const b=$(".menu"); const l=$(".links"); b?.addEventListener("click",()=>l?.classList.toggle("open"));} const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add("visible")}),{threshold:.12}); $$(".reveal").forEach(e=>io.observe(e));}
async function boot(){shell(); let settings=await getSettings().catch(()=>({title:"The Creator Studio",logo:"✦",version:"v1.0.0"})); setMeta(settings); if(settings.maintenance && !location.pathname.endsWith("maintenance.html") && !location.pathname.endsWith("admin.html")) location.href="maintenance.html"; const page=document.body.dataset.page; if(page==="home") await home(); if(page==="projects") await projects(); if(page==="project") await project(); if(page==="blog") await blog(); if(page==="article") await article();}
async function home(){const h=await getHomepage().catch(()=>null); if(h){setText("#eyebrow",h.eyebrow);setText("#headline",h.headline);setText("#intro",h.intro);$("#primaryCta").textContent=h.primaryCta;$("#secondaryCta").textContent=h.secondaryCta} const ps=await listProjects().catch(fallbackProjects); const as=await listArticles().catch(fallbackArticles); $("#featuredProjects").innerHTML=ps.slice(0,3).map(cardProject).join(""); $("#latestArticles").innerHTML=as.slice(0,3).map(cardArticle).join(""); shell();}
async function projects(){const ps=await listProjects().catch(fallbackProjects); $("#projectsList").innerHTML=ps.map(cardProject).join(""); shell();}
async function project(){const p=await getProject(params.get("id")).catch(()=>fallbackProjects().find(x=>x.id===params.get("id"))) || fallbackProjects()[0]; setText("#projectTitle",p.title); setText("#projectSummary",p.summary); setText("#projectCategory",p.category||"Project"); $("#projectTags").innerHTML=(p.tags||"").split(",").filter(Boolean).map(t=>`<span class="tag">${t.trim()}</span>`).join(""); setText("#projectContent",p.content||p.summary);}
async function blog(){const as=await listArticles().catch(fallbackArticles); $("#articlesList").innerHTML=as.map(cardArticle).join(""); shell();}
async function article(){const a=await getArticle(params.get("id")).catch(()=>fallbackArticles().find(x=>x.id===params.get("id"))) || fallbackArticles()[0]; setText("#articleTitle",a.title); setText("#articleExcerpt",a.excerpt); setText("#articleContent",a.content||a.excerpt);}
boot();
