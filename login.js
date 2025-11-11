// EmailJS initialization
(function() {
    emailjs.init("qHgQxYjQRiSUT8PG1");
})();

// API Base URL
const API_BASE_URL = 'http://localhost:3000/api';

// Constants
const ADMIN_REDIRECT = 'admin_dashboard.html';
const USER_REDIRECT = 'index.html';

// ----- DOM Elements -----
const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('container');

// Signup form elements
const signupForm = document.getElementById('signupForm');
const signupPasswordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const mismatchMessage = document.getElementById('mismatch-message');
const matchMessage = document.getElementById('match-message');
const passwordStrengthError = document.getElementById('password-strength-error');
const signupTermsCheckbox = document.getElementById('signupTermsCheckbox');
const signupSubmitButton = document.getElementById('signupButton');

// Signin form elements
const signinForm = document.getElementById('signinForm');
const signinTermsCheckbox = document.getElementById('signinTermsCheckbox');
const signinSubmitButton = document.getElementById('signinButton');

// Modal elements
const signupTermsLink = document.getElementById('signupTermsLink');
const signupPrivacyLink = document.getElementById('signupPrivacyLink');
const signinTermsLink = document.getElementById('signinTermsLink');
const signinPrivacyLink = document.getElementById('signinPrivacyLink');
const termsModal = document.getElementById('termsModal');
const privacyModal = document.getElementById('privacyModal');
const closeTerms = document.getElementById('closeTerms');
const closePrivacy = document.getElementById('closePrivacy');

// ----- UI Panel Toggle -----
if (signUpButton && signInButton) {
    signUpButton.addEventListener('click', () => {
        container.classList.add('right-panel-active');
        resetFormMessages();
    });

    signInButton.addEventListener('click', () => {
        container.classList.remove('right-panel-active');
        resetFormMessages();
    });
}

function resetFormMessages() {
    const messages = [mismatchMessage, matchMessage, passwordStrengthError];
    messages.forEach(el => {
        if (el) el.style.display = 'none';
    });

    document.querySelectorAll('.error-message').forEach(el => {
        if (el) {
            el.style.display = 'none';
            el.textContent = 'Please fill out this field.';
        }
    });
}

// ----- Password Validation -----
function validatePasswordStrength(password) {
    if (!password) return false;
    
    const hasMinLength = password.length >= 8;
    const hasNumber = /\d/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const isValid = hasMinLength && hasNumber && hasUpperCase && hasSymbol;

    if (passwordStrengthError) {
        passwordStrengthError.style.display = isValid ? 'none' : 'inline-block';
    }
    return isValid;
}

function validatePasswordMatch() {
    if (!signupPasswordInput || !confirmPasswordInput) return false;

    const password = signupPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    if (!password || !confirmPassword) return false;

    const isMatch = password === confirmPassword;

    if (mismatchMessage) {
        mismatchMessage.style.display = isMatch ? 'none' : 'inline-block';
    }
    if (matchMessage) {
        matchMessage.style.display = isMatch && confirmPassword ? 'inline-block' : 'none';
    }
    return isMatch;
}

function validateFormInputs(form) {
    if (!form) return false;

    let isValid = true;
    form.querySelectorAll('input[required]').forEach(input => {
        const errorElement = document.getElementById(`${input.id}-error`);
        if (errorElement) {
            if (!input.value.trim()) {
                errorElement.style.display = 'inline-block';
                isValid = false;
            } else {
                errorElement.style.display = 'none';
            }
        }
    });
    return isValid;
}

// ----- Email Validation -----
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ----- Update Button States -----
function updateSigninButtonState() {
    if (signinSubmitButton && signinTermsCheckbox) {
        signinSubmitButton.disabled = !signinTermsCheckbox.checked;
    }
}

function updateSignupButtonState() {
    if (signupSubmitButton && signupTermsCheckbox) {
        const isFormValid = validateFormInputs(signupForm) && 
                           validatePasswordStrength(signupPasswordInput?.value) && 
                           validatePasswordMatch();
        signupSubmitButton.disabled = !signupTermsCheckbox.checked || !isFormValid;
    }
}

