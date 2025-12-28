document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('userLoginForm');
    // Ensure the ID here matches the ID of the <p> tag used for messages in user_login.html
    const messageEl = document.getElementById('form-message'); 

    // Check if the form and message elements exist
    if (!loginForm) {
        console.error("Login form with ID 'userLoginForm' not found!");
        return; // Stop if the form isn't found
    }
     if (!messageEl) {
         console.warn("Message element with ID 'login-message' not found.");
         // We can continue without the message element, but it's good to know
     }

    loginForm.addEventListener('submit', async (event) => {
        // Prevent the default form submission (which reloads the page)
        event.preventDefault();

        // Clear previous messages
        if (messageEl) {
            messageEl.textContent = '';
            messageEl.classList.remove('success', 'error'); // Remove status classes
        }

        // 1. Get form data directly from elements
        const usernameInput = document.getElementById('username'); // Assumes input has id="username"
        const passwordInput = document.getElementById('password'); // Assumes input has id="password"

        // Basic check if inputs exist
        if (!usernameInput || !passwordInput) {
            console.error("Username or password input elements not found!");
            if (messageEl) messageEl.textContent = "Form error: Input fields missing.";
            return;
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value; // Don't trim password

        // 2. Basic client-side validation
        if (!username || !password) {
            if (messageEl) messageEl.textContent = 'Please enter both email and password.';
            return;
        }

        // 3. Send data to the server
        try {
            const response = await fetch('/user-login-api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Send only username and password
                body: JSON.stringify({ username: username, password: password }), 
            });

            // Always try to parse the response as JSON
            const result = await response.json(); 

            if (response.ok) {
                // --- THIS IS THE CRITICAL FIX ---
                // Check if user_id exists in the response
                if (result.user_id) {
                    // Save the user ID to localStorage
                    localStorage.setItem('parking_user_id', result.user_id);
                    console.log('User ID saved to localStorage:', result.user_id); // Check console on LOGIN page
                } else {
                    // This should not happen if main.py is correct, but good to check
                    console.error('Login success, but no user_id received from server.'); 
                    // Optionally alert the user here too
                    alert('Login successful, but failed to store user session. Please try again.');
                     if (messageEl) { // Show error even if ID is missing
                         messageEl.textContent = 'Login successful, but session error.';
                         messageEl.classList.add('error');
                     }
                     return; // Don't redirect if ID saving failed
                }
                // --- END FIX ---
                
                if (messageEl) {
                    messageEl.textContent = result.message || 'Login successful! Redirecting...';
                    messageEl.classList.add('success');
                }
                
                // Redirect AFTER saving the ID
                // Ensure redirect_url is provided by the server
                if (result.redirect_url) {
                    window.location.href = result.redirect_url;
                } else {
                     console.error("No redirect URL received from server.");
                      if (messageEl) {
                          messageEl.textContent = 'Login successful, but redirect failed.';
                          messageEl.classList.add('error');
                      }
                      alert("Login successful, but couldn't redirect. Please navigate manually.");
                }

            } else {
                // Error from server (e.g., "Invalid email or password")
                console.error('Server returned error:', result.error);
                if (messageEl) {
                    messageEl.textContent = `Error: ${result.error || 'Invalid credentials.'}`;
                    messageEl.classList.add('error');
                }
            }

        } catch (error) {
            console.error('Login process failed:', error);
            if (messageEl) {
                messageEl.textContent = 'Login failed due to a network or server issue. Please try again later.';
                messageEl.classList.add('error');
            }
        }
    });
});

