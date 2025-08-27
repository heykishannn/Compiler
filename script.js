// ===== GLOBAL VARIABLES AND CONFIGURATION =====
const GEMINI_API_KEY = 'AIzaSyC_E_nMjCfoC-9re5XUeQHpTugbYsXVcjo';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

// Cost of living data for Indian cities
const CITY_DATA = {
    mumbai: {
        name: 'Mumbai',
        rent: 40000,
        food: 15000,
        transport: 5000,
        utilities: 3000,
        entertainment: 8000,
        miscellaneous: 7000
    },
    delhi: {
        name: 'Delhi',
        rent: 25000,
        food: 12000,
        transport: 4000,
        utilities: 2500,
        entertainment: 6000,
        miscellaneous: 5500
    },
    bangalore: {
        name: 'Bangalore',
        rent: 30000,
        food: 13000,
        transport: 4500,
        utilities: 2800,
        entertainment: 7000,
        miscellaneous: 6000
    },
    hyderabad: {
        name: 'Hyderabad',
        rent: 20000,
        food: 10000,
        transport: 3500,
        utilities: 2200,
        entertainment: 5000,
        miscellaneous: 4500
    },
    pune: {
        name: 'Pune',
        rent: 22000,
        food: 11000,
        transport: 3800,
        utilities: 2400,
        entertainment: 5500,
        miscellaneous: 5000
    },
    chennai: {
        name: 'Chennai',
        rent: 18000,
        food: 9500,
        transport: 3200,
        utilities: 2000,
        entertainment: 4500,
        miscellaneous: 4200
    },
    kolkata: {
        name: 'Kolkata',
        rent: 15000,
        food: 8000,
        transport: 2800,
        utilities: 1800,
        entertainment: 3500,
        miscellaneous: 3500
    },
    ahmedabad: {
        name: 'Ahmedabad',
        rent: 16000,
        food: 8500,
        transport: 3000,
        utilities: 1900,
        entertainment: 4000,
        miscellaneous: 3800
    }
};