// ----- Send Welcome Email -----
async function sendWelcomeEmail(userEmail, userName) {
    try {
        const templateParams = {
            to_email: userEmail,
            to_name: userName,
            from_name: 'Lost & Found Hub Team',
            message: `Welcome to Lost & Found Hub, ${userName}! We're excited to have you on board. Start exploring our platform to reunite people with their lost belongings.`,
            subject: 'Welcome to Lost & Found Hub!'
        };

        await emailjs.send('service_jcln1zo', 'template_vmaohn1', templateParams);
        console.log('Welcome email sent successfully');
        return true;
    } catch (error) {
        console.error('Failed to send welcome email:', error);
        return false;
    }
}

// ----- SIGNUP -----
if (signupForm) {
    signupForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const username = document.getElementById('username')?.value.trim();
        const email = document.getElementById('email')?.value.trim().toLowerCase();
        const password = signupPasswordInput?.value;

        // Validate all fields
        if (!validateFormInputs(signupForm) ||
            !validatePasswordStrength(password) ||
            !validatePasswordMatch() ||
            !validateEmail(email) ||
            !signupTermsCheckbox.checked) {
            return;
        }

        // Show loading state
        const originalText = signupSubmitButton.textContent;
        signupSubmitButton.textContent = 'Creating Account...';
        signupSubmitButton.disabled = true;

        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    email: email,
                    password: password
                })
            });

            const result = await response.json();

            if (result.success) {
                // Send welcome email
                const emailSent = await sendWelcomeEmail(email, username);
                
                if (emailSent) {
                    alert('Account created successfully!');
                } else {
                    alert('Account created successfully! Welcome email failed to send.');
                }
                
                // Reset form and switch to signin
                signupForm.reset();
                container.classList.remove('right-panel-active');
                resetFormMessages();
            } else {
                // Show specific error messages
                if (result.message.includes('email') || result.message.includes('Email')) {
                    const emailError = document.getElementById('email-error');
                    if (emailError) {
                        emailError.textContent = result.message;
                        emailError.style.display = 'inline-block';
                    }
                } else if (result.message.includes('username') || result.message.includes('Username')) {
                    const usernameError = document.getElementById('username-error');
                    if (usernameError) {
                        usernameError.textContent = result.message;
                        usernameError.style.display = 'inline-block';
                    }
                } else {
                    alert('Sign Up failed: ' + result.message);
                }
            }
        } catch (err) {
            console.error('Signup Error:', err);
            alert('Network error: Unable to connect to server. Please try again.');
        } finally {
            // Reset button state
            signupSubmitButton.textContent = originalText;
            signupSubmitButton.disabled = !signupTermsCheckbox.checked;
        }
    });
}

// ----- SIGNIN -----
if (signinForm) {
    signinForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        
        if (!validateFormInputs(signinForm)) return;

        const email = document.getElementById('signinEmail').value.trim().toLowerCase();
        const password = document.getElementById('signinPassword').value;

        // Show loading state
        const originalText = signinSubmitButton.textContent;
        signinSubmitButton.textContent = 'Signing In...';
        signinSubmitButton.disabled = true;

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            let result;
            try {
                result = await response.json();
            } catch {
                throw new Error('Server returned invalid response. Please try again.');
            }

            if (result.success) {
                // Store user data
                localStorage.setItem('authToken', result.token);
                localStorage.setItem('userName', result.user?.username || result.user?.name || 'User');
                localStorage.setItem('userEmail', result.user?.email || '');
                localStorage.setItem('userPhoto', result.user?.photo || result.user?.picture || '');
                localStorage.setItem('userRole', result.user?.role || 'user');

                // Redirect based on role
                if (result.user?.role === "admin") {
                    window.location.href = ADMIN_REDIRECT;
                } else {
                    window.location.href = USER_REDIRECT;
                }
            } else {
                const errorElement = document.getElementById('signinPassword-error');
                if (errorElement) {
                    errorElement.textContent = result.message || 'Invalid email or password';
                    errorElement.style.display = 'inline-block';
                }
            }
        } catch (err) {
            console.error('Signin Error:', err);
            alert('Sign in error: ' + err.message);
        } finally {
            // Reset button state
            signinSubmitButton.textContent = originalText;
            signinSubmitButton.disabled = !signinTermsCheckbox.checked;
        }
    });
}

