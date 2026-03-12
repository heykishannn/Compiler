// ==========================================
// 1. SUPABASE CONFIGURATION
// ==========================================
const SUPABASE_URL = 'https://eudyxjuevhfawtztsqvr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1ZHl4anVldmhmYXd0enRzcXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjc0MTMsImV4cCI6MjA4ODg0MzQxM30.1IDFKSuNanx4pFXfrlHfcBVKQIHtNk5rY1ZDtB60-_c';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 2. STATE MANAGEMENT & ROUTING
// ==========================================
const app = {
    user: null,
    profile: null,
    isLoginMode: true,
    currentGroup: null,

    showLoader: () => document.getElementById('loader').classList.remove('hidden'),
    hideLoader: () => document.getElementById('loader').classList.add('hidden'),

    navigate: (viewId) => {
        document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
        document.getElementById(`view-${viewId}`).classList.remove('hidden');
        if(viewId !== 'auth') document.getElementById('navbar').classList.remove('hidden');
        
        // Trigger view-specific logic
        if(viewId === 'feed') app.loadFeed();
        if(viewId === 'profile') app.loadProfile();
        if(viewId === 'groups') app.loadGroups();
        if(viewId === 'admin') app.loadAdmin();
    },

    init: async () => {
        app.showLoader();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            app.user = session.user;
            await app.fetchProfile();
            app.navigate('feed');
        } else {
            app.navigate('auth');
            document.getElementById('navbar').classList.add('hidden');
        }
        app.hideLoader();

        // Listen for realtime messages in groups
        supabase.channel('public:group_messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, payload => {
                if(app.currentGroup && payload.new.group_id === app.currentGroup) {
                    app.appendMessage(payload.new);
                }
            }).subscribe();
    },

    // ==========================================
    // 3. AUTHENTICATION
    // ==========================================
    toggleAuthMode: () => {
        app.isLoginMode = !app.isLoginMode;
        document.getElementById('auth-submit').innerText = app.isLoginMode ? 'Login' : 'Sign Up';
        document.querySelector('.auth-toggle span').innerText = app.isLoginMode ? 'Sign up' : 'Login';
    },

    handleAuth: async (e) => {
        e.preventDefault();
        app.showLoader();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;

        try {
            if (app.isLoginMode) {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                app.user = data.user;
            } else {
                const { data, error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                app.user = data.user;
                // Create dummy profile immediately
                await supabase.from('profiles').insert([{ id: app.user.id, name: email.split('@')[0] }]);
            }
            await app.fetchProfile();
            app.navigate('feed');
        } catch (error) {
            alert(error.message);
        }
        app.hideLoader();
    },

    logout: async () => {
        await supabase.auth.signOut();
        app.user = null;
        app.profile = null;
        app.navigate('auth');
        document.getElementById('navbar').classList.add('hidden');
    },

    fetchProfile: async () => {
        const { data } = await supabase.from('profiles').select('*').eq('id', app.user.id).single();
        app.profile = data;
    },

    // ==========================================
    // 4. POST SYSTEM (Creation & Compression)
    // ==========================================
    previewPostImage: (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Auto compress and enforce 4:3 aspect ratio < 1MB
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.getElementById('post-canvas');
                const ctx = canvas.getContext('2d');
                
                // Enforce 4:3 ratio. 
                const targetRatio = 4/3;
                let srcWidth = img.width;
                let srcHeight = img.height;
                let sx = 0, sy = 0;

                if (srcWidth / srcHeight > targetRatio) {
                    srcWidth = srcHeight * targetRatio;
                    sx = (img.width - srcWidth) / 2;
                } else {
                    srcHeight = srcWidth / targetRatio;
                    sy = (img.height - srcHeight) / 2;
                }

                canvas.width = 800; // max width
                canvas.height = 600; // 800 * 3/4
                
                ctx.drawImage(img, sx, sy, srcWidth, srcHeight, 0, 0, canvas.width, canvas.height);
                
                const previewImg = document.getElementById('post-preview');
                previewImg.src = canvas.toDataURL('image/jpeg', 0.8); // 80% quality to stay under 1MB
                previewImg.classList.remove('hidden');
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    },

    publishPost: async () => {
        app.showLoader();
        const canvas = document.getElementById('post-canvas');
        const caption = document.getElementById('post-caption').value;

        canvas.toBlob(async (blob) => {
            try {
                const fileName = `${app.user.id}_${Date.now()}.jpg`;
                const { data: uploadData, error: uploadErr } = await supabase.storage.from('posts').upload(fileName, blob);
                if (uploadErr) throw uploadErr;

                const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName);
                
                const { error: dbErr } = await supabase.from('posts').insert([{
                    user_id: app.user.id,
                    image_url: urlData.publicUrl,
                    caption: caption
                }]);

                if (dbErr) throw dbErr;

                alert('Post published!');
                document.getElementById('post-caption').value = '';
                document.getElementById('post-preview').classList.add('hidden');
                app.navigate('feed');
            } catch (error) {
                alert('Error publishing post: ' + error.message);
            }
            app.hideLoader();
        }, 'image/jpeg', 0.8);
    },

    // ==========================================
    // 5. FEED & INTERACTIONS
    // ==========================================
    loadFeed: async () => {
        app.showLoader();
        const container = document.getElementById('feed-container');
        container.innerHTML = '';

        // Lazy loading logic simplified: Fetching latest 20 posts with profile data
        const { data: posts, error } = await supabase
            .from('posts')
            .select(`*, profiles(name, avatar_url)`)
            .order('created_at', { ascending: false })
            .limit(20);

        if (posts) {
            posts.forEach(post => {
                const avatar = post.profiles.avatar_url || 'https://via.placeholder.com/35';
                container.innerHTML += `
                    <div class="post-card">
                        <div class="post-header">
                            <img src="${avatar}" class="post-avatar">
                            <span>${post.profiles.name}</span>
                        </div>
                        <img src="${post.image_url}" class="post-img" loading="lazy">
                        <div class="post-actions">
                            <button onclick="app.likePost('${post.id}')">❤️ Like</button>
                            <button onclick="alert('Comments coming soon!')">💬 Comment</button>
                            <button onclick="alert('Shared!')">↗️ Share</button>
                        </div>
                        <div class="post-caption">
                            <strong>${post.profiles.name}</strong> ${post.caption}
                        </div>
                    </div>
                `;
            });
        }
        app.hideLoader();
    },

    likePost: async (postId) => {
        await supabase.from('likes').insert([{ post_id: postId, user_id: app.user.id }]);
        alert('Liked!');
    },

    // ==========================================
    // 6. GROUPS & REALTIME CHAT
    // ==========================================
    loadGroups: async () => {
        const { data: groups } = await supabase.from('groups').select('*').order('created_at', { ascending: false });
        const container = document.getElementById('groups-container');
        container.innerHTML = groups.map(g => `
            <div class="group-item" onclick="app.openGroupChat('${g.id}', '${g.name}')">
                # ${g.name}
            </div>
        `).join('');
    },

    createGroup: async () => {
        const name = prompt('Enter group name:');
        if(name) {
            await supabase.from('groups').insert([{ name, created_by: app.user.id }]);
            app.loadGroups();
        }
    },

    openGroupChat: async (groupId, groupName) => {
        app.currentGroup = groupId;
        document.querySelector('.group-list').classList.add('hidden');
        document.getElementById('chat-area').classList.remove('hidden');
        document.getElementById('chat-group-name').innerText = `# ${groupName}`;
        
        const { data: msgs } = await supabase.from('group_messages').select('*').eq('group_id', groupId).order('created_at', { ascending: true });
        
        const chatBox = document.getElementById('chat-messages');
        chatBox.innerHTML = '';
        msgs.forEach(m => app.appendMessage(m));
    },

    appendMessage: (msg) => {
        const chatBox = document.getElementById('chat-messages');
        const isMe = msg.user_id === app.user.id;
        chatBox.innerHTML += `<div class="msg ${isMe ? 'me' : 'other'}">${msg.content}</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    },

    sendGroupMessage: async () => {
        const input = document.getElementById('chat-msg-input');
        if(!input.value) return;
        await supabase.from('group_messages').insert([{
            group_id: app.currentGroup,
            user_id: app.user.id,
            content: input.value
        }]);
        input.value = '';
    },

    // ==========================================
    // 7. USER PROFILE & SETTINGS
    // ==========================================
    loadProfile: async () => {
        app.showLoader();
        document.getElementById('prof-name').innerText = app.profile.name || 'Anonymous';
        document.getElementById('prof-bio').innerText = app.profile.bio || 'No bio yet.';
        if(app.profile.avatar_url) document.getElementById('prof-avatar').src = app.profile.avatar_url;

        // Load specific user posts
        const { data: posts } = await supabase.from('posts').select('*').eq('user_id', app.user.id);
        document.getElementById('prof-posts-count').innerText = posts.length;
        
        const grid = document.getElementById('profile-posts-grid');
        grid.innerHTML = posts.map(p => `<img src="${p.image_url}" loading="lazy">`).join('');
        
        app.hideLoader();
    },

    saveSettings: async () => {
        app.showLoader();
        const name = document.getElementById('set-name').value;
        const bio = document.getElementById('set-bio').value;
        
        await supabase.from('profiles').update({ name, bio }).eq('id', app.user.id);
        await app.fetchProfile();
        alert('Profile updated!');
        app.hideLoader();
    },

    // ==========================================
    // 8. ADMIN PANEL
    // ==========================================
    loadAdmin: async () => {
        app.showLoader();
        // Check Admin Role
        if (!app.profile.is_admin) {
            alert('Access Denied. You are not an Admin.');
            app.navigate('feed');
            app.hideLoader();
            return;
        }

        const[{count: uCount}, {count: pCount}, {count: gCount}] = await Promise.all([
            supabase.from('profiles').select('*', {count: 'exact', head: true}),
            supabase.from('posts').select('*', {count: 'exact', head: true}),
            supabase.from('groups').select('*', {count: 'exact', head: true})
        ]);

        document.getElementById('admin-users').innerText = uCount;
        document.getElementById('admin-posts').innerText = pCount;
        document.getElementById('admin-groups').innerText = gCount;
        app.hideLoader();
    }
};

// Initialize App on DOM Load
document.addEventListener('DOMContentLoaded', app.init);