// Fallback responses for AI tools
const FALLBACK_RESPONSES = {
    instagram: {
        casual: [
            "✨ Just another day living my best life! What's making you smile today? 😊 #GoodVibes #LifeIsBeautiful #Grateful",
            "Coffee in hand, dreams in heart ☕️💭 Ready to conquer this beautiful day! What's your morning motivation? #MorningVibes #CoffeeTime",
            "Sunshine mixed with a little hurricane 🌪️☀️ That's just how I roll! #AuthenticLife #BeYourself #Mood"
        ],
        professional: [
            "Excited to share insights from today's industry conference. Key takeaway: Innovation thrives when we embrace continuous learning. What's your latest learning milestone? #ProfessionalGrowth #Innovation #Learning",
            "Reflecting on this quarter's achievements and setting ambitious goals for the next. Success is a journey, not a destination. #Goals #Success #ProfessionalLife",
            "Grateful for the opportunity to collaborate with such talented individuals. Teamwork truly makes the dream work! #Teamwork #Collaboration #Grateful"
        ],
        funny: [
            "Me: I'll just check social media for 5 minutes. Also me: *3 hours later* How did I end up watching videos of cats wearing tiny hats? 🐱👒 #Relatable #SocialMediaLife",
            "My bank account after online shopping: 'We need to talk.' Me: 'Sorry, who's this?' 💳😅 #OnlineShopping #Broke #Relatable",
            "Trying to adult today but my inner child keeps asking for snacks and nap time. Anyone else? 🍪😴 #Adulting #InnerChild #Mood"
        ],
        inspirational: [
            "Every sunrise brings new opportunities. Today, choose to see possibilities instead of problems. You've got this! 🌅✨ #Motivation #NewDay #Possibilities",
            "Your dreams don't have an expiration date. It's never too late to pursue what sets your soul on fire. 🔥💫 #Dreams #Inspiration #NeverTooLate",
            "Progress, not perfection. Every small step forward is a victory worth celebrating. Keep moving! 🚀 #Progress #Growth #Motivation"
        ],
        trendy: [
            "POV: You're living your main character era and it feels absolutely incredible ✨👑 #MainCharacterEnergy #SelfLove #ThatGirl",
            "Currently manifesting: good vibes, great opportunities, and unlimited iced coffee ☕️✨ #Manifesting #GoodVibes #IcedCoffee",
            "Plot twist: You're exactly where you need to be. Trust the process, bestie! 💫🦋 #PlotTwist #TrustTheProcess #Bestie"
        ]
    },
    youtube: {
        'how-to': [
            "How to Master [Topic] in 30 Days (Complete Beginner's Guide)",
            "The Ultimate [Topic] Tutorial - Step by Step for 2024",
            "How I Learned [Topic] From Zero (And You Can Too!)",
            "[Topic] Made Simple: A Complete How-To Guide",
            "The Only [Topic] Tutorial You'll Ever Need"
        ],
        listicle: [
            "10 [Topic] Tips That Will Change Your Life",
            "7 [Topic] Secrets Experts Don't Want You to Know",
            "15 Amazing [Topic] Hacks You Need to Try",
            "5 [Topic] Mistakes Everyone Makes (And How to Fix Them)",
            "12 [Topic] Ideas That Actually Work in 2024"
        ],
        review: [
            "[Topic] Review: Is It Worth Your Money in 2024?",
            "I Tried [Topic] for 30 Days - Here's What Happened",
            "[Topic] vs [Alternative]: Which One Should You Choose?",
            "Honest [Topic] Review - The Good, Bad, and Ugly",
            "[Topic] Review: Don't Buy Until You Watch This"
        ],
        tutorial: [
            "[Topic] Tutorial for Complete Beginners (2024)",
            "Learn [Topic] in 20 Minutes - Full Tutorial",
            "[Topic] Masterclass: From Beginner to Pro",
            "The Complete [Topic] Course - Free Tutorial",
            "[Topic] Tutorial: Everything You Need to Know"
        ],
        vlog: [
            "A Day in My Life: [Topic] Edition",
            "My [Topic] Journey: The Real Story",
            "Behind the Scenes: My [Topic] Experience",
            "Vlog: Why I Started [Topic] (And You Should Too)",
            "My [Topic] Routine: What Really Works"
        ],
        news: [
            "[Topic] News: What You Need to Know in 2024",
            "Breaking: Major [Topic] Update Changes Everything",
            "[Topic] Industry Update: Latest Trends and Predictions",
            "What's New in [Topic]: December 2024 Update",
            "[Topic] News Roundup: This Week's Biggest Stories"
        ]
    },
    blog: {
        beginners: `# The Complete Beginner's Guide to [Topic]

## Introduction
Welcome to the world of [topic]! If you're just starting out, this comprehensive guide will take you from zero to confident in no time.

## What You'll Learn
- The fundamentals of [topic]
- Essential tools and resources
- Step-by-step getting started process
- Common mistakes to avoid
- Next steps for continued learning

## Chapter 1: Understanding the Basics
[Topic] is more than just a trend - it's a valuable skill that can transform your [relevant area]. In this section, we'll cover the foundational concepts you need to know.

### Key Concepts
1. **Concept 1**: Brief explanation
2. **Concept 2**: Brief explanation  
3. **Concept 3**: Brief explanation

## Chapter 2: Getting Started
Now that you understand the basics, let's dive into practical application. Here's your step-by-step roadmap.

### Step 1: Preparation
Before you begin, make sure you have these essentials ready.

### Step 2: First Steps
Your first practical exercise to build confidence.

### Step 3: Building Momentum
How to maintain progress and stay motivated.

## Chapter 3: Common Pitfalls and How to Avoid Them
Learn from others' mistakes to accelerate your progress.

## Chapter 4: Tools and Resources
Essential tools that will make your journey easier and more effective.

## Conclusion
You now have everything you need to begin your [topic] journey. Remember, every expert was once a beginner. Take it one step at a time, and you'll be amazed at your progress.

## Next Steps
- Practice daily for 15-30 minutes
- Join online communities
- Find a mentor or accountability partner
- Set specific, measurable goals`,
        
        intermediate: `# Advanced [Topic] Strategies for 2024

## Introduction
Ready to take your [topic] skills to the next level? This intermediate guide covers advanced strategies and techniques.

## What You'll Discover
- Advanced techniques and strategies
- Industry best practices
- Optimization methods
- Scaling approaches
- Professional insights

## Chapter 1: Advanced Fundamentals
Building on your existing knowledge, let's explore more sophisticated approaches.

### Advanced Technique 1
Detailed explanation of complex concept with practical applications.

### Advanced Technique 2
How to implement this strategy effectively in real-world scenarios.

## Chapter 2: Optimization and Efficiency
Learn how to maximize your results with minimal effort.

### Performance Optimization
- Method 1: Specific technique
- Method 2: Alternative approach
- Method 3: Hybrid solution

### Workflow Optimization
Streamline your process for better results.

## Chapter 3: Scaling Your Success
How to expand and grow your [topic] efforts.

### Scaling Strategy 1
When and how to implement this approach.

### Scaling Strategy 2
Alternative scaling methods for different situations.

## Chapter 4: Industry Best Practices
Learn from the experts who've mastered this field.

### Professional Insights
- Insight 1: Expert perspective
- Insight 2: Industry trend
- Insight 3: Future predictions

## Chapter 5: Troubleshooting Common Issues
Solutions to challenges you'll face at this level.

## Conclusion
You're now equipped with advanced strategies to excel in [topic]. The key is consistent application and continuous learning.

## Action Items
- Implement one new strategy this week
- Track your results and adjust
- Connect with other intermediate practitioners
- Plan your path to expert level`,
        
        experts: `# Expert-Level [Topic] Mastery: Cutting-Edge Insights

## Introduction
For seasoned professionals looking to stay ahead of the curve and push the boundaries of [topic].

## Advanced Topics Covered
- Cutting-edge methodologies
- Research-backed innovations
- Industry disruptions
- Future-proofing strategies
- Thought leadership development

## Chapter 1: Emerging Trends and Innovations
Stay ahead with the latest developments in the field.

### Trend 1: Revolutionary Approach
Deep dive into game-changing methodology.

### Trend 2: Technology Integration
How emerging technologies are reshaping the landscape.

### Trend 3: Paradigm Shifts
Fundamental changes in how we approach [topic].

## Chapter 2: Advanced Research and Data
Leverage cutting-edge research for competitive advantage.

### Research Methodology
- Advanced analytical techniques
- Data interpretation strategies
- Predictive modeling approaches

### Implementation Framework
How to apply research findings in practice.

## Chapter 3: Thought Leadership and Innovation
Become a recognized expert and innovator in your field.

### Content Creation Strategy
- Developing unique perspectives
- Building authority and credibility
- Engaging with industry discourse

### Innovation Framework
- Identifying opportunities for innovation
- Testing and validating new approaches
- Scaling successful innovations

## Chapter 4: Strategic Partnerships and Collaboration
Leverage relationships for exponential growth.

### Partnership Strategy
- Identifying strategic partners
- Structuring mutually beneficial relationships
- Managing collaborative projects

## Chapter 5: Future-Proofing Your Expertise
Prepare for the next evolution in [topic].

### Scenario Planning
- Potential future developments
- Adaptation strategies
- Continuous learning frameworks

## Conclusion
Expert-level mastery requires continuous evolution and innovation. Use these insights to maintain your competitive edge and drive industry progress.

## Expert Action Plan
- Conduct original research in your niche
- Publish thought leadership content
- Speak at industry conferences
- Mentor the next generation of practitioners`,
        
        general: `# Everything You Need to Know About [Topic]

## Introduction
A comprehensive guide to [topic] for anyone looking to understand and apply this important concept.

## Table of Contents
1. What is [Topic]?
2. Why [Topic] Matters
3. Getting Started with [Topic]
4. Best Practices and Tips
5. Common Challenges and Solutions
6. Tools and Resources
7. Future of [Topic]

## Chapter 1: What is [Topic]?
[Topic] is a fundamental concept that impacts many aspects of our daily lives. Understanding its core principles is essential for anyone looking to improve their knowledge in this area.

### Key Definitions
- **Term 1**: Clear, concise definition
- **Term 2**: Clear, concise definition
- **Term 3**: Clear, concise definition

### Historical Context
Brief overview of how [topic] has evolved over time.

## Chapter 2: Why [Topic] Matters
Understanding the importance and relevance of [topic] in today's world.

### Benefits of Understanding [Topic]
1. **Benefit 1**: Specific advantage
2. **Benefit 2**: Practical application
3. **Benefit 3**: Long-term value

### Real-World Applications
How [topic] applies to various industries and situations.

## Chapter 3: Getting Started with [Topic]
Practical steps to begin your journey with [topic].

### Step-by-Step Guide
1. **Assessment**: Evaluate your current knowledge
2. **Planning**: Set clear goals and objectives
3. **Implementation**: Take action with specific strategies
4. **Evaluation**: Measure progress and adjust

### Essential Tools
List of must-have resources for beginners.

## Chapter 4: Best Practices and Tips
Proven strategies for success with [topic].

### Do's and Don'ts
- **Do**: Specific recommendation
- **Don't**: Common mistake to avoid
- **Do**: Another best practice
- **Don't**: Another pitfall

### Pro Tips
Advanced insights from experienced practitioners.

## Chapter 5: Common Challenges and Solutions
Overcome typical obstacles with proven solutions.

### Challenge 1: Specific Problem
- **Solution**: Detailed approach to resolution
- **Prevention**: How to avoid this issue

### Challenge 2: Another Common Issue
- **Solution**: Step-by-step resolution
- **Prevention**: Proactive measures

## Chapter 6: Tools and Resources
Comprehensive list of helpful resources.

### Free Resources
- Resource 1: Description and link
- Resource 2: Description and link
- Resource 3: Description and link

### Premium Tools
- Tool 1: Features and benefits
- Tool 2: Use cases and pricing
- Tool 3: Comparison with alternatives

## Chapter 7: Future of [Topic]
What to expect and how to prepare for upcoming changes.

### Emerging Trends
- Trend 1: Impact and implications
- Trend 2: Opportunities and challenges
- Trend 3: Timeline and predictions

### Preparation Strategies
How to stay ahead of the curve.

## Conclusion
[Topic] is an evolving field with tremendous potential. By understanding the fundamentals and staying current with trends, you can leverage this knowledge for personal and professional success.

## Next Steps
- Start with the basics and build gradually
- Join communities and networks
- Stay updated with latest developments
- Practice regularly and seek feedback`
    },
    tweet: {
        informative: [
            "🧠 Did you know? [Topic] can significantly impact your daily productivity. Here's what the latest research reveals: [key insight]. What's your experience with this? #Productivity #Research",
            "📊 Breaking down [topic] in simple terms: ✅ Benefit 1 ✅ Benefit 2 ✅ Benefit 3. Which one resonates most with you? #Education #Tips",
            "💡 Quick [topic] fact: [interesting statistic or insight]. This changes everything we thought we knew about [related concept]. #FactCheck #Learning"
        ],
        humorous: [
            "Me trying to explain [topic] to my friends: 'It's like [funny analogy]' Them: 'That makes no sense' Me: 'Exactly!' 😂 #Relatable #Humor",
            "[Topic] expectations vs reality: Expectation: [idealistic view] Reality: [humorous truth] Anyone else? 🤷‍♀️ #ExpectationVsReality #Funny",
            "Plot twist: [topic] is actually just [humorous oversimplification]. Mind = blown 🤯 (Just kidding, but wouldn't that be easier?) #Humor #PlotTwist"
        ],
        inspirational: [
            "🌟 Your [topic] journey doesn't have to be perfect. It just has to be yours. Every small step counts toward something bigger. Keep going! #Motivation #Journey",
            "✨ Remember: You don't have to be great at [topic] to get started, but you have to get started to be great. What's your first step today? #Inspiration #GetStarted",
            "🚀 The best time to start with [topic] was yesterday. The second best time is now. Your future self will thank you for beginning today. #Motivation #StartNow"
        ],
        question: [
            "🤔 Quick question: What's the biggest challenge you face with [topic]? Looking to learn from your experiences and maybe share some solutions! #Question #Community",
            "💭 Curious: If you could change one thing about how [topic] works, what would it be and why? Let's brainstorm together! #Question #Innovation",
            "🗣️ Hot take needed: Is [topic] overrated or underrated in 2024? Defend your position in the comments! #Debate #Question"
        ],
        thread: [
            "🧵 THREAD: 5 things I wish I knew about [topic] before I started (this could save you months of trial and error) 👇 #Thread #Tips",
            "🧵 Let's talk about [topic] myths vs reality. I'm breaking down the biggest misconceptions in this thread 👇 #Thread #MythBusting",
            "🧵 THREAD: The complete beginner's roadmap to [topic]. Bookmark this for later! 👇 #Thread #Beginner #Guide"
        ]
    }
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    setupIntersectionObserver();
    setupRangeInputs();
    hideSkeletonLoader();
});

