const loginForm = document.getElementById("login");
const registerForm = document.getElementById("register");
const showRegisterLink = document.getElementById("show-register");
const showLoginLink = document.getElementById("show-login");
const loginSection = document.getElementById("login-form");
const registerSection = document.getElementById("register-form");

// Switch to Register Form
showRegisterLink.addEventListener("click", (e) => {
  e.preventDefault();
  switchToRegisterForm();
});

// Switch to Login Form
showLoginLink.addEventListener("click", (e) => {
  e.preventDefault();
  switchToLoginForm();
});

// Login Form Submission
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  try {
    const response = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const result = await response.json();
    if (result.status === 'SUCCESS') {
      alert(result.message);
      window.location.href = result.url; // Redirect to the provided URL
    } else {
      alert(result.message);
    }
  } catch (error) {
    console.error('Error during login:', error);
    alert('An error occurred. Please try again.');
  }
});

// Register Form Submission
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("register-username").value;
  const displayName = document.getElementById("register-displayname").value;
  const password = document.getElementById("register-password").value;

  try {
    const response = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, displayName, password }),
    });

    const result = await response.json();
    if (result.status === 'SUCCESS') {
      alert(result.message);
      window.location.href = result.url; // Redirect to the provided URL
    } else {
      alert(result.message);
    }
  } catch (error) {
    console.error('Error during registration:', error);
    alert('An error occurred. Please try again.');
  }
});

// Forgot Password Button
document.getElementById("forgot-password").addEventListener("click", (e) => {
  e.preventDefault();
  alert("Please contact support to reset your password.");
});

// Helper function to switch to the login form
function switchToLoginForm() {
  registerSection.classList.add("hidden");
  loginSection.classList.remove("hidden");
}

// Helper function to switch to the register form
function switchToRegisterForm() {
  loginSection.classList.add("hidden");
  registerSection.classList.remove("hidden");
}