const fetch = require('node-fetch');

async function testRegister() {
    try {
        const response = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'Test123!',
                name: 'Test User'
            })
        });

        const data = await response.json();
        console.log('Response status:', response.status);
        console.log('Response data:', data);
    } catch (error) {
        console.error('Error:', error);
    }
}

async function testLogin() {
    try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'demo@synthex.com',
                password: 'demo123!'
            })
        });

        const data = await response.json();
        console.log('Login Response status:', response.status);
        console.log('Login Response data:', data);
    } catch (error) {
        console.error('Login Error:', error);
    }
}

console.log('Testing registration...');
testRegister().then(() => {
    console.log('\nTesting login...');
    return testLogin();
});