function initializeApp() {
    console.log('ToolVerse initialized successfully!');
    
    // Add smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

function hideSkeletonLoader() {
    setTimeout(() => {
        const skeletonLoader = document.getElementById('skeleton-loader');
        const mainApp = document.getElementById('main-app');
        
        skeletonLoader.style.opacity = '0';
        setTimeout(() => {
            skeletonLoader.style.display = 'none';
            mainApp.classList.remove('hidden');
        }, 500);
    }, 2000); // Show skeleton for 2 seconds
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // AI Tool Forms
    document.getElementById('instagram-form').addEventListener('submit', handleInstagramGeneration);
    document.getElementById('youtube-form').addEventListener('submit', handleYouTubeGeneration);
    document.getElementById('blog-form').addEventListener('submit', handleBlogGeneration);
    document.getElementById('tweet-form').addEventListener('submit', handleTweetGeneration);
    
    // Calculator Forms
    document.getElementById('job-quit-form').addEventListener('submit', handleJobQuitCalculation);
    document.getElementById('freelance-rate-form').addEventListener('submit', handleFreelanceRateCalculation);
    document.getElementById('cost-living-form').addEventListener('submit', handleCostLivingComparison);
    
    // Mobile menu toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', toggleMobileMenu);
    }
}

function setupRangeInputs() {
    // Setup range input value displays
    const rangeInputs = document.querySelectorAll('.range-input');
    rangeInputs.forEach(input => {
        const valueDisplay = document.getElementById(input.id + '-value');
        if (valueDisplay) {
            input.addEventListener('input', function() {
                valueDisplay.textContent = this.value;
            });
        }
    });
}

