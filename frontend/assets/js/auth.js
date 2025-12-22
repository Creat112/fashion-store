import { api } from './api.js';

// Initialize authentication
const initAuth = () => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser) updateAuthUI(currentUser);

    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const signupForm = document.getElementById('signup-form');
    if (signupForm) signupForm.addEventListener('submit', handleSignup);
};

const handleLogin = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('remember-me')?.checked;

    if (!email || !password) {
        alert('Please fill in all fields');
        return;
    }

    try {
        const user = await api.post('/auth/login', { email, password });

        if (rememberMe) {
            localStorage.setItem('currentUser', JSON.stringify(user));
        } else {
            sessionStorage.setItem('currentUser', JSON.stringify(user));
        }

        updateAuthUI(user);
        alert('Login successful!');
        setTimeout(() => window.location.href = 'index.html', 1000);
    } catch (error) {
        console.error('Login error:', error);
        alert(error.message || 'Login failed');
    }
};

const handleSignup = async (e) => {
    e.preventDefault();
    const fullname = document.getElementById('fullname').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    try {
        const user = await api.post('/auth/signup', { name: fullname, email, password });

        // Auto login after signup
        localStorage.setItem('currentUser', JSON.stringify(user));
        updateAuthUI(user);

        alert('Account created successfully!');
        setTimeout(() => window.location.href = 'index.html', 1000);
    } catch (error) {
        console.error('Signup error:', error);
        alert(error.message || 'Signup failed');
    }
};

const updateAuthUI = (user) => {
    const loginLink = document.querySelector('a[href="login.html"]');
    if (user && loginLink) {
        loginLink.textContent = `Hi, ${user.name}`;
        loginLink.href = '#';
        loginLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Logout?')) logout();
        });
    }
};

const logout = () => {
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');
    window.location.href = 'index.html';
};

export { initAuth, logout, updateAuthUI };