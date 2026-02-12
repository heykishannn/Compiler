// ==================== SUPABASE INIT ====================
// 👇 REPLACE WITH YOUR SUPABASE URL & ANON KEY
const SUPABASE_URL = 'https://yourproject.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== APP STATE ====================
let currentUser = null;
let userProfile = null;
let currentTool = null;
let adminEmail = 'admin@solveitpro.com'; // change this

// ==================== DOM CACHE ====================
const app = document.getElementById('app');

// ==================== ROUTER (SPA) ====================
const views = {
  auth: renderAuth,
  home: renderHome,
  tool: renderTool,
  admin: renderAdmin
};

function navigate(view, data = {}) {
  views[view]?.(data);
}

// ==================== AUTH ====================
async function renderAuth() {
  app.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <h2>Login</h2>
        <div class="input-group">
          <input type="email" id="login-email" placeholder="Email">
        </div>
        <div class="input-group">
          <input type="password" id="login-password" placeholder="Password">
        </div>
        <button class="btn btn-primary" id="login-btn">Sign In</button>
        <p style="margin-top:20px; text-align:center;">
          No account? <a href="#" id="show-signup">Sign up</a>
        </p>
      </div>
      <div class="auth-card hidden" id="signup-card">
        <h2>Sign Up</h2>
        <div class="input-group">
          <input type="email" id="signup-email" placeholder="Email">
        </div>
        <div class="input-group">
          <input type="password" id="signup-password" placeholder="Password">
        </div>
        <button class="btn btn-primary" id="signup-btn">Create Account</button>
        <p style="margin-top:20px; text-align:center;">
          Back to <a href="#" id="show-login">Login</a>
        </p>
      </div>
    </div>
  `;

  document.getElementById('show-signup').addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.auth-card')[1].classList.remove('hidden');
    document.querySelectorAll('.auth-card')[0].classList.add('hidden');
  });
  document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.auth-card')[0].classList.remove('hidden');
    document.querySelectorAll('.auth-card')[1].classList.add('hidden');
  });

  document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  });

  document.getElementById('signup-btn').addEventListener('click', async () => {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert('Check your email for confirmation!');
  });
}

// ==================== AUTH STATE LISTENER ====================
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    currentUser = session.user;
    loadUserProfile();
  } else {
    currentUser = null;
    userProfile = null;
    navigate('auth');
  }
});

async function loadUserProfile() {
  // Get or create profile in 'users' table
  let { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', currentUser.id)
    .single();

  if (error || !data) {
    // First time user – insert
    const today = new Date().toISOString().split('T')[0];
    const newProfile = {
      id: currentUser.id,
      email: currentUser.email,
      is_premium: false,
      daily_usage_count: 0,
      last_usage_date: today
    };
    const { data: inserted, error: insertError } = await supabase
      .from('users')
      .insert([newProfile])
      .select()
      .single();
    if (insertError) console.error(insertError);
    else userProfile = inserted;
  } else {
    userProfile = data;
    // Reset daily count if date changed
    const today = new Date().toISOString().split('T')[0];
    if (userProfile.last_usage_date !== today) {
      userProfile.daily_usage_count = 0;
      userProfile.last_usage_date = today;
      await supabase
        .from('users')
        .update({ daily_usage_count: 0, last_usage_date: today })
        .eq('id', currentUser.id);
    }
  }

  // Navigate based on admin status
  if (currentUser.email === adminEmail) navigate('admin');
  else navigate('home');
}

// ==================== HOME SCREEN ====================
function renderHome() {
  const tools = [
    { id: 'bio', name: 'Instagram Bio', icon: 'fa-user', trending: true },
    { id: 'hook', name: 'Viral Reel Hook', icon: 'fa-video', trending: true },
    { id: 'love', name: 'Love Message', icon: 'fa-heart', trending: false },
    { id: 'resume', name: 'Resume Headline', icon: 'fa-file-alt', trending: false },
    { id: 'study', name: 'Study Timetable', icon: 'fa-calendar', trending: true },
    { id: 'gym', name: 'Gym Diet Plan', icon: 'fa-dumbbell', trending: false },
    { id: 'krishna', name: 'Krishna Caption', icon: 'fa-om', trending: false }
  ];

  let toolCards = tools.map(t => `
    <div class="tool-card" data-tool="${t.id}">
      <i class="fas ${t.icon}"></i>
      <span>${t.name}</span>
      ${t.trending ? '<span class="trending-badge">🔥 Trending</span>' : ''}
    </div>
  `).join('');

  app.innerHTML = `
    <div class="top-bar">
      <span class="app-title">SolveIt Pro</span>
      <button class="btn" id="logout-btn"><i class="fas fa-sign-out-alt"></i></button>
    </div>
    <div class="ad-banner">📢 Ad Space – Banner</div>
    <div class="usage-badge">
      ${userProfile?.is_premium ? '⭐ Premium' : `🔓 Free: ${userProfile?.daily_usage_count || 0}/3 today`}
      ${!userProfile?.is_premium ? '<button class="btn-premium" id="upgrade-btn" style="margin-left:12px;">Upgrade</button>' : ''}
    </div>
    <div class="search-box">
      <i class="fas fa-search"></i>
      <input type="text" id="tool-search" placeholder="Search tools...">
    </div>
    <div class="tool-grid" id="tool-grid">
      ${toolCards}
    </div>
    <div class="ad-mid">📢 Ad Space – Mid Content</div>
  `;

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', () => supabase.auth.signOut());
  // Upgrade button
  if (!userProfile?.is_premium) {
    document.getElementById('upgrade-btn')?.addEventListener('click', initiatePayment);
  }
  // Tool selection
  document.querySelectorAll('.tool-card').forEach(card => {
    card.addEventListener('click', () => {
      const toolId = card.dataset.tool;
      currentTool = toolId;
      navigate('tool', { tool: toolId });
    });
  });
  // Search
  document.getElementById('tool-search').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.tool-card').forEach(card => {
      const name = card.querySelector('span').innerText.toLowerCase();
      card.style.display = name.includes(term) ? 'block' : 'none';
    });
  });
}

// ==================== TOOL GENERATOR ====================
const toolGenerators = {
  bio: (input) => [`✨ ${input} | Dreamer & Creator`, `📸 ${input} – Capturing moments`, `🚀 ${input} on a mission`, `💡 ${input} | Ideas worth spreading`, `🌍 ${input} · Global citizen`],
  hook: (topic) => [`Stop scrolling if you care about ${topic}`, `I tried ${topic} for 30 days – here's what happened`, `${topic} changed my life forever`, `3 ${topic} secrets they don't tell you`, `Why ${topic} is the next big thing`],
  love: (name) => [`${name}, you're my favourite notification`, `Every love story is beautiful, but ours is my favourite, ${name}`, `${name}, you're the reason I believe in forever`, `If I had a flower for every time I thought of you, I could walk through my garden forever, ${name}`, `${name}, you're my today and all of my tomorrows`],
  resume: (role) => [`Innovative ${role} with 5+ years of impact`, `Results-driven ${role} | Data & strategy`, `Creative ${role} – turning ideas into products`, `${role} passionate about user experience`, `Award-winning ${role} seeking new challenges`],
  study: (subject) => [`7:00 AM - ${subject} revision`, `9:00 AM - Practice problems (${subject})`, `11:00 AM - Break`, `1:00 PM - ${subject} group study`, `4:00 PM - ${subject} flashcards`],
  gym: (goal) => [`Monday: Chest + 30min cardio (${goal})`, `Tuesday: Back & biceps (${goal})`, `Wednesday: Active recovery`, `Thursday: Leg day (${goal})`, `Friday: Shoulders & abs (${goal})`],
  krishna: (input) => [`🕉️ When Krishna is your captain, the ocean of life is easy to cross.`, `🌸 Like Krishna's flute, let your life be hollow so the divine can play through you.`, `💛 Radhe Radhe – ${input}`, `🦚 Let go, trust Krishna.`, `✨ Your struggle today is Krishna's leela for a better tomorrow.`]
};