// ===== INTERSECTION OBSERVER FOR SCROLL ANIMATIONS =====
function setupIntersectionObserver() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
            }
        });
    }, observerOptions);
    
    // Observe all tool cards and calculator cards
    document.querySelectorAll('.tool-card, .calculator-card, .feature-item').forEach(el => {
        el.classList.add('animate-on-scroll');
        observer.observe(el);
    });
}

// ===== UTILITY FUNCTIONS =====
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

function toggleMobileMenu() {
    const navMenu = document.querySelector('.nav-menu');
    const hamburgerLines = document.querySelectorAll('.hamburger-line');
    
    navMenu.style.display = navMenu.style.display === 'flex' ? 'none' : 'flex';
    
    // Animate hamburger to X
    hamburgerLines.forEach((line, index) => {
        if (navMenu.style.display === 'flex') {
            if (index === 0) line.style.transform = 'rotate(45deg) translate(5px, 5px)';
            if (index === 1) line.style.opacity = '0';
            if (index === 2) line.style.transform = 'rotate(-45deg) translate(7px, -6px)';
        } else {
            line.style.transform = 'none';
            line.style.opacity = '1';
        }
    });
}

function showLoading(buttonId) {
    const button = document.querySelector(`#${buttonId} .tool-button, #${buttonId} .calculator-button`);
    const buttonText = button.querySelector('.button-text');
    const buttonLoader = button.querySelector('.button-loader');
    
    buttonText.classList.add('hidden');
    buttonLoader.classList.remove('hidden');
    button.disabled = true;
}

