// SolveIt Pro - Core Application Logic

// --- Configuration ---
// IMPORTANT: Replace these with your actual Supabase and Razorpay credentials
const SUPABASE_URL = 'supabaseUrl = 'https://wrgwllfdoaqudkqwwqfz.supabase.co'';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndyZ3dsbGZkb2FxdWRrcXd3cWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MTY1NjAsImV4cCI6MjA4NjQ5MjU2MH0.7U-FgKq0pmqMJvp4S5xB_HZlhATKCdv1tNy_HThxiO4';
const RAZORPAY_KEY_ID = 'YOUR_RAZORPAY_KEY_ID';
const ADMIN_EMAIL = 'kishankumar9396@gmail.com';

// Initialize Supabase with Error Handling
let supabase = null;
try {
    if (window.supabase && SUPABASE_URL !== 'https://wrgwllfdoaqudkqwwqfz.supabase.co') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase initialized successfully.");
    } else {
        console.warn("Supabase credentials not set or library missing. App will run in limited mode.");
    }
} catch (e) {
    console.error("Failed to initialize Supabase:", e);
}

// --- State Management ---
let currentUser = null;
let userProfile = {
    is_premium: false,
    daily_usage_count: 0,
    last_usage_date: new Date().toISOString().split('T')[0]
};
let currentView = 'home';
let isSignUp = false;

// --- Tool Definitions ---
const tools = [
    {
        id: 'insta-bio',
        title: 'Instagram Bio Generator',
        desc: 'Create catchy bios for your profile',
        trending: true,
        fields: [{ name: 'niche', label: 'Your Niche (e.g. Fitness, Tech)', type: 'text' }, { name: 'vibe', label: 'Vibe (e.g. Professional, Funny)', type: 'text' }],
        generate: (data) => Array(5).fill(0).map((_, i) => `✨ ${data.niche} Enthusiast | ${data.vibe} vibes only | Option ${i+1} 🚀`)
    },
    {
        id: 'reel-hook',
        title: 'Viral Reel Hook Generator',
        desc: 'Stop the scroll with these hooks',
        trending: true,
        fields: [{ name: 'topic', label: 'Reel Topic', type: 'text' }],
        generate: (data) => [
            `The secret to ${data.topic} nobody tells you...`,
            `Stop doing this if you want to master ${data.topic}!`,
            `3 simple steps to 10x your ${data.topic}`,
            `I wish I knew this about ${data.topic} sooner.`,
            `How to ${data.topic} like a pro in 2024.`
        ]
    },
    {
        id: 'love-msg',
        title: 'Love Message Generator',
        desc: 'Sweet messages for your partner',
        fields: [{ name: 'name', label: 'Partner\'s Name', type: 'text' }, { name: 'mood', label: 'Mood (Romantic, Cute)', type: 'text' }],
        generate: (data) => Array(5).fill(0).map((_, i) => `${data.mood} message for ${data.name}: You are my favorite person! ❤️ (#${i+1})`)
    },
    {
        id: 'resume-headline',
        title: 'Resume Headline Generator',
        desc: 'Stand out to recruiters',
        fields: [{ name: 'role', label: 'Target Job Role', type: 'text' }, { name: 'exp', label: 'Years of Experience', type: 'number' }],
        generate: (data) => [
            `${data.role} with ${data.exp} years of experience driving results.`,
            `Innovative ${data.role} specializing in efficiency and growth.`,
            `Results-driven ${data.role} | ${data.exp}+ Years Experience`,
            `Strategic ${data.role} focused on scalable solutions.`,
            `Passionate ${data.role} helping brands achieve excellence.`
        ]
    },
    {
        id: 'study-timetable',
        title: 'Study Timetable Generator',
        desc: 'Organize your learning schedule',
        fields: [{ name: 'subjects', label: 'Subjects (comma separated)', type: 'text' }, { name: 'hours', label: 'Daily Study Hours', type: 'number' }],
        generate: (data) => Array(5).fill(0).map((_, i) => `Schedule ${i+1}: Focus on ${data.subjects.split(',')[0]} for ${data.hours/2} hours...`)
    },
    {
        id: 'gym-diet',
        title: 'Gym Diet Plan Generator',
        desc: 'Fuel your workouts correctly',
        fields: [{ name: 'goal', label: 'Goal (Bulking, Cutting)', type: 'text' }, { name: 'weight', label: 'Current Weight (kg)', type: 'number' }],
        generate: (data) => Array(5).fill(0).map((_, i) => `Diet Plan ${i+1} for ${data.goal}: High protein, moderate carbs for ${data.weight}kg bodyweight.`)
    },
    {
        id: 'krishna-caption',
        title: 'Motivational/Krishna Captions',
        desc: 'Divine wisdom for your posts',
        fields: [{ name: 'theme', label: 'Theme (Peace, Hard Work)', type: 'text' }],
        generate: (data) => [
            "Do your duty without thinking of the fruit. - Lord Krishna",
            "Peace begins when expectation ends.",
            "The soul is neither born nor does it die.",
            "Focus on the journey, not just the destination.",
            "Strength comes from within, guided by the divine."
        ]
    }
];