// ----- PASSWORD INPUT EVENTS -----
if (signupPasswordInput && confirmPasswordInput) {
    signupPasswordInput.addEventListener('input', () => {
        validatePasswordStrength(signupPasswordInput.value);
        validatePasswordMatch();
        updateSignupButtonState();
    });
    
    confirmPasswordInput.addEventListener('input', () => {
        validatePasswordMatch();
        updateSignupButtonState();
    });
}

// ----- INPUT VALIDATION EVENTS -----
if (signupForm) {
    signupForm.querySelectorAll('input[required]').forEach(input => {
        input.addEventListener('blur', () => {
            validateFormInputs(signupForm);
            updateSignupButtonState();
        });
    });
}

if (signinForm) {
    signinForm.querySelectorAll('input[required]').forEach(input => {
        input.addEventListener('blur', () => {
            validateFormInputs(signinForm);
        });
    });
}

// ----- TERMS CHECKBOX EVENTS -----
if (signinTermsCheckbox) {
    signinTermsCheckbox.addEventListener('change', updateSigninButtonState);
}
if (signupTermsCheckbox) {
    signupTermsCheckbox.addEventListener('change', updateSignupButtonState);
}

// ----- MODAL CONTROLS -----
if (signupTermsLink) {
    signupTermsLink.addEventListener('click', function (e) {
        e.preventDefault();
        if (termsModal) termsModal.style.display = 'flex';
    });
}

if (signupPrivacyLink) {
    signupPrivacyLink.addEventListener('click', function (e) {
        e.preventDefault();
        if (privacyModal) privacyModal.style.display = 'flex';
    });
}

if (signinTermsLink) {
    signinTermsLink.addEventListener('click', function (e) {
        e.preventDefault();
        if (termsModal) termsModal.style.display = 'flex';
    });
}

if (signinPrivacyLink) {
    signinPrivacyLink.addEventListener('click', function (e) {
        e.preventDefault();
        if (privacyModal) privacyModal.style.display = 'flex';
    });
}

if (closeTerms) {
    closeTerms.addEventListener('click', function () {
        if (termsModal) termsModal.style.display = 'none';
    });
}
if (closePrivacy) {
    closePrivacy.addEventListener('click', function () {
        if (privacyModal) privacyModal.style.display = 'none';
    });
}

window.addEventListener('click', function (e) {
    if (e.target === termsModal) {
        termsModal.style.display = 'none';
    }
    if (e.target === privacyModal) {
        privacyModal.style.display = 'none';
    }
});

// ----- GOOGLE LOGIN -----
function handleCredentialResponse(response) {
    // Show loading state
    const googleButtons = document.querySelectorAll('[id*="g_id"]');
    googleButtons.forEach(btn => {
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
    });

    fetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: response.credential })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userName', data.user.username || data.user.name);
            localStorage.setItem('userEmail', data.user.email);
            localStorage.setItem('userPhoto', data.user.photo || data.user.picture || '');
            localStorage.setItem('userRole', data.user?.role || 'user');
            
            alert('Welcome to Lost & Found Hub!');
            
            // Redirect based on role
            if (data.user?.role === "admin") {
                window.location.href = ADMIN_REDIRECT;
            } else {
                window.location.href = USER_REDIRECT;
            }
        } else {
            alert('Google Sign-In failed: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Google auth error:', error);
        alert('Error during Google sign-in. Please try again.');
    })
    .finally(() => {
        // Reset button state
        googleButtons.forEach(btn => {
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        });
    });
}