async function renderTool({ tool }) {
  if (!userProfile) return;
  const canGenerate = userProfile.is_premium || userProfile.daily_usage_count < 3;
  if (!canGenerate) {
    alert('Daily limit reached. Upgrade to premium!');
    return navigate('home');
  }

  const toolName = tool.charAt(0).toUpperCase() + tool.slice(1).replace('krishna', 'Krishna Caption');
  app.innerHTML = `
    <div class="top-bar">
      <button class="btn" id="back-btn"><i class="fas fa-arrow-left"></i> Back</button>
      <span class="app-title">${toolName}</span>
    </div>
    <div class="ad-banner">📢 Ad Space – Banner</div>
    <div class="tool-container">
      <label for="tool-input">Enter topic / name / goal:</label>
      <input type="text" id="tool-input" class="tool-input" placeholder="e.g. fitness, John, weight loss">
      <button class="btn btn-primary" id="generate-btn">Generate</button>
      <div id="outputs-area"></div>
    </div>
    <div class="ad-mid">📢 Ad Space – Mid Content</div>
  `;

  document.getElementById('back-btn').addEventListener('click', () => navigate('home'));

  document.getElementById('generate-btn').addEventListener('click', async () => {
    const input = document.getElementById('tool-input').value.trim();
    if (!input) return alert('Please enter something');
    
    // Check limit again (race condition safe)
    if (!userProfile.is_premium && userProfile.daily_usage_count >= 3) {
      return alert('Daily limit reached. Upgrade!');
    }

    const generator = toolGenerators[tool];
    const outputs = generator(input).slice(0,5); // ensure 5

    // Render outputs
    const outputsDiv = document.getElementById('outputs-area');
    outputsDiv.innerHTML = outputs.map((text, i) => `
      <div class="output-card">
        <span>${text}</span>
        <button class="copy-btn" data-text="${text}">Copy</button>
      </div>
    `).join('');

    // Copy buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        navigator.clipboard.writeText(e.target.dataset.text);
        e.target.innerText = 'Copied!';
        setTimeout(() => e.target.innerText = 'Copy', 1500);
      });
    });

    // Increment usage count for non-premium
    if (!userProfile.is_premium) {
      const newCount = userProfile.daily_usage_count + 1;
      userProfile.daily_usage_count = newCount;
      await supabase
        .from('users')
        .update({ daily_usage_count: newCount })
        .eq('id', currentUser.id);
    }

    // Save to saved_results table
    await supabase
      .from('saved_results')
      .insert([{
        user_id: currentUser.id,
        category: tool,
        result_text: outputs.join(' | ')
      }]);
  });
}