// --- DOM Elements ---
const views = {
    home: document.getElementById('home-view'),
    auth: document.getElementById('auth-view'),
    tool: document.getElementById('tool-view'),
    profile: document.getElementById('profile-view'),
    admin: document.getElementById('admin-view')
};

const authBtn = document.getElementById('auth-btn');
const profileBtn = document.getElementById('profile-btn');
const toolGrid = document.getElementById('tool-grid');
const toolSearch = document.getElementById('tool-search');
const authForm = document.getElementById('auth-form');
const authToggle = document.getElementById('auth-toggle');

// --- Navigation Logic ---
function showView(viewName) {
    Object.keys(views).forEach(key => {
        if (views[key]) {
            views[key].classList.toggle('hidden', key !== viewName);
        }
    });
    currentView = viewName;
    window.scrollTo(0, 0);
}

document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => showView('home'));
});

authBtn.addEventListener('click', () => {
    if (currentUser) {
        showView('profile');
    } else {
        showView('auth');
    }
});

profileBtn.addEventListener('click', () => showView('profile'));

// --- Auth Logic ---
async function handleAuth(e) {
    e.preventDefault();
    if (!supabase) {
        alert("Supabase is not configured. Please add your keys in script.js.");
        return;
    }
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    try {
        let result;
        if (isSignUp) {
            result = await supabase.auth.signUp({ email, password });
            if (result.error) throw result.error;
            alert('Signup successful! Please check your email for verification.');
        } else {
            result = await supabase.auth.signInWithPassword({ email, password });
            if (result.error) throw result.error;
            await initUser();
            showView('home');
        }
    } catch (error) {
        alert(error.message);
    }
}

if (authForm) authForm.addEventListener('submit', handleAuth);

if (authToggle) {
    authToggle.addEventListener('click', () => {
        isSignUp = !isSignUp;
        document.getElementById('auth-title').innerText = isSignUp ? 'Sign Up' : 'Login';
        document.getElementById('auth-submit').innerText = isSignUp ? 'Sign Up' : 'Login';
        authToggle.innerHTML = isSignUp ? 'Already have an account? <span>Login</span>' : 'Don\'t have an account? <span>Sign Up</span>';
    });
}

async function initUser() {
    if (!supabase) return;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        currentUser = user;

        if (user) {
            authBtn.classList.add('hidden');
            profileBtn.classList.remove('hidden');
            
            let { data: profile, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (!profile && !error) {
                const { data: newProfile } = await supabase
                    .from('users')
                    .insert([{ id: user.id, email: user.email, is_premium: false, daily_usage_count: 0, last_usage_date: new Date().toISOString().split('T')[0] }])
                    .select()
                    .single();
                profile = newProfile;
            }
            
            if (profile) userProfile = profile;
            updateProfileUI();
            
            if (user.email === ADMIN_EMAIL) {
                const adminBtn = document.getElementById('admin-btn');
                if (adminBtn) adminBtn.classList.remove('hidden');
            }
        } else {
            authBtn.classList.remove('hidden');
            profileBtn.classList.add('hidden');
        }
    } catch (e) {
        console.error("Error in initUser:", e);
    }
}

function updateProfileUI() {
    const emailDisp = document.getElementById('user-email-display');
    const statusBadge = document.getElementById('premium-status');
    const usageDisp = document.getElementById('usage-count');
    const upgradeBtn = document.getElementById('upgrade-btn');

    if (emailDisp) emailDisp.innerText = currentUser ? currentUser.email : 'Guest';
    if (statusBadge) {
        statusBadge.innerText = userProfile.is_premium ? 'PRO User' : 'Free User';
        statusBadge.className = userProfile.is_premium ? 'status-badge premium' : 'status-badge';
    }
    if (usageDisp) usageDisp.innerText = `Daily Usage: ${userProfile.daily_usage_count}/3`;
    if (upgradeBtn) upgradeBtn.classList.toggle('hidden', userProfile.is_premium);
}

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        if (supabase) await supabase.auth.signOut();
        location.reload();
    });
}

// --- Tool Logic ---
function renderTools(filter = '') {
    if (!toolGrid) return;
    toolGrid.innerHTML = '';
    const filtered = tools.filter(t => t.title.toLowerCase().includes(filter.toLowerCase()));
    
    filtered.forEach(tool => {
        const card = document.createElement('div');
        card.className = 'tool-card';
        card.innerHTML = `
            ${tool.trending ? '<span class="trending-badge">Trending</span>' : ''}
            <h3>${tool.title}</h3>
            <p>${tool.desc}</p>
        `;
        card.onclick = () => openTool(tool);
        toolGrid.appendChild(card);
    });
}

if (toolSearch) {
    toolSearch.addEventListener('input', (e) => renderTools(e.target.value));
}

