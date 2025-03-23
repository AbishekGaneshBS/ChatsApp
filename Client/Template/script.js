const loginForm = document.getElementById("login");
const registerForm = document.getElementById("register");
const showRegisterLink = document.getElementById("show-register");
const showLoginLink = document.getElementById("show-login");
const loginSection = document.getElementById("login-form");
const registerSection = document.getElementById("register-form");

showRegisterLink.addEventListener("click", () => {
  loginSection.classList.add("hidden");
  registerSection.classList.remove("hidden");
});

showLoginLink.addEventListener("click", () => {
  registerSection.classList.add("hidden");
  loginSection.classList.remove("hidden");
});


loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;


  if (yourLoginLogic(username, password)) {
    alert("Login successful!");

  } else {
    alert("Wrong username or password.");
  }
});


registerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = document.getElementById("register-username").value;
  const displayName = document.getElementById("register-displayname").value;
  const password = document.getElementById("register-password").value;


  if (yourUsernameCheckLogic(username)) {
    alert("Username is already taken.");
  } else {
    // Replace this with your own logic for registering the user
    // Example: Call an API or save to a database
    yourRegisterLogic(username, displayName, password);
    alert("Registration successful! Please login.");
    loginSection.classList.remove("hidden");
    registerSection.classList.add("hidden");
  }
});

// Forgot Password Button
document.getElementById("forgot-password").addEventListener("click", () => {
  alert("Please contact support to reset your password.");
});

// Placeholder functions for your logic
function yourLoginLogic(username, password) {
  // Replace this with your actual login logic
  // Example: Call an API or check against a database
  return false; // Return true if login is successful, false otherwise
}

function yourUsernameCheckLogic(username) {
  // Replace this with your actual logic to check if the username is taken
  // Example: Call an API or check against a database
  return false; // Return true if the username is taken, false otherwise
}

function yourRegisterLogic(username, displayName, password) {
  // Replace this with your actual logic to register the user
  // Example: Call an API or save to a database
  console.log("User registered:", { username, displayName, password });
}