function hideLoading(buttonId) {
    const button = document.querySelector(`#${buttonId} .tool-button, #${buttonId} .calculator-button`);
    const buttonText = button.querySelector('.button-text');
    const buttonLoader = button.querySelector('.button-loader');
    
    buttonText.classList.remove('hidden');
    buttonLoader.classList.add('hidden');
    button.disabled = false;
}

function showResult(resultId, content) {
    const resultElement = document.getElementById(resultId);
    const outputElement = document.getElementById(resultId.replace('-result', '-output'));
    
    if (outputElement) {
        outputElement.innerHTML = content;
    }
    
    resultElement.classList.add('show');
    resultElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    const text = element.textContent || element.innerText;
    
    navigator.clipboard.writeText(text).then(() => {
        // Show copy feedback
        const copyButton = element.parentElement.querySelector('.copy-button');
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = '<span class="copy-icon">✅</span> Copied!';
        
        setTimeout(() => {
            copyButton.innerHTML = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}

// ===== AI CONTENT GENERATION =====
async function callGeminiAPI(prompt) {
    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Gemini API error:', error);
        return null;
    }
}

function getFallbackResponse(tool, category, topic = '') {
    const responses = FALLBACK_RESPONSES[tool][category];
    if (Array.isArray(responses)) {
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        return randomResponse.replace(/\[topic\]/gi, topic || 'your topic');
    }
    return responses.replace(/\[topic\]/gi, topic || 'your topic');
}

// ===== INSTAGRAM CAPTION GENERATOR =====
async function handleInstagramGeneration(e) {
    e.preventDefault();
    
    const formId = 'instagram-form';
    const topic = document.getElementById('instagram-topic').value;
    const tone = document.getElementById('instagram-tone').value;
    
    showLoading(formId);
    
    const prompt = `Create an engaging Instagram caption about "${topic}" with a ${tone} tone. Include relevant emojis and hashtags. Make it authentic and engaging for social media.`;
    
    try {
        const result = await callGeminiAPI(prompt);
        const content = result || getFallbackResponse('instagram', tone, topic);
        showResult('instagram-result', content);
    } catch (error) {
        const fallbackContent = getFallbackResponse('instagram', tone, topic);
        showResult('instagram-result', fallbackContent);
    }
    
    hideLoading(formId);
}

// ===== YOUTUBE TITLE GENERATOR =====
async function handleYouTubeGeneration(e) {
    e.preventDefault();
    
    const formId = 'youtube-form';
    const topic = document.getElementById('youtube-topic').value;
    const style = document.getElementById('youtube-style').value;
    
    showLoading(formId);
    
    const prompt = `Generate 5 compelling YouTube video titles about "${topic}" in the ${style} style. Make them click-worthy, SEO-friendly, and engaging. Each title should be on a new line.`;
    
    try {
        const result = await callGeminiAPI(prompt);
        const content = result || getFallbackResponse('youtube', style).map(title => 
            title.replace(/\[Topic\]/g, topic)
        ).join('\n\n');
        showResult('youtube-result', content);
    } catch (error) {
        const fallbackContent = getFallbackResponse('youtube', style).map(title => 
            title.replace(/\[Topic\]/g, topic)
        ).join('\n\n');
        showResult('youtube-result', fallbackContent);
    }
    
    hideLoading(formId);
}

// ===== BLOG POST OUTLINE GENERATOR =====
async function handleBlogGeneration(e) {
    e.preventDefault();
    
    const formId = 'blog-form';
    const topic = document.getElementById('blog-topic').value;
    const audience = document.getElementById('blog-audience').value;
    
    showLoading(formId);
    
    const prompt = `Create a comprehensive blog post outline about "${topic}" for ${audience}. Include an introduction, main sections with subsections, and a conclusion. Make it detailed and well-structured.`;
    
    try {
        const result = await callGeminiAPI(prompt);
        const content = result || getFallbackResponse('blog', audience).replace(/\[topic\]/gi, topic);
        showResult('blog-result', content);
    } catch (error) {
        const fallbackContent = getFallbackResponse('blog', audience).replace(/\[topic\]/gi, topic);
        showResult('blog-result', fallbackContent);
    }
    
    hideLoading(formId);
}

// ===== TWEET GENERATOR =====
async function handleTweetGeneration(e) {
    e.preventDefault();
    
    const formId = 'tweet-form';
    const topic = document.getElementById('tweet-topic').value;
    const style = document.getElementById('tweet-style').value;
    
    showLoading(formId);
    
    const prompt = `Generate 3 engaging tweets about "${topic}" in ${style} style. Each tweet should be under 280 characters, include relevant hashtags, and be optimized for engagement. Separate each tweet with a line break.`;
    
    try {
        const result = await callGeminiAPI(prompt);
        const content = result || getFallbackResponse('tweet', style).map(tweet => 
            tweet.replace(/\[topic\]/gi, topic)
        ).join('\n\n');
        showResult('tweet-result', content);
    } catch (error) {
        const fallbackContent = getFallbackResponse('tweet', style).map(tweet => 
            tweet.replace(/\[topic\]/gi, topic)
        ).join('\n\n');
        showResult('tweet-result', fallbackContent);
    }
    
    hideLoading(formId);
}

// ===== JOB QUIT CALCULATOR =====
function handleJobQuitCalculation(e) {
    e.preventDefault();
    
    const jobSatisfaction = parseInt(document.getElementById('job-satisfaction').value);
    const workLifeBalance = parseInt(document.getElementById('work-life-balance').value);
    const salarySatisfaction = parseInt(document.getElementById('salary-satisfaction').value);
    const careerGrowth = parseInt(document.getElementById('career-growth').value);
    const emergencyFund = parseInt(document.getElementById('emergency-fund').value);
    
    // Calculate risk score (0-100)
    const satisfactionScore = (jobSatisfaction + workLifeBalance + salarySatisfaction + careerGrowth) / 4;
    const financialSecurity = Math.min(emergencyFund / 6, 1) * 10; // Max 10 points for 6+ months
    const riskScore = Math.round(100 - ((satisfactionScore + financialSecurity) / 2 * 10));
    
    // Generate recommendation
    let recommendation = '';
    let factors = '';
    
    if (riskScore <= 30) {
        recommendation = '🟢 <strong>Low Risk</strong> - Your current situation seems stable. Consider staying and working on specific improvements.';
        factors = '• High job satisfaction and financial security<br>• Focus on optimizing your current role<br>• Consider discussing concerns with your manager';
    } else if (riskScore <= 60) {
        recommendation = '🟡 <strong>Medium Risk</strong> - Mixed signals. Carefully plan your next move and consider all options.';
        factors = '• Some areas of concern that need attention<br>• Start building your emergency fund<br>• Explore internal opportunities first<br>• Begin networking and skill development';
    } else {
        recommendation = '🔴 <strong>High Risk</strong> - Multiple red flags detected. Seriously consider making a change, but plan carefully.';
        factors = '• Significant dissatisfaction in key areas<br>• Prioritize building financial security<br>• Start job searching immediately<br>• Consider professional counseling or career coaching';
    }
    
    // Display results
    document.getElementById('job-quit-score').textContent = riskScore;
    document.getElementById('job-quit-recommendation').innerHTML = recommendation;
    document.getElementById('job-quit-factors').innerHTML = factors;
    
    showResult('job-quit-result', '');
}

// ===== FREELANCE RATE CALCULATOR =====
function handleFreelanceRateCalculation(e) {
    e.preventDefault();
    
    const desiredSalary = parseFloat(document.getElementById('desired-salary').value);
    const workingHours = parseFloat(document.getElementById('working-hours').value);
    const vacationWeeks = parseFloat(document.getElementById('vacation-weeks').value);
    const businessExpenses = parseFloat(document.getElementById('business-expenses').value);
    const taxRate = parseFloat(document.getElementById('tax-rate').value) / 100;
    
    // Calculate working weeks and hours
    const workingWeeks = 52 - vacationWeeks;
    const totalWorkingHours = workingWeeks * workingHours;
    
    // Calculate rates
    const grossRequired = desiredSalary + businessExpenses;
    const preeTaxRequired = grossRequired / (1 - taxRate);
    const minHourlyRate = Math.round(preeTaxRequired / totalWorkingHours);
    const recommendedRate = Math.round(minHourlyRate * 1.25); // 25% buffer
    const premiumRate = Math.round(minHourlyRate * 1.5); // 50% premium
    
    // Display results
    document.getElementById('min-hourly-rate').textContent = `₹${minHourlyRate}`;
    document.getElementById('recommended-rate').textContent = `₹${recommendedRate}`;
    document.getElementById('premium-rate').textContent = `₹${premiumRate}`;
    
    const details = `
        <div class="rate-details-grid">
            <div class="detail-item">
                <span class="detail-label">Working Hours/Year:</span>
                <span class="detail-value">${totalWorkingHours} hours</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Pre-tax Income Needed:</span>
                <span class="detail-value">₹${preeTaxRequired.toLocaleString()}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Business Expenses:</span>
                <span class="detail-value">₹${businessExpenses.toLocaleString()}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Tax Rate:</span>
                <span class="detail-value">${(taxRate * 100)}%</span>
            </div>
        </div>
        <div class="rate-tips">
            <h5>💡 Pricing Tips:</h5>
            <ul>
                <li>Start with the recommended rate for most clients</li>
                <li>Use premium rate for rush jobs or specialized work</li>
                <li>Never go below minimum rate - it doesn't cover your costs</li>
                <li>Review and adjust rates quarterly</li>
            </ul>
        </div>
    `;
    
    document.getElementById('rate-details').innerHTML = details;
    showResult('freelance-rate-result', '');
}

// ===== COST OF LIVING COMPARISON =====
function handleCostLivingComparison(e) {
    e.preventDefault();
    
    const currentCity = document.getElementById('current-city').value;
    const targetCity = document.getElementById('target-city').value;
    const currentSalary = parseFloat(document.getElementById('current-salary').value);
    
    const currentCityData = CITY_DATA[currentCity];
    const targetCityData = CITY_DATA[targetCity];
    
    // Calculate total living costs
    const currentTotalCost = Object.values(currentCityData).slice(1).reduce((sum, cost) => sum + cost, 0);
    const targetTotalCost = Object.values(targetCityData).slice(1).reduce((sum, cost) => sum + cost, 0);
    
    // Calculate cost difference percentage
    const costDifference = ((targetTotalCost - currentTotalCost) / currentTotalCost * 100).toFixed(1);
    
    // Calculate equivalent salary
    const equivalentSalary = Math.round(currentSalary * (targetTotalCost / currentTotalCost));
    
    // Display summary
    document.getElementById('cost-difference').textContent = `${costDifference > 0 ? '+' : ''}${costDifference}%`;
    document.getElementById('cost-difference').style.color = costDifference > 0 ? '#fa709a' : '#43e97b';
    document.getElementById('equivalent-salary').textContent = `₹${equivalentSalary.toLocaleString()}`;
    
    // Create detailed breakdown
    const breakdown = `
        <div class="cost-comparison-table">
            <div class="comparison-header">
                <div class="city-column">
                    <h5>${currentCityData.name}</h5>
                    <span class="city-label">Current</span>
                </div>
                <div class="category-column">Category</div>
                <div class="city-column">
                    <h5>${targetCityData.name}</h5>
                    <span class="city-label">Target</span>
                </div>
            </div>
            
            <div class="comparison-row">
                <div class="cost-value">₹${currentCityData.rent.toLocaleString()}</div>
                <div class="cost-category">Rent</div>
                <div class="cost-value">₹${targetCityData.rent.toLocaleString()}</div>
            </div>
            
            <div class="comparison-row">
                <div class="cost-value">₹${currentCityData.food.toLocaleString()}</div>
                <div class="cost-category">Food</div>
                <div class="cost-value">₹${targetCityData.food.toLocaleString()}</div>
            </div>
            
            <div class="comparison-row">
                <div class="cost-value">₹${currentCityData.transport.toLocaleString()}</div>
                <div class="cost-category">Transport</div>
                <div class="cost-value">₹${targetCityData.transport.toLocaleString()}</div>
            </div>
            
            <div class="comparison-row">
                <div class="cost-value">₹${currentCityData.utilities.toLocaleString()}</div>
                <div class="cost-category">Utilities</div>
                <div class="cost-value">₹${targetCityData.utilities.toLocaleString()}</div>
            </div>
            
            <div class="comparison-row">
                <div class="cost-value">₹${currentCityData.entertainment.toLocaleString()}</div>
                <div class="cost-category">Entertainment</div>
                <div class="cost-value">₹${targetCityData.entertainment.toLocaleString()}</div>
            </div>
            
            <div class="comparison-row">
                <div class="cost-value">₹${currentCityData.miscellaneous.toLocaleString()}</div>
                <div class="cost-category">Miscellaneous</div>
                <div class="cost-value">₹${targetCityData.miscellaneous.toLocaleString()}</div>
            </div>
            
            <div class="comparison-total">
                <div class="total-value">₹${currentTotalCost.toLocaleString()}</div>
                <div class="total-label">Total Monthly</div>
                <div class="total-value">₹${targetTotalCost.toLocaleString()}</div>
            </div>
        </div>
        
        <div class="comparison-insights">
            <h5>💡 Key Insights:</h5>
            <ul>
                <li>${costDifference > 0 ? `Moving to ${targetCityData.name} will cost ${costDifference}% more` : `Moving to ${targetCityData.name} will save ${Math.abs(costDifference)}%`}</li>
                <li>You'll need ₹${equivalentSalary.toLocaleString()} to maintain the same lifestyle</li>
                <li>Biggest cost difference: ${getBiggestDifference(currentCityData, targetCityData)}</li>
                <li>${getRecommendation(costDifference, currentSalary, equivalentSalary)}</li>
            </ul>
        </div>
    `;
    
    document.getElementById('cost-breakdown').innerHTML = breakdown;
    showResult('cost-living-result', '');
}

function getBiggestDifference(currentCity, targetCity) {
    const categories = ['rent', 'food', 'transport', 'utilities', 'entertainment', 'miscellaneous'];
    let maxDiff = 0;
    let maxCategory = '';
    
    categories.forEach(category => {
        const diff = Math.abs(targetCity[category] - currentCity[category]);
        if (diff > maxDiff) {
            maxDiff = diff;
            maxCategory = category;
        }
    });
    
    return `${maxCategory} (₹${maxDiff.toLocaleString()} difference)`;
}

function getRecommendation(costDifference, currentSalary, equivalentSalary) {
    const salaryIncrease = equivalentSalary - currentSalary;
    
    if (costDifference > 20) {
        return `Consider negotiating a ₹${salaryIncrease.toLocaleString()} salary increase before moving`;
    } else if (costDifference < -10) {
        return `Great opportunity to save money while maintaining lifestyle`;
    } else {
        return `Cost difference is manageable with proper budgeting`;
    }
}

// ===== ADDITIONAL STYLES FOR DYNAMIC CONTENT =====
const additionalStyles = `
<style>
.rate-details-grid {
    display: grid;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.detail-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem;
    background: var(--glass-bg);
    border-radius: var(--radius-sm);
    border: 1px solid var(--glass-border);
}

.detail-label {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
}

.detail-value {
    color: var(--text-primary);
    font-weight: 600;
}

.rate-tips {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--glass-bg);
    border-radius: var(--radius-md);
    border: 1px solid var(--glass-border);
}

.rate-tips h5 {
    color: var(--text-primary);
    margin-bottom: 0.5rem;
}

.rate-tips ul {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.6;
}

.rate-tips li {
    margin-bottom: 0.25rem;
}

.cost-comparison-table {
    background: var(--glass-bg);
    border-radius: var(--radius-lg);
    border: 1px solid var(--glass-border);
    overflow: hidden;
    margin-bottom: 1rem;
}

.comparison-header {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    background: var(--primary-gradient);
    padding: 1rem;
    color: var(--text-primary);
    font-weight: 600;
}

.city-column {
    text-align: center;
}

.category-column {
    text-align: center;
}

.city-label {
    font-size: var(--font-size-xs);
    opacity: 0.8;
}

.comparison-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--glass-border);
}

.comparison-row:last-child {
    border-bottom: none;
}

.cost-value {
    text-align: center;
    color: var(--text-primary);
    font-weight: 600;
}

.cost-category {
    text-align: center;
    color: var(--text-secondary);
}

.comparison-total {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    padding: 1rem;
    background: var(--glass-bg);
    border-top: 2px solid var(--glass-border);
}

.total-value {
    text-align: center;
    color: var(--text-primary);
    font-weight: 700;
    font-size: var(--font-size-lg);
}

.total-label {
    text-align: center;
    color: var(--text-accent);
    font-weight: 600;
}

.comparison-insights {
    padding: 1rem;
    background: var(--glass-bg);
    border-radius: var(--radius-md);
    border: 1px solid var(--glass-border);
}

.comparison-insights h5 {
    color: var(--text-primary);
    margin-bottom: 0.5rem;
}

.comparison-insights ul {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.6;
}

.comparison-insights li {
    margin-bottom: 0.25rem;
}

@media (max-width: 768px) {
    .comparison-header,
    .comparison-row,
    .comparison-total {
        grid-template-columns: 1fr;
        gap: 0.5rem;
    }
    
    .cost-category {
        order: -1;
        background: var(--tertiary-bg);
        padding: 0.5rem;
        border-radius: var(--radius-sm);
        font-weight: 600;
    }
}
</style>
`;

// Inject additional styles
document.head.insertAdjacentHTML('beforeend', additionalStyles);

// ===== PERFORMANCE MONITORING =====
window.addEventListener('load', function() {
    // Log performance metrics
    const perfData = performance.getEntriesByType('navigation')[0];
    console.log('ToolVerse Performance Metrics:', {
        loadTime: Math.round(perfData.loadEventEnd - perfData.loadEventStart),
        domContentLoaded: Math.round(perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart),
        totalTime: Math.round(perfData.loadEventEnd - perfData.fetchStart)
    });
});

// ===== ERROR HANDLING =====
window.addEventListener('error', function(e) {
    console.error('ToolVerse Error:', e.error);
    // Could implement user-friendly error reporting here
});

// ===== EXPORT FOR TESTING =====
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CITY_DATA,
        FALLBACK_RESPONSES,
        getFallbackResponse,
        getBiggestDifference,
        getRecommendation
    };
}

