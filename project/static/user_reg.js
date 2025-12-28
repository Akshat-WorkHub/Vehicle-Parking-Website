document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('userDetailsForm');
    const messageEl = document.getElementById('form-message');

    form.addEventListener('submit', async (event) => {
        // Prevent the default form submission (which reloads the page)
        event.preventDefault();

        // Clear previous messages
        messageEl.textContent = '';
        messageEl.style.color = 'red';

        // 1. Get form data
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // 2. Client-side validation
        if (password !== confirmPassword) {
            messageEl.textContent = 'Passwords do not match!';
            return;
        }

        if (password.length < 8) {
            messageEl.textContent = 'Password must be at least 8 characters long.';
            return;
        }

        // Get all form data as a FormData object
        const formData = new FormData(form);
        // Convert FormData to a plain JavaScript object
        const data = Object.fromEntries(formData.entries());

        // We don't need to send the confirmation password
        delete data.confirmPwd; 

        // 3. Send data to the server
        try {
            const response = await fetch('/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (response.ok) {
                // Success!
                messageEl.textContent = result.message;
                messageEl.style.color = 'green';
                form.reset(); // Clear the form
            } else {
                // Error from server (e.g., "Username taken")
                messageEl.textContent = `Error: ${result.error}`;
            }

        } catch (error) {
            console.error('Registration failed:', error);
            messageEl.textContent = 'Registration failed. Please try again later.';
        }
    });
});