// ----- GOOGLE AUTH INITIALIZATION -----
window.onload = function () {
    if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.initialize({
            client_id: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
            callback: handleCredentialResponse
        });

        const signinBtn = document.getElementById("g_id_signin");
        const signupBtn = document.getElementById("g_id_signup");

        if (signinBtn) google.accounts.id.renderButton(signinBtn, { theme: "outline", size: "large" });
        if (signupBtn) google.accounts.id.renderButton(signupBtn, { theme: "outline", size: "large" });
    }

    updateSigninButtonState();
    updateSignupButtonState();
};

// ----- ENTER KEY SUPPORT -----
document.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        const activeForm = container.classList.contains('right-panel-active') ? signupForm : signinForm;
        if (activeForm) {
            const submitButton = activeForm.querySelector('button[type="submit"]');
            if (submitButton && !submitButton.disabled) {
                submitButton.click();
            }
        }
    }
});


        // Initialize EmailJS when the page loads
        document.addEventListener('DOMContentLoaded', function() {
            // Initialize EmailJS with your public key
            // Replace 'YOUR_PUBLIC_KEY' with your actual EmailJS public key
            emailjs.init("qHgQxYjQRiSUT8PG1");
            console.log("EmailJS initialized");
            
            const signupForm = document.getElementById('signupForm');
            
            signupForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                // Get form values
                const username = document.getElementById('username').value;
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                
                // Hide any previous email status messages
                hideAllEmailMessages();
                
                try {
                    // Show sending message
                    document.getElementById('emailSendingMessage').style.display = 'block';
                    
                    // First, store user in database (your existing functionality)
                    console.log('Storing user in database:', { username, email, password });
                    // Your database storage code here...
                    
                    // Then send welcome email
                    await sendWelcomeEmail(email, username);
                    
                    // Show success message
                    document.getElementById('emailSendingMessage').style.display = 'none';
                    document.getElementById('emailSuccessMessage').style.display = 'block';
                    
                    // Reset form
                    signupForm.reset();
                    
                    // Optionally switch to sign in after successful signup
                    setTimeout(function() {
                        document.getElementById('container').classList.remove('right-panel-active');
                        // Hide success message
                        document.getElementById('emailSuccessMessage').style.display = 'none';
                    }, 5000);
                    
                } catch (error) {
                    console.error('Error during signup:', error);
                    document.getElementById('emailSendingMessage').style.display = 'none';
                    document.getElementById('emailErrorMessage').style.display = 'block';
                    
                    // Hide error message after 5 seconds
                    setTimeout(function() {
                        document.getElementById('emailErrorMessage').style.display = 'none';
                    }, 5000);
                }
            });
            
            // Function to hide all email status messages
            function hideAllEmailMessages() {
                document.getElementById('emailSendingMessage').style.display = 'none';
                document.getElementById('emailSuccessMessage').style.display = 'none';
                document.getElementById('emailErrorMessage').style.display = 'none';
            }
            
            // Function to send welcome email using EmailJS
            async function sendWelcomeEmail(userEmail, userName) {
                try {
                    console.log('Attempting to send email to:', userEmail);
                    
                    // EmailJS parameters
                    const templateParams = {
                        to_email: userEmail,
                        to_name: userName,
                        from_name: "Lost & Found Hub Team",
                        message: `Welcome to Lost & Found Hub, ${userName}! We're excited to have you on board. Start exploring and help reunite people with their lost belongings.`,
                        reply_to: "noreply@lostfoundhub.com"
                    };
                    
                    // Send email using EmailJS
                    // Replace 'YOUR_SERVICE_ID' and 'YOUR_TEMPLATE_ID' with your actual IDs
                    const response = await emailjs.send(
                        'service_jcln1zo', 
                        'template_vmaohn1', 
                        templateParams
                    );
                    
                    console.log('Email sent successfully!', response);
                    return response;
                    
                } catch (error) {
                    console.error('Email sending failed:', error);
                    throw new Error(`Email sending failed: ${error.text || error.message}`);
                }
            }
        });
