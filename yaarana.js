const SUPA_URL='https://eudyxjuevhfawtztsqvr.supabase.co';
const SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1ZHl4anVldmhmYXd0enRzcXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjc0MTMsImV4cCI6MjA4ODg0MzQxM30.1IDFKSuNanx4pFXfrlHfcBVKQIHtNk5rY1ZDtB60-_c';
const {createClient}=supabase;
const db=createClient(SUPA_URL,SUPA_KEY);

// STATE
let CU=null,CP=null,curPage='home',chatSub=null,chatId=null,chatType=null,cmt_postId=null,srchTimer=null,grpTab='discover',postImgBlob=null,newAvBlob=null,grpImgBlob=null,grpSelectedMembers=[],storyTimer=null,currentStoryId=null,currentStoryUserId=null;

// ========== INIT ==========
async function init(){
  showLoad(true);
  const {data:{session}}=await db.auth.getSession();
  if(session){CU=session.user;await loadCP();initTheme();showApp();}
  else{showAuth();}
  showLoad(false);
}

async function loadCP(){
  const{data}=await db.from('profiles').select('*').eq('id',CU.id).single();
  if(data){CP=data;updateNavAv();}
  updateBadges();
}

async function updateBadges(){
  if(!CU)return;
  try{
    // Notification count: new likes + new followers since last visit
    const since=localStorage.getItem('mm-last-notif-check')||new Date(0).toISOString();
    const{data:myPosts}=await db.from('posts').select('id').eq('user_id',CU.id).eq('is_deleted',false);
    const pids=(myPosts||[]).map(p=>p.id);
    let notifCount=0;
    const{count:fwrCount}=await db.from('followers').select('*',{count:'exact',head:true}).eq('following_id',CU.id).gt('created_at',since);
    notifCount+=fwrCount||0;
    if(pids.length){const{count:likeCount}=await db.from('likes').select('*',{count:'exact',head:true}).in('post_id',pids).neq('user_id',CU.id).gt('created_at',since);notifCount+=likeCount||0;}
    const nb=document.getElementById('notif-badge');
    if(nb){if(notifCount>0){nb.textContent=notifCount>9?'9+':notifCount;nb.style.display='flex';}else{nb.style.display='none';}}
    const nd=document.getElementById('notif-dot');if(nd){if(notifCount>0)nd.classList.remove('hidden');else nd.classList.add('hidden');}
    // Message count: unread DMs
    let msgCount=0;try{const mr=await db.from('direct_messages').select('*',{count:'exact',head:true}).eq('receiver_id',CU.id).eq('is_read',false);msgCount=mr.count||0;}catch(e){}
    const mb=document.getElementById('msg-badge');
    if(mb){if(msgCount>0){mb.textContent=msgCount>9?'9+':msgCount;mb.style.display='flex';}else{mb.style.display='none';}}
  }catch(e){}
}

// Clear notification badge when opening notifications

function updateNavAv(){
  const el=document.getElementById('nav-avatar');if(!el)return;
  if(CP?.avatar_url){el.outerHTML=`<img src="${CP.avatar_url}" class="av" id="nav-avatar" style="width:32px;height:32px;cursor:pointer" onclick="navigateTo('my-profile')">`;}
  else{el.textContent=ini(CP?.full_name||CP?.username||'?');}
}

// ========== DISPLAY ==========
function showLoad(v){document.getElementById('loading-ov').style.display=v?'flex':'none';}
function showAuth(){document.getElementById('loading-ov').classList.add('hidden');document.getElementById('auth-wr').classList.remove('hidden');document.getElementById('app-wr').classList.add('hidden');}
function showApp(){document.getElementById('loading-ov').classList.add('hidden');document.getElementById('auth-wr').classList.add('hidden');document.getElementById('app-wr').classList.remove('hidden');loadHomeFeed();
  // Update badges every 30 seconds
  updateBadges();
  if(window._badgeInterval)clearInterval(window._badgeInterval);
  window._badgeInterval=setInterval(updateBadges,30000);
}

function toast(msg,type='info'){const c=document.getElementById('toast-c');const t=document.createElement('div');t.className=`toast ${type}`;t.textContent=msg;c.appendChild(t);setTimeout(()=>t.remove(),3500);}
function ini(n){if(!n)return'?';return n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);}
function ago(d){const diff=Math.floor((Date.now()-new Date(d))/1000);if(diff<60)return'just now';if(diff<3600)return`${Math.floor(diff/60)}m`;if(diff<86400)return`${Math.floor(diff/3600)}h`;if(diff<604800)return`${Math.floor(diff/86400)}d`;return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short'});}
function fmtDate(d){return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});}
function openModal(id){document.getElementById(id).classList.remove('hidden');document.body.style.overflow='hidden';}
function closeModal(id){document.getElementById(id).classList.add('hidden');document.body.style.overflow='';}
function esc(t){if(!t)return'';return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function avHtml(p,sz=32){if(p?.avatar_url)return`<img src="${p.avatar_url}" class="av" style="width:${sz}px;height:${sz}px;" alt="">`;return`<div class="av-ph" style="width:${sz}px;height:${sz}px;font-size:${sz*.35}px">${ini(p?.full_name||p?.username||'?')}</div>`;}

function refreshCurrentPage(){toast('Refreshing...','info');navigateTo(curPage,true);}

// ========== THEME ==========
function initTheme(){const t=localStorage.getItem('mm-theme')||'light';applyTheme(t,false);}
function setTheme(t){applyTheme(t,true);closeModal('theme-mo');}
function applyTheme(t,save=true){
  document.documentElement.setAttribute('data-theme',t);
  if(save)localStorage.setItem('mm-theme',t);
  document.querySelectorAll('.theme-card').forEach(c=>c.classList.remove('active'));
  document.getElementById(`theme-${t}`)?.classList.add('active');
  const labels={light:'☀️ Light',dark:'🌙 Dark',amoled:'⚫ AMOLED',ocean:'🌊 Ocean',forest:'🌿 Forest',rose:'🌸 Rose',sunset:'🌅 Sunset',purple:'💜 Purple'};
  const el=document.getElementById('curr-theme-label');if(el)el.textContent=labels[t]||t;
}
function showThemeModal(){initTheme();openModal('theme-mo');}

// ========== AUTH ==========
function switchAuthTab(tab,btn){document.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('active'));btn.classList.add('active');document.getElementById('login-form').classList.toggle('hidden',tab!=='login');document.getElementById('signup-form').classList.toggle('hidden',tab!=='signup');}

async function handleLogin(){
  const email=document.getElementById('login-email').value.trim(),pw=document.getElementById('login-password').value;
  if(!email||!pw)return toast('Fill all fields','error');
  const btn=document.getElementById('login-btn');btn.disabled=true;btn.textContent='Logging in...';
  const{data,error}=await db.auth.signInWithPassword({email,password:pw});
  btn.disabled=false;btn.textContent='Login to Yaarana';
  if(error)return toast(error.message,'error');
  CU=data.user;await loadCP();
  if(CP?.is_admin){toast('Admin: Use Admin Login button','info');await db.auth.signOut();showAuth();}else{initTheme();showApp();}
  toast('Welcome back!','success');
}

async function handleSignup(){
  const email=document.getElementById('signup-email').value.trim(),pw=document.getElementById('signup-password').value;
  if(!email||!pw)return toast('Fill all fields','error');
  if(pw.length<6)return toast('Password min 6 chars','error');
  const btn=document.getElementById('signup-btn');btn.disabled=true;btn.textContent='Creating...';
  const{data,error}=await db.auth.signUp({email,password:pw});
  btn.disabled=false;btn.textContent='Create Account';
  if(error)return toast(error.message,'error');
  CU=data.user;
  await new Promise(r=>setTimeout(r,1200));
  await loadCP();initTheme();showApp();
  toast('Welcome to Yaarana!','success');
  setTimeout(()=>showEditProfileModal(),1500);
}

async function handleLogout(){await db.auth.signOut();CU=null;CP=null;showAuth();toast('Logged out','info');}
function confirmDeleteAccount(){toast('Account deletion disabled in demo','error');}

// ========== NAVIGATION ==========
function navigateTo(page,force=false){
  if(page===curPage&&!force)return;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('chat-page').style.display='none';
  document.getElementById('bottom-nav').style.display='flex';
  document.getElementById('top-nav').style.display='flex';
  document.querySelectorAll('.bn-item').forEach(b=>b.classList.remove('active'));
  const navMap={home:'bn-home',search:'bn-search',create:'bn-create',reels:'bn-reels',settings:'bn-settings'};
  if(navMap[page])document.getElementById(navMap[page])?.classList.add('active');
  curPage=page;
  if(page==='home'){document.getElementById('home-page').classList.add('active');loadHomeFeed();}
  else if(page==='search'){document.getElementById('search-page').classList.add('active');loadExplorePosts();}
  else if(page==='create'){document.getElementById('create-page').classList.add('active');}
  else if(page==='groups'){navigateTo('dms');setTimeout(()=>switchMsgTab('discover',document.getElementById('msg-tab-discover')),100);return;}
  else if(page==='reels'){document.getElementById('reels-page').classList.add('active');}
  else if(page==='dms'){
    document.getElementById('dms-page').classList.add('active');
    // Reset to DMs tab
    document.querySelectorAll('#dms-page .pt-btn').forEach(b=>b.classList.remove('active'));
    const dmTabBtn=document.getElementById('msg-tab-dms');if(dmTabBtn)dmTabBtn.classList.add('active');
    document.getElementById('dms-tab-content').classList.remove('hidden');
    document.getElementById('discover-tab-content').classList.add('hidden');
    document.getElementById('mygroups-tab-content').classList.add('hidden');
    document.getElementById('requests-tab-content').classList.add('hidden');
    const fab=document.getElementById('grp-fab');if(fab)fab.style.display='none';
    loadDMs();
  }
  else if(page==='my-profile'){document.getElementById('my-profile-page').classList.add('active');loadMyProfile();}
  else if(page==='profile'){document.getElementById('profile-page').classList.add('active');}
  else if(page==='notifications'){
    document.getElementById('notif-page').classList.add('active');
    const nb=document.getElementById('notif-badge');if(nb)nb.style.display='none';
    const nd=document.getElementById('notif-dot');if(nd)nd.classList.add('hidden');
    localStorage.setItem('mm-last-notif-check',new Date().toISOString());
    loadNotifs();
  }
  else if(page==='settings'){document.getElementById('settings-page').classList.add('active');}
}

async function openGroupChat(gId,gName,memCount,isAdmin){
  chatId=gId;chatType='group';
  document.getElementById('chat-title').textContent=gName;
  document.getElementById('chat-sub').textContent=`${memCount} members`;
  const{data:grpData}=await db.from('groups').select('avatar_url').eq('id',gId).single();
  const chatAvEl=document.getElementById('chat-av');
  if(grpData?.avatar_url){
    chatAvEl.outerHTML=`<img src="${grpData.avatar_url}" id="chat-av" class="av" style="width:36px;height:36px;border-radius:8px;cursor:pointer;flex-shrink:0" onclick="showGrpInfo('${gId}')" alt="${esc(gName)}">`;
  } else {chatAvEl.textContent=ini(gName);chatAvEl.id='chat-av';chatAvEl.style.cursor='pointer';chatAvEl.onclick=()=>showGrpInfo(gId);}
  const barAv=document.getElementById('chat-bar-av');
  if(CP?.avatar_url){barAv.outerHTML=`<img src="${CP.avatar_url}" id="chat-bar-av" class="av" style="width:32px;height:32px;flex-shrink:0;border-radius:50%;">`;}
  else{barAv.textContent=ini(CP?.full_name||CP?.username||'?');barAv.id='chat-bar-av';}
  document.getElementById('chat-info-btn').onclick=()=>showGrpInfo(gId);
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('bottom-nav').style.display='none';
  document.getElementById('top-nav').style.display='none';
  document.getElementById('chat-page').style.display='flex';
  loadChatMsgs();subscribeChat();
}

async function openDMChat(userId,userName){
  chatId=userId;chatType='dm';
  const{data:prof}=await db.from('profiles').select('full_name,username,avatar_url').eq('id',userId).single();
  const displayName=prof?.full_name||prof?.username||userName;
  document.getElementById('chat-title').textContent=displayName;
  document.getElementById('chat-sub').textContent='@'+(prof?.username||userName);
  document.getElementById('chat-info-btn').onclick=()=>viewUserProfile(userId);
  const chatAv=document.getElementById('chat-av');
  if(prof?.avatar_url){chatAv.outerHTML=`<img src="${prof.avatar_url}" id="chat-av" class="av" style="width:36px;height:36px;border-radius:50%;cursor:pointer;flex-shrink:0" onclick="viewUserProfile('${userId}')" alt="${esc(displayName)}">"`;}
  else{chatAv.textContent=ini(displayName);chatAv.id='chat-av';chatAv.style.cursor='pointer';chatAv.onclick=()=>viewUserProfile(userId);}
  const barAv=document.getElementById('chat-bar-av');
  if(CP?.avatar_url){barAv.outerHTML=`<img src="${CP.avatar_url}" id="chat-bar-av" class="av" style="width:32px;height:32px;flex-shrink:0;border-radius:50%;">`;}
  else{barAv.textContent=ini(CP?.full_name||CP?.username||'?');barAv.id='chat-bar-av';}
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('bottom-nav').style.display='none';
  document.getElementById('top-nav').style.display='none';
  document.getElementById('chat-page').style.display='flex';
  loadChatMsgs();subscribeChat();
}

function closeChatPage(){
  if(chatSub){chatSub.unsubscribe();chatSub=null;}
  document.getElementById('chat-page').style.display='none';
  document.getElementById('bottom-nav').style.display='flex';
  document.getElementById('top-nav').style.display='flex';
  navigateTo(chatType==='dm'?'dms':'groups');
}
function showChatInfo(){if(chatType==='group')showGrpInfo(chatId);else viewUserProfile(chatId);}