// ==================== RAZORPAY PREMIUM ====================
async function initiatePayment() {
  // In production, call your serverless function to create an order
  // For this demo, we simulate a successful payment and upgrade the user.
  // REPLACE with actual Razorpay order creation via Supabase Edge Function.
  
  const options = {
    key: 'rzp_test_YOUR_KEY', // 🔁 Replace with your Razorpay test key
    amount: 29900, // ₹299
    currency: 'INR',
    name: 'SolveIt Pro',
    description: 'Lifetime Premium',
    image: 'https://your-logo-url',
    handler: async function (response) {
      // Payment successful
      const { error } = await supabase
        .from('users')
        .update({ is_premium: true })
        .eq('id', currentUser.id);
      if (!error) {
        userProfile.is_premium = true;
        alert('🎉 You are now premium!');
        navigate('home');
      }
    },
    prefill: {
      email: currentUser.email
    },
    theme: {
      color: '#6366f1'
    }
  };
  const rzp = new Razorpay(options);
  rzp.open();
}

// ==================== ADMIN DASHBOARD ====================
async function renderAdmin() {
  if (currentUser?.email !== adminEmail) return navigate('home');

  // Fetch all users
  const { data: users } = await supabase.from('users').select('*');
  // Fetch all saved_results? (optional)
  
  let rows = users?.map(u => `
    <tr>
      <td>${u.email}</td>
      <td>${u.is_premium ? '✅' : '❌'}</td>
      <td>${u.daily_usage_count}</td>
      <td>${u.last_usage_date}</td>
      <td>
        <button class="btn" data-id="${u.id}" data-action="toggle">Toggle Premium</button>
        <button class="btn" data-id="${u.id}" data-action="reset">Reset Usage</button>
      </td>
    </tr>
  `).join('');

  app.innerHTML = `
    <div class="top-bar">
      <span class="app-title">Admin</span>
      <button class="btn" id="logout-btn"><i class="fas fa-sign-out-alt"></i></button>
    </div>
    <table class="admin-table">
      <thead>
        <tr><th>Email</th><th>Premium</th><th>Today</th><th>Last Date</th><th>Actions</th></tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="5">No users</td></tr>'}
      </tbody>
    </table>
    <button class="btn" id="back-to-home">Back to Home</button>
  `;

  document.getElementById('logout-btn').addEventListener('click', () => supabase.auth.signOut());
  document.getElementById('back-to-home').addEventListener('click', () => navigate('home'));

  // Action handlers
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const userId = e.target.dataset.id;
      const action = e.target.dataset.action;
      if (action === 'toggle') {
        const user = users.find(u => u.id === userId);
        await supabase.from('users').update({ is_premium: !user.is_premium }).eq('id', userId);
        renderAdmin(); // refresh
      } else if (action === 'reset') {
        await supabase.from('users').update({ daily_usage_count: 0, last_usage_date: new Date().toISOString().split('T')[0] }).eq('id', userId);
        renderAdmin();
      }
    });
  });
}

// ==================== INIT ====================
// Start with auth view
navigate('auth');