function openTool(tool) {
    showView('tool');
    const container = document.getElementById('tool-container');
    const template = document.getElementById('tool-template');
    if (!template) return;
    
    const content = template.content.cloneNode(true);
    content.querySelector('.tool-title').innerText = tool.title;
    content.querySelector('.tool-desc').innerText = tool.desc;
    
    const fieldsContainer = content.getElementById('form-fields');
    tool.fields.forEach(f => {
        const input = document.createElement('input');
        input.type = f.type;
        input.name = f.name;
        input.placeholder = f.label;
        input.required = true;
        fieldsContainer.appendChild(input);
    });

    const form = content.querySelector('.tool-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        
        // Check usage limit
        const today = new Date().toISOString().split('T')[0];
        if (!userProfile.is_premium) {
            if (userProfile.last_usage_date !== today) {
                userProfile.daily_usage_count = 0;
                userProfile.last_usage_date = today;
            }
            if (userProfile.daily_usage_count >= 3) {
                alert('Daily limit reached! Upgrade to Pro for unlimited access.');
                showView('profile');
                return;
            }
        }

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const results = tool.generate(data);
        
        displayResults(results, tool.id);
        
        // Update usage locally
        userProfile.daily_usage_count++;
        updateProfileUI();

        // Update usage in DB if logged in
        if (supabase && currentUser) {
            await supabase.from('users').update({ 
                daily_usage_count: userProfile.daily_usage_count,
                last_usage_date: today 
            }).eq('id', currentUser.id);

            // Save first result to DB
            await supabase.from('saved_results').insert([{
                user_id: currentUser.id,
                category: tool.id,
                result_text: results[0]
            }]);
        }
    };

    container.innerHTML = '';
    container.appendChild(content);
    document.getElementById('tool-results').innerHTML = '';
}

function displayResults(results, category) {
    const container = document.getElementById('tool-results');
    container.innerHTML = '<h3>Generated Results:</h3>';
    results.forEach(text => {
        const div = document.createElement('div');
        div.className = 'result-item';
        div.innerHTML = `
            <p>${text}</p>
            <button class="copy-btn">Copy</button>
        `;
        div.querySelector('.copy-btn').onclick = () => {
            navigator.clipboard.writeText(text);
            alert('Copied to clipboard!');
        };
        container.appendChild(div);
    });
}

// --- Payment Logic ---
const upgradeBtn = document.getElementById('upgrade-btn');
if (upgradeBtn) {
    upgradeBtn.addEventListener('click', () => {
        if (RAZORPAY_KEY_ID === 'YOUR_RAZORPAY_KEY_ID') {
            alert("Razorpay Key ID not set. Please add it in script.js.");
            return;
        }
        const options = {
            key: RAZORPAY_KEY_ID,
            amount: 49900,
            currency: "INR",
            name: "SolveIt Pro",
            description: "Premium Subscription",
            handler: async function (response) {
                if (supabase && currentUser) {
                    const { error } = await supabase
                        .from('users')
                        .update({ is_premium: true })
                        .eq('id', currentUser.id);
                    
                    if (!error) {
                        userProfile.is_premium = true;
                        updateProfileUI();
                        alert('Welcome to Pro! Payment Successful ID: ' + response.razorpay_payment_id);
                    }
                } else {
                    userProfile.is_premium = true;
                    updateProfileUI();
                    alert('Payment Successful (Local Mode)! ID: ' + response.razorpay_payment_id);
                }
            },
            prefill: {
                email: currentUser ? currentUser.email : ""
            },
            theme: {
                color: "#38bdf8"
            }
        };
        const rzp = new Razorpay(options);
        rzp.open();
    });
}

// --- Admin Logic ---
const adminBtn = document.getElementById('admin-btn');
if (adminBtn) {
    adminBtn.addEventListener('click', async () => {
        if (!supabase) return;
        showView('admin');
        const { data: users } = await supabase.from('users').select('*');
        const list = document.getElementById('users-list');
        if (!list) return;
        list.innerHTML = '';
        
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.email}</td>
                <td>${u.is_premium ? '✅' : '❌'}</td>
                <td>${u.daily_usage_count}/3</td>
                <td>
                    <button class="btn-secondary" onclick="togglePremium('${u.id}', ${u.is_premium})">Toggle Pro</button>
                    <button class="btn-secondary" onclick="resetUsage('${u.id}')">Reset</button>
                </td>
            `;
            list.appendChild(tr);
        });
    });
}

window.togglePremium = async (id, current) => {
    if (supabase) {
        await supabase.from('users').update({ is_premium: !current }).eq('id', id);
        document.getElementById('admin-btn').click();
    }
};

window.resetUsage = async (id) => {
    if (supabase) {
        await supabase.from('users').update({ daily_usage_count: 0 }).eq('id', id);
        document.getElementById('admin-btn').click();
    }
};

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded. Initializing app...");
    renderTools();
    if (supabase) {
        initUser();
    }
});