// ========== HOME FEED ==========
async function loadHomeFeed(){
  if(!CU)return;
  const sc=document.getElementById('stories-c'),fc=document.getElementById('feed-c');
  sc.innerHTML='<div class="dots"><span></span><span></span><span></span></div>';
  fc.innerHTML=[1,2,3].map(()=>`<div class="skel-card"><div class="skel-row"><div class="skeleton skel-av"></div><div style="flex:1"><div class="skeleton skel-line" style="width:40%;margin-bottom:6px"></div><div class="skeleton skel-line" style="width:25%"></div></div></div><div class="skeleton skel-img"></div><div style="padding:.6rem 0 .2rem"><div class="skeleton skel-line" style="width:60%;margin-bottom:6px"></div><div class="skeleton skel-line" style="width:80%"></div></div></div>`).join('');
  await loadStories(sc);
  await loadFeedPosts(fc);
}

async function loadStories(sc){
  const since=new Date(Date.now()-24*60*60*1000).toISOString();
  const[{data:following},{data:myBlocks},{data:stories}]=await Promise.all([
    db.from('followers').select('following_id').eq('follower_id',CU.id),
    db.from('blocked_users').select('blocked_id').eq('blocker_id',CU.id),
    db.from('stories').select('*,profiles:user_id(id,username,full_name,avatar_url)').gt('created_at',since).order('created_at',{ascending:false})
  ]);
  const followingIds=new Set((following||[]).map(f=>f.following_id));
  const blockedSet=new Set((myBlocks||[]).map(b=>b.blocked_id));
  const byUser=new Map();
  (stories||[]).forEach(s=>{
    if(s.user_id!==CU.id&&(!followingIds.has(s.user_id)||blockedSet.has(s.user_id)))return;
    if(!byUser.has(s.user_id))byUser.set(s.user_id,{profile:s.profiles,stories:[s]});
    else byUser.get(s.user_id).stories.push(s);
  });
  const seenStories=JSON.parse(localStorage.getItem('ya-seen-stories')||'{}');
  // Check if current user has own story
  const myStories=(stories||[]).filter(s=>s.user_id===CU.id);
  const myLatestStory=myStories[0]||null;
  const myStoryBtn=myLatestStory?
    `<div class="story-item" style="position:relative" onclick="viewStory('${CU.id}','${esc(CP?.username||'You')}','${myLatestStory.image_url}','${myLatestStory.id}')">
      <div class="story-ring" style="background:linear-gradient(135deg,var(--saffron),#FF3CAC)"><div class="story-ring-inner">${CP?.avatar_url?`<img src="${CP.avatar_url}" alt="">`:
      `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--saffron);font-size:1.1rem">${ini(CP?.full_name||CP?.username)}</div>`}</div></div>
      <div onclick="event.stopPropagation();document.getElementById('story-fi').click()" style="position:absolute;bottom:16px;right:0;width:20px;height:20px;background:var(--saffron);border-radius:50%;border:2px solid var(--bg);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2" title="Upload new story">
        <svg viewBox="0 0 24 24" style="width:11px;height:11px;fill:none;stroke:white;stroke-width:3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </div>
      <span class="story-name">Your Story</span>
    </div>`:
    `<div class="story-item" onclick="document.getElementById('story-fi').click()">
      <div class="story-add-ring">${CP?.avatar_url?`<img src="${CP.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`:
      `<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:none;stroke:var(--text3);stroke-width:2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`}</div>
      <span class="story-name">Add Story</span>
    </div>`;
  const storiesHtml=[...byUser.entries()].filter(([uid])=>uid!==CU.id).map(([uid,{profile,stories:ss}])=>{
    const isSeen=seenStories[uid]&&seenStories[uid]>=new Date(ss[0].created_at).getTime();
    return`<div class="story-item" onclick="viewStory('${uid}','${esc(profile?.username||'User')}','${esc(ss[0].image_url)}','${ss[0].id}')">
      <div class="story-ring" style="${isSeen?'background:var(--border2);':''}"><div class="story-ring-inner">${profile?.avatar_url?`<img src="${profile.avatar_url}" alt="">`:
      `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--saffron);font-size:1.1rem;">${ini(profile?.full_name||profile?.username)}</div>`}</div></div>
      <span class="story-name">${esc(profile?.username||'User')}</span>
    </div>`;}).join('');
  sc.innerHTML=myStoryBtn+storiesHtml;
}

async function loadFeedPosts(fc){
  const[{data:postsRaw,error},{data:myBlks}]=await Promise.all([
    db.from('posts').select('*,profiles:user_id(id,username,full_name,avatar_url),likes(count),comments(count)').eq('is_deleted',false).order('created_at',{ascending:false}).limit(40),
    db.from('blocked_users').select('blocked_id').eq('blocker_id',CU.id)
  ]);
  if(error){fc.innerHTML=`<div class="empty-st"><div class="empty-tt">Failed to load</div><div class="empty-tx">${error.message}</div></div>`;return;}
  const bset=new Set((myBlks||[]).map(b=>b.blocked_id));
  const posts=(postsRaw||[]).filter(p=>!bset.has(p.user_id));
  if(!posts.length){fc.innerHTML=`<div class="empty-st"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><div class="empty-tt">No posts yet</div><div class="empty-tx">Follow people or create a post!</div><button class="btn btn-primary" style="margin-top:.8rem" onclick="navigateTo('search')">Explore</button></div>`;return;}
  const{data:myLikes}=await db.from('likes').select('post_id').eq('user_id',CU.id);
  const likedSet=new Set((myLikes||[]).map(l=>l.post_id));
  fc.innerHTML=posts.map(p=>renderPost(p,likedSet)).join('');
  lazyLoad();
}

function renderPost(post,likedSet=new Set()){
  const p=post.profiles,lc=post.likes?.[0]?.count||0,cc=post.comments?.[0]?.count||0,isLiked=likedSet.has(post.id),isOwn=post.user_id===CU?.id;
  return`<div class="post-card" id="post-${post.id}">
  <div class="post-hdr">
    <div onclick="viewUserProfile('${p?.id}')" style="cursor:pointer">${avHtml(p,42)}</div>
    <div class="post-ui">
      <div class="post-un" onclick="viewUserProfile('${p?.id}')" style="display:flex;align-items:center;gap:2px">${esc(p?.username||'Unknown')}${verifBadge(p,16)}</div>
      <div class="post-tm">${ago(post.created_at)}</div>
    </div>
    <div style="position:relative">
      <button class="nav-btn" onclick="toggleDD('pdd-${post.id}')">
        <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
      </button>
      <div class="dd-menu hidden" id="pdd-${post.id}">
        ${isOwn?`<button class="dd-item danger" onclick="deletePost('${post.id}');closeDD('pdd-${post.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>Delete Post</button>`:''}
        <button class="dd-item" onclick="openReport('post','${post.id}');closeDD('pdd-${post.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Report</button>
        ${!isOwn?`<button class="dd-item" onclick="blockUser('${p?.id}');closeDD('pdd-${post.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>Block User</button>`:''}
        <button class="dd-item" onclick="openShare('${post.id}');closeDD('pdd-${post.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Share</button>
      </div>
    </div>
  </div>
  <div class="post-img-w"><img class="post-img lazy" data-src="${post.image_url}" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E" alt="Post"></div>
  <div class="post-acts">
    <button class="act-btn ${isLiked?'liked':''}" onclick="toggleLike('${post.id}',this)" id="lb-${post.id}">
      ${isLiked?`<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:#E91E63"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`:
      `<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`}
      <span id="lc-${post.id}">${lc}</span>
    </button>
    <button class="act-btn" onclick="openCmtModal('${post.id}')">
      <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span>${cc}</span>
    </button>
    <button class="act-btn" onclick="openShare('${post.id}')">
      <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
    </button>
  </div>
  <div class="post-info">
    ${lc>0?`<div class="post-lk">${lc} ${lc===1?'like':'likes'}</div>`:''}
    ${post.caption?`<div class="post-cap"><span class="post-un" onclick="viewUserProfile('${p?.id}')" style="display:inline">${esc(p?.username)}</span> ${esc(post.caption)}</div>`:''}
    <div class="post-vcm" onclick="openCmtModal('${post.id}')">View all ${cc} comments</div>
  </div>
</div>`;
}

function lazyLoad(){
  if('IntersectionObserver' in window){
    const o=new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){
          var i=en.target;
          if(i.dataset.src){i.src=i.dataset.src;i.classList.remove('lazy');o.unobserve(i);}
        }
      });
    },{rootMargin:'200px'});
    document.querySelectorAll('img.lazy').forEach(function(i){o.observe(i);});
  } else {
    document.querySelectorAll('img.lazy').forEach(function(i){i.src=i.dataset.src;});
  }
}

// ========== STORIES ==========
async function uploadStory(event){
  const file=event.target.files[0];if(!file)return;
  showLoad(true);
  try{
    const blob=await compressImg(file,500,null); // no ratio enforcement
    const fn=`${CU.id}/${Date.now()}_story.jpg`;
    const{error:ue}=await db.storage.from('posts').upload(fn,blob,{contentType:'image/jpeg'});
    if(ue)throw ue;
    const{data:{publicUrl}}=db.storage.from('posts').getPublicUrl(fn);
    const{error}=await db.from('stories').insert({user_id:CU.id,image_url:publicUrl,expires_at:new Date(Date.now()+24*60*60*1000).toISOString()});
    if(error)throw error;
    toast('Story uploaded! ✓','success');
    // Auto-open the story just uploaded
    const sc=document.getElementById('stories-c');
    if(sc)await loadStories(sc);
    // Open it
    const username=CP?.username||'You';
    viewStory(CU.id,username,publicUrl,null);
    // Get the actual story ID and update currentStoryId
    const{data:newStory}=await db.from('stories').select('id').eq('user_id',CU.id).order('created_at',{ascending:false}).limit(1).single().catch(()=>({data:null}));
    if(newStory)currentStoryId=newStory.id;
    const delBtn=document.getElementById('story-delete-btn');if(delBtn)delBtn.style.display='block';
  }catch(e){toast('Story upload failed: '+e.message,'error');}
  showLoad(false);
  event.target.value='';
}

function viewStory(userId,username,imgUrl,storyId){
  currentStoryUserId=userId;currentStoryId=storyId||null;
  document.getElementById('sv-name').textContent=username;
  document.getElementById('sv-av').textContent=ini(username);
  document.getElementById('story-img').src=imgUrl;
  document.getElementById('story-viewer').classList.remove('hidden');
  // Show/hide delete button for own stories
  const delBtn=document.getElementById('story-delete-btn');
  if(delBtn)delBtn.style.display=(userId===CU?.id&&storyId)?'block':'none';
  const bar=document.getElementById('story-prog-bar');
  bar.style.width='0%';bar.style.transition='none';
  clearInterval(storyTimer);
  setTimeout(()=>{bar.style.transition='width 5s linear';bar.style.width='100%';},50);
  storyTimer=setTimeout(()=>closeStoryViewer(),5200);
  const seen=JSON.parse(localStorage.getItem('ya-seen-stories')||'{}');
  seen[userId]=Date.now();localStorage.setItem('ya-seen-stories',JSON.stringify(seen));
  document.querySelectorAll('.story-item').forEach(item=>{
    if(item.getAttribute('onclick')&&item.getAttribute('onclick').includes(userId)){
      const ring=item.querySelector('.story-ring');if(ring)ring.style.background='var(--border2)';
    }
  });
}
function closeStoryViewer(){clearInterval(storyTimer);document.getElementById('story-viewer').classList.add('hidden');currentStoryId=null;currentStoryUserId=null;}
async function deleteMyStory(){
  if(!currentStoryId)return toast('Story ID not found','error');
  if(!confirm('Delete this story?'))return;
  clearInterval(storyTimer);
  // Get the story first to get image URL for storage cleanup
  const{data:storyData}=await db.from('stories').select('image_url').eq('id',currentStoryId).single().catch(()=>({data:null}));
  const{error}=await db.from('stories').delete().eq('id',currentStoryId).eq('user_id',CU.id);
  if(error){toast('Delete failed: '+error.message,'error');return;}
  // Try to delete from storage too (cleanup)
  if(storyData?.image_url){
    try{
      const url=new URL(storyData.image_url);
      const parts=url.pathname.split('/posts/');
      if(parts[1])await db.storage.from('posts').remove([decodeURIComponent(parts[1])]).catch(()=>{});
    }catch(e){}
  }
  closeStoryViewer();toast('Story deleted','success');
  const sc=document.getElementById('stories-c');if(sc)await loadStories(sc);
}

// ========== LIKES ==========
async function toggleLike(pid,btn){
  if(!CU)return;
  const liked=btn.classList.contains('liked'),countEl=document.getElementById(`lc-${pid}`);
  if(liked){
    btn.classList.remove('liked');
    btn.querySelector('svg').outerHTML=`<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    countEl.textContent=Math.max(0,parseInt(countEl.textContent)-1);
    await db.from('likes').delete().eq('user_id',CU.id).eq('post_id',pid);
  }else{
    btn.classList.add('liked');
    btn.querySelector('svg').outerHTML=`<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:#E91E63"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    countEl.textContent=parseInt(countEl.textContent)+1;
    await db.from('likes').insert({user_id:CU.id,post_id:pid});
  }
}

// ========== COMMENTS ==========
async function openCmtModal(postId){
  cmt_postId=postId;openModal('comment-mo');
  const av=document.getElementById('cmt-mo-av');
  if(CP?.avatar_url){av.outerHTML=`<img src="${CP.avatar_url}" id="cmt-mo-av" class="av" style="width:32px;height:32px;border-radius:50%;flex-shrink:0;">`;}
  else{av.textContent=ini(CP?.full_name||CP?.username||'?');av.id='cmt-mo-av';}
  await loadCmts(postId);
}

async function loadCmts(postId){
  const list=document.getElementById('cmts-list');
  list.innerHTML='<div class="dots"><span></span><span></span><span></span></div>';
  const[{data:cmts},{data:myLikes},{data:postData}]=await Promise.all([
    db.from('comments').select('*,profiles:user_id(id,username,full_name,avatar_url),comment_likes(count)').eq('post_id',postId).eq('is_deleted',false).order('is_pinned',{ascending:false}).order('created_at',{ascending:true}),
    db.from('comment_likes').select('comment_id').eq('user_id',CU.id),
    db.from('posts').select('user_id').eq('id',postId).single()
  ]);
  const myLikedSet=new Set((myLikes||[]).map(l=>l.comment_id));
  const postOwnerId=postData?.user_id;
  const isPostOwner=postOwnerId===CU.id;
  if(!cmts||!cmts.length){list.innerHTML='<div class="empty-st" style="padding:1.5rem"><div class="empty-tt">No comments yet</div></div>';return;}
  // Attach like data
  const enriched=cmts.map(c=>({...c,like_count:c.comment_likes?.[0]?.count||0,my_like:myLikedSet.has(c.id)}));
  if(!cmts||!cmts.length){list.innerHTML='<div class="empty-st" style="padding:1.5rem"><div class="empty-tt">No comments yet</div></div>';return;}
  list.innerHTML=enriched.map(c=>{
    const isOwn=c.user_id===CU?.id;
    const isPinned=c.is_pinned;
    // Check if post owner to allow pin
    return`<div class="cmt-item" id="cmt-${c.id}" ${isPinned?'style="order:-1"':''}>
      <div onclick="viewUserProfile('${c.profiles?.id}')" style="cursor:pointer">${avHtml(c.profiles,30)}</div>
      <div class="cmt-body">
        ${isPinned?`<div style="font-size:.65rem;font-weight:700;color:var(--saffron);margin-bottom:.15rem">📌 Pinned</div>`:''}
        <div class="cmt-auth" onclick="viewUserProfile('${c.profiles?.id}')" style="cursor:pointer">${esc(c.profiles?.username||'User')}${verifBadge(c.profiles,13)}</div>
        <div class="cmt-txt">${esc(c.content)}</div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:.5rem">
            <div class="cmt-tm">${ago(c.created_at)}</div>
            <button class="btn btn-ghost btn-sm" style="font-size:.7rem;padding:.1rem .4rem;gap:.2rem" onclick="toggleCmtLike('${c.id}',this)" id="clt-${c.id}">
              <svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:${c.my_like?'#E91E63':'none'};stroke:${c.my_like?'#E91E63':'currentColor'};stroke-width:2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span id="clc-${c.id}">${c.like_count||0}</span>
            </button>
          </div>
          <div style="display:flex;gap:2px">
            ${isPostOwner?`<button class="btn btn-ghost btn-sm" style="font-size:.7rem;padding:.1rem .4rem;color:var(--saffron)" onclick="togglePinComment('${c.id}',${isPinned})">${isPinned?'Unpin':'📌 Pin'}</button>`:''}
            <button class="btn btn-ghost btn-sm" style="font-size:.7rem;padding:.1rem .4rem" onclick="openReport('comment','${c.id}')">Report</button>
            ${isOwn?`<button class="btn btn-ghost btn-sm" style="font-size:.7rem;padding:.1rem .4rem;color:#FF3B3B" onclick="deleteCmt('${c.id}')">Delete</button>`:''}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function submitComment(){
  const inp=document.getElementById('cmt-inp'),content=inp.value.trim();
  if(!content||!cmt_postId)return;
  inp.value='';
  const{error}=await db.from('comments').insert({user_id:CU.id,post_id:cmt_postId,content});
  if(error)return toast(error.message,'error');
  await loadCmts(cmt_postId);
}

async function deleteCmt(id){
  await db.from('comments').update({is_deleted:true}).eq('id',id);
  document.getElementById(`cmt-${id}`)?.remove();toast('Deleted','success');
}

async function toggleCmtLike(cmtId,btn){
  const countEl=document.getElementById(`clc-${cmtId}`);
  const svg=btn.querySelector('svg');
  const isLiked=svg.style.fill==='#E91E63'||svg.getAttribute('fill')==='#E91E63';
  if(isLiked){
    await db.from('comment_likes').delete().eq('user_id',CU.id).eq('comment_id',cmtId);
    svg.style.fill='none';svg.style.stroke='currentColor';
    countEl.textContent=Math.max(0,parseInt(countEl.textContent)-1);
  }else{
    await db.from('comment_likes').insert({user_id:CU.id,comment_id:cmtId});
    svg.style.fill='#E91E63';svg.style.stroke='#E91E63';
    countEl.textContent=parseInt(countEl.textContent)+1;
  }
}

async function togglePinComment(cmtId,isPinned){
  // Unpin all others first if pinning
  if(!isPinned){
    await db.from('comments').update({is_pinned:false}).eq('post_id',cmt_postId);
  }
  await db.from('comments').update({is_pinned:!isPinned}).eq('id',cmtId);
  toast(isPinned?'Comment unpinned':'Comment pinned!','success');
  await loadCmts(cmt_postId);
}

// ========== POST CREATION ==========
function onDragOver(e){e.preventDefault();document.getElementById('upload-zone').classList.add('dragover');}
function onDrop(e){e.preventDefault();document.getElementById('upload-zone').classList.remove('dragover');const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/'))processPostImg(f);}

async function handlePostImgSel(event){const f=event.target.files[0];if(f)processPostImg(f);}

async function processPostImg(file){
  try{
    const blob=await compressImg(file,1024,null); // no ratio enforcement
    postImgBlob=blob;
    const url=URL.createObjectURL(blob);
    document.getElementById('upload-zone').classList.add('hidden');
    const pw=document.getElementById('post-prev-w');pw.classList.remove('hidden');
    document.getElementById('post-prev-img').src=url;
    document.getElementById('publish-btn').disabled=false;
    toast('Image ready','success');
  }catch(e){toast('Image error: '+e.message,'error');}
}

function removePostPreview(){
  postImgBlob=null;
  document.getElementById('post-prev-w').classList.add('hidden');
  document.getElementById('upload-zone').classList.remove('hidden');
  document.getElementById('post-prev-img').src='';
  document.getElementById('post-fi').value='';
  document.getElementById('publish-btn').disabled=true;
}

async function compressImg(file,maxKB,ratio){
  return new Promise((res,rej)=>{
    const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{
      let w=img.width,h=img.height;
      if(ratio){if(w/h>ratio)w=h*ratio;else h=w/ratio;}
      const maxW=1400;if(w>maxW){h=h*(maxW/w);w=maxW;}
      const cv=document.createElement('canvas');cv.width=Math.round(w);cv.height=Math.round(h);
      cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
      URL.revokeObjectURL(url);
      let q=0.85;
      const tryC=()=>{cv.toBlob(b=>{if(!b)return rej(new Error('fail'));if(b.size<=maxKB*1024||q<=0.3)res(b);else{q-=0.1;tryC();};},'image/jpeg',q);};tryC();
    };img.onerror=()=>rej(new Error('Invalid image'));img.src=url;
  });
}

async function publishPost(){
  if(!postImgBlob)return;
  const btn=document.getElementById('publish-btn');btn.disabled=true;btn.textContent='Uploading...';
  const caption=document.getElementById('post-caption').value.trim();
  const fn=`${CU.id}/${Date.now()}.jpg`;
  const{error:ue}=await db.storage.from('posts').upload(fn,postImgBlob,{contentType:'image/jpeg'});
  if(ue){btn.disabled=false;btn.innerHTML=`<svg viewBox="0 0 24 24" style="width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Publish Post`;return toast('Upload failed: '+ue.message,'error');}
  const{data:{publicUrl}}=db.storage.from('posts').getPublicUrl(fn);
  const{error}=await db.from('posts').insert({user_id:CU.id,image_url:publicUrl,caption});
  btn.disabled=false;btn.innerHTML=`<svg viewBox="0 0 24 24" style="width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Publish Post`;
  if(error)return toast(error.message,'error');
  toast('Post published!','success');removePostPreview();document.getElementById('post-caption').value='';navigateTo('home');
}

async function deletePost(id){
  if(!confirm('Delete this post?'))return;
  // Verify ownership
  const{data:chk}=await db.from('posts').select('id,user_id').eq('id',id).single().catch(()=>({data:null}));
  if(!chk){toast('Post not found','error');return;}
  if(chk.user_id!==CU.id){toast('You can only delete your own posts','error');return;}
  // Hard DELETE from database — removes from DB completely
  const{error}=await db.from('posts').delete().eq('id',id).eq('user_id',CU.id);
  if(error){
    toast('Delete failed: '+error.message,'error');return;
  }
  // Remove from UI everywhere
  document.getElementById('post-'+id)?.remove();
  document.querySelectorAll('.grid-post').forEach(el=>{if(el.getAttribute('onclick')?.includes(id))el.remove();});
  document.getElementById('post-detail-ov')?.remove();
  toast('Post deleted ✓','success');
  if(curPage==='my-profile'){setTimeout(()=>loadMyProfile(),300);}
}

// ========== PROFILE ==========
async function loadMyProfile(){
  await loadCP();
  renderProfilePage(CP,document.getElementById('my-profile-c'),true);
}

async function viewUserProfile(userId){
  if(!userId||userId==='null'||userId==='undefined'){return;}
  if(userId===CU?.id){navigateTo('my-profile');return;}
  // Navigate and show loader
  navigateTo('profile');
  const profC=document.getElementById('profile-c');
  if(!profC)return;
  profC.innerHTML='<div class="dots" style="padding:3rem"><span></span><span></span><span></span></div>';
  try{
    const{data:blk}=await db.from('blocked_users').select('id').eq('blocker_id',CU.id).eq('blocked_id',userId).single().catch(()=>({data:null}));
    if(blk){profC.innerHTML='<div class="empty-st" style="padding:3rem"><div class="empty-tt">User Blocked</div><div class="empty-tx">Unblock in Settings to view their profile</div></div>';return;}
    const{data:p,error}=await db.from('profiles').select('*').eq('id',userId).single();
    if(error||!p){profC.innerHTML='<div class="empty-st" style="padding:3rem"><div class="empty-tt">User not found</div></div>';return;}
    await renderProfilePage(p,profC,false);
  }catch(err){
    profC.innerHTML='<div class="empty-st" style="padding:3rem"><div class="empty-tt">Could not load profile</div><div class="empty-tx">'+esc(err.message)+'</div></div>';
  }
}


async function renderProfilePage(profile,container,isOwn){
  if(!profile)return;
  const[{data:frs},{data:fng},{data:posts}]=await Promise.all([
    db.from('followers').select('count').eq('following_id',profile.id),
    db.from('followers').select('count').eq('follower_id',profile.id),
    db.from('posts').select('id,image_url').eq('user_id',profile.id).eq('is_deleted',false).order('created_at',{ascending:false})
  ]);
  let isFollowing=false,isBlocked=false;
  if(!isOwn&&CU){
    const[{data:f},{data:b}]=await Promise.all([
      db.from('followers').select('id').eq('follower_id',CU.id).eq('following_id',profile.id).single(),
      db.from('blocked_users').select('id').eq('blocker_id',CU.id).eq('blocked_id',profile.id).single()
    ]);
    isFollowing=!!f;isBlocked=!!b;
  }
  const fc=frs?.[0]?.count||0,fgc=fng?.[0]?.count||0;
  const actionBtns=isOwn?
    `<button class="btn btn-outline btn-sm" onclick="showEditProfileModal()"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit Profile</button>`:
    `<div style="display:flex;gap:.5rem;flex-wrap:wrap">
      <button class="btn ${isFollowing?'btn-outline':'btn-primary'} btn-sm" onclick="toggleFollow('${profile.id}',${isFollowing},this)">
        ${isFollowing?`<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2.5"><polyline points="20 6 9 17 4 12"/></svg>Following`:`<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Follow`}
      </button>
      ${isFollowing?`<button class="btn btn-ghost btn-sm" onclick="openDMWithUser('${profile.id}','${esc(profile.username)}')"><svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Message</button>`:''}
      <button class="btn btn-ghost btn-sm" onclick="openReport('user','${profile.id}')"><svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg></button>
      <button class="btn btn-ghost btn-sm" style="color:${isBlocked?'var(--green)':'#FF3B3B'}" onclick="toggleBlock('${profile.id}',${isBlocked},this)"><svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>${isBlocked?'Unblock':'Block'}</button>
    </div>`;
  container.innerHTML=`
  <div class="prof-hdr">
    <div class="prof-top">${avHtml(profile,80)}<div style="flex:1;min-width:0">
      <div class="prof-nm" style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">${esc(profile.full_name||profile.username)}${verifBadge(profile,22)}</div>
      <div class="prof-un">@${esc(profile.username)}</div>
      ${profile.bio?`<div class="prof-bio">${esc(profile.bio)}</div>`:''}
      ${profile.website?`<a href="${esc(profile.website)}" target="_blank" class="prof-web">${esc(profile.website)}</a>`:''}
      ${profile.age||profile.gender?`<div style="font-size:.8rem;color:var(--text3);margin-top:.3rem">${[profile.age&&profile.age+' yrs',profile.gender].filter(Boolean).join(' · ')}</div>`:''}
    </div></div>
    <div class="prof-stats">
      <div class="stat-i"><span class="stat-n">${posts?.length||0}</span><span class="stat-l">Posts</span></div>
      <div class="stat-i" onclick="showFollowersList('${profile.id}','followers')" style="cursor:pointer"><span class="stat-n">${fc}</span><span class="stat-l" style="text-decoration:underline dotted;text-underline-offset:2px">Followers</span></div>
      <div class="stat-i" onclick="showFollowersList('${profile.id}','following')" style="cursor:pointer"><span class="stat-n">${fgc}</span><span class="stat-l" style="text-decoration:underline dotted;text-underline-offset:2px">Following</span></div>
    </div>
    ${actionBtns}
  </div>
  <div class="prof-tabs">
    <button class="prof-tab active" onclick="switchProfTab('posts','${profile.id}',this)"><svg viewBox="0 0 24 24" style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>Posts</button>
    <button class="prof-tab" onclick="switchProfTab('liked','${profile.id}',this)"><svg viewBox="0 0 24 24" style="width:15px;height:15px;fill:currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>Liked</button>
  </div>
  <div id="prof-posts-grid">${posts&&posts.length?`<div class="posts-grid">${posts.map(p=>`<div class="grid-post" onclick="openPostDetail('${p.id}')"><img src="${p.image_url}" alt="" loading="lazy"><div class="grid-post-ov"><svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:white"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div></div>`).join('')}</div>`:
  `<div class="empty-st"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><div class="empty-tt">No posts yet</div></div>`}
  </div>`;
}

async function switchProfTab(tab,userId,btn){
  document.querySelectorAll('.prof-tab').forEach(t=>t.classList.remove('active'));btn.classList.add('active');
  const c=document.getElementById('prof-posts-grid');c.innerHTML='<div class="dots"><span></span><span></span><span></span></div>';
  if(tab==='posts'){
    const{data:posts}=await db.from('posts').select('id,image_url').eq('user_id',userId).eq('is_deleted',false).order('created_at',{ascending:false});
    c.innerHTML=posts&&posts.length?`<div class="posts-grid">${posts.map(p=>`<div class="grid-post" onclick="openPostDetail('${p.id}')"><img src="${p.image_url}" loading="lazy"><div class="grid-post-ov"><svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:white"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div></div>`).join('')}</div>`:
    `<div class="empty-st"><div class="empty-tt">No posts</div></div>`;
  }else{
    const{data:likes}=await db.from('likes').select('posts(id,image_url,is_deleted)').eq('user_id',userId);
    const lp=(likes||[]).map(l=>l.posts).filter(p=>p&&!p.is_deleted);
    c.innerHTML=lp.length?`<div class="posts-grid">${lp.map(p=>`<div class="grid-post" onclick="openPostDetail('${p.id}')"><img src="${p.image_url}" loading="lazy"><div class="grid-post-ov"><svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:white"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div></div>`).join('')}</div>`:
    `<div class="empty-st"><div class="empty-tt">No liked posts</div></div>`;
  }
}

async function openPostDetail(postId){
  const{data:post}=await db.from('posts').select('*,profiles:user_id(id,username,full_name,avatar_url),likes(count),comments(count)').eq('id',postId).single();
  if(!post)return;
  const{data:myLikes}=await db.from('likes').select('post_id').eq('user_id',CU.id);
  const likedSet=new Set((myLikes||[]).map(l=>l.post_id));
  let ov=document.getElementById('post-detail-ov');
  if(!ov){ov=document.createElement('div');ov.id='post-detail-ov';ov.style='position:fixed;inset:0;background:rgba(10,22,40,.6);backdrop-filter:blur(4px);z-index:800;display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto';document.body.appendChild(ov);}
  ov.innerHTML=`<div style="background:var(--surface);border-radius:var(--r-lg);width:min(100%,480px);max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);position:relative">
    <button onclick="document.getElementById('post-detail-ov').remove()" style="position:absolute;top:.8rem;right:.8rem;background:var(--bg2);border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;color:var(--text2)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12" stroke-linecap="round"/></svg></button>
    ${renderPost(post,likedSet)}
  </div>`;
  ov.onclick=e=>{if(e.target===ov)ov.remove();};
}

// ========== EDIT PROFILE ==========
async function showEditProfileModal(){
  await loadCP();const p=CP;if(!p)return;
  document.getElementById('edit-fname').value=p.full_name||'';
  document.getElementById('edit-uname').value=p.username||'';
  document.getElementById('edit-age').value=p.age||'';
  document.getElementById('edit-gender').value=p.gender||'';
  document.getElementById('edit-bio').value=p.bio||'';
  document.getElementById('edit-website').value=p.website||'';
  const av=document.getElementById('edit-av-prev');
  if(p.avatar_url){av.outerHTML=`<img src="${p.avatar_url}" id="edit-av-prev" class="av" style="width:90px;height:90px;display:block;margin:0 auto .8rem">`;}
  else{av.className='av-ph';av.style='width:90px;height:90px;margin:0 auto .8rem;font-size:2rem';av.id='edit-av-prev';av.textContent=ini(p.full_name||p.username);}
  newAvBlob=null;
  openModal('edit-profile-mo');
}

async function handleAvSel(event){
  const f=event.target.files[0];if(!f)return;
  const blob=await compressImg(f,300,1);newAvBlob=blob;
  const url=URL.createObjectURL(blob);
  const el=document.getElementById('edit-av-prev');
  if(el.tagName==='IMG')el.src=url;
  else el.outerHTML=`<img src="${url}" id="edit-av-prev" class="av" style="width:90px;height:90px;display:block;margin:0 auto .8rem">`;
}

async function saveProfile(){
  const btn=document.getElementById('save-prof-btn');btn.disabled=true;btn.textContent='Saving...';
  let avatarUrl=CP?.avatar_url;
  if(newAvBlob){
    const fn=`${CU.id}/av_${Date.now()}.jpg`;
    const{error:ue}=await db.storage.from('avatars').upload(fn,newAvBlob,{contentType:'image/jpeg',upsert:true});
    if(!ue){const{data:{publicUrl}}=db.storage.from('avatars').getPublicUrl(fn);avatarUrl=publicUrl;}
  }
  const updates={full_name:document.getElementById('edit-fname').value.trim(),username:document.getElementById('edit-uname').value.trim(),age:parseInt(document.getElementById('edit-age').value)||null,gender:document.getElementById('edit-gender').value,bio:document.getElementById('edit-bio').value.trim(),website:document.getElementById('edit-website').value.trim(),avatar_url:avatarUrl,updated_at:new Date().toISOString()};
  const{error}=await db.from('profiles').update(updates).eq('id',CU.id);
  btn.disabled=false;btn.innerHTML=`<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Save Profile`;
  if(error)return toast(error.message,'error');
  await loadCP();closeModal('edit-profile-mo');toast('Profile updated!','success');updateNavAv();newAvBlob=null;
  // Refresh profile page if visible
  if(curPage==='my-profile')loadMyProfile();
}

// ========== FOLLOW ==========
async function toggleFollow(uid,isFollowing,btn){
  if(!CU)return;
  if(isFollowing){
    await db.from('followers').delete().eq('follower_id',CU.id).eq('following_id',uid);
    btn.innerHTML=`<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Follow`;
    btn.className='btn btn-primary btn-sm';btn.onclick=()=>toggleFollow(uid,false,btn);toast('Unfollowed','info');
  }else{
    await db.from('followers').insert({follower_id:CU.id,following_id:uid});
    btn.innerHTML=`<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2.5"><polyline points="20 6 9 17 4 12"/></svg>Following`;
    btn.className='btn btn-outline btn-sm';btn.onclick=()=>toggleFollow(uid,true,btn);toast('Following!','success');
  }
}

// ========== BLOCK ==========
async function toggleBlock(uid,isBlocked,btn){
  if(isBlocked){await db.from('blocked_users').delete().eq('blocker_id',CU.id).eq('blocked_id',uid);btn.innerHTML=`<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>Block`;btn.style.color='#FF3B3B';toast('Unblocked','info');}
  else{if(!confirm('Block this user?'))return;await db.from('blocked_users').insert({blocker_id:CU.id,blocked_id:uid});await db.from('followers').delete().eq('follower_id',CU.id).eq('following_id',uid);btn.innerHTML=`<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>Unblock`;btn.style.color='var(--green)';toast('Blocked','success');}
}
async function blockUser(uid){if(!CU||!uid)return;const{error}=await db.from('blocked_users').insert({blocker_id:CU.id,blocked_id:uid});if(error&&error.code!=='23505')return toast(error.message,'error');toast('User blocked','success');}

// ========== GROUPS ==========
let grpImgUrl=null;
function handleGrpImgSel(event){
  const f=event.target.files[0];if(!f)return;
  const reader=new FileReader();reader.onload=e=>{
    const prev=document.getElementById('grp-img-prev');
    prev.innerHTML=`<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
    // Store for upload
    compressImg(f,200,1).then(b=>{grpImgBlob=b;});
  };reader.readAsDataURL(f);
}

let memberSearchTimer=null;
async function searchMembersToAdd(q){
  clearTimeout(memberSearchTimer);const res=document.getElementById('grp-member-srch-res');
  if(!q.trim()){res.innerHTML='';return;}
  memberSearchTimer=setTimeout(async()=>{
    const{data:users}=await db.from('profiles').select('id,username,full_name,avatar_url').or(`username.ilike.%${q}%,full_name.ilike.%${q}%`).neq('id',CU.id).limit(5);
    if(!users||!users.length){res.innerHTML='<div style="font-size:.82rem;color:var(--text3);padding:.5rem">No users found</div>';return;}
    res.innerHTML=`<div class="card" style="margin-top:.4rem">${users.map(u=>`<div class="ul-item" onclick="addMemberToList('${u.id}','${esc(u.username)}','${u.avatar_url||''}')">
      ${avHtml(u,32)}<div><div style="font-weight:700;font-size:.85rem">${esc(u.full_name||u.username)}</div><div style="font-size:.75rem;color:var(--text3)">@${esc(u.username)}</div></div>
    </div>`).join('')}</div>`;
  },300);
}

function addMemberToList(uid,username,avatar){
  if(grpSelectedMembers.find(m=>m.id===uid))return toast('Already added','info');
  grpSelectedMembers.push({id:uid,username});
  document.getElementById('grp-member-srch-res').innerHTML='';
  document.getElementById('grp-member-srch').value='';
  renderSelectedMembers();
}

function removeFromList(uid){grpSelectedMembers=grpSelectedMembers.filter(m=>m.id!==uid);renderSelectedMembers();}

function renderSelectedMembers(){
  const el=document.getElementById('grp-selected-members');
  el.innerHTML=grpSelectedMembers.map(m=>`<div style="display:flex;align-items:center;gap:.25rem;background:var(--saffron-pale);padding:.2rem .6rem;border-radius:999px;font-size:.78rem;font-weight:600">
    ${esc(m.username)}<button onclick="removeFromList('${m.id}')" style="background:none;border:none;cursor:pointer;color:var(--saffron);font-weight:700;line-height:1;padding:0 0 0 .2rem">×</button>
  </div>`).join('');
}

function showCreateGroupModal(){grpSelectedMembers=[];grpImgBlob=null;document.getElementById('grp-name-inp').value='';document.getElementById('grp-desc-inp').value='';document.getElementById('grp-member-srch-res').innerHTML='';document.getElementById('grp-selected-members').innerHTML='';document.getElementById('grp-img-prev').innerHTML=`<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:none;stroke:var(--text3);stroke-width:1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;openModal('create-grp-mo');}

async function createGroup(){
  const name=document.getElementById('grp-name-inp').value.trim();
  if(!name)return toast('Group name required','error');
  let imgUrl=null;
  if(grpImgBlob){
    const fn=`groups/${CU.id}_${Date.now()}.jpg`;
    const{error:ue}=await db.storage.from('posts').upload(fn,grpImgBlob,{contentType:'image/jpeg'});
    if(!ue){const{data:{publicUrl}}=db.storage.from('posts').getPublicUrl(fn);imgUrl=publicUrl;}
  }
  const{data:grp,error}=await db.from('groups').insert({name,description:document.getElementById('grp-desc-inp').value.trim(),created_by:CU.id,avatar_url:imgUrl}).select().single();
  if(error)return toast(error.message,'error');
  // Creator becomes admin
  await db.from('group_members').insert({group_id:grp.id,user_id:CU.id,role:'admin'});
  // Add selected members
  for(const m of grpSelectedMembers){await db.from('group_members').insert({group_id:grp.id,user_id:m.id,role:'member'}).catch(()=>{});}
  closeModal('create-grp-mo');grpSelectedMembers=[];grpImgBlob=null;
  toast('Group created!','success');loadGroups();openGroupChat(grp.id,grp.name,1+grpSelectedMembers.length,true);
}

async function loadGroups(){
  const c=document.getElementById('grp-list-c');c.innerHTML='<div class="dots"><span></span><span></span><span></span></div>';
  if(grpTab==='discover'){
    const{data:groups}=await db.from('groups').select('*,group_members(count)').eq('is_deleted',false).order('created_at',{ascending:false});
    // Auto-delete groups with 0 members
    for(const eg of (groups||[]).filter(g=>(g.group_members?.[0]?.count||0)===0)){await db.from('groups').update({is_deleted:true}).eq('id',eg.id).catch(()=>{});}
    const validGroups=(groups||[]).filter(g=>(g.group_members?.[0]?.count||0)>0);
    if(!validGroups.length){c.innerHTML='<div class="empty-st"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><div class="empty-tt">No groups yet</div><div class="empty-tx">Create the first one!</div></div>';return;}
    const{data:myMems}=await db.from('group_members').select('group_id').eq('user_id',CU.id);
    const myGrpIds=new Set((myMems||[]).map(m=>m.group_id));
    c.innerHTML=validGroups.map(g=>{const cnt=g.group_members?.[0]?.count||0;const isMem=myGrpIds.has(g.id);return`<div class="grp-card" onclick="joinAndOpenGroup('${g.id}','${esc(g.name)}',${cnt})">
      <div class="grp-av">${g.avatar_url?`<img src="${g.avatar_url}" alt="">`:`<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:none;stroke:var(--text3);stroke-width:1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`}</div>
      <div class="grp-info"><div class="grp-nm">${esc(g.name)}</div><div class="grp-dc">${esc(g.description||'No description')}</div><div class="grp-mb">${cnt} members</div></div>
      <div style="flex-shrink:0">${isMem?`<span style="font-size:.72rem;font-weight:700;color:var(--green)">✓ Joined</span>`:`<span style="font-size:.72rem;font-weight:700;color:var(--saffron)">Join ›</span>`}</div>
    </div>`;}).join('');
  }else{
    const{data:mems}=await db.from('group_members').select('group_id,role,groups(*)').eq('user_id',CU.id);
    if(!mems||!mems.length){c.innerHTML='<div class="empty-st"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><div class="empty-tt">No groups joined</div></div>';return;}
    c.innerHTML=mems.filter(m=>m.groups&&!m.groups.is_deleted).map(m=>{const g=m.groups,isAdmin=m.role==='admin';return`<div class="grp-card" onclick="openGroupChat('${g.id}','${esc(g.name)}',0,${isAdmin})">
      <div class="grp-av">${g.avatar_url?`<img src="${g.avatar_url}" alt="">`:`<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:none;stroke:var(--text3);stroke-width:1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`}</div>
      <div class="grp-info"><div style="display:flex;align-items:center;gap:.4rem"><div class="grp-nm">${esc(g.name)}</div>${isAdmin?`<span class="chip chip-s" style="font-size:.65rem;padding:.1rem .4rem">Admin</span>`:''}</div><div class="grp-dc">${esc(g.description||'')}</div></div>
      <div style="display:flex;flex-direction:column;gap:.3rem;align-items:flex-end">
        <button class="btn btn-ghost btn-sm" style="font-size:.72rem;color:#FF3B3B" onclick="event.stopPropagation();leaveGroup('${g.id}','${esc(g.name)}')">
          <svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>Leave
        </button>
        ${isAdmin?`<button class="btn btn-ghost btn-sm" style="font-size:.72rem;color:#FF3B3B" onclick="event.stopPropagation();deleteGroupAction('${g.id}','${esc(g.name)}')">
          <svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>Delete
        </button>`:''}
      </div>
    </div>`;}).join('');
  }
}

function switchGrpTab(tab,btn){grpTab=tab;document.querySelectorAll('.pt-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');loadGroups();}

async function joinAndOpenGroup(gId,gName,cnt){
  const{data:existing}=await db.from('group_members').select('id,role').eq('group_id',gId).eq('user_id',CU.id).single().catch(()=>({data:null}));
  if(existing){
    const isAdmin=existing.role==='admin';
    openGroupChat(gId,gName,cnt,isAdmin);
    return;
  }
  // Check if already has a pending request
  const{data:pendingReq}=await db.from('group_join_requests').select('id,status').eq('group_id',gId).eq('user_id',CU.id).single().catch(()=>({data:null}));
  if(pendingReq){
    if(pendingReq.status==='pending')return toast('Join request already sent. Waiting for admin approval.','info');
    if(pendingReq.status==='rejected')return toast('Your join request was declined.','error');
  }
  // Submit join request
  const{error}=await db.from('group_join_requests').insert({group_id:gId,user_id:CU.id,status:'pending'});
  if(error)return toast('Could not send request: '+error.message,'error');
  toast(`Join request sent to "${gName}"! Waiting for admin approval.`,'success');
}

async function leaveGroup(gId,gName){
  if(!confirm(`Leave group "${gName}"?`))return;
  await db.from('group_members').delete().eq('group_id',gId).eq('user_id',CU.id);
  toast('Left group','info');
  await autoDeleteEmptyGroup(gId);
  loadGroupsTab('mine');
}

async function autoDeleteEmptyGroup(gId){
  const{count}=await db.from('group_members').select('*',{count:'exact',head:true}).eq('group_id',gId);
  if(count===0)await db.from('groups').update({is_deleted:true}).eq('id',gId);
}

async function deleteGroupAction(gId,gName){
  if(!confirm(`Delete group "${gName}"? This cannot be undone.`))return;
  await db.from('groups').update({is_deleted:true}).eq('id',gId).eq('created_by',CU.id);
  toast('Group deleted','success');
  // Close chat if open
  const chatPage=document.getElementById('chat-page');if(chatPage.classList.contains('active'))closeChatPage();
  loadGroupsTab('mine');
}

async function showGrpInfo(gId){
  openModal('grp-info-mo');const body=document.getElementById('grp-info-body');body.innerHTML='<div class="dots"><span></span><span></span><span></span></div>';
  const[{data:grp},{data:members}]=await Promise.all([
    db.from('groups').select('*').eq('id',gId).single(),
    db.from('group_members').select('*,profiles:user_id(id,username,full_name,avatar_url)').eq('group_id',gId)
  ]);
  const myMem=members?.find(m=>m.user_id===CU.id);const isAdmin=myMem?.role==='admin';
  const adminCount=(members||[]).filter(m=>m.role==='admin').length;
  // Generate invite link
  const inviteLink=`${window.location.origin}${window.location.pathname}?join=${gId}`;
  body.innerHTML=`
  <div style="margin-bottom:1rem">
    <div style="font-weight:700;font-size:1rem">${esc(grp?.name)}</div>
    <div style="font-size:.85rem;color:var(--text2);margin-top:.25rem">${esc(grp?.description||'No description')}</div>
  </div>
  ${isAdmin?`<div style="margin-bottom:.8rem"><div style="font-size:.8rem;font-weight:700;color:var(--text3);margin-bottom:.4rem">GROUP INVITE LINK</div>
  <div style="display:flex;gap:.5rem"><input value="${inviteLink}" class="fi" style="font-size:.78rem" readonly><button class="btn btn-primary btn-sm" onclick="copyGrpInviteDirect('${inviteLink}')">Copy</button></div></div>`:''}
  ${isAdmin?`<div id="grp-req-section-${gId}" style="margin-bottom:1rem"></div>`:''}
  ${isAdmin?`<div style="margin-bottom:.8rem"><button class="btn btn-outline btn-sm btn-full" onclick="showAddMembersToGroup('${gId}')"><svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Members</button></div>`:''}
  <div style="font-size:.8rem;font-weight:700;color:var(--text3);margin-bottom:.5rem">MEMBERS (${members?.length||0})</div>
  <div>${(members||[]).map(m=>{const p=m.profiles,isMe=m.user_id===CU.id;return`<div style="display:flex;align-items:center;gap:.7rem;padding:.6rem 0;border-bottom:1px solid var(--border)">
    ${avHtml(p,36)}<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:.88rem">${esc(p?.username||'User')}</div><div style="font-size:.72rem;color:var(--text3)">${m.role==='admin'?'Admin':'Member'}</div></div>
    ${isAdmin&&!isMe?`<div style="display:flex;gap:.3rem">
      ${m.role!=='admin'&&adminCount<5?`<button class="btn btn-ghost btn-sm" style="font-size:.7rem" onclick="makeGroupAdmin('${gId}','${m.user_id}')">Make Admin</button>`:''}
      <button class="btn btn-ghost btn-sm" style="font-size:.7rem;color:#FF3B3B" onclick="kickGroupMember('${gId}','${m.user_id}','${esc(p?.username||'')}')">
        <svg viewBox="0 0 24 24" style="width:11px;height:11px;fill:none;stroke:currentColor;stroke-width:2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Kick
      </button>
    </div>`:''}
  </div>`;}).join('')}</div>`;
  // Load pending join requests for admin
  if(isAdmin)loadGroupJoinRequests(gId);
}

async function kickGroupMember(gId,userId,username){
  if(!confirm(`Kick ${username} from group?`))return;
  await db.from('group_members').delete().eq('group_id',gId).eq('user_id',userId);
  toast(`${username} removed`,'success');
  await autoDeleteEmptyGroup(gId);
  closeModal('grp-info-mo');loadGroups();
}

async function makeGroupAdmin(gId,userId){
  const{data:admins}=await db.from('group_members').select('id').eq('group_id',gId).eq('role','admin');
  if(admins&&admins.length>=5)return toast('Max 5 admins allowed','error');
  await db.from('group_members').update({role:'admin'}).eq('group_id',gId).eq('user_id',userId);
  toast('Made admin!','success');showGrpInfo(gId);
}

function copyGrpInviteDirect(link){navigator.clipboard.writeText(link).then(()=>toast('Invite link copied!','success')).catch(()=>toast('Copy failed','error'));}

async function loadGroupJoinRequests(gId){
  const sec=document.getElementById(`grp-req-section-${gId}`);if(!sec)return;
  const{data:reqs}=await db.from('group_join_requests').select('*,profiles:user_id(id,username,full_name,avatar_url)').eq('group_id',gId).eq('status','pending');
  if(!reqs||!reqs.length){sec.innerHTML='';return;}
  sec.innerHTML=`<div style="background:var(--saffron-pale);border-radius:var(--r-sm);padding:.8rem;margin-bottom:.5rem">
    <div style="font-size:.8rem;font-weight:700;color:var(--saffron);margin-bottom:.5rem">JOIN REQUESTS (${reqs.length})</div>
    ${reqs.map(r=>`<div style="display:flex;align-items:center;gap:.6rem;padding:.4rem 0">
      ${avHtml(r.profiles,32)}<div style="flex:1;font-weight:600;font-size:.85rem">${esc(r.profiles?.username||'User')}</div>
      <button class="btn btn-primary btn-sm" onclick="approveGroupReq('${r.id}','${gId}','${r.user_id}')">Approve</button>
      <button class="btn btn-ghost btn-sm" style="color:#FF3B3B" onclick="rejectGroupReq('${r.id}','${gId}')">Reject</button>
    </div>`).join('')}
  </div>`;
}

async function approveGroupReq(reqId,gId,userId){
  await db.from('group_join_requests').update({status:'approved'}).eq('id',reqId);
  await db.from('group_members').insert({group_id:gId,user_id:userId,role:'member'}).catch(()=>{});
  toast('Member approved!','success');showGrpInfo(gId);
}

async function rejectGroupReq(reqId,gId){
  await db.from('group_join_requests').update({status:'rejected'}).eq('id',reqId);
  toast('Request rejected','info');showGrpInfo(gId);
}

let addMembersGrpId=null;
function showAddMembersToGroup(gId){
  addMembersGrpId=gId;
  document.getElementById('add-grp-members-search').value='';
  document.getElementById('add-grp-members-res').innerHTML='';
  openModal('add-grp-members-mo');
}

let addMemberTimer=null;
async function searchUsersToAddToGroup(q){
  clearTimeout(addMemberTimer);const res=document.getElementById('add-grp-members-res');
  if(!q.trim()){res.innerHTML='';return;}
  addMemberTimer=setTimeout(async()=>{
    const{data:existing}=await db.from('group_members').select('user_id').eq('group_id',addMembersGrpId);
    const existIds=new Set((existing||[]).map(m=>m.user_id));
    const{data:users}=await db.from('profiles').select('id,username,full_name,avatar_url').or(`username.ilike.%${q}%,full_name.ilike.%${q}%`).neq('id',CU.id).limit(8);
    if(!users||!users.length){res.innerHTML='<div style="font-size:.82rem;color:var(--text3);padding:.5rem">No users found</div>';return;}
    res.innerHTML=`<div class="card">${users.map(u=>`<div class="ul-item">
      ${avHtml(u,32)}<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:.85rem">${esc(u.full_name||u.username)}</div><div style="font-size:.75rem;color:var(--text3)">@${esc(u.username)}</div></div>
      ${existIds.has(u.id)?`<span style="font-size:.75rem;color:var(--text3)">Already in group</span>`:
      `<button class="btn btn-primary btn-sm" onclick="addUserDirectlyToGroup('${u.id}','${esc(u.username)}')">Add</button>`}
    </div>`).join('')}</div>`;
  },300);
}

async function addUserDirectlyToGroup(userId,username){
  const{data:existingMem}=await db.from('group_members').select('id').eq('group_id',addMembersGrpId).eq('user_id',userId).single().catch(()=>({data:null}));
  if(existingMem){toast(`${username} is already a member`,'info');return;}
  // Try direct insert first
  const{error}=await db.from('group_members').insert({group_id:addMembersGrpId,user_id:userId,role:'member'});
  if(error){
    if(error.code==='23505'){toast(`${username} is already a member`,'info');return;}
    if(error.message&&(error.message.includes('row-level security')||error.message.includes('policy'))){
      // Fallback: send a join request instead
      const{error:reqErr}=await db.from('group_join_requests').upsert({
        group_id:addMembersGrpId,user_id:userId,status:'pending'
      },{onConflict:'group_id,user_id',ignoreDuplicates:true}).catch(e=>({error:e}));
      if(!reqErr){toast(`Invite sent to ${username}! They must accept.`,'info');return;}
      toast('Permission denied. Run yaarana_v6.sql first.','error');return;
    }
    toast(error.message,'error');return;
  }
  toast(`${username} added to group! ✓`,'success');
  document.getElementById('add-grp-members-search').value='';
  document.getElementById('add-grp-members-res').innerHTML='';
}

// ========== CHAT ==========
async function loadChatMsgs(){
  if(!CU){toast('Please log in first','error');return;}
  const msgC=document.getElementById('chat-msgs');
  if(!msgC)return;
  msgC.innerHTML='<div class="dots" style="padding:2rem"><span></span><span></span><span></span></div>';
  let msgs=[];
  try{
    if(chatType==='group'){
      const{data,error}=await db.from('group_messages')
        .select('id,user_id,content,shared_post_id,created_at,profiles:user_id(id,username,full_name,avatar_url,is_verified,verification_expires_at)')
        .eq('group_id',chatId).order('created_at',{ascending:true}).limit(100);
      if(error)throw error;
      msgs=data||[];
    }else{
      const{data,error}=await db.from('direct_messages')
        .select('id,sender_id,receiver_id,content,shared_post_id,created_at,is_read')
        .or(`and(sender_id.eq.${CU.id},receiver_id.eq.${chatId}),and(sender_id.eq.${chatId},receiver_id.eq.${CU.id})`)
        .order('created_at',{ascending:true}).limit(100);
      if(error)throw error;
      msgs=data||[];
    }
  }catch(err){
    msgC.innerHTML=`<div class="empty-st" style="padding:2rem"><div class="empty-tt">Could not load messages</div><div class="empty-tx">${esc(err.message)}</div><button class="btn btn-primary" style="margin-top:1rem" onclick="loadChatMsgs()">Retry</button></div>`;
    return;
  }
  renderMsgs(msgs);
}

function renderMsgs(msgs){
  const c=document.getElementById('chat-msgs');
  if(!msgs.length){c.innerHTML='<div class="empty-st" style="padding:3rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><div class="empty-tt">No messages yet</div><div class="empty-tx">Say hello!</div></div>';return;}
  c.innerHTML=msgs.map(m=>renderMsgBubble(m)).join('');
  c.scrollTop=c.scrollHeight;
  if(chatType==='dm'){
    // Mark messages as read (only if is_read column exists - needs SQL v6)
    try{db.from('direct_messages').update({is_read:true}).eq('sender_id',chatId).eq('receiver_id',CU.id).eq('is_read',false).then(()=>updateBadges()).catch(()=>{});}catch(e){}
  }
  setTimeout(loadSharedPostPreviews, 100);
}

async function loadSharedPostPreviews(){
  const items=document.querySelectorAll('[id^="spost-"]');
  for(const el of items){
    const msgId=el.id.replace('spost-','');
    const bubble=document.getElementById('cmsg-'+msgId)?.querySelector('.shared-post-bubble');
    if(!bubble)continue;
    const onclick=bubble.getAttribute('onclick')||'';
    const postIdMatch=onclick.match(/'([a-f0-9-]{36})'/);
    if(!postIdMatch)continue;
    const postId=postIdMatch[1];
    const{data:post}=await db.from('posts').select('image_url,caption').eq('id',postId).single().catch(()=>({data:null}));
    if(post?.image_url){el.outerHTML=`<img src="${post.image_url}" style="width:100%;height:150px;object-fit:cover;display:block">`;}
    else{el.innerHTML='<div style="font-size:.75rem;color:var(--text3);text-align:center">Post unavailable</div>';}
  }
}

function renderMsgBubble(m){
  const uid=m.user_id||m.sender_id,isOwn=uid===CU?.id,profile=m.profiles||m.sender;
  const msgId=m.id;
  let contentHtml='';
  if(m.shared_post_id){
    contentHtml=`<div class="shared-post-bubble" onclick="openPostDetail('${m.shared_post_id}')" style="cursor:pointer;border-radius:8px;overflow:hidden;border:1px solid var(--border);background:var(--surface);max-width:220px">
      <div id="spost-${m.id}" style="background:var(--bg2);height:150px;display:flex;align-items:center;justify-content:center">
        <div class="dots"><span></span><span></span><span></span></div>
      </div>
      <div style="padding:.4rem .6rem;font-size:.72rem;color:var(--text2);font-weight:600">📎 Shared post — tap to view</div>
    </div>`;
  } else {
    contentHtml=`<div class="msg-bbl" oncontextmenu="showMsgCtx(event,'${msgId}',${isOwn},'${esc(m.content||'')}')">
      ${esc(m.content||'')}
      <div class="msg-ctx-menu" id="mctx-${msgId}">
        <button class="msg-ctx-btn" onclick="copyMsg('${msgId}','${esc(m.content||'')}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</button>
        ${isOwn?`<button class="msg-ctx-btn" onclick="editMsg('${msgId}','${esc(m.content||'')}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit</button>`:''}
        ${isOwn?`<button class="msg-ctx-btn danger" onclick="deleteMsg('${msgId}','${chatType}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>Delete</button>`:''}
      </div>
    </div>`;
  }
  return`<div class="msg-w ${isOwn?'own':''}" id="msgw-${msgId}">
    ${!isOwn?`<div onclick="viewUserProfile('${profile?.id}')" style="cursor:pointer;flex-shrink:0">${avHtml(profile,28)}</div>`:''}
    <div>
      ${!isOwn&&chatType==='group'?`<div class="msg-snd" style="cursor:pointer" onclick="viewUserProfile('${profile?.id}')">${esc(profile?.full_name||profile?.username||'User')}${verifBadge(profile,13)}</div>`:''}
      ${contentHtml}
      <div class="msg-tm">${ago(m.created_at)}</div>
    </div>
    ${isOwn?avHtml(CP,28):''}
  </div>`;
}

function showMsgCtx(e,msgId,isOwn,content){
  e.preventDefault();
  document.querySelectorAll('.msg-ctx-menu.show').forEach(m=>m.classList.remove('show'));
  const menu=document.getElementById(`mctx-${msgId}`);if(menu)menu.classList.add('show');
  setTimeout(()=>{document.addEventListener('click',()=>{document.querySelectorAll('.msg-ctx-menu.show').forEach(m=>m.classList.remove('show'));},{once:true});},10);
}

function copyMsg(msgId,content){
  navigator.clipboard.writeText(content).then(()=>toast('Copied','success')).catch(()=>{});
  document.querySelectorAll('.msg-ctx-menu.show').forEach(m=>m.classList.remove('show'));
}

function editMsg(msgId,content){
  document.getElementById('edit-msg-id').value=msgId;
  document.getElementById('edit-msg-txt').value=content;
  openModal('edit-msg-mo');
  document.querySelectorAll('.msg-ctx-menu.show').forEach(m=>m.classList.remove('show'));
}

async function saveEditedMsg(){
  const id=document.getElementById('edit-msg-id').value,txt=document.getElementById('edit-msg-txt').value.trim();
  if(!txt)return;
  const table=chatType==='group'?'group_messages':'direct_messages';
  const{error}=await db.from(table).update({content:txt}).eq('id',id);
  if(error)return toast(error.message,'error');
  const bbl=document.querySelector(`#msgw-${id} .msg-bbl`);
  if(bbl){const ctx=bbl.querySelector('.msg-ctx-menu');const ctxHtml=ctx?ctx.outerHTML:'';bbl.innerHTML=esc(txt)+ctxHtml;}
  closeModal('edit-msg-mo');toast('Edited','success');
}

async function deleteMsg(msgId,type){
  const table=type==='group'?'group_messages':'direct_messages';
  await db.from(table).delete().eq('id',msgId);
  document.getElementById(`msgw-${msgId}`)?.remove();
  document.querySelectorAll('.msg-ctx-menu.show').forEach(m=>m.classList.remove('show'));
  toast('Deleted','success');
}

async function sendChatMsg(){
  const inp=document.getElementById('chat-inp'),content=inp.value.trim();if(!content)return;inp.value='';
  if(chatType==='group'){const{error}=await db.from('group_messages').insert({group_id:chatId,user_id:CU.id,content});if(error)toast(error.message,'error');}
  else{const{error}=await db.from('direct_messages').insert({sender_id:CU.id,receiver_id:chatId,content});if(error)toast(error.message,'error');}
}

function subscribeChat(){
  if(chatSub){chatSub.unsubscribe();chatSub=null;}
  const table=chatType==='group'?'group_messages':'direct_messages';
  const filter=chatType==='group'?`group_id=eq.${chatId}`:undefined;
  const cfg={event:'INSERT',schema:'public',table};if(filter)cfg.filter=filter;
  chatSub=db.channel(`chat-${chatId}`).on('postgres_changes',cfg,async payload=>{
    const m=payload.new;
    if(chatType==='dm'){const ok=(m.sender_id===CU.id&&m.receiver_id===chatId)||(m.sender_id===chatId&&m.receiver_id===CU.id);if(!ok)return;}
    const uid=m.user_id||m.sender_id;
    const{data:profile}=await db.from('profiles').select('id,username,full_name,avatar_url').eq('id',uid).single();
    const c=document.getElementById('chat-msgs');
    const empty=c.querySelector('.empty-st');if(empty)empty.remove();
    const div=document.createElement('div');div.innerHTML=renderMsgBubble({...m,profiles:profile,sender:profile});
    while(div.firstChild)c.appendChild(div.firstChild);
    c.scrollTop=c.scrollHeight;
  }).subscribe();
}

// ========== DMs ==========
function switchMsgTab(tab,btn){
  document.querySelectorAll('#dms-page .pt-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  document.getElementById('dms-tab-content').classList.add('hidden');
  document.getElementById('discover-tab-content').classList.add('hidden');
  document.getElementById('mygroups-tab-content').classList.add('hidden');
  document.getElementById('requests-tab-content').classList.add('hidden');
  const fab=document.getElementById('grp-fab');
  if(tab==='dms'){document.getElementById('dms-tab-content').classList.remove('hidden');if(fab)fab.style.display='none';loadDMs();}
  else if(tab==='discover'){document.getElementById('discover-tab-content').classList.remove('hidden');if(fab)fab.style.display='flex';loadGroupsTab('discover');}
  else if(tab==='mygroups'){document.getElementById('mygroups-tab-content').classList.remove('hidden');if(fab)fab.style.display='flex';loadGroupsTab('mine');}
  else if(tab==='requests'){document.getElementById('requests-tab-content').classList.remove('hidden');if(fab)fab.style.display='none';loadGroupJoinRequests();}
}

async function loadGroupsTab(mode){
  const cid=mode==='discover'?'grp-discover-c':'grp-mine-c';
  const c=document.getElementById(cid);
  if(!c)return;
  c.innerHTML='<div class="dots"><span></span><span></span><span></span></div>';
  if(mode==='discover'){
    const{data:groups}=await db.from('groups').select('*,group_members(count)').eq('is_deleted',false).order('created_at',{ascending:false});
    // Only auto-delete groups with 0 members that are more than 1 hour old
    const oneHourAgo = new Date(Date.now()-60*60*1000).toISOString();
    for(const eg of (groups||[]).filter(g=>(g.group_members?.[0]?.count||0)===0&&eg.created_at<oneHourAgo)){
      await db.from('groups').update({is_deleted:true}).eq('id',eg.id).catch(()=>{});
    }
    const validGroups=(groups||[]).filter(g=>(g.group_members?.[0]?.count||0)>0||(g.created_at>=oneHourAgo));
    if(!validGroups.length){c.innerHTML='<div class="empty-st" style="padding:2.5rem"><div class="empty-tt">No groups yet</div><div class="empty-tx">Create the first one!</div></div>';return;}
    const{data:myMems}=await db.from('group_members').select('group_id').eq('user_id',CU.id);
    const myGrpIds=new Set((myMems||[]).map(m=>m.group_id));
    c.innerHTML=validGroups.map(g=>{const cnt=g.group_members?.[0]?.count||0;const isMem=myGrpIds.has(g.id);return`<div class="grp-card" onclick="joinAndOpenGroup('${g.id}','${esc(g.name)}',${cnt})">
      <div class="grp-av">${g.avatar_url?`<img src="${g.avatar_url}" alt="">`:`<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:none;stroke:var(--text3);stroke-width:1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`}</div>
      <div class="grp-info"><div class="grp-nm">${esc(g.name)}</div><div class="grp-dc">${esc(g.description||'No description')}</div><div class="grp-mb">${cnt} members</div></div>
      <div style="flex-shrink:0">${isMem?`<span style="font-size:.72rem;font-weight:700;color:var(--green)">✓ Joined</span>`:`<span style="font-size:.72rem;font-weight:700;color:var(--saffron)">Join ›</span>`}</div>
    </div>`;}).join('');
  } else {
    const{data:mems}=await db.from('group_members').select('group_id,role,groups(*)').eq('user_id',CU.id);
    if(!mems||!mems.length){c.innerHTML='<div class="empty-st" style="padding:2.5rem"><div class="empty-tt">No groups joined</div></div>';return;}
    c.innerHTML=mems.filter(m=>m.groups&&!m.groups.is_deleted).map(m=>{const g=m.groups,isAdmin=m.role==='admin';return`<div class="grp-card" onclick="openGroupChat('${g.id}','${esc(g.name)}',0,${isAdmin})">
      <div class="grp-av">${g.avatar_url?`<img src="${g.avatar_url}" alt="">`:`<svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:none;stroke:var(--text3);stroke-width:1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`}</div>
      <div class="grp-info"><div style="display:flex;align-items:center;gap:.4rem"><div class="grp-nm">${esc(g.name)}</div>${isAdmin?`<span style="font-size:.65rem;font-weight:700;background:var(--saffron-pale);color:var(--saffron);padding:.1rem .4rem;border-radius:4px">Admin</span>`:''}</div><div class="grp-dc">${esc(g.description||'')}</div></div>
      <div style="display:flex;flex-direction:column;gap:.3rem;align-items:flex-end">
        <button class="btn btn-ghost btn-sm" style="font-size:.72rem;color:#FF3B3B" onclick="event.stopPropagation();leaveGroup('${g.id}','${esc(g.name)}')">Leave</button>
        ${isAdmin?`<button class="btn btn-ghost btn-sm" style="font-size:.72rem;color:#FF3B3B" onclick="event.stopPropagation();deleteGroupAction('${g.id}','${esc(g.name)}')">Delete</button>`:''}
      </div>
    </div>`;}).join('');
  }
}

async function loadGroupJoinRequests(){
  const c=document.getElementById('grp-requests-c');
  if(!c)return;
  c.innerHTML='<div class="dots"><span></span><span></span><span></span></div>';
  // Get groups where I am admin
  const{data:adminGroups}=await db.from('group_members').select('group_id,groups(id,name)').eq('user_id',CU.id).eq('role','admin');
  if(!adminGroups||!adminGroups.length){c.innerHTML='<div class="empty-st" style="padding:2.5rem"><div class="empty-tt">No pending requests</div><div class="empty-tx">You are not admin of any group</div></div>';return;}
  const gIds=adminGroups.map(m=>m.group_id);
  const{data:reqs}=await db.from('group_join_requests').select('*,profiles:user_id(id,username,full_name,avatar_url),groups(name)').in('group_id',gIds).eq('status','pending');
  if(!reqs||!reqs.length){c.innerHTML='<div class="empty-st" style="padding:2.5rem"><div class="empty-tt">No pending requests</div></div>';return;}
  c.innerHTML=reqs.map(r=>`<div class="ul-item">
    ${avHtml(r.profiles,40)}
    <div style="flex:1;min-width:0">
      <div style="font-weight:700">${esc(r.profiles?.full_name||r.profiles?.username)}</div>
      <div style="font-size:.8rem;color:var(--text3)">Wants to join ${esc(r.groups?.name)}</div>
    </div>
    <div style="display:flex;gap:.4rem">
      <button class="btn btn-primary btn-sm" onclick="approveJoinRequest('${r.id}','${r.group_id}','${r.user_id}')">✓</button>
      <button class="btn btn-danger btn-sm" onclick="rejectJoinRequest('${r.id}')">✗</button>
    </div>
  </div>`).join('');
}

async function loadDMs(){
  const c=document.getElementById('dm-list-c');
  if(!c)return;
  c.innerHTML='<div class="dots"><span></span><span></span><span></span></div>';
  // Load DM requests
  // Load unread DM senders (is_read needs SQL v6 - if column missing, skip gracefully)
  let reqs=[];
  try{
    const{data:reqData}=await db.from('direct_messages')
      .select('sender_id,profiles:sender_id(id,username,full_name,avatar_url,is_verified,verification_expires_at)')
      .eq('receiver_id',CU.id).eq('is_read',false)
      .order('created_at',{ascending:false});
    reqs=reqData||[];
  }catch(e){reqs=[];}
  const reqSenders=[];
  const seenReq=new Set();
  for(const r of reqs){
    if(!seenReq.has(r.sender_id)){seenReq.add(r.sender_id);reqSenders.push(r.profiles);}
  }
  // Load all DM conversations
  const{data:sent}=await db.from('direct_messages')
    .select('receiver_id,sender_id,content,created_at,profiles_r:receiver_id(id,username,full_name,avatar_url),profiles_s:sender_id(id,username,full_name,avatar_url)')
    .eq('sender_id',CU.id).order('created_at',{ascending:false}).limit(100);
  const{data:recv}=await db.from('direct_messages')
    .select('receiver_id,sender_id,content,created_at,profiles_r:receiver_id(id,username,full_name,avatar_url),profiles_s:sender_id(id,username,full_name,avatar_url)')
    .eq('receiver_id',CU.id).order('created_at',{ascending:false}).limit(100);
  const allMsgs=[...(sent||[]),...(recv||[])];
  const convMap=new Map();
  for(const m of allMsgs){
    const otherId=m.sender_id===CU.id?m.receiver_id:m.sender_id;
    const otherProf=m.sender_id===CU.id?m.profiles_r:m.profiles_s;
    if(!convMap.has(otherId)||new Date(m.created_at)>new Date(convMap.get(otherId).time)){
      convMap.set(otherId,{profile:otherProf,lastMsg:m.content,time:m.created_at,unread:!m.is_read&&m.receiver_id===CU.id});
    }
  }
  const convs=Array.from(convMap.values()).sort((a,b)=>new Date(b.time)-new Date(a.time));
  if(!convs.length){c.innerHTML='<div class="empty-st" style="padding:2.5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><div class="empty-tt">No messages yet</div><div class="empty-tx">Follow someone and send them a message!</div></div>';return;}
  c.innerHTML=`<div class="card">${convs.map(cv=>{const p=cv.profile;return`<div class="ul-item" style="position:relative" id="dm-item-${p?.id}" onclick="openDMChat('${p?.id}','${esc(p?.username||'')}')">
    ${avHtml(p,44)}
    <div style="flex:1;min-width:0">
      <div style="font-weight:700;font-size:.9rem;display:flex;align-items:center;gap:2px">${esc(p?.full_name||p?.username||'User')}${verifBadge(p,15)}</div>
      <div style="font-size:.8rem;color:var(--text${cv.unread?'1':'3'});font-weight:${cv.unread?700:400};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px">${esc(cv.lastMsg||'')}</div>
    </div>
    ${cv.unread?'<span style="width:10px;height:10px;background:var(--saffron);border-radius:50%;flex-shrink:0"></span>':''}
    <div style="font-size:.72rem;color:var(--text3);margin-right:.4rem">${ago(cv.time)}</div>
    <button onclick="event.stopPropagation();toggleDMMenu('${p?.id}','${esc(p?.username||'')}')" style="background:none;border:none;cursor:pointer;padding:.3rem;color:var(--text3);border-radius:50%;display:flex;align-items:center;justify-content:center;width:28px;height:28px;flex-shrink:0">
      <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
    </button>
    <div class="dm-ctx-menu hidden" id="dm-ctx-${p?.id}" style="position:absolute;right:.5rem;top:100%;background:var(--surface);border-radius:var(--r-sm);box-shadow:0 8px 30px rgba(0,0,0,.15);min-width:160px;z-index:200;overflow:hidden;border:1px solid var(--border);animation:fadeIn .15s ease">
      <button class="dd-item" onclick="event.stopPropagation();pinDMConv('${p?.id}','${esc(p?.username||'')}');toggleDMMenu('${p?.id}')"><svg viewBox="0 0 24 24" style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg>Pin Chat</button>
      <button class="dd-item danger" onclick="event.stopPropagation();deleteConversation('${p?.id}');toggleDMMenu('${p?.id}')"><svg viewBox="0 0 24 24" style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>Delete Chat</button>
      <button class="dd-item danger" onclick="event.stopPropagation();confirmBlockFromDM('${p?.id}','${esc(p?.username||'')}');toggleDMMenu('${p?.id}')"><svg viewBox="0 0 24 24" style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>Block User</button>
    </div>
  </div>`}).join('')}</div>`;
}


function toggleDMMenu(uid,username){
  const menu=document.getElementById(`dm-ctx-${uid}`);
  if(!menu)return;
  const isHidden=menu.classList.contains('hidden');
  // Close all open DM menus
  document.querySelectorAll('.dm-ctx-menu').forEach(m=>m.classList.add('hidden'));
  if(isHidden){
    menu.classList.remove('hidden');
    setTimeout(()=>{
      document.addEventListener('click',()=>menu.classList.add('hidden'),{once:true});
    },10);
  }
}

async function pinDMConv(uid,username){
  toast(`Chat with @${username} pinned ✓`,'success');
  // Store pinned in localStorage
  const pins=JSON.parse(localStorage.getItem('ya-pinned-dms')||'[]');
  if(!pins.includes(uid)){pins.unshift(uid);localStorage.setItem('ya-pinned-dms',JSON.stringify(pins));}
  loadDMs();
}


async function confirmBlockFromDM(uid,username){
  if(!confirm(`Block @${username}?`))return;
  await db.from('blocked_users').insert({blocker_id:CU.id,blocked_id:uid}).catch(()=>{});
  await db.from('followers').delete().eq('follower_id',CU.id).eq('following_id',uid);
  toast(`@${username} blocked`,'success');loadDMs();
}

async function deleteConversation(uid){
  if(!confirm('Delete this conversation? Messages will be removed for you.'))return;
  await db.from('direct_messages').delete().eq('sender_id',CU.id).eq('receiver_id',uid);
  await db.from('direct_messages').delete().eq('sender_id',uid).eq('receiver_id',CU.id);
  toast('Conversation deleted','success');loadDMs();
}

async function openDMWithUser(userId,userName){
  if(!userId||!CU)return;
  openDMChat(userId,userName);
}

async function acceptDMReq(id,senderId){await db.from('dm_requests').update({status:'accepted'}).eq('id',id);toast('Request accepted','success');loadDMs();}
async function rejectDMReq(id){await db.from('dm_requests').update({status:'rejected'}).eq('id',id);toast('Declined','info');loadDMs();}

// ========== SEARCH ==========
function handleSearch(q){
  clearTimeout(srchTimer);
  const exploreSection=document.getElementById('explore-section');
  if(!q.trim()){
    document.getElementById('srch-results').innerHTML='<div class="empty-st"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" stroke-linecap="round"/></svg><div class="empty-tt">Discover People</div></div>';
    if(exploreSection)exploreSection.style.display='';
    return;
  }
  if(exploreSection)exploreSection.style.display='none';
  srchTimer=setTimeout(()=>searchUsers(q),300);
}

async function loadExplorePosts(){
  const grid=document.getElementById('explore-posts-grid');if(!grid)return;
  grid.innerHTML='<div class="dots"><span></span><span></span><span></span></div>';
  // Get posts sorted by like count
  const{data:posts}=await db.from('posts').select('id,image_url,likes(count),comments(count)').eq('is_deleted',false).order('created_at',{ascending:false}).limit(60);
  if(!posts||!posts.length){grid.innerHTML='<div class="empty-st"><div class="empty-tt">No posts yet</div></div>';return;}
  // Sort by likes desc
  const sorted=[...posts].sort((a,b)=>(b.likes?.[0]?.count||0)-(a.likes?.[0]?.count||0)).slice(0,30);
  grid.innerHTML=`<div class="posts-grid">${sorted.map(p=>`<div class="grid-post" onclick="openPostDetail('${p.id}')">
    <img src="${p.image_url}" alt="" loading="lazy">
    <div class="grid-post-ov">
      <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:white"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      <span style="font-size:.72rem">${p.likes?.[0]?.count||0}</span>
    </div>
  </div>`).join('')}</div>`;
}

async function searchUsers(q){
  const c=document.getElementById('srch-results');c.innerHTML='<div class="dots"><span></span><span></span><span></span></div>';
  const{data:users}=await db.from('profiles').select('*').or(`username.ilike.%${q}%,full_name.ilike.%${q}%`).neq('id',CU.id).limit(20);
  if(!users||!users.length){c.innerHTML='<div class="empty-st"><div class="empty-tt">No users found</div></div>';return;}
  c.innerHTML=`<div class="card">${users.map(u=>`<div class="ul-item" onclick="viewUserProfile('${u.id}')">
    ${avHtml(u,42)}<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:.9rem">${esc(u.full_name||u.username)}</div><div style="font-size:.8rem;color:var(--text3)">@${esc(u.username)}</div></div>
    <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();quickFollow('${u.id}',this)"><svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Follow</button>
  </div>`).join('')}</div>`;
}

async function quickFollow(uid,btn){
  const{error}=await db.from('followers').insert({follower_id:CU.id,following_id:uid});
  if(error&&error.code!=='23505')return toast(error.message,'error');
  btn.innerHTML=`<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2.5"><polyline points="20 6 9 17 4 12"/></svg>Following`;
  btn.className='btn btn-primary btn-sm';toast('Followed!','success');
}

// ========== NOTIFICATIONS ==========
async function loadNotifs(){
  localStorage.setItem('mm-last-notif-check',new Date().toISOString());
  const nb=document.getElementById('notif-badge');if(nb)nb.style.display='none';
  const nd=document.getElementById('notif-dot');if(nd)nd.classList.add('hidden');
  const c=document.getElementById('notif-list');
  c.innerHTML='<div class="dots" style="padding:2rem"><span></span><span></span><span></span></div>';
  if(!CU)return;
  const since=new Date(Date.now()-30*24*60*60*1000).toISOString();
  const{data:myPosts}=await db.from('posts').select('id,image_url').eq('user_id',CU.id).eq('is_deleted',false);
  const pids=(myPosts||[]).map(p=>p.id);
  const[{data:fwrs},{data:likes},{data:cmts}]=await Promise.all([
    db.from('followers').select('*,profiles:follower_id(id,username,full_name,avatar_url)').eq('following_id',CU.id).gt('created_at',since).order('created_at',{ascending:false}).limit(30),
    pids.length?db.from('likes').select('*,profiles:user_id(id,username,full_name,avatar_url),posts(image_url)').in('post_id',pids).neq('user_id',CU.id).gt('created_at',since).order('created_at',{ascending:false}).limit(30):Promise.resolve({data:[]}),
    pids.length?db.from('comments').select('*,profiles:user_id(id,username,full_name,avatar_url)').in('post_id',pids).neq('user_id',CU.id).gt('created_at',since).order('created_at',{ascending:false}).limit(20):Promise.resolve({data:[]})
  ]);
  const notifs=[
    ...(fwrs||[]).map(f=>({id:'f_'+f.id,profile:f.profiles,text:`<strong>${esc(f.profiles?.username)}</strong> started following you`,time:f.created_at,thumb:null,icon:'👤'})),
    ...(likes||[]).map(l=>({id:'l_'+l.id,profile:l.profiles,text:`<strong>${esc(l.profiles?.username)}</strong> liked your post`,time:l.created_at,thumb:l.posts?.image_url,icon:'❤️'})),
    ...(cmts||[]).map(cm=>({id:'c_'+cm.id,profile:cm.profiles,text:`<strong>${esc(cm.profiles?.username)}</strong> commented: ${esc(cm.content?.substring(0,30))}`,time:cm.created_at,thumb:null,icon:'💬'}))
  ].sort((a,b)=>new Date(b.time)-new Date(a.time));
  if(!notifs.length){c.innerHTML='<div class="empty-st" style="padding:2.5rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg><div class="empty-tt">No notifications</div></div>';return;}
  c.innerHTML='<div id="notif-items-wrap">'+notifs.map(n=>`
    <div class="notif-item" id="ni-${n.id}" style="position:relative;overflow:hidden;touch-action:pan-y;cursor:pointer">
      <div class="notif-swipe-bg" style="position:absolute;right:0;top:0;bottom:0;width:80px;background:#FF3B3B;display:flex;align-items:center;justify-content:center;transform:translateX(100%);transition:transform .2s">
        <svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:none;stroke:white;stroke-width:2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
      </div>
      <div class="notif-content" onclick="viewUserProfile('${n.profile?.id}')" style="display:flex;align-items:center;gap:.8rem;padding:.9rem 1rem;background:var(--surface);position:relative;z-index:1;transition:transform .2s">
        <div style="font-size:1.2rem;flex-shrink:0">${n.icon}</div>
        ${avHtml(n.profile,40)}
        <div style="flex:1;min-width:0">
          <div style="font-size:.88rem;line-height:1.4">${n.text}</div>
          <div style="font-size:.75rem;color:var(--text3);margin-top:.2rem">${ago(n.time)}</div>
        </div>
        ${n.thumb?`<img src="${n.thumb}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;flex-shrink:0">`:''}
      </div>
    </div>`).join('')+'</div>';
  // Add swipe-to-delete touch handlers
  document.querySelectorAll('.notif-item').forEach(el=>{
    let startX=0,isDragging=false;
    const content=el.querySelector('.notif-content');
    const bg=el.querySelector('.notif-swipe-bg');
    el.addEventListener('touchstart',e=>{startX=e.touches[0].clientX;isDragging=true;},{passive:true});
    el.addEventListener('touchmove',e=>{
      if(!isDragging)return;
      const dx=e.touches[0].clientX-startX;
      if(dx<0){
        const pct=Math.min(Math.abs(dx),80);
        content.style.transform=`translateX(-${pct}px)`;
        bg.style.transform=`translateX(${100-(pct/80*100)}%)`;
      }
    },{passive:true});
    el.addEventListener('touchend',e=>{
      const dx=startX-e.changedTouches[0].clientX;
      isDragging=false;
      if(dx>60){el.style.opacity='0';el.style.transform='translateX(-100%)';el.style.transition='all .3s';setTimeout(()=>el.remove(),300);}
      else{content.style.transform='';bg.style.transform='translateX(100%)';}
    },{passive:true});
  });
}


async function submitReport(){
  const type=document.getElementById('rpt-ttype').value,id=document.getElementById('rpt-tid').value,reason=document.getElementById('rpt-reason').value;
  if(!reason)return toast('Select a reason','error');
  const data={reporter_id:CU.id,reason};
  if(type==='post')data.post_id=id;else if(type==='user')data.reported_user_id=id;else if(type==='comment')data.comment_id=id;
  const{error}=await db.from('reports').insert(data);
  if(error)return toast(error.message,'error');
  closeModal('report-mo');document.getElementById('rpt-reason').value='';toast('Report submitted. Thank you!','success');
}

let sharePostId=null;
async function openShare(postId){
  sharePostId=postId;shareSelected=[];
  const link=`${window.location.origin}${window.location.pathname}?post=${postId}`;
  document.getElementById('share-link').value=link;
  const prev=document.getElementById('share-post-preview');
  if(prev){
    const{data:post}=await db.from('posts').select('image_url,caption,profiles:user_id(username,full_name,avatar_url)').eq('id',postId).single();
    if(post)prev.innerHTML=`<div style="display:flex;align-items:center;gap:.6rem;padding:.7rem"><div style="flex-shrink:0">${avHtml(post.profiles,38)}</div><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:.84rem">${esc(post.profiles?.full_name||post.profiles?.username||'')}</div>${post.caption?`<div style="font-size:.78rem;color:var(--text2);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(post.caption)}</div>`:''}</div>${post.image_url?`<img src="${post.image_url}" style="width:54px;height:54px;object-fit:cover;border-radius:8px;flex-shrink:0">`:''}</div>`;
  }
  const selEl=document.getElementById('share-selected-list');if(selEl)selEl.innerHTML='';
  const sendBtn=document.getElementById('share-send-btn');if(sendBtn)sendBtn.disabled=true;
  openModal('share-mo');
  const sl=document.getElementById('share-friends-list');
  sl.innerHTML='<div class="dots"><span></span><span></span><span></span></div>';
  const[{data:following},{data:myGroups}]=await Promise.all([
    db.from('followers').select('following_id,profiles:following_id(id,username,full_name,avatar_url)').eq('follower_id',CU.id),
    db.from('group_members').select('group_id,groups(id,name,avatar_url)').eq('user_id',CU.id)
  ]);
  const friends=(following||[]).map(f=>f.profiles).filter(Boolean);
  const groups=(myGroups||[]).map(m=>m.groups).filter(Boolean);
  let htm='';
  if(friends.length){
    htm+=`<div style="font-size:.75rem;font-weight:700;color:var(--text3);margin-bottom:.5rem">FRIENDS</div>`;
    htm+=friends.map(f=>`<div class="ul-item" id="shr-f-${f.id}" onclick="toggleShareSelect('friend','${f.id}','${esc(f.full_name||f.username)}','${esc(f.username)}')" style="cursor:pointer;border-radius:var(--r-sm);transition:background .15s">
      ${avHtml(f,38)}<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:.88rem">${esc(f.full_name||f.username)}</div><div style="font-size:.75rem;color:var(--text3)">@${esc(f.username)}</div></div>
      <div id="shck-f-${f.id}" style="width:22px;height:22px;border:2px solid var(--border2);border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .15s"></div>
    </div>`).join('');
  }
  if(groups.length){
    htm+=`<div style="font-size:.75rem;font-weight:700;color:var(--text3);margin:.8rem 0 .5rem">GROUPS</div>`;
    htm+=groups.map(g=>`<div class="ul-item" id="shr-g-${g.id}" onclick="toggleShareSelect('group','${g.id}','${esc(g.name)}','')" style="cursor:pointer;border-radius:var(--r-sm);transition:background .15s">
      <div class="av-ph" style="width:38px;height:38px;font-size:.8rem;border-radius:8px">${ini(g.name)}</div>
      <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:.88rem">${esc(g.name)}</div><div style="font-size:.75rem;color:var(--text3)">Group</div></div>
      <div id="shck-g-${g.id}" style="width:22px;height:22px;border:2px solid var(--border2);border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .15s"></div>
    </div>`).join('');
  }
  if(!htm)htm='<div class="empty-st" style="padding:1rem"><div class="empty-tt">No friends or groups</div></div>';
  sl.innerHTML=htm;
}

async function sharePostToFriend(userId,username){
  const link=document.getElementById('share-link').value;
  const{error}=await db.from('direct_messages').insert({sender_id:CU.id,receiver_id:userId,content:`📎 Shared a post: ${link}`});
  if(error)return toast(error.message,'error');
  toast(`Shared to ${username}!`,'success');closeModal('share-mo');
}

async function sharePostToGroup(groupId,groupName){
  const link=document.getElementById('share-link').value;
  const{error}=await db.from('group_messages').insert({group_id:groupId,user_id:CU.id,content:`📎 Shared a post: ${link}`});
  if(error)return toast(error.message,'error');
  toast(`Shared to ${groupName}!`,'success');closeModal('share-mo');
}

function toggleShareSelect(type,id,name,username){
  const prefix=type==='friend'?'f':'g';
  const idx=shareSelected.findIndex(s=>s.id===id&&s.type===type);
  const chk=document.getElementById(`shck-${prefix}-${id}`);
  const item=document.getElementById(`shr-${prefix}-${id}`);
  if(idx>=0){
    shareSelected.splice(idx,1);
    if(chk){chk.style.background='';chk.style.borderColor='var(--border2)';chk.innerHTML='';}
    if(item)item.style.background='';
  }else{
    shareSelected.push({type,id,name,username});
    if(chk){chk.style.background='var(--saffron)';chk.style.borderColor='var(--saffron)';chk.innerHTML='<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:white;stroke-width:2.5"><polyline points="20 6 9 17 4 12"/></svg>';}
    if(item)item.style.background='var(--saffron-pale)';
  }
  const selEl=document.getElementById('share-selected-list');
  if(selEl)selEl.innerHTML=shareSelected.map(s=>`<span style="background:var(--saffron-pale);color:var(--saffron);padding:.2rem .6rem;border-radius:999px;font-size:.75rem;font-weight:700">${esc(s.name)}</span>`).join('');
  const sendBtn=document.getElementById('share-send-btn');
  if(sendBtn)sendBtn.disabled=shareSelected.length===0;
}

async function sendShareToSelected(){
  if(!shareSelected.length)return;
  const postId=sharePostId;
  const{data:post}=await db.from('posts').select('image_url,caption,profiles:user_id(username)').eq('id',postId).single();
  const msgContent=post?.caption?`📎 "${post.caption.slice(0,60)}" — tap to view`:'📎 Shared a post — tap to view';
  const results=await Promise.allSettled(shareSelected.map(s=>{
    if(s.type==='friend')return db.from('direct_messages').insert({sender_id:CU.id,receiver_id:s.id,content:msgContent,shared_post_id:postId});
    else return db.from('group_messages').insert({group_id:s.id,user_id:CU.id,content:msgContent,shared_post_id:postId});
  }));
  const failed=results.filter(r=>r.status==='rejected').length;
  if(failed>0)toast(`Sent to ${shareSelected.length-failed}, ${failed} failed`,'info');
  else toast(`Shared to ${shareSelected.length} recipient${shareSelected.length>1?'s':''}!`,'success');
  closeModal('share-mo');shareSelected=[];
}


function copyShareLink(){navigator.clipboard.writeText(document.getElementById('share-link').value).then(()=>toast('Copied!','success'));}

// ========== SHARE END ==========
async function showBlockedModal(){
  openModal('blocked-mo');const c=document.getElementById('blocked-list');
  const{data:blocked}=await db.from('blocked_users').select('*,profiles:blocked_id(id,username,full_name,avatar_url)').eq('blocker_id',CU.id);
  if(!blocked||!blocked.length){c.innerHTML='<div class="empty-st" style="padding:2rem"><div class="empty-tt">No blocked users</div></div>';return;}
  c.innerHTML=blocked.map(b=>`<div class="ul-item">${avHtml(b.profiles,40)}<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:.9rem">${esc(b.profiles?.full_name||b.profiles?.username)}</div><div style="font-size:.8rem;color:var(--text3)">@${esc(b.profiles?.username)}</div></div><button class="btn btn-outline btn-sm" onclick="unblockUser('${b.blocked_id}',this)">Unblock</button></div>`).join('');
}
async function unblockUser(uid,btn){await db.from('blocked_users').delete().eq('blocker_id',CU.id).eq('blocked_id',uid);btn.closest('.ul-item').remove();toast('Unblocked','success');}

// ========== DROPDOWNS ==========
function toggleDD(id){const m=document.getElementById(id);document.querySelectorAll('.dd-menu').forEach(d=>{if(d.id!==id)d.classList.add('hidden');});m?.classList.toggle('hidden');}
function closeDD(id){document.getElementById(id)?.classList.add('hidden');}
document.addEventListener('click',e=>{if(!e.target.closest('[onclick*="toggleDD"]')&&!e.target.closest('.dd-menu'))document.querySelectorAll('.dd-menu').forEach(m=>m.classList.add('hidden'));});

// ========== ADMIN ==========

// ========== VERIFICATION BADGE ==========
let selectedVerifPlan='1month';
function selectVerifPlan(el,plan,label){
  selectedVerifPlan=plan;
  document.querySelectorAll('[name="verif-plan"]').forEach(r=>r.closest('label').style.border='2px solid var(--border)');
  el.style.border='2px solid var(--saffron)';
  document.getElementById('verif-plan-selected').style.display='block';
  document.getElementById('verif-plan-label').textContent=label;
}
function showVerifPurchaseModal(){loadVerifStatus();openModal('verif-purchase-mo');}
async function loadVerifStatus(){
  if(!CU)return;
  const{data:p}=await db.from('profiles').select('is_verified,verification_expires_at').eq('id',CU.id).single().catch(()=>({data:null}));
  const el=document.getElementById('verif-status-text');
  if(!el)return;
  if(p?.is_verified&&p?.verification_expires_at){
    const exp=new Date(p.verification_expires_at);
    const now=new Date();
    if(exp>now){
      const days=Math.ceil((exp-now)/(1000*60*60*24));
      el.innerHTML=`<div class="sett-tt">✅ Verified — ${days} days left</div><div class="sett-st">Expires: ${exp.toLocaleDateString('en-IN')}</div>`;
      return;
    }
  }
  if(p?.is_verified===false||(p?.verification_expires_at&&new Date(p.verification_expires_at)<new Date())){
    el.innerHTML='<div class="sett-tt">Not Verified</div><div class="sett-st">Purchase a plan to get your badge</div>';
  } else {
    el.innerHTML='<div class="sett-tt">Not Verified</div><div class="sett-st">Purchase a plan to get your badge</div>';
  }
}
async function submitVerifRequest(){
  const txnId=document.getElementById('verif-txn-id').value.trim();
  const note=document.getElementById('verif-note').value.trim();
  if(!txnId){toast('Enter transaction ID','error');return;}
  const btn=document.getElementById('verif-submit-btn');btn.disabled=true;btn.textContent='Submitting...';
  // Store request in verification_requests table
  const planDays={'1month':30,'3months':90,'6months':180};
  const{error}=await db.from('verification_requests').insert({
    user_id:CU.id,plan:selectedVerifPlan,txn_id:txnId,note,
    status:'pending',days:planDays[selectedVerifPlan]||30
  });
  btn.disabled=false;btn.textContent="I've Paid — Submit Request";
  if(error){
    if(error.message?.includes('does not exist'))toast('Verification system setup needed. Contact admin.','info');
    else toast(error.message,'error');
    return;
  }
  closeModal('verif-purchase-mo');
  toast('Request submitted! Admin will verify and activate your badge within 24 hours ✅','success');
}

// Show verification badge on profile - Instagram style
function verifBadge(profile,size){
  if(!profile?.is_verified)return '';
  if(profile.verification_expires_at&&new Date(profile.verification_expires_at)<new Date())return '';
  const s=size||18;
  return `<span class="verif-badge" title="Verified Account" style="display:inline-flex;align-items:center;justify-content:center;width:${s}px;height:${s}px;background:#1877F2;border-radius:50%;margin-left:3px;flex-shrink:0;vertical-align:middle;box-shadow:0 1px 4px rgba(24,119,242,.5);border:1.5px solid rgba(255,255,255,.8)"><svg viewBox="0 0 24 24" style="width:${Math.round(s*.62)}px;height:${Math.round(s*.62)}px" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>`;
}


async function approveJoinRequest(reqId,groupId,userId){
  const{error:me}=await db.from('group_members').insert({group_id:groupId,user_id:userId,role:'member'}).catch(e=>({error:e}));
  const{error:re}=await db.from('group_join_requests').update({status:'approved'}).eq('id',reqId).catch(e=>({error:e}));
  if(me&&me.code!=='23505'){toast('Could not add member: '+(me.message||''),'error');return;}
  toast('Member approved!','success');loadGroupJoinRequests();
}
async function rejectJoinRequest(reqId){
  const{error}=await db.from('group_join_requests').update({status:'rejected'}).eq('id',reqId);
  if(error){toast(error.message,'error');return;}
  toast('Request rejected','info');loadGroupJoinRequests();
}

// ========== FOLLOWERS / FOLLOWING LIST ==========
async function showFollowersList(userId,type){
  document.getElementById('follow-list-title').textContent = type==='followers'?'Followers':'Following';
  document.getElementById('follow-list-c').innerHTML='<div class="dots" style="padding:2rem"><span></span><span></span><span></span></div>';
  openModal('follow-list-mo');
  let profiles=[];
  if(type==='followers'){
    const{data}=await db.from('followers').select('follower_id,profiles:follower_id(id,username,full_name,avatar_url,is_verified,verification_expires_at)').eq('following_id',userId);
    profiles=(data||[]).map(r=>r.profiles).filter(Boolean);
  } else {
    const{data}=await db.from('followers').select('following_id,profiles:following_id(id,username,full_name,avatar_url,is_verified,verification_expires_at)').eq('follower_id',userId);
    profiles=(data||[]).map(r=>r.profiles).filter(Boolean);
  }
  const c=document.getElementById('follow-list-c');
  if(!profiles.length){c.innerHTML='<div class="empty-st" style="padding:2rem"><div class="empty-tt">No '+type+' yet</div></div>';return;}
  c.innerHTML=profiles.map(p=>`
    <div class="ul-item" onclick="closeModal('follow-list-mo');viewUserProfile('${p.id}')" style="cursor:pointer">
      ${avHtml(p,44)}
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;display:flex;align-items:center;gap:3px">${esc(p.full_name||p.username)}${verifBadge(p,16)}</div>
        <div style="font-size:.82rem;color:var(--text3)">@${esc(p.username)}</div>
      </div>
      ${p.id!==CU?.id?`<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();viewUserProfile('${p.id}')">View</button>`:''}
    </div>`).join('');
}


// ========== INIT ==========
init();
